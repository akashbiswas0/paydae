// Paydae backend — zero npm dependencies (Node 18+ builtin http + fetch).
// All ledger calls happen server-side; the browser never sees credentials.
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4000;

// --- .env + config ----------------------------------------------------------
const env = {};
for (const line of readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { AUTH_URL, CLIENT_ID, CLIENT_SECRET, LEDGER_API } = env;
const config = JSON.parse(readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const PARTIES = config.parties; // { company, alice, bob }
const USER_ID = config.userId;
const TPL = (entity) => `${config.packageId}:Paydae:${entity}`;

// --- JWT cache (8h expiry; re-mint after 7h or on 401) -----------------------
let cachedToken = null;
let tokenMintedAt = 0;
const SEVEN_HOURS = 7 * 60 * 60 * 1000;

async function mintToken() {
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
  const body = await res.json();
  cachedToken = body.access_token;
  tokenMintedAt = Date.now();
  return cachedToken;
}

async function getToken() {
  if (!cachedToken || Date.now() - tokenMintedAt > SEVEN_HOURS) return mintToken();
  return cachedToken;
}

async function ledger(method, endpoint, body) {
  const call = async (token) =>
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
  return text ? JSON.parse(text) : null;
}

// --- ledger reads ------------------------------------------------------------
async function activeContracts(party) {
  const { offset } = await ledger('GET', '/v2/state/ledger-end');
  const entries = await ledger('POST', '/v2/state/active-contracts', {
    filter: { filtersByParty: { [party]: {} } },
    verbose: true,
    activeAtOffset: offset,
  });
  const out = [];
  for (const e of entries || []) {
    const ev = e?.contractEntry?.JsActiveContract?.createdEvent;
    if (!ev) continue;
    out.push({
      contractId: ev.contractId,
      entity: ev.templateId.split(':')[2],
      arg: ev.createArgument,
    });
  }
  return out;
}

function groupState(contracts, persona) {
  const groups = {
    AgreementProposal: [],
    Agreement: [],
    Invoice: [],
    ApprovedInvoice: [],
    Payment: [],
    Treasury: [],
  };
  for (const c of contracts) {
    if (groups[c.entity]) groups[c.entity].push({ contractId: c.contractId, ...c.arg });
  }
  const state = {
    persona,
    proposals: groups.AgreementProposal,
    agreements: groups.Agreement,
    invoices: groups.Invoice,
    approvedInvoices: groups.ApprovedInvoice,
    payments: groups.Payment,
  };
  if (persona === 'company') {
    state.treasury = groups.Treasury[0] || null;
  }
  return state;
}

// --- ledger writes -----------------------------------------------------------
async function submitAndWait(party, command) {
  return ledger('POST', '/v2/commands/submit-and-wait', {
    commands: [command],
    commandId: `paydae-${randomUUID()}`,
    actAs: [party],
    userId: USER_ID,
  });
}

const createCmd = (entity, createArguments) => ({
  CreateCommand: { templateId: TPL(entity), createArguments },
});
const exerciseCmd = (entity, contractId, choice, choiceArgument = {}) => ({
  ExerciseCommand: { templateId: TPL(entity), contractId, choice, choiceArgument },
});

async function handleAction(persona, action, payload = {}) {
  const party = PARTIES[persona];
  switch (action) {
    case 'propose': {
      if (persona !== 'company') throw new Error('only company can propose');
      const contractor = PARTIES[payload.contractor];
      if (!contractor) throw new Error(`unknown contractor: ${payload.contractor}`);
      return submitAndWait(party, createCmd('AgreementProposal', {
        company: party,
        contractor,
        role: payload.role,
        hourlyRate: String(payload.rate),
        currency: 'USD',
      }));
    }
    case 'countersign':
      return submitAndWait(party, exerciseCmd('AgreementProposal', payload.cid, 'Countersign'));
    case 'submitInvoice':
      return submitAndWait(party, exerciseCmd('Agreement', payload.agreementCid, 'SubmitInvoice', {
        hours: String(payload.hours),
        memo: payload.memo || '',
      }));
    case 'approve': {
      if (persona !== 'company') throw new Error('only company can approve');
      return submitAndWait(party, exerciseCmd('Invoice', payload.cid, 'Approve'));
    }
    case 'payAll': {
      if (persona !== 'company') throw new Error('only company can run payday');
      const acs = await activeContracts(party);
      const treasury = acs.find((c) => c.entity === 'Treasury');
      if (!treasury) throw new Error('no treasury — bootstrap it first');
      const invoiceCids = acs.filter((c) => c.entity === 'ApprovedInvoice').map((c) => c.contractId);
      if (invoiceCids.length === 0) throw new Error('no approved invoices to pay');
      return submitAndWait(party, exerciseCmd('Treasury', treasury.contractId, 'PayAllApproved', {
        invoiceCids,
      }));
    }
    case 'bootstrapTreasury': {
      if (persona !== 'company') throw new Error('only company can bootstrap treasury');
      const acs = await activeContracts(party);
      if (acs.some((c) => c.entity === 'Treasury')) throw new Error('treasury already exists');
      return submitAndWait(party, createCmd('Treasury', {
        company: party,
        balance: String(payload.balance),
        currency: 'USD',
      }));
    }
    default:
      throw new Error(`unknown action: ${action}`);
  }
}

// --- http server ---------------------------------------------------------------
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
const APP_ROUTES = new Set(['/', '/company', '/c/alice', '/c/bob']);

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/api/state' && req.method === 'GET') {
      const persona = url.searchParams.get('p');
      if (!PARTIES[persona]) return sendJSON(res, 400, { error: `unknown persona: ${persona}` });
      const contracts = await activeContracts(PARTIES[persona]);
      return sendJSON(res, 200, groupState(contracts, persona));
    }
    if (url.pathname === '/api/action' && req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const { p: persona, action, payload } = JSON.parse(raw || '{}');
      if (!PARTIES[persona]) return sendJSON(res, 400, { error: `unknown persona: ${persona}` });
      const result = await handleAction(persona, action, payload);
      return sendJSON(res, 200, { ok: true, updateId: result?.updateId || null });
    }
    // static files
    const file = APP_ROUTES.has(url.pathname)
      ? path.join(ROOT, 'static', 'app.html')
      : path.join(ROOT, 'static', path.normalize(url.pathname).replace(/^([/\\.])+/, ''));
    if (!file.startsWith(path.join(ROOT, 'static')) || !existsSync(file)) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    return res.end(readFileSync(file));
  } catch (err) {
    console.error(`[paydae] ${req.method} ${url.pathname} failed:`, err.message);
    return sendJSON(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => console.log(`Paydae running at http://localhost:${PORT}`));
