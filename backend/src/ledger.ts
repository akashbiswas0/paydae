// JSON Ledger API client: JWT cache + reads (ACS) + writes (submit-and-wait).
import { randomUUID } from 'node:crypto';
import { AUTH_URL, CLIENT_ID, CLIENT_SECRET, LEDGER_API, config } from './env.js';
import type { Contract, LedgerCommand } from './types.js';

let cachedToken: string | null = null;
let tokenMintedAt = 0;
const SEVEN_HOURS = 7 * 60 * 60 * 1000; // tokens live 8h; re-mint early

async function mintToken(): Promise<string> {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: CLIENT_ID,
      scope: 'daml_ledger_api',
    }),
  });
  if (!res.ok) throw new Error(`token mint failed: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token: string };
  cachedToken = body.access_token;
  tokenMintedAt = Date.now();
  return cachedToken;
}

async function getToken(): Promise<string> {
  if (!cachedToken || Date.now() - tokenMintedAt > SEVEN_HOURS) return mintToken();
  return cachedToken;
}

async function ledger<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
  const call = (token: string) =>
    fetch(`${LEDGER_API}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  let res = await call(await getToken());
  if (res.status === 401) res = await call(await mintToken());
  const text = await res.text();
  if (!res.ok) throw new Error(`ledger ${endpoint} HTTP ${res.status}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as T;
}

interface AcsEntry {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: {
        contractId: string;
        templateId: string;
        createArgument: Record<string, unknown>;
      };
    };
  };
}

export async function activeContracts(party: string): Promise<Contract[]> {
  const { offset } = await ledger<{ offset: number }>('GET', '/v2/state/ledger-end');
  const entries = await ledger<AcsEntry[] | null>('POST', '/v2/state/active-contracts', {
    filter: { filtersByParty: { [party]: {} } },
    verbose: true,
    activeAtOffset: offset,
  });
  const out: Contract[] = [];
  for (const e of entries ?? []) {
    const ev = e.contractEntry?.JsActiveContract?.createdEvent;
    if (!ev) continue;
    const entity = ev.templateId.split(':')[2];
    if (!entity) continue;
    out.push({ contractId: ev.contractId, entity, arg: ev.createArgument });
  }
  return out;
}

export async function submitAndWait(
  party: string,
  command: LedgerCommand,
): Promise<{ updateId?: string }> {
  return ledger('POST', '/v2/commands/submit-and-wait', {
    commands: [command],
    commandId: `paydae-${randomUUID()}`,
    actAs: [party],
    userId: config.userId,
  });
}
