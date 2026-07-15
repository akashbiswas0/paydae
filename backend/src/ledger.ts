// JSON Ledger API client: JWT cache + reads (ACS) + writes.
//
// Two write paths:
//   - submitAndWait: custodial (participant authorizes via user rights) — kept
//     only for negative tests; the app itself never uses it anymore.
//   - prepareSubmission/executeSubmission: Canton interactive submission for
//     external parties. The browser signs the prepared-transaction hash with
//     the wallet's ed25519 key; the ledger verifies it against the party's
//     key namespace. Runs as ledger user 6 (CanExecuteAsAnyParty).
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

// ---------- external party onboarding ----------

let cachedSynchronizerId: string | null = null;
export async function synchronizerId(): Promise<string> {
  if (cachedSynchronizerId) return cachedSynchronizerId;
  const res = await ledger<{ connectedSynchronizers: { synchronizerId: string }[] }>(
    'GET',
    '/v2/state/connected-synchronizers',
  );
  const id = res.connectedSynchronizers[0]?.synchronizerId;
  if (!id) throw new Error('no connected synchronizer');
  cachedSynchronizerId = id;
  return id;
}

export interface GeneratedTopology {
  partyId: string;
  publicKeyFingerprint: string;
  multiHash: string;
  topologyTransactions: string[];
}

/** Step 1 of onboarding: derive the party + topology transactions from a public key.
 * The browser must sign `multiHash` with the matching private key. */
export async function generateTopology(
  partyHint: string,
  publicKeyB64: string,
): Promise<GeneratedTopology> {
  return ledger('POST', '/v2/parties/external/generate-topology', {
    synchronizer: await synchronizerId(),
    partyHint,
    publicKey: {
      format: 'CRYPTO_KEY_FORMAT_RAW',
      keyData: publicKeyB64,
      keySpec: 'SIGNING_KEY_SPEC_EC_CURVE25519',
    },
    localParticipantObservationOnly: false,
    confirmationThreshold: 1,
    otherConfirmingParticipantUids: [],
    observingParticipantUids: [],
  });
}

/** Step 2 of onboarding: allocate the party using the key's signature over multiHash. */
export async function allocateExternalParty(
  topologyTransactions: string[],
  multiHashSignature: string,
  signedByFingerprint: string,
): Promise<void> {
  await ledger('POST', '/v2/parties/external/allocate', {
    synchronizer: await synchronizerId(),
    identityProviderId: '',
    onboardingTransactions: topologyTransactions.map((transaction) => ({ transaction })),
    multiHashSignatures: [
      {
        format: 'SIGNATURE_FORMAT_CONCAT',
        signature: multiHashSignature,
        signedBy: signedByFingerprint,
        signingAlgorithmSpec: 'SIGNING_ALGORITHM_SPEC_ED25519',
      },
    ],
  });
}

export async function waitForParty(partyId: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await ledger<{ partyDetails?: { party: string }[] }>(
        'GET',
        `/v2/parties/${encodeURIComponent(partyId)}`,
      );
      if (res.partyDetails?.[0]?.party === partyId) return;
    } catch {
      /* not yet visible */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`party ${partyId} did not appear after allocation`);
}

// ---------- transaction receipt (stakeholder-only lookup by update id) ----------

interface UpdateEvent {
  CreatedEvent?: { contractId: string; templateId: string; createArgument: Record<string, unknown> };
  ArchivedEvent?: { contractId: string; templateId: string };
}

export interface UpdateDetails {
  updateId: string;
  effectiveAt: string;
  events: { kind: 'created' | 'archived'; entity: string; contractId: string; fields?: Record<string, unknown> }[];
}

/** Fetch a committed transaction by update id AS the given party. Returns null
 * when the update doesn't exist or the party was not a stakeholder — Canton
 * never even delivered it to this participant's view of that party. */
export async function updateById(party: string, updateId: string): Promise<UpdateDetails | null> {
  let res: { update?: { Transaction?: { value?: { updateId: string; effectiveAt: string; events?: UpdateEvent[] } } } };
  try {
    res = await ledger('POST', '/v2/updates/update-by-id', {
      updateId,
      updateFormat: {
        includeTransactions: {
          eventFormat: { filtersByParty: { [party]: {} }, verbose: true },
          transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA',
        },
      },
    });
  } catch (err) {
    if (String(err instanceof Error ? err.message : err).includes('UPDATE_NOT_FOUND')) return null;
    throw err;
  }
  const tx = res.update?.Transaction?.value;
  if (!tx) return null;
  const events: UpdateDetails['events'] = [];
  for (const e of tx.events ?? []) {
    if (e.CreatedEvent) {
      events.push({
        kind: 'created',
        entity: e.CreatedEvent.templateId.split(':')[2] ?? e.CreatedEvent.templateId,
        contractId: e.CreatedEvent.contractId,
        fields: e.CreatedEvent.createArgument,
      });
    } else if (e.ArchivedEvent) {
      events.push({
        kind: 'archived',
        entity: e.ArchivedEvent.templateId.split(':')[2] ?? e.ArchivedEvent.templateId,
        contractId: e.ArchivedEvent.contractId,
      });
    }
  }
  return { updateId: tx.updateId, effectiveAt: tx.effectiveAt, events };
}

// ---------- interactive submission (wallet-signed writes) ----------

export interface PreparedSubmission {
  preparedTransaction: string;
  preparedTransactionHash: string;
}

export async function prepareSubmission(
  party: string,
  commands: LedgerCommand[],
): Promise<PreparedSubmission> {
  return ledger('POST', '/v2/interactive-submission/prepare', {
    commands,
    commandId: `paydae-wallet-${randomUUID()}`,
    userId: config.userId,
    actAs: [party],
    readAs: [],
    disclosedContracts: [],
    synchronizerId: await synchronizerId(),
    packageIdSelectionPreference: [],
    verboseHashing: false,
  });
}

export async function executeSubmission(
  party: string,
  preparedTransaction: string,
  signatureB64: string,
): Promise<{ updateId: string }> {
  const body = {
    userId: config.userId,
    preparedTransaction,
    hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
    submissionId: randomUUID(),
    deduplicationPeriod: { Empty: {} },
    partySignatures: {
      signatures: [
        {
          party,
          signatures: [
            {
              signature: signatureB64,
              signedBy: party.split('::')[1],
              format: 'SIGNATURE_FORMAT_CONCAT',
              signingAlgorithmSpec: 'SIGNING_ALGORITHM_SPEC_ED25519',
            },
          ],
        },
      ],
    },
  };
  // the shared devnet occasionally times out on executeAndWait; retry is safe
  // (same submissionId -> deduplicated by the ledger)
  for (let attempt = 1; ; attempt++) {
    try {
      return await ledger('POST', '/v2/interactive-submission/executeAndWait', body);
    } catch (err) {
      if (attempt < 3 && String(err instanceof Error ? err.message : err).includes('timely response')) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
  }
}
