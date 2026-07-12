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
┌──────────────────────────┐      ┌──────────────────┐      ┌──────────────────────┐
│  frontend/ (Next.js :3000)│      │ backend/ (:4000) │      │  JSON Ledger API v2  │
│  /company  ·  /c/alice   │◄────►│  Express + TS    │◄────►│  Devnet validator    │
│  /c/bob                  │ REST │  holds creds,    │ JWT  │  (Canton Network)    │
│  TS · Tailwind · shadcn  │proxy │  talks to ledger │      │  paydae DAR + parties│
│  Redux Toolkit           │      │                  │      │                      │
└──────────────────────────┘      └──────────────────┘      └──────────────────────┘
```

- **Daml** ([daml/daml/Paydae.daml](daml/daml/Paydae.daml)): `AgreementProposal → Agreement → Invoice → ApprovedInvoice → Payment`, plus `Treasury` with the atomic `PayAllApproved` choice.
- **Backend** ([backend/](backend/src/index.ts)): Express + TypeScript (100 % TS, run with `tsx`). Mints and caches the OIDC JWT (re-mints on 401 / >7h), translates persona REST calls (`GET /api/state`, `POST /api/action`) into ledger commands/ACS queries. The browser never sees credentials.
- **Frontend** ([frontend/](frontend/src/app)): Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Redux Toolkit. Dark theme, one route per persona with a big colored badge (company amber, Alice teal, Bob violet). Polls state every 2.5 s through a Redux async thunk; `/api/*` is rewritten to the Express backend so the browser stays same-origin.

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
`AUTH_URL`, `CLIENT_ID`, `CLIENT_SECRET`, `LEDGER_API` at the repo root.

```bash
# 1. build + test the Daml package
cd daml && dpm build
cd ../daml-tests && dpm build && dpm test   # happy path, privacy, negatives

# 2. deploy to Devnet (once)
./scripts/devnet.sh upload daml/.daml/dist/paydae-0.1.0.dar
./scripts/devnet.sh allocate PaydaeCo        # …and PaydaeAlice, PaydaeBob
./scripts/devnet.sh grant 6 <party-id>       # actAs+readAs for the ledger user
# record package id + party ids in config.json

# 3. run the app (two terminals)
cd backend && npm install && npm run dev     # Express API on http://localhost:4000
cd frontend && npm install && npm run dev    # Next.js UI on http://localhost:3000
# open localhost:3000/company, /c/alice, /c/bob in three tabs

# optional: wipe all Paydae contracts for a fresh demo run
node scripts/reset.mjs
```

## Devnet proof

- Validator: `https://ledger-api.validator.devnet.sandbox.fivenorth.io`
- Package id: `b6c41b85c14063cad92ff77488b39bce6b42ef837805f7626f5bef948876d240`
- Parties (namespace `1220a14c…acf8`):
  - `PaydaeCo::1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8`
  - `PaydaeAlice::1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8`
  - `PaydaeBob::1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8`
- Ledger user: `6` (see [config.json](config.json))
- Verified 2026-07-12 in a real-browser e2e run (and re-verified 2026-07-13 on the
  Next.js + Express stack): treasury bootstrapped at $50,000; offers (Designer
  $70/h, Engineer $85/h) countersigned; invoices 40 h ($2,800) and 10 h ($850)
  approved; one `PayAllApproved` debited exactly $3,650 → $46,350; both
  contractors saw *Paid ✓* and never each other's data.

## Repo layout

```
daml/            Daml package "paydae" (the shipped DAR)
daml-tests/      Daml Script tests (separate so the DAR has no script dependency)
scripts/         devnet.sh helpers + reset.mjs (archive all contracts for a clean demo)
backend/         Express + TypeScript API (JWT, ledger reads/writes)
frontend/        Next.js + TypeScript + Tailwind + shadcn/ui + Redux Toolkit UI
config.json      package id, party ids, ledger user
```
