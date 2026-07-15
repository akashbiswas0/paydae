// Profile registry: maps a wallet PUBLIC key to its Canton party and app role.
// No private key material is ever stored server-side — the browser holds the
// only copy. Losing the key file means losing access to the party.
import Database from 'better-sqlite3';
import path from 'node:path';
import { REPO_ROOT } from './env.js';
import type { Profile, Role } from './types.js';

const DB_PATH = path.join(REPO_ROOT, 'backend', 'profiles.sqlite');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    fingerprint  TEXT PRIMARY KEY,
    public_key   TEXT NOT NULL UNIQUE,
    party_id     TEXT NOT NULL UNIQUE,
    role         TEXT NOT NULL CHECK (role IN ('company', 'contractor', 'auditor')),
    display_name TEXT NOT NULL,
    created_at   TEXT NOT NULL
  )
`);

// pre-auditor databases carry a CHECK that rejects 'auditor' — rebuild in place
{
  const schema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'profiles'")
    .get() as { sql: string };
  if (!schema.sql.includes('auditor')) {
    db.exec(`
      BEGIN;
      ALTER TABLE profiles RENAME TO profiles_old;
      CREATE TABLE profiles (
        fingerprint  TEXT PRIMARY KEY,
        public_key   TEXT NOT NULL UNIQUE,
        party_id     TEXT NOT NULL UNIQUE,
        role         TEXT NOT NULL CHECK (role IN ('company', 'contractor', 'auditor')),
        display_name TEXT NOT NULL,
        created_at   TEXT NOT NULL
      );
      INSERT INTO profiles SELECT * FROM profiles_old;
      DROP TABLE profiles_old;
      COMMIT;
    `);
  }
}

interface Row {
  fingerprint: string;
  public_key: string;
  party_id: string;
  role: Role;
  display_name: string;
  created_at: string;
}

const toProfile = (r: Row): Profile => ({
  fingerprint: r.fingerprint,
  publicKey: r.public_key,
  partyId: r.party_id,
  role: r.role,
  displayName: r.display_name,
  createdAt: r.created_at,
});

export function saveProfile(p: Omit<Profile, 'createdAt'>): Profile {
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO profiles (fingerprint, public_key, party_id, role, display_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(p.fingerprint, p.publicKey, p.partyId, p.role, p.displayName, createdAt);
  return { ...p, createdAt };
}

export function profileByPublicKey(publicKey: string): Profile | null {
  const row = db.prepare('SELECT * FROM profiles WHERE public_key = ?').get(publicKey) as
    | Row
    | undefined;
  return row ? toProfile(row) : null;
}

export function profileByParty(partyId: string): Profile | null {
  const row = db.prepare('SELECT * FROM profiles WHERE party_id = ?').get(partyId) as
    | Row
    | undefined;
  return row ? toProfile(row) : null;
}

export function listContractors(): Profile[] {
  const rows = db
    .prepare("SELECT * FROM profiles WHERE role = 'contractor' ORDER BY created_at")
    .all() as Row[];
  return rows.map(toProfile);
}

export function listAuditors(): Profile[] {
  const rows = db
    .prepare("SELECT * FROM profiles WHERE role = 'auditor' ORDER BY created_at")
    .all() as Row[];
  return rows.map(toProfile);
}

/** display names for every known party — sent with state so the UI can label parties */
export function partyNames(): Record<string, string> {
  const rows = db.prepare('SELECT party_id, display_name FROM profiles').all() as Pick<
    Row,
    'party_id' | 'display_name'
  >[];
  return Object.fromEntries(rows.map((r) => [r.party_id, r.display_name]));
}
