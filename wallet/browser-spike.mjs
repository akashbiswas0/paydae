// Phase-0 spike for the browser-key wallet design: prove that locally
// generated ed25519 keypairs — no gateway, no wallet store — can drive the
// ENTIRE Paydae flow, company side included:
//
//   1. onboard TWO new external parties (company + contractor) via the raw
//      JSON Ledger API (/v2/parties/external/generate-topology + /allocate)
//   2. company creates an AgreementProposal via interactive submission
//      (CreateCommand: prepare -> local sign -> executeAndWait)
//   3. contractor Countersigns via interactive submission (ExerciseCommand)
//   4. negative: a custodial submit-and-wait actAs either party must be rejected
//
// Everything runs as ledger user 6 (the m2m token's user): ParticipantAdmin
// covers allocation, CanExecuteAsAnyParty covers interactive submission and
// CanReadAsAnyParty covers ACS reads. NO user rights are granted anywhere.
//
// Usage: node browser-spike.mjs   (no local services needed)

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nacl from 'tweetnacl';

const WALLET_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(WALLET_DIR, '..');
const envVars = {};
for (const line of readFileSync(path.join(REPO_ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && m[1] && m[2] !== undefined) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const config = JSON.parse(readFileSync(path.join(REPO_ROOT, 'config.json'), 'utf8'));
const LEDGER_API = envVars.LEDGER_API;
const USER_ID = config.userId;
const RUN = Date.now().toString(36);

const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

// ---------- ledger access (real m2m token, user 6 — same as the backend) ----------
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
let token;
async function ledger(method, endpoint, body) {
  token ??= await m2mToken();
  const resp = await fetch(`${LEDGER_API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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

const log = (...a) => console.log('[spike]', ...a);

let synchronizerId;

// ---------- external party onboarding from a local public key ----------
async function onboardParty(partyHint, keyPair) {
  const topo = await ledger('POST', '/v2/parties/external/generate-topology', {
    synchronizer: synchronizerId,
    partyHint,
    publicKey: {
      format: 'CRYPTO_KEY_FORMAT_RAW',
      keyData: b64(keyPair.publicKey),
      keySpec: 'SIGNING_KEY_SPEC_EC_CURVE25519',
    },
    localParticipantObservationOnly: false,
    confirmationThreshold: 1,
    otherConfirmingParticipantUids: [],
    observingParticipantUids: [],
  });
  const multiHashSignature = b64(nacl.sign.detached(unb64(topo.multiHash), keyPair.secretKey));
  await ledger('POST', '/v2/parties/external/allocate', {
    synchronizer: synchronizerId,
    identityProviderId: '',
    onboardingTransactions: topo.topologyTransactions.map((transaction) => ({ transaction })),
    multiHashSignatures: [
      {
        format: 'SIGNATURE_FORMAT_CONCAT',
        signature: multiHashSignature,
        signedBy: topo.publicKeyFingerprint,
        signingAlgorithmSpec: 'SIGNING_ALGORITHM_SPEC_ED25519',
      },
    ],
  });
  for (let i = 0; ; i++) {
    try {
      const res = await ledger('GET', `/v2/parties/${encodeURIComponent(topo.partyId)}`);
      if (res.partyDetails?.[0]?.party === topo.partyId) break;
    } catch {
      /* not yet visible */
    }
    if (i > 30) throw new Error(`party ${topo.partyId} did not appear after allocation`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  return topo.partyId;
}

// ---------- interactive submission: prepare -> local sign -> executeAndWait ----------
async function interactiveSubmit(party, keyPair, commands, label) {
  const prepared = await ledger('POST', '/v2/interactive-submission/prepare', {
    commands,
    commandId: `spike-${label}-${randomUUID()}`,
    userId: USER_ID,
    actAs: [party],
    readAs: [],
    disclosedContracts: [],
    synchronizerId,
    packageIdSelectionPreference: [],
    verboseHashing: false,
  });
  const signature = b64(nacl.sign.detached(unb64(prepared.preparedTransactionHash), keyPair.secretKey));
  const body = {
    userId: USER_ID,
    preparedTransaction: prepared.preparedTransaction,
    hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
    submissionId: randomUUID(),
    deduplicationPeriod: { Empty: {} },
    partySignatures: {
      signatures: [
        {
          party,
          signatures: [
            {
              signature,
              signedBy: party.split('::')[1],
              format: 'SIGNATURE_FORMAT_CONCAT',
              signingAlgorithmSpec: 'SIGNING_ALGORITHM_SPEC_ED25519',
            },
          ],
        },
      ],
    },
  };
  for (let attempt = 1; ; attempt++) {
    try {
      return await ledger('POST', '/v2/interactive-submission/executeAndWait', body);
    } catch (err) {
      if (attempt < 4 && /timely response|activating|NOT_FOUND/.test(String(err.message))) {
        log(`   ${label}: transient failure (attempt ${attempt}), retrying in 5s…`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw err;
    }
  }
}

// ---------- spike ----------
const companyKeys = nacl.sign.keyPair();
const contractorKeys = nacl.sign.keyPair();
log('1. local ed25519 keypairs (company + contractor) generated');

({ connectedSynchronizers: [{ synchronizerId }] } = await ledger('GET', '/v2/state/connected-synchronizers'));
log('   synchronizer:', synchronizerId);

const COMPANY = await onboardParty(`SpikeCo${RUN}`, companyKeys);
const CONTRACTOR = await onboardParty(`SpikeContractor${RUN}`, contractorKeys);
log('2. parties allocated (no user rights granted):');
log('   company:   ', COMPANY);
log('   contractor:', CONTRACTOR);

log('3. company creates AgreementProposal — wallet-signed CreateCommand…');
const proposed = await interactiveSubmit(COMPANY, companyKeys, [
  { CreateCommand: { templateId: templateId('AgreementProposal'), createArguments: {
    company: COMPANY, contractor: CONTRACTOR, role: 'Spike Role', hourlyRate: '75.0', currency: 'USD',
  } } },
], 'propose');
log('   proposal committed. updateId:', proposed.updateId);

const proposals = (await acs(CONTRACTOR)).filter((c) => c.entity === 'AgreementProposal');
if (!proposals.length) throw new Error('proposal not visible on contractor ACS');
const proposalCid = proposals[proposals.length - 1].contractId;
log('   visible on contractor ACS:', proposalCid.slice(0, 24));

log('4. contractor Countersign — wallet-signed ExerciseCommand…');
const countersigned = await interactiveSubmit(CONTRACTOR, contractorKeys, [
  { ExerciseCommand: { templateId: templateId('AgreementProposal'), contractId: proposalCid, choice: 'Countersign', choiceArgument: {} } },
], 'countersign');
log('   EXECUTED. updateId:', countersigned.updateId);

const agreements = (await acs(CONTRACTOR)).filter((c) => c.entity === 'Agreement');
if (!agreements.length) throw new Error('no Agreement after countersign');
log('   Agreement active:', agreements[0].contractId.slice(0, 24));

log('5. negative: custodial submit-and-wait actAs the external parties…');
for (const [who, party, cid] of [['contractor', CONTRACTOR, agreements[0].contractId]]) {
  try {
    await ledger('POST', '/v2/commands/submit-and-wait', {
      commands: [{ ExerciseCommand: { templateId: templateId('Agreement'), contractId: cid, choice: 'SubmitInvoice', choiceArgument: { hours: '1.0', memo: 'FORGED' } } }],
      commandId: `spike-forge-${randomUUID()}`,
      actAs: [party],
      userId: USER_ID,
    });
    log(`   !!! FORGE as ${who} SUCCEEDED (unexpected)`);
    process.exit(1);
  } catch (err) {
    log(`   forge as ${who} REJECTED as expected:`, String(err.message).slice(0, 160));
  }
}

log('GATE PASSED — full flow wallet-signed on both sides, zero custodial writes.');
log('   company:              ', COMPANY);
log('   contractor:           ', CONTRACTOR);
log('   propose updateId:     ', proposed.updateId);
log('   countersign updateId: ', countersigned.updateId);
