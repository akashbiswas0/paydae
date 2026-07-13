// Paydae backend — Express + TypeScript. All ledger calls happen server-side;
// the browser never sees credentials.
import express from 'express';
import cors from 'cors';
import { config } from './env.js';
import { activeContracts } from './ledger.js';
import { groupState } from './state.js';
import { handleAction } from './actions.js';
import type { ActionRequest, Persona } from './types.js';
// wallet-integration: flag-gated additions (WALLET_MODE=1) — contractor pages may
// read a wallet party's state, and company offers resolve alice/bob to the wallet
// parties from wallet/parties.json. With WALLET_MODE unset nothing changes.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, templateId } from './env.js';
import { submitAndWait } from './ledger.js';

// wallet-integration: helpers (inert unless WALLET_MODE=1)
const WALLET_MODE = process.env.WALLET_MODE === '1';
function walletParties(): Partial<Record<string, string>> {
  try {
    return JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'wallet', 'parties.json'), 'utf8'),
    ) as Partial<Record<string, string>>;
  } catch {
    return {};
  }
}

const PORT = 4000;
const app = express();

app.use(cors()); // Next.js dev server proxies /api here; CORS kept for direct calls
app.use(express.json());

const isPersona = (p: unknown): p is Persona =>
  typeof p === 'string' && p in config.parties;

app.get('/api/state', async (req, res) => {
  const persona = req.query.p;
  if (!isPersona(persona)) {
    res.status(400).json({ error: `unknown persona: ${String(persona)}` });
    return;
  }
  try {
    // wallet-integration: optional wallet-party override for contractor reads
    const override =
      WALLET_MODE && typeof req.query.party === 'string' && req.query.party
        ? req.query.party
        : null;
    const contracts = await activeContracts(override ?? config.parties[persona]);
    res.json(groupState(contracts, persona));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[paydae] GET /api/state?p=${persona} failed:`, message);
    res.status(500).json({ error: message });
  }
});

app.post('/api/action', async (req, res) => {
  const { p: persona, action, payload } = (req.body ?? {}) as Partial<ActionRequest>;
  if (!isPersona(persona)) {
    res.status(400).json({ error: `unknown persona: ${String(persona)}` });
    return;
  }
  if (!action) {
    res.status(400).json({ error: 'missing action' });
    return;
  }
  try {
    // wallet-integration: in wallet mode, company offers target the wallet party
    // (contractor payload stays "alice"/"bob"; resolution comes from parties.json)
    if (WALLET_MODE && persona === 'company' && action === 'propose') {
      const contractorKey = String(payload?.['contractor'] ?? '');
      const walletParty = walletParties()[contractorKey];
      if (walletParty) {
        const rate = Number(payload?.['rate']);
        const role = String(payload?.['role'] ?? '');
        if (!role || !Number.isFinite(rate) || rate <= 0) {
          res.status(400).json({ error: 'missing or invalid role/rate' });
          return;
        }
        const result = await submitAndWait(config.parties.company, {
          CreateCommand: {
            templateId: templateId('AgreementProposal'),
            createArguments: {
              company: config.parties.company,
              contractor: walletParty,
              role,
              hourlyRate: String(rate),
              currency: 'USD',
            },
          },
        });
        res.json({ ok: true, updateId: result.updateId ?? null });
        return;
      }
    }
    const result = await handleAction(persona, action, payload);
    res.json({ ok: true, updateId: result.updateId ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[paydae] POST /api/action ${action} failed:`, message);
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => console.log(`Paydae backend running at http://localhost:${PORT}`));
