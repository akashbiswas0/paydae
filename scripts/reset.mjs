// Reset the Paydae Devnet state: archive every active Paydae contract for all
// three parties so a demo can start from a blank slate.
//   node scripts/reset.mjs
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const config = JSON.parse(readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const PARTIES = Object.values(config.parties);

const tokenRes = await fetch(env.AUTH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.CLIENT_ID,
    client_secret: env.CLIENT_SECRET,
    audience: env.CLIENT_ID,
    scope: 'daml_ledger_api',
  }),
});
const { access_token: token } = await tokenRes.json();

async function ledger(method, endpoint, body) {
  const res = await fetch(`${env.LEDGER_API}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${endpoint} HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const { offset } = await ledger('GET', '/v2/state/ledger-end');
const seen = new Map(); // contractId -> {templateId, stakeholders}
for (const party of PARTIES) {
  const entries = await ledger('POST', '/v2/state/active-contracts', {
    filter: { filtersByParty: { [party]: {} } },
    verbose: true,
    activeAtOffset: offset,
  });
  for (const e of entries || []) {
    const ev = e?.contractEntry?.JsActiveContract?.createdEvent;
    if (!ev || !ev.templateId.includes(':Paydae:')) continue;
    // archiving needs the authority of every signatory: pass all stakeholders
    const stakeholders = [...new Set([...(ev.signatories || []), ...(ev.observers || [])])]
      .filter((p) => PARTIES.includes(p));
    seen.set(ev.contractId, { templateId: ev.templateId, actAs: stakeholders });
  }
}

console.log(`archiving ${seen.size} contract(s)…`);
for (const [contractId, { templateId, actAs }] of seen) {
  await ledger('POST', '/v2/commands/submit-and-wait', {
    commands: [{ ExerciseCommand: { templateId, contractId, choice: 'Archive', choiceArgument: {} } }],
    commandId: `reset-${randomUUID()}`,
    actAs,
    userId: config.userId,
  });
  console.log(`  archived ${templateId.split(':')[2]} ${contractId.slice(0, 16)}…`);
}
console.log('done — ledger is clean.');
