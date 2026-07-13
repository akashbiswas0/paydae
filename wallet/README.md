# Paydae wallet layer — Canton Wallet Gateway (branch: wallets-external)

Contractor actions (Countersign, SubmitInvoice) signed through a **Canton Wallet
Gateway** (official `@canton-network` wallet SDK infrastructure) instead of the
custodial Express backend. Company actions stay custodial. Two parallel paths,
zero shared code:

```
contractor browser ──dapp-sdk──► wallet gateway (:3030) ──► auth proxy (:9000) ──► JSON Ledger API
company browser    ──existing──► Express backend (:4000) ──────────────────────► JSON Ledger API
```

## Files

- `devnet-proxy.mjs` — auth-injecting proxy (:9000). Stamps a real Authentik
  client-credentials token on every forwarded request; reads `CLIENT_ID` /
  `CLIENT_SECRET` from the repo-root `.env`. Also forwards `/scan-proxy/*` to the
  validator's Token Standard registry.
- `config.fivenorth-devnet.json` — Wallet Gateway config for the 5North devnet
  validator (synchronizer id, self-signed demo IDP, sqlite stores).
- `start-devnet.sh` — boots proxy + gateway (`npm run devnet`).
- `probe.mjs` — Phase-0 proof: onboards a new external party through the gateway
  and countersigns a Paydae AgreementProposal with a wallet signature.
- `mirror-wallet.mjs` — mirrors an onboarded wallet row to ledger user `6` in the
  gateway store (see "Sandbox quirks" below).

## Run

```bash
cd wallet && npm install
npm run devnet          # proxy :9000 + gateway :3030
node probe.mjs          # end-to-end wallet lifecycle proof
```

## Sandbox quirks (why mirror-wallet.mjs exists)

- The shared sandbox ledger user `6` is at its participant rights quota
  (`TOO_MANY_USER_RIGHTS`), so wallet onboarding runs as a dedicated gateway user
  `paydae-wallet` (created once via `POST /v2/users` with the m2m token) — the
  `CanActAs <new party>` grant lands on that user.
- The auth proxy stamps the single m2m token (ledger user `6`) on every call, and
  Canton submission endpoints require body `userId` == token user — so
  prepare/sign/execute run as user `6` (it holds `CanExecuteAsAnyParty`).
- The gateway's wallet store is per-user; `mirror-wallet.mjs` copies the onboarded
  wallet row to user `6` so those submission calls can see it. Signing keys are
  looked up by public key, so signing is unaffected.

## Phase-0 proof (devnet, 2026-07-13)

- Wallet party (new namespace, external ed25519 key held by the gateway):
  `PaydaeProbeW::122067efd34557282e06637871938e30f8c45c7b65da9cac3af11d327df33b5eee3e`
- Wallet-signed Countersign updateId:
  `1220882bb41addc89f182319034463d864063b8fafdd7c539e13ce66f358b80a6296`
- Forge negative: custodial `submit-and-wait` with `actAs` the wallet party →
  HTTP 403 PERMISSION_DENIED (the external party's signature cannot be forged by
  the company's credentials).

## Custody note (honest)

The gateway holds the wallets' ed25519 signing keys in its local
`signing_store.devnet.sqlite` — this is a self-hosted wallet service signing
per-transaction after explicit review, not device-side key custody. Device keys
(e.g. WebAuthn / hardware wallets) are the natural next step via the gateway's
signing-driver interface (Fireblocks/Dfns/Blockdaemon drivers already exist).

## Attribution

Gateway config, auth proxy and start script vendored (and adapted) from
https://github.com/akashbiswas0/canton-start — a fork of Digital Asset's
[canton-network-quickstart](https://github.com/digital-asset/cn-quickstart)
(Apache-2.0) pointed at the same 5North devnet sandbox. The wallet gateway itself
is `@canton-network/wallet-gateway-remote@1.4.0` (npm).
