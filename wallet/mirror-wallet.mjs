// Mirror a wallet row to ledger user "6" in a gateway store, and make it that
// user's primary wallet.
//
// Why: the auth proxy stamps every ledger call with the shared m2m token
// (sub = "6"), and Canton's submission endpoints require body userId == token
// user. But user 6 is at its participant rights quota (TOO_MANY_USER_RIGHTS),
// so wallets are ONBOARDED under a dedicated gateway user ("paydae-wallet").
// The gateway's wallet store is per-user, so prepare/sign/execute — which must
// run as user 6 — can only see the wallet after this mirror step. The signing
// key itself is looked up by publicKey (not by user), so signing keeps working.
//
// Usage:
//   node mirror-wallet.mjs <partyId> [storePath]
// or  import { mirrorWalletToSubmitter } from './mirror-wallet.mjs'

import Database from 'better-sqlite3';

export const SUBMITTER_USER = '6';

export function mirrorWalletToSubmitter(partyId, storePath = 'store.devnet.sqlite') {
  const db = new Database(storePath);
  try {
    const src = db
      .prepare('SELECT * FROM wallets WHERE party_id = ? AND user_id != ?')
      .get(partyId, SUBMITTER_USER);
    if (!src) throw new Error(`no wallet row found for party ${partyId}`);
    const tx = db.transaction(() => {
      db.prepare('UPDATE wallets SET "primary" = 0 WHERE user_id = ?').run(SUBMITTER_USER);
      db.prepare(
        `INSERT OR REPLACE INTO wallets
           (party_id, network_id, "primary", hint, public_key, namespace, user_id,
            signing_provider_id, status, external_tx_id, topology_transactions, disabled, reason)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        src.party_id, src.network_id, src.hint, src.public_key, src.namespace,
        SUBMITTER_USER, src.signing_provider_id, src.status, src.external_tx_id,
        src.topology_transactions, src.disabled, src.reason,
      );
    });
    tx();
    return { partyId: src.party_id, mirroredTo: SUBMITTER_USER };
  } finally {
    db.close();
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [partyId, storePath] = process.argv.slice(2);
  if (!partyId) {
    console.error('usage: node mirror-wallet.mjs <partyId> [storePath]');
    process.exit(1);
  }
  console.log(mirrorWalletToSubmitter(partyId, storePath));
}
