// Loads ../.env (repo root) and ../config.json. No dotenv dependency needed.
// When no .env file exists (hosted deploys), falls back to process.env.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PaydaeConfig } from './types.js';

export const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const envVars: Record<string, string> = {};
const envPath = path.join(REPO_ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && m[1] && m[2] !== undefined) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function required(name: string): string {
  const value = envVars[name] ?? process.env[name];
  if (!value) throw new Error(`missing required env variable: ${name} (set it in .env or the process environment)`);
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
