# Canton App Blueprint

A complete, self-contained recipe for building **any** web application on Canton with
**browser-held wallets** — the exact architecture, parameters, request bodies, and gotchas
proven in the Paydae app on the FiveNorth devnet. Hand this file to a developer (or an AI)
and they can build a new Canton app with the same wallet behavior without reading Paydae's code.

**The core idea:** every user of the app is a Canton *external party*. Their ed25519 private key
is generated in the browser, stored only in `localStorage` + a downloadable key file, and used to
sign (a) their party-onboarding topology and (b) the hash of every transaction they submit.
The backend never holds a signing key — it is an authenticated pipe to the validator that
*prepares* transactions and *forwards* signatures. The ledger itself verifies every signature
against the party's key namespace, so a compromised backend still cannot forge a user action.

---

## 1. Architecture

```
┌───────────────────────── Browser ─────────────────────────┐
│  ed25519 keypair (tweetnacl) — NEVER leaves the browser   │
│  localStorage keystore + downloadable JSON key file       │
│  signs: onboarding multiHash, preparedTransactionHash     │
└───────────────┬───────────────────────────────────────────┘
                │ public keys, signatures, JSON (no secrets)
┌───────────────▼──────────── Backend (Express) ────────────┐
│  OAuth2 client-credentials JWT to the validator           │
│  profiles DB (sqlite): publicKey -> {partyId, role, name} │
│  builds commands, calls prepare/execute, reads ACS        │
└───────────────┬───────────────────────────────────────────┘
                │ JSON Ledger API v2 (HTTPS + Bearer JWT)
┌───────────────▼──────── Canton Validator (devnet) ────────┐
│  external-party onboarding, interactive submission,       │
│  signature verification, privacy (stakeholder-only data)  │
└───────────────────────────────────────────────────────────┘
```

Three layers, each replaceable independently:

1. **Daml model** (`daml/`) — templates define *who can do what*; signatories/observers define
   *who can see what*. This is the only Canton-specific "smart contract" code.
2. **Backend** (`backend/`) — Express + TypeScript (`tsx watch`), port 4000. Stateless with
   respect to keys; stateful only for the profiles directory (better-sqlite3).
3. **Frontend** (`frontend/`) — Next.js App Router + Redux Toolkit + Tailwind. Rewrites
   `/api/*` → `http://localhost:4000/api/*` (see `frontend/next.config.ts`).

**No gas, ever.** Canton has no user-paid transaction fee. The validator operator pays traffic.
Users create a wallet and transact immediately — there is **no faucet/funding step**. Do not
build one.

---

## 2. Validator / environment details

### 2.1 `.env` (repo root — NEVER commit this file)

```
LEDGER_API=https://ledger-api.validator.devnet.sandbox.fivenorth.io
AUTH_URL=https://auth.sandbox.fivenorth.io/application/o/token/
CLIENT_ID=<oauth client id — in .env>
CLIENT_SECRET=<oauth client secret — in .env>
```

### 2.2 Minting a JWT (OAuth2 client credentials)

`POST $AUTH_URL` with `Content-Type: application/x-www-form-urlencoded`:

| field           | value               |
| --------------- | ------------------- |
| `grant_type`    | `client_credentials`|
| `client_id`     | `$CLIENT_ID`        |
| `client_secret` | `$CLIENT_SECRET`    |
| `audience`      | `$CLIENT_ID`        |
| `scope`         | `daml_ledger_api`   |

Response: `{ "access_token": "<jwt>" }`. Tokens live **8 hours** — cache and re-mint after ~7h,
and retry once with a fresh token on any 401 (see `backend/src/ledger.ts`).

Every Ledger API call: `Authorization: Bearer <jwt>`, JSON bodies, base URL `$LEDGER_API`.

### 2.3 `config.json` (repo root, committed)

```json
{
  "packageId": "b6c41b85c14063cad92ff77488b39bce6b42ef837805f7626f5bef948876d240",
  "parties": { "...legacy custodial demo parties, not needed for new apps..." : "" },
  "userId": "6"
}
```

- `packageId` — the hash of the uploaded DAR; template IDs are `<packageId>:<Module>:<Entity>`.
- `userId: "6"` — the **ledger user** the backend's JWT maps to on this validator. It has
  `ParticipantAdmin`, `CanExecuteAsAnyParty`, and `CanReadAsAnyParty`. That is what lets one
  backend serve every wallet: it can *prepare/execute/read for* any party, but **authority to
  act still comes only from the party's own ed25519 signature**, verified by the ledger.
- **Crucial devnet fact:** external parties need **zero user-rights grants**. Do not call
  `/v2/users/*/rights` for them. (Rights grants were only ever needed for old custodial parties;
  the operator has pruned user 6's rights before — don't depend on per-party grants.)

### 2.4 Synchronizer

Needed in onboarding + prepare bodies. Fetch once and cache:

```
GET /v2/state/connected-synchronizers
→ { "connectedSynchronizers": [ { "synchronizerId": "..." } ] }
```

---

## 3. The Daml model layer

Write your domain as templates in `daml/daml/<Module>.daml`. Rules of thumb proven here:

- `signatory` = whose authority the contract carries; `observer` = who else can see it.
  Privacy is automatic: non-stakeholders **cannot see the contract exists at all**.
- A proposal/accept pattern gets you dual-signed contracts: template signed by A with B as
  observer, plus a `choice` controlled by B that `create`s the dual-signatory template.
- Dual-signed contracts can't be plain-archived by one side — consume them via a controlled
  choice (see `MarkPaid` in `daml/daml/Paydae.daml`).
- One `exercise` = one **atomic transaction**: a choice body that fetches N contracts, asserts
  invariants, exercises sub-choices, and recreates state either fully commits or fully aborts
  (see `PayAllApproved`).
- `Decimal` fields are sent **as strings** over the JSON API (`"hourlyRate": "120"`).

Build + deploy (this is an **admin HTTP call**, not a wallet action — no wallet "deploys" anything):

```bash
cd daml && daml build                     # requires daml SDK (yaml says sdk-version 3.5.2)
# upload .daml/dist/<name>-<version>.dar:
curl -X POST "$LEDGER_API/v2/packages" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/octet-stream" --data-binary "@<file>.dar"
```

The new `packageId` is the DAR's main package hash (`daml damlc inspect-dar` shows it);
put it in `config.json`. `scripts/devnet.sh` wraps token/upload/acs helpers.

---

## 4. Wallet onboarding (browser-key external party)

The full handshake — the backend is a stateless relay; the browser signs in the middle.

### Step A — browser generates the key

```js
import nacl from "tweetnacl";
const pair = nacl.sign.keyPair();          // publicKey: 32 bytes, secretKey: 64 bytes
// store both base64-encoded; base64(publicKey) is 44 chars matching /^[A-Za-z0-9+/]{43}=$/
```

### Step B — backend: generate topology from the public key

```
POST /v2/parties/external/generate-topology
{
  "synchronizer": "<synchronizerId>",
  "partyHint": "<display name sanitized to [A-Za-z0-9_-]>",
  "publicKey": {
    "format": "CRYPTO_KEY_FORMAT_RAW",
    "keyData": "<base64 32-byte public key>",
    "keySpec": "SIGNING_KEY_SPEC_EC_CURVE25519"
  },
  "localParticipantObservationOnly": false,
  "confirmationThreshold": 1,
  "otherConfirmingParticipantUids": [],
  "observingParticipantUids": []
}
→ { "partyId": "<hint>::<fingerprint>", "publicKeyFingerprint", "multiHash", "topologyTransactions": [".."] }
```

### Step C — browser signs the multiHash

```js
signature = base64( nacl.sign.detached( base64decode(multiHash), secretKey ) )
```

### Step D — backend: allocate the party

```
POST /v2/parties/external/allocate
{
  "synchronizer": "<synchronizerId>",
  "identityProviderId": "",
  "onboardingTransactions": [ { "transaction": "<each topologyTransaction>" }, ... ],
  "multiHashSignatures": [ {
    "format": "SIGNATURE_FORMAT_CONCAT",
    "signature": "<base64 sig from step C>",
    "signedBy": "<publicKeyFingerprint>",
    "signingAlgorithmSpec": "SIGNING_ALGORITHM_SPEC_ED25519"
  } ]
}
```

### Step E — wait for activation

Poll `GET /v2/parties/<urlencoded partyId>` every 2s (up to ~60s) until it appears.
**Gotcha:** a brand-new party's first submissions can still briefly 403 with a
"security-sensitive" error while topology propagates — retry for ~30s before failing.

Then save the profile (`publicKey → {partyId, role, displayName}`) in the backend's sqlite
directory so `Load Wallet` and party-name display work. **Never store private keys server-side.**

---

## 5. Wallet-signed writes (interactive submission)

Every state change follows **prepare → user reviews & signs in browser → execute**.
This is the MetaMask-equivalent UX and it must be preserved in any app built from this blueprint.

### 5.1 Prepare (backend)

```
POST /v2/interactive-submission/prepare
{
  "commands": [ <LedgerCommand>, ... ],
  "commandId": "<app>-wallet-<uuid>",
  "userId": "6",
  "actAs": ["<partyId>"],
  "readAs": [],
  "disclosedContracts": [],
  "synchronizerId": "<synchronizerId>",
  "packageIdSelectionPreference": [],
  "verboseHashing": false
}
→ { "preparedTransaction": "<big base64 blob>", "preparedTransactionHash": "<base64>" }
```

Command shapes (note Decimals as strings):

```json
{ "CreateCommand":   { "templateId": "<packageId>:<Module>:<Entity>", "createArguments": { ... } } }
{ "ExerciseCommand": { "templateId": "<packageId>:<Module>:<Entity>", "contractId": "...",
                       "choice": "<ChoiceName>", "choiceArgument": { ... } } }
```

### 5.2 Sign (browser — the confirm-modal contract)

Show the user a human-readable summary (built server-side alongside the commands) **plus** the
hash they are signing, with explicit Approve/Reject. On approve:

```js
signature = base64( nacl.sign.detached( base64decode(preparedTransactionHash), secretKey ) )
```

The key signs **the hash of the exact prepared transaction** — not a blank instruction. Reject
must submit nothing.

### 5.3 Execute (backend)

```
POST /v2/interactive-submission/executeAndWait
{
  "userId": "6",
  "preparedTransaction": "<blob from prepare>",
  "hashingSchemeVersion": "HASHING_SCHEME_VERSION_V2",
  "submissionId": "<uuid>",
  "deduplicationPeriod": { "Empty": {} },
  "partySignatures": { "signatures": [ {
    "party": "<partyId>",
    "signatures": [ {
      "signature": "<base64 sig>",
      "signedBy": "<partyId.split('::')[1]>",        // the key fingerprint
      "format": "SIGNATURE_FORMAT_CONCAT",
      "signingAlgorithmSpec": "SIGNING_ALGORITHM_SPEC_ED25519"
    } ]
  } ] }
}
→ { "updateId": "1220..." }
```

**Retry rule:** the shared devnet occasionally times out with a "timely response" error.
Retry up to 3× with a 3s pause **reusing the same `submissionId`** — the ledger deduplicates,
so retries are safe.

**Security property (verified):** submitting with a wrong/other key's signature is rejected by
the ledger (`FAILED_TO_EXECUTE...`/403). Signature verification is ledger-side; the backend's
profile checks are only for friendly errors.

---

## 6. Reads

- **Ledger end:** `GET /v2/state/ledger-end` → `{ "offset": n }`
- **Active contracts (per party):**
  ```
  POST /v2/state/active-contracts
  { "filter": { "filtersByParty": { "<partyId>": {} } }, "verbose": true, "activeAtOffset": <offset> }
  ```
  Entries: `contractEntry.JsActiveContract.createdEvent.{contractId, templateId, createArgument}`.
  Entity name = `templateId.split(':')[2]`. Reads run as user 6 (CanReadAsAnyParty), but Canton
  only returns contracts the party is a stakeholder of — this is the privacy demo.
- **Transaction receipt (stakeholder-only — powers the in-app "explorer" page):**
  ```
  POST /v2/updates/update-by-id
  { "updateId": "...", "updateFormat": { "includeTransactions": {
      "eventFormat": { "filtersByParty": { "<partyId>": {} }, "verbose": true },
      "transactionShape": "TRANSACTION_SHAPE_ACS_DELTA" } } }
  ```
  Returns `update.Transaction.value.{updateId, effectiveAt, events[]}` with
  `CreatedEvent`/`ArchivedEvent`. Non-stakeholders get 404 `UPDATE_NOT_FOUND` — build the UI to
  say so; there is **no public Canton explorer** and that is the point.
- **Update stream:** `POST /v2/updates/flats` with
  `{ "beginExclusive": 0, "endInclusive": <ledger-end offset>, "filter": { "filtersByParty": {...} }, "verbose": false }`.

---

## 7. Backend API surface (the pattern to replicate)

Express, port 4000, `cors()`, `express.json({ limit: '2mb' })` (prepared transactions are big).
See `backend/src/index.ts`. Any Canton app should expose the same seven-route shape:

| route | body → response | purpose |
| --- | --- | --- |
| `POST /api/wallet/create` | `{role, displayName, publicKey}` → generate-topology result | validate pubkey (`/^[A-Za-z0-9+/]{43}=$/`), 409 if key already has a profile |
| `POST /api/wallet/create/complete` | topo fields + `multiHashSignature` → `{role, partyId, displayName}` | allocate → waitForParty → save profile |
| `POST /api/wallet/load` | `{publicKey}` → profile or 404 | "Load Wallet" lookup |
| `GET /api/contractors` (directory) | → `[{partyId, displayName}]` | so users can address each other without pasting party IDs |
| `GET /api/state?party=` | → role-aware grouped ACS + `partyNames` map | poll every ~2.5s from the shell |
| `GET /api/update/:updateId?party=` | → receipt or 404 | transaction receipt page |
| `POST /api/tx/prepare` | `{party, action, payload}` → `{preparedTransaction, preparedTransactionHash, summary}` | server builds commands **and** the confirm-modal summary |
| `POST /api/tx/execute` | `{party, preparedTransaction, signature}` → `{ok, updateId}` | forwards to executeAndWait |

Action builder pattern (`backend/src/walletActions.ts`): a `buildAction(profile, action, payload)`
switch that (1) enforces role checks, (2) validates payload server-side, (3) returns
`{commands, summary: {title, description, fields: [label, value][]}}`. Display-only payload
fields (names, rates for math) feed the summary **only** — commands are built from contract IDs
and validated inputs, so a lying client can only mislabel its own confirm modal, never forge state.

Profiles store (`backend/src/profiles.ts`): better-sqlite3, WAL mode, single table
`profiles(fingerprint PK, public_key UNIQUE, party_id UNIQUE, role, display_name, created_at)`.
Gitignore the `.sqlite*` files.

---

## 8. Frontend wallet layer (behavior to preserve exactly)

### 8.1 Keystore (`frontend/src/wallet/keystore.ts`)

- `tweetnacl` for keygen + detached signing. Keys are base64 (32-byte public, 64-byte secret).
- localStorage key `"<app>.wallets"` holding a map `fingerprint → StoredWallet`
  (`fingerprint = partyId.split("::")[1]`).
- Keys deliberately **stay out of Redux** so they never appear in devtools state dumps.
- **Key file** (downloaded on create, importable anywhere):
  ```json
  { "version": 1, "app": "<appname>", "role": "...", "displayName": "...",
    "partyId": "...", "publicKey": "<b64>", "privateKey": "<b64>" }
  ```
  `parseKeyFile` must recompute the public key from the secret key
  (`nacl.sign.keyPair.fromSecretKey`) and reject on mismatch — catches tampered/corrupt files.
- "Forget on this device" removes from localStorage only; the key file still works.
- The key file **is** the wallet. Losing every copy orphans the party — no recovery. Say so in the UI.

### 8.2 Flows (`frontend/src/wallet/onboarding.ts`, `Landing.tsx`)

- **Create wallet:** keygen → `POST /api/wallet/create` → sign `multiHash` → `.../complete`
  → save to keystore → **force key-file download** → route to `/w/<fingerprint>`. Any
  role-specific bootstrap action (Paydae: create treasury) is prepared+signed+executed silently
  with the fresh key as part of onboarding.
- **Load wallet:** file picker **and** paste-textarea fallback → `parseKeyFile` →
  `POST /api/wallet/load` → show "This is a **company/contractor** profile: *Name*" with a
  role-matching "Load … Profile" button → import to keystore → route to the wallet page.
- **Wallets on this device:** chips listing keystore entries (open / forget).

### 8.3 App shell + signing UX

- Route scheme `/w/[fingerprint]` (wallet dashboard) and `/w/[fingerprint]/tx/[updateId]`
  (receipt). Next.js App Router note: `params` is a Promise — unwrap with `use(params)` in
  client components. Resolve the wallet from the keystore **after mount** (localStorage is
  browser-only); redirect to `/` if missing.
- Redux slice holds `{profile, data, busy, pending, lastUpdateId, error}`. Thunks:
  `fetchState(party)` (poll 2.5s), `prepareTx` (→ sets `pending` with summary+hash),
  `executeTx` (→ clears pending, sets `lastUpdateId`, refetches).
- **ConfirmModal** (the MetaMask moment): renders the summary title/description/fields,
  "Signing as *Name* `<partyId slice>`", the tx-hash slice, and the note that the key signs
  this exact prepared transaction. Reject = clear pending, nothing submitted. Approve =
  `signHash(privateKey, preparedTransactionHash)` → `executeTx`. Disable both while busy.
  Lock all action buttons while `busy || pending !== null`.
- **TxToast**: on commit, show "Committed on Canton — tx `<id slice>`" for ~12s (devnet is slow;
  shorter timeouts get missed), clickable → receipt page, with a copy-id button.

---

## 9. Recipe: build a NEW Canton app from this blueprint

1. **Model** the domain as Daml templates (section 3). `daml build`, upload the DAR
   (`scripts/devnet.sh upload`), record the new `packageId` in `config.json`.
2. **Backend**: copy the layer verbatim — `env.ts` (reads root `.env` + `config.json`),
   `ledger.ts` (token cache, `ledger()` wrapper, onboarding, prepare/execute, ACS, update-by-id
   — all app-agnostic, reuse unchanged), `profiles.ts` (rename roles), and rewrite **only**
   `walletActions.ts` (your actions → commands + summaries) and `state.ts` (group your ACS by
   template into the shape your UI wants).
3. **Frontend**: copy `wallet/keystore.ts` + `wallet/onboarding.ts` (change the `app` string and
   any bootstrap action), `Landing.tsx`, `WalletShell.tsx`, `ConfirmModal.tsx`, `TxToast.tsx`,
   the `/w/[fingerprint]` routes, and the Redux slice. Rewrite only the role dashboards.
4. **Run**: `npm run dev` in `backend/` (tsx watch, :4000) and `frontend/` (:3000). No other
   processes — no gateway, no proxy, no funding scripts.
5. **Test the invariants** (all were verified for Paydae; re-verify for a new app):
   - create wallet → party allocated with zero rights grants, bootstrap action committed;
   - reject in the confirm modal → nothing on the ledger;
   - forged signature (another party's key) → ledger rejects;
   - privacy: a party's `/api/state` shows only its own contracts, and a non-stakeholder
     receipt lookup 404s;
   - restore: forget wallet → import key file → dashboard intact.

## 10. Devnet gotchas (hard-won, do not rediscover)

- `executeAndWait` "timely response" timeouts are transient — retry same `submissionId` (§5.3).
- New parties can 403 submissions for ~30s after allocation — retry loop.
- The operator can prune ledger-user rights without notice; the design must not depend on
  per-party `CanActAs` grants (external parties don't need them).
- JWTs last 8h; cache ~7h and retry-once on 401.
- Daml `Decimal` values are JSON **strings** in commands and come back as strings in `createArgument`.
- Party hints must be `[A-Za-z0-9_-]` — sanitize display names.
- `partyId` format is `<hint>::<fingerprint>`; the fingerprint doubles as `signedBy` in
  execute bodies and as the wallet's local ID.
- Hygiene: never commit `.env`, `*.sqlite*`, or wallet key files. Prepared transactions exceed
  Express's default JSON limit — set `2mb`.
