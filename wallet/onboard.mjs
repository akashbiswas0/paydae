// Onboard the demo contractor wallets (PaydaeAliceW, PaydaeBobW) through the
// Wallet Gateway and write wallet/parties.json so the backend can resolve
// alice/bob -> wallet party in wallet mode.
//
// Idempotent: reuses wallets that already exist in the gateway store.
//
// Usage: node onboard.mjs   (proxy :9000 + gateway :3030 must be running)

import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mirrorWalletToSubmitter } from './mirror-wallet.mjs';

const WALLET_DIR = path.dirname(fileURLToPath(import.meta.url));
const GATEWAY = 'http://localhost:3030';
const NETWORK_ID = 'canton:da-devnet';
const HINTS = { alice: 'PaydaeAliceW', bob: 'PaydaeBobW' };

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
const JWT_WALLET = selfSignedJwt('paydae-wallet'); // onboarding user (rights quota free)

let rpcId = 0;
async function user(method, params) {
  const resp = await fetch(`${GATEWAY}/api/v0/user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${JWT_WALLET}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const body = await resp.json();
  if (body.error) throw new Error(`${method} RPC error: ${JSON.stringify(body.error)}`);
  return body.result;
}

console.log('[onboard] gateway session…');
await user('addSession', { networkId: NETWORK_ID });

const parties = {};
for (const [persona, hint] of Object.entries(HINTS)) {
  const wallets = await user('listWallets', {});
  let wallet = wallets.find((w) => w.hint === hint);
  if (wallet) {
    console.log(`[onboard] ${persona}: reusing ${wallet.partyId}`);
  } else {
    console.log(`[onboard] ${persona}: creating wallet ${hint}…`);
    const created = await user('createWallet', {
      partyHint: hint,
      signingProviderId: 'wallet-kernel',
      primary: false,
    });
    wallet = created.wallet;
    console.log(`[onboard] ${persona}: allocated ${wallet.partyId}`);
  }
  // make the wallet visible to the submitter user (see mirror-wallet.mjs)
  mirrorWalletToSubmitter(wallet.partyId, path.join(WALLET_DIR, 'store.devnet.sqlite'));
  parties[persona] = wallet.partyId;
}

const out = path.join(WALLET_DIR, 'parties.json');
writeFileSync(out, JSON.stringify(parties, null, 2) + '\n');
console.log(`[onboard] wrote ${out}`);
console.log(JSON.stringify(parties, null, 2));
