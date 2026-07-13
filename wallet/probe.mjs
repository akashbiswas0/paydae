// Phase-0 probe: prove the full wallet lifecycle against the local gateway.
//
//   1. self-signed user session on the gateway (idp "unsafe-auth", sub = ledger user 6)
//   2. onboard a NEW external party (hint PaydaeProbeW) via createWallet (wallet-kernel)
//   3. custodial: PaydaeCo creates an AgreementProposal -> probe party (m2m token, user 6)
//   4. wallet-signed: Countersign THROUGH the gateway (prepareExecute -> sign -> execute)
//   5. negative: forge attempt — custodial submit-and-wait actAs the wallet party must fail
//
// Usage: node probe.mjs   (proxy :9000 + gateway :3030 must be running)

import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envVars = {};
for (const line of readFileSync(path.join(REPO_ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && m[1] && m[2] !== undefined) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const config = JSON.parse(readFileSync(path.join(REPO_ROOT, 'config.json'), 'utf8'));

const GATEWAY = 'http://localhost:3030';
const NETWORK_ID = 'canton:da-devnet';
const LEDGER_API = envVars.LEDGER_API;
const PARTY_HINT = process.argv[2] || 'PaydaeProbeW';

// ---------- self-signed gateway JWT (idp type self_signed: signature unverified) ----------
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
function selfSignedJwt(sub) {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    iss: 'unsafe-auth',
    sub,
    scope: 'openid daml_ledger_api offline_access',
    aud: 'https://canton.network.global',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 8 * 3600,
  });
  const sig = createHmac('sha256', 'unsafe').update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}
// Two gateway users, because shared sandbox ledger user "6" is at its 1000-right
// quota (TOO_MANY_USER_RIGHTS) but already holds CanExecuteAsAnyParty + ParticipantAdmin:
//  - "paydae-wallet" (dedicated user created via /v2/users): onboarding + signing.
//    createWallet grants CanActAs <new party> to this user — quota is fine — and the
//    gateway signing store scopes keys by this userId.
//  - "6": prepare/execute. Submission endpoints require body userId == token user
//    (the proxy stamps the m2m token, sub=6), and CanExecuteAsAnyParty authorizes
//    interactive submission for the external wallet party.
const JWT_WALLET = selfSignedJwt('paydae-wallet');
const JWT_SUBMIT = selfSignedJwt('6');

// ---------- JSON-RPC helper ----------
let rpcId = 0;
async function rpc(pathName, jwt, method, params) {
  const resp = await fetch(`${GATEWAY}${pathName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const body = await resp.json();
  if (body.error) throw new Error(`${method} RPC error: ${JSON.stringify(body.error)}`);
  return body.result;
}
const user = (method, params) => rpc('/api/v0/user', JWT_WALLET, method, params);
const userAs6 = (method, params) => rpc('/api/v0/user', JWT_SUBMIT, method, params);
const dapp = (method, params) => rpc('/api/v0/dapp', JWT_SUBMIT, method, params);

// ---------- custodial ledger access (same as backend: real m2m token, user 6) ----------
async function m2mToken() {
  const resp = await fetch(envVars.AUTH_URL, {
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
  if (!resp.ok) throw new Error(`m2m token failed: ${resp.status}`);
  return (await resp.json()).access_token;
}
let custodialToken;
async function ledger(method, endpoint, body) {
  custodialToken ??= await m2mToken();
  const resp = await fetch(`${LEDGER_API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${custodialToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`ledger ${endpoint} HTTP ${resp.status}: ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : null;
}
const templateId = (entity) => `${config.packageId}:Paydae:${entity}`;
async function acs(party) {
  const { offset } = await ledger('GET', '/v2/state/ledger-end');
  const entries = await ledger('POST', '/v2/state/active-contracts', {
    filter: { filtersByParty: { [party]: {} } },
    verbose: true,
    activeAtOffset: offset,
  });
  return (entries ?? [])
    .map((e) => e.contractEntry?.JsActiveContract?.createdEvent)
    .filter(Boolean)
    .map((ev) => ({ contractId: ev.contractId, entity: ev.templateId.split(':')[2], arg: ev.createArgument }));
}

// ---------- probe ----------
const log = (...a) => console.log('[probe]', ...a);

log('1. gateway session…');
const session = await user('addSession', { networkId: NETWORK_ID });
log('   session ok, network:', session.network.id, 'status:', session.status);

log('2. wallet onboarding…');
let wallets = await user('listWallets', {});
let wallet = wallets.find((w) => w.hint?.includes(PARTY_HINT) || w.partyId?.startsWith(PARTY_HINT));
if (wallet) {
  log('   reusing existing wallet', wallet.partyId);
  if (!wallet.primary) await user('setPrimaryWallet', { partyId: wallet.partyId });
} else {
  const created = await user('createWallet', {
    partyHint: PARTY_HINT,
    signingProviderId: 'wallet-kernel',
    primary: true,
  });
  wallet = created.wallet;
  log('   created wallet', JSON.stringify(wallet, null, 2));
}
const PROBE_PARTY = wallet.partyId;
if (!PROBE_PARTY) throw new Error('wallet has no partyId — allocation failed');
log('   probe party:', PROBE_PARTY);

// Mirror the wallet row to user 6 so prepare/sign/execute (which must run as the
// submitter user the proxy's m2m token maps to) can see it. See mirror-wallet.mjs.
const { mirrorWalletToSubmitter } = await import('./mirror-wallet.mjs');
log('   mirror:', JSON.stringify(mirrorWalletToSubmitter(PROBE_PARTY)));
// session for user 6 so the user-API sign/execute have a current network
await userAs6('addSession', { networkId: NETWORK_ID });

log('3. custodial: PaydaeCo -> AgreementProposal for probe party…');
const company = config.parties.company;
await ledger('POST', '/v2/commands/submit-and-wait', {
  commands: [{ CreateCommand: { templateId: templateId('AgreementProposal'), createArguments: {
    company, contractor: PROBE_PARTY, role: 'Probe Role', hourlyRate: '1.0', currency: 'USD',
  } } }],
  commandId: `probe-propose-${randomUUID()}`,
  actAs: [company],
  userId: config.userId,
});
const proposals = (await acs(PROBE_PARTY)).filter((c) => c.entity === 'AgreementProposal' && c.arg.contractor === PROBE_PARTY);
if (!proposals.length) throw new Error('proposal not visible on probe party ACS');
const proposalCid = proposals[proposals.length - 1].contractId;
log('   proposal cid:', proposalCid);

log('4. wallet-signed Countersign through gateway…');
const prep = await dapp('prepareExecute', {
  commands: [{ ExerciseCommand: { templateId: templateId('AgreementProposal'), contractId: proposalCid, choice: 'Countersign', choiceArgument: {} } }],
  commandId: `probe-countersign-${randomUUID()}`,
  actAs: [PROBE_PARTY],
});
log('   prepared, userUrl:', prep.userUrl);
const txId = new URL(prep.userUrl).searchParams.get('transactionId');
if (!txId) throw new Error('no transactionId in prepareExecute response');

// sign as user 6 too: the tx store is scoped to the user that prepared (6), and the
// signing driver looks keys up by publicKey, not by user.
const signed = await userAs6('sign', { transactionId: txId, partyId: PROBE_PARTY });
log('   sign status:', signed.status, 'signedBy:', signed.signedBy);
if (signed.status !== 'signed') throw new Error(`sign did not complete: ${JSON.stringify(signed)}`);

const executed = await userAs6('execute', {
  transactionId: txId,
  partyId: PROBE_PARTY,
  signature: signed.signature,
  signedBy: signed.signedBy,
});
log('   EXECUTED. updateId:', executed?.updateId ?? JSON.stringify(executed).slice(0, 300));

const agreements = (await acs(PROBE_PARTY)).filter((c) => c.entity === 'Agreement');
log('   agreements on probe party ACS:', agreements.length, agreements.map((a) => a.contractId.slice(0, 20)));
if (!agreements.length) throw new Error('no Agreement after countersign');

log('5. negative: custodial forge attempt (user 6 actAs wallet party, old-style submit)…');
try {
  const invoices = await ledger('POST', '/v2/commands/submit-and-wait', {
    commands: [{ ExerciseCommand: { templateId: templateId('Agreement'), contractId: agreements[0].contractId, choice: 'SubmitInvoice', choiceArgument: { hours: '1.0', memo: 'forged' } } }],
    commandId: `probe-forge-${randomUUID()}`,
    actAs: [PROBE_PARTY],
    userId: config.userId,
  });
  log('   !!! FORGE SUCCEEDED (unexpected):', JSON.stringify(invoices).slice(0, 300));
} catch (err) {
  log('   forge REJECTED as expected:', String(err.message).slice(0, 400));
}

log('DONE. party:', PROBE_PARTY);
