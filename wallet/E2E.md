# Wallet-mode e2e evidence (devnet, 2026-07-13)

Real-browser run (Chrome) with all four processes up: backend :4000
(`WALLET_MODE=1`), frontend :3000 (`NEXT_PUBLIC_WALLET_MODE=1`), auth proxy
:9000, wallet gateway :3030.

## Wallet parties (new namespaces = per-wallet ed25519 keys, external parties)

- Alice: `PaydaeAliceW::1220f000420713aadfd9a9247b03ef0ec1b51e7fe0996523e8f7fdde010b57aedde9`
- Bob:   `PaydaeBobW::122060c0044333cbfc36c2686253ffc39eb24f88be08ea63ae4238a7b693a2244ec6`

## Committed transactions (updateIds)

| Step | Path | updateId |
|---|---|---|
| Offer Designer $70/h → alice-wallet | custodial (company) | `1220fad395…91da98` |
| Offer Engineer $85/h → bob-wallet | custodial (company) | `1220…` (TxToast shown) |
| Alice Countersign | **wallet-signed** (SignModal → gateway) | `122047f41e…e828ba` |
| Bob Countersign | **wallet-signed** | `12209aeda4…0833f2` |
| Alice invoice 40h "June design work" ($2,800) | **wallet-signed** | `1220aa7bb0…e09780` |
| Bob invoice 10h "API integration" ($850) | **wallet-signed** | `12202a0df8…aa6c5b` (first attempt hit a devnet `executeAndWait` timeout; retry committed) |
| Approve Alice invoice | custodial (company) | `1220aa8fda…e8eef6` |
| Approve Bob invoice | custodial (company) | `12206852cd…fe5e20` |
| PayAllApproved (payday) | custodial (company) | `12203e430f…f88c14` |

Treasury: $48,000.00 → **$44,350.00** (−$3,650 exactly). Both contractors show
Paid ✓ ($2,800 / $850).

## Proof assertions

- **Forge rejection**: `POST /v2/commands/submit-and-wait` with the company's
  m2m credentials and `actAs: [PaydaeAliceW…]` (SubmitInvoice 99h "FORGED BY
  COMPANY") → **HTTP 403 PERMISSION_DENIED**. The wallet party is an external
  party — its transactions require the wallet key's signature, which the
  company does not hold.
- **Reject path**: SignModal opened for Alice's Countersign, clicked Reject →
  proposal still pending, agreements 0 (curl-verified; no ledger write).
- **Privacy**: ACS of alice-wallet (2 contracts) and bob-wallet (2 contracts) —
  zero contracts on either ACS mentioning the other party. Bob's tab showed
  nothing of Alice's throughout (screenshot).
- **Custodial regression**: with `WALLET_MODE` unset (backend) and
  `NEXT_PUBLIC_WALLET_MODE` unset (frontend): no wallet UI renders, contractor
  pages show the custodial parties' state, `&party=` override is ignored, and
  company propose targets `PaydaeAlice::…` (curl-verified; test proposal
  archived afterwards).

## Reference-UX rework (dapp-sdk popups + manual onboarding), same day

The flow was reworked to match DA's quickstart dApp UX (reference:
github.com/akashbiswas0/canton-start) and re-verified in real Chrome:

- **Manual onboarding**: created wallet `PaydaeBobW2` by hand in Bob's gateway
  web UI (:3031 → "Wallet Onboarding" network → Parties → + New → wallet-kernel)
  → "Party created" toast; party
  `PaydaeBobW2::1220e736e395ad88b0cda789334202717982072b3ef17d9c8049b377110f0b525e40`
  allocated on devnet; `mirror-watch` auto-updated `parties.json`.
- **Connect**: dApp "Connect wallet" → dapp-sdk wallet picker ("Paydae Wallet
  Gateway") → gateway login popup (network select + Client ID) → connected;
  session restore works on reconnect.
- **Wallet-signed exercises via the gateway approve popup**: Countersign and
  SubmitInvoice (10h "API integration", Amount 850 shown in Activity Details)
  both reviewed + approved in the gateway popup, committed on devnet
  (agreement active, invoice pending in-app afterwards).
- Alice reconnected the same way on her gateway (:3030): PaydaeAliceW with the
  2,800 CC badge and her $2,800 Paid ✓ history intact.
- The earlier SignModal was removed; review + signing now happen in the
  gateway's own approve page (`/approve/…&closeafteraction`), exactly like the
  reference app.
