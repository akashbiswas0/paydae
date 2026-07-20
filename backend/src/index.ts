// Paydae backend — Express + TypeScript.
//
// Browser-key wallet architecture: every user (companies AND contractors) is an
// external Canton party whose ed25519 key lives only in their browser. The
// backend holds no signing keys — it is the authenticated pipe to the validator:
//
//   POST /api/wallet/create           public key -> party topology to sign
//   POST /api/wallet/create/complete  signed topology -> party allocated + profile saved
//   POST /api/wallet/load             public key -> {role, partyId, displayName}
//   GET  /api/contractors             directory for the company's offer form
//   GET  /api/state?party=            role-aware app state (reads as user 6)
//   POST /api/tx/prepare              action -> prepared transaction + hash + summary
//   POST /api/tx/execute              browser signature -> committed updateId
import express from 'express';
import cors from 'cors';
import {
  activeContracts,
  allocateExternalParty,
  executeSubmission,
  generateTopology,
  prepareSubmission,
  updateById,
  waitForParty,
} from './ledger.js';
import { groupState } from './state.js';
import { buildAction } from './walletActions.js';
import {
  listAuditors,
  listContractors,
  partyNames as partyNamesMap,
  profileByParty,
  profileByPublicKey,
  saveProfile,
} from './profiles.js';
import type { ActionName, Role } from './types.js';

const PORT = Number(process.env.PORT) || 4000;
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' })); // prepared transactions are sizeable

const isRole = (r: unknown): r is Role =>
  r === 'company' || r === 'contractor' || r === 'auditor';
const isPublicKey = (k: unknown): k is string =>
  typeof k === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(k);

function fail(res: express.Response, status: number, error: string): void {
  res.status(status).json({ error });
}

const handle =
  (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
  (req: express.Request, res: express.Response) => {
    fn(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[paydae] ${req.method} ${req.path} failed:`, message);
      fail(res, 500, message);
    });
  };

// ---------- wallet onboarding ----------

app.post(
  '/api/wallet/create',
  handle(async (req, res) => {
    const { role, displayName, publicKey } = req.body ?? {};
    if (!isRole(role)) return fail(res, 400, 'role must be "company", "contractor" or "auditor"');
    if (typeof displayName !== 'string' || !displayName.trim()) {
      return fail(res, 400, 'missing displayName');
    }
    if (!isPublicKey(publicKey)) return fail(res, 400, 'publicKey must be base64 ed25519 (32 bytes)');
    if (profileByPublicKey(publicKey)) return fail(res, 409, 'this key already has a profile — use Load Wallet');
    const hint = displayName.trim().replace(/[^A-Za-z0-9_-]/g, '');
    if (!hint) return fail(res, 400, 'displayName needs at least one alphanumeric character');
    const topo = await generateTopology(hint, publicKey);
    // stateless handshake: the browser signs multiHash and posts everything back
    res.json(topo);
  }),
);

app.post(
  '/api/wallet/create/complete',
  handle(async (req, res) => {
    const {
      role,
      displayName,
      publicKey,
      partyId,
      publicKeyFingerprint,
      topologyTransactions,
      multiHashSignature,
    } = req.body ?? {};
    if (!isRole(role)) return fail(res, 400, 'role must be "company", "contractor" or "auditor"');
    if (typeof displayName !== 'string' || !displayName.trim()) {
      return fail(res, 400, 'missing displayName');
    }
    if (!isPublicKey(publicKey)) return fail(res, 400, 'invalid publicKey');
    if (
      typeof partyId !== 'string' ||
      typeof publicKeyFingerprint !== 'string' ||
      !Array.isArray(topologyTransactions) ||
      typeof multiHashSignature !== 'string'
    ) {
      return fail(res, 400, 'missing onboarding fields');
    }
    await allocateExternalParty(
      topologyTransactions as string[],
      multiHashSignature,
      publicKeyFingerprint,
    );
    await waitForParty(partyId);
    const profile = saveProfile({
      fingerprint: publicKeyFingerprint,
      publicKey,
      partyId,
      role,
      displayName: displayName.trim(),
    });
    res.json({ role: profile.role, partyId: profile.partyId, displayName: profile.displayName });
  }),
);

app.post(
  '/api/wallet/load',
  handle(async (req, res) => {
    const { publicKey } = req.body ?? {};
    if (!isPublicKey(publicKey)) return fail(res, 400, 'invalid publicKey');
    const profile = profileByPublicKey(publicKey);
    if (!profile) return fail(res, 404, 'no profile for this key on this Paydae instance');
    res.json({ role: profile.role, partyId: profile.partyId, displayName: profile.displayName });
  }),
);

app.get(
  '/api/contractors',
  handle(async (_req, res) => {
    res.json(
      listContractors().map((p) => ({ partyId: p.partyId, displayName: p.displayName })),
    );
  }),
);

app.get(
  '/api/auditors',
  handle(async (_req, res) => {
    res.json(listAuditors().map((p) => ({ partyId: p.partyId, displayName: p.displayName })));
  }),
);

// ---------- app state ----------

app.get(
  '/api/state',
  handle(async (req, res) => {
    const party = req.query.party;
    if (typeof party !== 'string' || !party) return fail(res, 400, 'missing party');
    const profile = profileByParty(party);
    if (!profile) return fail(res, 404, 'unknown party — create or load a wallet first');
    const contracts = await activeContracts(party);
    res.json(groupState(contracts, profile.role, party));
  }),
);

// transaction receipt: only works for a party that was a stakeholder — Canton
// never delivered the transaction to anyone else, so there is nothing to show
app.get(
  '/api/update/:updateId',
  handle(async (req, res) => {
    const party = req.query.party;
    const updateId = req.params.updateId;
    if (typeof party !== 'string' || !party) return fail(res, 400, 'missing party');
    if (typeof updateId !== 'string' || !updateId) return fail(res, 400, 'missing updateId');
    const profile = profileByParty(party);
    if (!profile) return fail(res, 404, 'unknown party');
    const details = await updateById(party, updateId);
    if (!details) {
      return fail(res, 404, 'update not found — or this party was not a stakeholder of it');
    }
    res.json({ ...details, partyNames: partyNamesMap() });
  }),
);

// ---------- wallet-signed writes (prepare -> browser signs -> execute) ----------

app.post(
  '/api/tx/prepare',
  handle(async (req, res) => {
    const { party, action, payload } = req.body ?? {};
    if (typeof party !== 'string' || !party) return fail(res, 400, 'missing party');
    const profile = profileByParty(party);
    if (!profile) return fail(res, 404, 'unknown party — create or load a wallet first');
    const built = await buildAction(profile, action as ActionName, payload ?? {});
    const prepared = await prepareSubmission(party, built.commands);
    res.json({
      preparedTransaction: prepared.preparedTransaction,
      preparedTransactionHash: prepared.preparedTransactionHash,
      summary: built.summary,
    });
  }),
);

app.post(
  '/api/tx/execute',
  handle(async (req, res) => {
    const { party, preparedTransaction, signature } = req.body ?? {};
    if (typeof party !== 'string' || !party) return fail(res, 400, 'missing party');
    if (typeof preparedTransaction !== 'string' || typeof signature !== 'string') {
      return fail(res, 400, 'missing preparedTransaction or signature');
    }
    // authority comes from the signature itself: the ledger verifies it against
    // the party's key namespace. The profile check just gives a friendly error.
    if (!profileByParty(party)) return fail(res, 404, 'unknown party');
    const result = await executeSubmission(party, preparedTransaction, signature);
    console.log(`[paydae] committed ${result.updateId} signed by ${party.split('::')[0]}`);
    res.json({ ok: true, updateId: result.updateId ?? null });
  }),
);

app.listen(PORT, () => console.log(`Paydae backend (browser-key wallets) at http://localhost:${PORT}`));
