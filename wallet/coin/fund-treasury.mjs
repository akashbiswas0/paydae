// Fund PaydaeCo with real Canton Coin (Amulet) on devnet by transferring from
// the sandbox's funded party (5nsandbox-devnet-2), then accepting the transfer
// instruction as PaydaeCo. Both parties are participant-held, so the custodial
// m2m credentials can act for both.
//
// Adapted from https://github.com/akashbiswas0/canton-start
// quickstart/gateway/fund-payer.mjs.
//
// Usage (from wallet/): node coin/fund-treasury.mjs [amount=5000]

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SDK } from '@canton-network/wallet-sdk';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const envVars = {};
for (const line of readFileSync(path.join(REPO_ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && m[1] && m[2] !== undefined) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const config = JSON.parse(readFileSync(path.join(REPO_ROOT, 'config.json'), 'utf8'));

const NS = '1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8';
const SENDER = `5nsandbox-devnet-2::${NS}`;
const TREASURY = config.parties.company;
const AMOUNT = process.argv[2] || '5000';
const LEDGER = envVars.LEDGER_API;
const REGISTRY = new URL('https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator/v0/scan-proxy');

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
console.log('[fund] token acquired');

const auth = { method: 'static', token };
const sdk = await SDK.create({
  auth,
  ledgerClientUrl: LEDGER,
  token: { auth, registries: [REGISTRY] },
});
console.log('[fund] sdk ready');

async function submit(commands, actAs, disclosedContracts = [], tag) {
  const resp = await fetch(`${LEDGER}/v2/commands/submit-and-wait`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      commands,
      commandId: `fund-treasury-${tag}-${crypto.randomUUID()}`,
      actAs,
      readAs: actAs,
      disclosedContracts,
    }),
  });
  const body = await resp.json();
  if (!resp.ok) throw new Error(`${tag} failed: ${resp.status} ${JSON.stringify(body).slice(0, 500)}`);
  console.log(`[fund] ${tag} ok, updateId:`, body.updateId);
  return body;
}

const balance = async (party) => {
  const utxos = await sdk.token.utxos.list({ partyId: party });
  return utxos.reduce((s, u) => s + Number(u.interfaceViewValue.amount), 0);
};

console.log('[fund] treasury CC balance before:', await balance(TREASURY));

const [transferCmd, transferDisclosures] = await sdk.token.transfer.create({
  sender: SENDER,
  recipient: TREASURY,
  amount: AMOUNT,
  instrumentId: 'Amulet',
  registryUrl: REGISTRY,
  memo: 'paydae treasury funding',
});
await submit([transferCmd], [SENDER], transferDisclosures, 'transfer');

const pending = await sdk.token.transfer.pending(TREASURY);
console.log('[fund] pending transfer instructions for treasury:', pending.length);
for (const instr of pending) {
  const [acceptCmd, acceptDisclosures] = await sdk.token.transfer.accept({
    transferInstructionCid: instr.contractId,
    registryUrl: REGISTRY,
  });
  await submit([acceptCmd], [TREASURY], acceptDisclosures, 'accept');
}

console.log('[fund] treasury CC balance after:', await balance(TREASURY));
