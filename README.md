# Paydae — Confidential Contractor Payroll on Canton

**Web3 Deel.** Agreement + invoice + payment as one private, atomic workflow on the
Canton Network. Payday for every contractor is **one atomic transaction**, and each
contractor's terms, invoices, and payments are **invisible to everyone else** — not
because the app filters them out, but because Canton's validator never distributes
those contracts to non-stakeholders in the first place.

Built for the Canton Network hackathon (July 2026). Verified end-to-end against
Canton **Devnet** (Seaport sandbox validator, `fivenorth.io`).

## The two moments that matter

1. **Privacy is the ledger's, not the app's.** Open Alice's and Bob's tabs side by
   side: each sees only their own agreement, rate, invoices, and payments. Alice's
   data never reaches Bob's party — `queryContractId` as Bob on Alice's agreement
   returns `None` at the ledger level (covered by a script test).
2. **One-click atomic payday.** `Treasury.PayAllApproved` fetches every approved
   invoice, checks the balance covers the total, marks each invoice paid, and
   debits the treasury — in a single Canton transaction. Insufficient balance means
   *nothing* happens (also covered by a test).

## Architecture

```
┌─────────────────────────┐      ┌─────────────────┐      ┌──────────────────────┐
│  Browser (static/)      │      │  server.mjs     │      │  JSON Ledger API v2  │
│  /company  ·  /c/alice  │◄────►│  Node 18+, zero │◄────►│  Devnet validator    │
│  /c/bob                 │ REST │  npm deps, :4000│ JWT  │  (Canton Network)    │
│  vanilla HTML/CSS/JS    │      │  holds creds    │      │  paydae DAR + parties│
└─────────────────────────┘      └─────────────────┘      └──────────────────────┘
```

- **Daml** ([daml/daml/Paydae.daml](daml/daml/Paydae.daml)): `AgreementProposal → Agreement → Invoice → ApprovedInvoice → Payment`, plus `Treasury` with the atomic `PayAllApproved` choice.
- **Backend** ([server.mjs](server.mjs)): zero-dependency Node server. Mints and caches the OIDC JWT (re-mints on 401 / >7h), translates persona REST calls into ledger commands/ACS queries. The browser never sees credentials.
- **Frontend** ([static/](static/)): no libraries, dark theme, one page per persona with a big colored badge (company amber, Alice teal, Bob violet). Polls state every 2.5 s.

## Privacy matrix (who sees what)

| Contract | Company | Alice | Bob | Why |
|---|---|---|---|---|
| Alice's AgreementProposal | ✅ | ✅ | ❌ | signatory company, observer Alice |
| Alice's Agreement / Invoice / ApprovedInvoice | ✅ | ✅ | ❌ | dual-signed company + Alice |
| Alice's Payment | ✅ | ✅ | ❌ | signatory company, observer Alice |
| Bob's contracts | ✅ | ❌ | ✅ | symmetric |
| Treasury (balance) | ✅ | ❌ | ❌ | signatory company only |

This is enforced by Canton's distribution model: a validator only receives contracts
where its parties are stakeholders. There is no server-side filtering to get wrong.

## Contract flow

1. Company creates `AgreementProposal` (role, hourly rate) — contractor is observer.
2. Contractor exercises `Countersign` → dual-signed `Agreement`.
3. Contractor exercises `SubmitInvoice` (hours, memo) → `Invoice` with `amount = hours × hourlyRate` (valid because the Agreement carries both authorities).
4. Company exercises `Approve` → `ApprovedInvoice`.
5. Company exercises `Treasury.PayAllApproved([cids])` → each invoice's `MarkPaid` fires, `Payment`s are created, treasury is recreated with `balance − total`. The `MarkPaid` indirection is required: the company alone can't archive a dual-signed contract, but it *can* exercise a company-controlled choice on it.

## Setup

Prereqs: `dpm` 3.5.2, JDK 21, Node 18+, and a `.env` (never committed) with
`AUTH_URL`, `CLIENT_ID`, `CLIENT_SECRET`, `LEDGER_API`.

```bash
# 1. build + test the Daml package
cd daml && dpm build
cd ../daml-tests && dpm build && dpm test   # happy path, privacy, negatives

# 2. deploy to Devnet (once)
./scripts/devnet.sh upload daml/.daml/dist/paydae-0.1.0.dar
./scripts/devnet.sh allocate PaydaeCo        # …and PaydaeAlice, PaydaeBob
./scripts/devnet.sh grant 6 <party-id>       # actAs+readAs for the ledger user
# record package id + party ids in config.json

# 3. run the app
node server.mjs                              # http://localhost:4000
# open /company, /c/alice, /c/bob in three tabs
```

## Devnet proof

- Validator: `https://ledger-api.validator.devnet.sandbox.fivenorth.io`
- Package id: `b6c41b85c14063cad92ff77488b39bce6b42ef837805f7626f5bef948876d240`
- Parties (namespace `1220a14c…acf8`):
  - `PaydaeCo::1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8`
  - `PaydaeAlice::1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8`
  - `PaydaeBob::1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8`
- Ledger user: `6` (see [config.json](config.json))
- Verified 2026-07-12 in a real-browser e2e run: treasury bootstrapped at $50,000;
  offers (Designer $70/h, Engineer $85/h) countersigned; invoices 40 h ($2,800) and
  10 h ($850) approved; one `PayAllApproved` debited exactly $3,650 → $46,350; both
  contractors saw *Paid ✓* and never each other's data.

## Repo layout

```
daml/            Daml package "paydae" (the shipped DAR)
daml-tests/      Daml Script tests (separate so the DAR has no script dependency)
scripts/         devnet.sh — token / upload / allocate / grant / acs helpers
server.mjs       zero-dependency backend + static file server
static/          persona picker + company/contractor UIs
config.json      package id, party ids, ledger user
```
