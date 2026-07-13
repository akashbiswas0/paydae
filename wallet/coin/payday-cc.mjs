// Real Canton Coin payday: after the custodial USD payday, move real Amulet on
// devnet from PaydaeCo to each contractor's WALLET party for their paid invoice
// amounts. The transfer instruction is created custodially (PaydaeCo is a
// participant-held party); each recipient ACCEPTS it through their wallet
// session (gateway prepare -> wallet-key sign -> interactive submission), so
// receiving money is wallet-signed too.
//
// Honesty note (also in wallet/README.md): this is a follow-on settlement
// transfer, not yet atomic with invoice consumption. Atomic settlement =
// Token Standard allocations (roadmap).
//
// Usage (from wallet/): node coin/payday-cc.mjs
//   Amounts come from each wallet party's Payment contracts (USD payday),
//   paid once: already-settled amounts are tracked in coin/settled.json.

import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SDK } from '@canton-network/wallet-sdk';

const WALLET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.join(WALLET_DIR, '..');
const envVars = {};
for (const line of readFileSync(path.join(REPO_ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && m[1] && m[2] !== undefined) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const config = JSON.parse(readFileSync(path.join(REPO_ROOT, 'config.json'), 'utf8'));
const walletParties = JSON.parse(readFileSync(path.join(WALLET_DIR, 'parties.json'), 'utf8'));

const COMPANY = config.parties.company;
const LEDGER = envVars.LEDGER_API;
const GATEWAY = 'http://localhost:3030';
const NETWORK_ID = 'canton:da-devnet';
const REGISTRY = new URL('https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator/v0/scan-proxy');
const SETTLED_FILE = path.join(WALLET_DIR, 'coin', 'settled.json');

// ---------- custodial m2m token ----------
const tokenResp = await fetch(envVars.AUTH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: envVars.CLIENT_ID,
    client_secret: envVars.CLIENT_SECRET,
    audience: envVars.CLIENT_ID,
    scope: 'daml_ledger_api',
  }),
});
const { access_token: token } = await tokenResp.json();
const auth = { method: 'static', token };
const sdk = await SDK.create({ auth, ledgerClientUrl: LEDGER, token: { auth, registries: [REGISTRY] } });
console.log('[cc-payday] sdk ready');

async function submit(commands, actAs, disclosedContracts = [], tag) {
  const resp = await fetch(`${LEDGER}/v2/commands/submit-and-wait`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ commands, commandId: `cc-payday-${tag}-${crypto.randomUUID()}`, actAs, readAs: actAs, disclosedContracts }),
  });
  const body = await resp.json();
  if (!resp.ok) throw new Error(`${tag} failed: ${resp.status} ${JSON.stringify(body).slice(0, 500)}`);
  console.log(`[cc-payday] ${tag} ok, updateId:`, body.updateId);
  return body;
}

// ---------- gateway wallet session (same scheme as probe.mjs) ----------
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
function selfSignedJwt(sub) {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({ iss: 'unsafe-auth', sub, scope: 'openid daml_ledger_api offline_access', aud: 'https://canton.network.global', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 8 * 3600 });
  const sig = createHmac('sha256', 'unsafe').update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}
const JWT6 = selfSignedJwt('6');
let rpcId = 0;
async function rpc(apiPath, method, params) {
  const resp = await fetch(`${GATEWAY}${apiPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${JWT6}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const body = await resp.json();
  if (body.error) throw new Error(`${method} RPC error: ${JSON.stringify(body.error).slice(0, 400)}`);
  return body.result;
}

/** Exercise through the wallet session: prepare -> sign -> execute. */
async function walletExercise(party, commands, disclosedContracts, tag) {
  const prep = await rpc('/api/v0/dapp', 'prepareExecute', {
    commands,
    commandId: `cc-accept-${crypto.randomUUID()}`,
    actAs: [party],
    disclosedContracts,
  });
  const transactionId = new URL(prep.userUrl).searchParams.get('transactionId');
  const signed = await rpc('/api/v0/user', 'sign', { transactionId, partyId: party });
  if (signed.status !== 'signed') throw new Error(`sign failed: ${JSON.stringify(signed)}`);
  const executed = await rpc('/api/v0/user', 'execute', {
    transactionId, partyId: party, signature: signed.signature, signedBy: signed.signedBy,
  });
  console.log(`[cc-payday] ${tag} (wallet-signed) ok, updateId:`, executed?.updateId);
  return executed;
}

// ---------- amounts from Payment contracts on each wallet party ----------
async function payments(party) {
  const hdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const { offset } = await fetch(`${LEDGER}/v2/state/ledger-end`, { headers: hdr }).then((r) => r.json());
  const acs = await fetch(`${LEDGER}/v2/state/active-contracts`, {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ filter: { filtersByParty: { [party]: {} } }, verbose: true, activeAtOffset: offset }),
  }).then((r) => r.json());
  return (acs || [])
    .map((e) => e.contractEntry?.JsActiveContract?.createdEvent)
    .filter(Boolean)
    .filter((ev) => ev.templateId.includes(':Payment'))
    .map((ev) => ({ contractId: ev.contractId, amount: Number(ev.createArgument.amount) }));
}

const balance = async (party) => {
  const utxos = await sdk.token.utxos.list({ partyId: party });
  return utxos.reduce((s, u) => s + Number(u.interfaceViewValue.amount), 0);
};

const settled = existsSync(SETTLED_FILE) ? JSON.parse(readFileSync(SETTLED_FILE, 'utf8')) : {};

for (const [persona, party] of Object.entries(walletParties)) {
  const pays = await payments(party);
  const unsettled = pays.filter((p) => !settled[p.contractId]);
  const total = unsettled.reduce((s, p) => s + p.amount, 0);
  if (!total) { console.log(`[cc-payday] ${persona}: nothing to settle`); continue; }

  console.log(`[cc-payday] ${persona}: settling ${total} CC -> ${party.slice(0, 24)}…`);
  console.log(`[cc-payday] ${persona} CC balance before:`, await balance(party));

  const [transferCmd, transferDisclosures] = await sdk.token.transfer.create({
    sender: COMPANY, recipient: party, amount: String(total),
    instrumentId: 'Amulet', registryUrl: REGISTRY,
    memo: `paydae payday (${persona})`,
  });
  await submit([transferCmd], [COMPANY], transferDisclosures, `transfer-${persona}`);

  const pending = await sdk.token.transfer.pending(party);
  for (const instr of pending) {
    const [acceptCmd, acceptDisclosures] = await sdk.token.transfer.accept({
      transferInstructionCid: instr.contractId, registryUrl: REGISTRY,
    });
    await walletExercise(party, [acceptCmd], acceptDisclosures, `accept-${persona}`);
  }

  console.log(`[cc-payday] ${persona} CC balance after:`, await balance(party));
  for (const p of unsettled) settled[p.contractId] = { persona, amount: p.amount };
  writeFileSync(SETTLED_FILE, JSON.stringify(settled, null, 2) + '\n');
}

console.log('[cc-payday] company CC balance:', await balance(COMPANY));
console.log('[cc-payday] done');
