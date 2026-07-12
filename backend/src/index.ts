// Paydae backend — Express + TypeScript. All ledger calls happen server-side;
// the browser never sees credentials.
import express from 'express';
import cors from 'cors';
import { config } from './env.js';
import { activeContracts } from './ledger.js';
import { groupState } from './state.js';
import { handleAction } from './actions.js';
import type { ActionRequest, Persona } from './types.js';

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
    const contracts = await activeContracts(config.parties[persona]);
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
    const result = await handleAction(persona, action, payload);
    res.json({ ok: true, updateId: result.updateId ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[paydae] POST /api/action ${action} failed:`, message);
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => console.log(`Paydae backend running at http://localhost:${PORT}`));
