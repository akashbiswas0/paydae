# Paydae wallet layer — Canton Wallet Gateway (branch: wallets-external)

Contractor actions (Countersign, SubmitInvoice) are **signed by the contractor's
own wallet** through a Canton Wallet Gateway (official `@canton-network` wallet
SDK infrastructure) instead of the custodial Express backend. Each contractor is
a **new external Canton party with its own key namespace** — the company's
credentials physically cannot sign for them. Company actions (offers, approvals,
payday) stay on the existing custodial path. Two parallel paths, zero shared code.

The UX follows DA's canton-network-quickstart dApp pattern: the browser uses
**`@canton-network/dapp-sdk`** (CIP-103) — "Connect wallet" opens the SDK's
wallet picker and the gateway's own login popup; every exercise opens the
**gateway's approve popup**, where the user reviews the prepared transaction
(action, amount, signatories, hash) and Approves — the wallet key signs and the
gateway submits via Canton interactive submission. One gateway instance per
contractor:

```
alice browser ──dapp-sdk──► gateway :3030 (alice's wallet) ─┐
bob browser   ──dapp-sdk──► gateway :3031 (bob's wallet)   ─┼─► auth proxy :9000 ──► JSON Ledger API
   (login + approve popups)  ed25519 keys, review & sign    │      stamps real          (fivenorth
                                                            │      OAuth token           devnet)
company browser ──existing─► Express backend :4000 ─────────┘
```

## Run (5 processes, one command for the wallet stack)

```bash
# 0. once: repo-root .env with AUTH_URL / CLIENT_ID / CLIENT_SECRET / LEDGER_API
cd wallet && npm install
npm run devnet     # auth proxy :9000 + alice gateway :3030 + bob gateway :3031 + mirror-watch

cd ../backend  && WALLET_MODE=1 npm run dev          # Express API :4000
cd ../frontend && npm run dev                        # Next.js :3000
# frontend/.env.local (gitignored):
#   NEXT_PUBLIC_WALLET_MODE=1
#   NEXT_PUBLIC_WALLET_GATEWAY_URL=http://localhost:3030       (alice)
#   NEXT_PUBLIC_WALLET_GATEWAY_URL_BOB=http://localhost:3031   (bob)
```

## Manual wallet onboarding (the demo user does this, in the gateway UI)

1. Open the contractor's gateway (http://localhost:3030 alice / :3031 bob).
2. Log into the **"Wallet Onboarding (5North DevNet)"** network.
3. Parties page → **+ New** → hint containing the contractor name (e.g.
   `PaydaeAliceW2`), signing provider **wallet-kernel**, create.
4. That's it — `mirror-watch` records the new wallet party in `parties.json`
   (so company offers target it) and makes it visible to the dApp session.

Then in the app: **Connect wallet** → SDK picker → gateway login popup → pick
**"Canton DevNet (5North sandbox)"** → Connect. Countersign / Submit invoice
now open the gateway's approve popup for review + signing.

`onboard.mjs` still exists as a scripted alternative to steps 1–3.

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

1. The dApp calls `prepareExecuteAndWait` (dapp-sdk) — the gateway **prepares**
   the exact Daml exercise and Canton returns the serialized prepared
   transaction and its hash.
2. The **gateway's approve popup** opens: Activity Details show the action type,
   amount, signatories, template and transaction hash. Reject = nothing ever
   submitted.
3. On **Approve**, the gateway signs the hash with the wallet's **ed25519 key**
   and submits the signature via Canton **interactive submission** → the popup
   closes and the committed updateId lands in the app's TxToast.

The negative proof: replaying a contractor action through the custodial path
(`actAs` the wallet party with the company's m2m credentials) is rejected by the
ledger with PERMISSION_DENIED — external parties require their own key's
signature.

## Sandbox quirks (why mirror-watch.mjs exists)

- The shared sandbox ledger user `6` is at its participant rights quota
  (`TOO_MANY_USER_RIGHTS`), so wallet onboarding happens on a separate
  **"Wallet Onboarding" network entry** whose clientId is a dedicated gateway
  user `paydae-wallet` (created once via `POST /v2/users` with the m2m token) —
  the `CanActAs <new party>` grant lands on that user instead.
- The auth proxy stamps the single m2m token (ledger user `6`) on every call,
  and Canton's submission endpoints require body `userId` == token user — so
  the dApp session (prepare/sign/execute) runs on the main network as user `6`
  (it holds `CanExecuteAsAnyParty`).
- The gateway's wallet store is per-user and per-network; the background
  `mirror-watch.mjs` copies each manually onboarded wallet row to user `6` on
  the main network, records a rights row (so the approve page enables
  submission — user 6's real `CanExecuteAsAnyParty` is invisible to the local
  store), and maintains `parties.json` (hint containing "alice"/"bob" →
  persona) for the backend's offer resolution. Signing keys are looked up by
  public key, so signing is unaffected.
- `mirror-wallet.mjs` is the one-shot version used by the scripted flow.

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
