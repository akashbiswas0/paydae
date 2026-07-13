# Paydae wallet layer — Canton Wallet Gateway (branch: wallets-external)

Contractor actions (Countersign, SubmitInvoice) are **signed by the contractor's
own wallet** through a Canton Wallet Gateway (official `@canton-network` wallet
SDK infrastructure) instead of the custodial Express backend. Each contractor is
a **new external Canton party with its own key namespace** — the company's
credentials physically cannot sign for them. Company actions (offers, approvals,
payday) stay on the existing custodial path. Two parallel paths, zero shared code:

```
contractor browser ──JSON-RPC──► wallet gateway (:3030) ──► auth proxy (:9000) ──► JSON Ledger API
   (SignModal)                    prepare / sign / execute      stamps real           (fivenorth
                                  ed25519 wallet keys           OAuth token            devnet)
company browser    ──existing──► Express backend (:4000) ──────────────────────► JSON Ledger API
```

## Run (4 processes)

```bash
# 0. once: repo-root .env with AUTH_URL / CLIENT_ID / CLIENT_SECRET / LEDGER_API
cd wallet && npm install
npm run devnet                    # 1+2: auth proxy :9000 + wallet gateway :3030
node onboard.mjs                  # once: onboard PaydaeAliceW/PaydaeBobW -> parties.json

cd ../backend  && WALLET_MODE=1 npm run dev          # 3: Express API :4000
cd ../frontend && npm run dev                        # 4: Next.js :3000
# frontend/.env.local (gitignored):
#   NEXT_PUBLIC_WALLET_MODE=1
#   NEXT_PUBLIC_WALLET_GATEWAY_URL=http://localhost:3030
```

With both flags unset the app is behaviorally identical to `main` (verified —
see [E2E.md](E2E.md) "Custodial regression").

Optional Canton Coin (stretch, live on devnet):

```bash
node coin/fund-treasury.mjs 5000   # tap real Amulet from the sandbox party into PaydaeCo
node coin/payday-cc.mjs            # after payday: CC transfers to each wallet party,
                                   # accepted THROUGH their wallet session
```

## What's in here

| File | Purpose |
|---|---|
| `devnet-proxy.mjs` | Auth-injecting proxy (:9000): stamps a real Authentik m2m token on every forwarded ledger call; also forwards `/scan-proxy/*` to the Token Standard registry. Secret read from repo-root `.env`. |
| `config.fivenorth-devnet.json` | Gateway config: 5North devnet synchronizer, self-signed demo IDP, sqlite stores. |
| `start-devnet.sh` | Boots proxy + gateway (`npm run devnet`). |
| `onboard.mjs` | Onboards the contractor wallets (new external parties) and writes `parties.json` for the backend's propose resolution. |
| `probe.mjs` | Phase-0 proof script: full wallet lifecycle incl. wallet-signed Countersign + forge negative. |
| `mirror-wallet.mjs` | Sandbox workaround, see below. |
| `coin/fund-treasury.mjs` · `coin/payday-cc.mjs` | Real Canton Coin funding + payday settlement. |
| `E2E.md` | The full e2e evidence: updateIds, proof assertions, regression. |

Frontend counterpart: `frontend/src/wallet/` (gateway adapter, Redux slice,
WalletCard, SignModal). Existing app files are touched only at marked
`// wallet-integration:` points (store.ts, ContractorView.tsx, backend
index.ts).

## Signing flow (what "wallet-signed" means here)

1. Browser asks the gateway to **prepare** the exact Daml exercise
   (`prepareExecute` on the dApp API) — Canton returns the serialized prepared
   transaction and its hash.
2. The **SignModal** shows the human-readable action ("Countersign: Designer ·
   $70/h from Paydae Inc.", signing party). Reject = nothing ever submitted.
3. On approve, the gateway's signing store signs the hash with the wallet's
   **ed25519 key** (`sign`), and the signature is submitted via Canton
   **interactive submission** (`execute`) → committed updateId shown in the
   TxToast.

The negative proof: replaying a contractor action through the custodial path
(`actAs` the wallet party with the company's m2m credentials) is rejected by the
ledger with PERMISSION_DENIED — external parties require their own key's
signature.

## Sandbox quirks (why mirror-wallet.mjs exists)

- The shared sandbox ledger user `6` is at its participant rights quota
  (`TOO_MANY_USER_RIGHTS`), so wallet onboarding runs as a dedicated gateway
  user `paydae-wallet` (created once via `POST /v2/users` with the m2m token) —
  the `CanActAs <new party>` grant lands on that user instead.
- The auth proxy stamps the single m2m token (ledger user `6`) on every call,
  and Canton's submission endpoints require body `userId` == token user — so
  prepare/sign/execute run as user `6` (it holds `CanExecuteAsAnyParty`).
- The gateway's wallet store is per-user; `mirror-wallet.mjs` copies the
  onboarded wallet row to user `6` so those calls can see it. Signing keys are
  looked up by public key, so signing is unaffected.

On a dedicated validator (own OAuth clients per user) none of this is needed.

## Custody model (honest)

The gateway holds the wallets' ed25519 signing keys in its local
`signing_store.devnet.sqlite` — a **self-hosted wallet service** signing
per-transaction after explicit user review, not device-side custody. The
browser session uses the gateway's self-signed demo IDP ("unsafe-auth"), which
is demo-grade auth by design. Device keys (WebAuthn / hardware) and a real IDP
are the natural next step via the gateway's pluggable signing drivers
(Fireblocks / Dfns / Blockdaemon drivers ship with it).

CC settlement note: the Canton Coin payday is a follow-on transfer after the
USD payday — recipients accept it wallet-signed, but it is not yet atomic with
invoice consumption. Atomic delivery-vs-payment = Token Standard allocations
(the gateway + wallet-sdk support them; roadmap).

## Attribution

Gateway config, auth proxy, start script and the coin funding pattern vendored
(and adapted) from https://github.com/akashbiswas0/canton-start — a fork of
Digital Asset's [canton-network-quickstart](https://github.com/digital-asset/cn-quickstart)
(Apache-2.0) pointed at the same 5North devnet sandbox. The gateway itself is
`@canton-network/wallet-gateway-remote@1.4.0` (npm).
