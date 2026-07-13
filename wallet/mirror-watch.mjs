// Background watcher that makes MANUAL wallet onboarding work on this sandbox.
//
// The demo user creates wallets by hand in the gateway web UI, logged into the
// "Wallet Onboarding" network (gateway user `paydae-wallet` — the shared ledger
// user `6` is at its participant rights quota, see README "Sandbox quirks").
// The dApp, however, connects via the main network (user `6`, whose token the
// auth proxy stamps). The gateway's wallet store is per-user and per-network,
// so this watcher continuously:
//
//   1. mirrors every allocated wallet row from user `paydae-wallet` to user `6`
//      on the main network id (primary = most recently allocated), and
//   2. maintains wallet/parties.json (hint containing "alice"/"bob" -> persona)
//      so the backend can resolve company offers to the wallet parties.
//
// Watches both gateway stores (alice :3030, bob :3031). Pure sandbox glue —
// on a dedicated validator none of this exists.
//
// Usage: node mirror-watch.mjs   (started automatically by start-devnet.sh)

import Database from 'better-sqlite3';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WALLET_DIR = path.dirname(fileURLToPath(import.meta.url));
const STORES = ['store.devnet.sqlite', 'store.devnet.bob.sqlite'].map((f) =>
  path.join(WALLET_DIR, f),
);
const PARTIES_FILE = path.join(WALLET_DIR, 'parties.json');
const SUBMITTER = '6';
const MAIN_NETWORK = 'canton:da-devnet';
const ONBOARD_USER = 'paydae-wallet';
const POLL_MS = 2000;

function personaOf(hint) {
  const h = (hint || '').toLowerCase();
  if (h.includes('alice')) return 'alice';
  if (h.includes('bob')) return 'bob';
  return null;
}

function sweep(storePath) {
  if (!existsSync(storePath)) return [];
  const db = new Database(storePath);
  const mirrored = [];
  try {
    const hasWallets = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='wallets'")
      .get();
    if (!hasWallets) return [];
    const rows = db
      .prepare(
        `SELECT * FROM wallets
          WHERE user_id = ? AND status = 'allocated'
            AND signing_provider_id = 'wallet-kernel'
            AND (disabled IS NULL OR disabled = 0)`,
      )
      .all(ONBOARD_USER);
    for (const src of rows) {
      const existing = db
        .prepare('SELECT 1 FROM wallets WHERE party_id = ? AND user_id = ? AND network_id = ?')
        .get(src.party_id, SUBMITTER, MAIN_NETWORK);
      if (existing) continue;
      const tx = db.transaction(() => {
        db.prepare('UPDATE wallets SET "primary" = 0 WHERE user_id = ?').run(SUBMITTER);
        db.prepare(
          `INSERT OR REPLACE INTO wallets
             (party_id, network_id, "primary", hint, public_key, namespace, user_id,
              signing_provider_id, status, external_tx_id, topology_transactions, disabled, reason)
           VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          src.party_id, MAIN_NETWORK, src.hint, src.public_key, src.namespace,
          SUBMITTER, src.signing_provider_id, src.status, src.external_tx_id,
          src.topology_transactions, src.disabled, src.reason,
        );
        // the approve page enables submission only if the store records a right
        // for this user+party; the submitter's real CanExecuteAsAnyParty is a
        // ledger-side right the store cannot see
        for (const right of ['CanActAs', 'CanReadAs']) {
          db.prepare(
            'INSERT OR REPLACE INTO user_party_rights (user_id, network_id, party_id, "right") VALUES (?, ?, ?, ?)',
          ).run(SUBMITTER, MAIN_NETWORK, src.party_id, right);
        }
      });
      tx();
      mirrored.push({ partyId: src.party_id, hint: src.hint });
      console.log(`[mirror-watch] ${path.basename(storePath)}: mirrored ${src.party_id} -> user ${SUBMITTER} (primary)`);
    }
  } finally {
    db.close();
  }
  return mirrored;
}

function updateParties(mirrored) {
  if (!mirrored.length) return;
  let parties = {};
  try {
    parties = JSON.parse(readFileSync(PARTIES_FILE, 'utf8'));
  } catch {
    /* start fresh */
  }
  let changed = false;
  for (const { partyId, hint } of mirrored) {
    const persona = personaOf(hint);
    if (persona && parties[persona] !== partyId) {
      parties[persona] = partyId;
      changed = true;
      console.log(`[mirror-watch] parties.json: ${persona} -> ${partyId}`);
    }
  }
  if (changed) writeFileSync(PARTIES_FILE, JSON.stringify(parties, null, 2) + '\n');
}

console.log('[mirror-watch] watching gateway stores for manually onboarded wallets…');
setInterval(() => {
  try {
    const mirrored = STORES.flatMap((s) => sweep(s));
    updateParties(mirrored);
  } catch (err) {
    console.error('[mirror-watch] sweep failed:', err.message);
  }
}, POLL_MS);
