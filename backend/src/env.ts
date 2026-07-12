// Loads ../.env (repo root) and ../config.json. No dotenv dependency needed.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PaydaeConfig } from './types.js';

export const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const envVars: Record<string, string> = {};
for (const line of readFileSync(path.join(REPO_ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && m[1] && m[2] !== undefined) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

function required(name: string): string {
  const value = envVars[name];
  if (!value) throw new Error(`missing required .env variable: ${name}`);
  return value;
}

export const AUTH_URL = required('AUTH_URL');
export const CLIENT_ID = required('CLIENT_ID');
export const CLIENT_SECRET = required('CLIENT_SECRET');
export const LEDGER_API = required('LEDGER_API');

export const config: PaydaeConfig = JSON.parse(
  readFileSync(path.join(REPO_ROOT, 'config.json'), 'utf8'),
);

export const templateId = (entity: string): string => `${config.packageId}:Paydae:${entity}`;
