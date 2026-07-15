# E2E evidence — auditor role (browser-key wallets)

Run 2026-07-15 (~11:30–12:00 UTC) on FiveNorth devnet, driven in a real Chrome via the
Claude extension against `localhost:3000` (Next.js) + `localhost:4000` (Express).
Package `paydae v0.2.0`, packageId `1ea37a34dcde97964bd5575730f04bc63aa9d528050b055234a5b932c3a18546`
— a **valid upgrade** of v0.1.0 (`auditors : Optional [Party]` added to all six templates).

## Cast (all browser-held ed25519 keys, zero rights grants)

| Wallet    | Role       | Party |
|-----------|------------|-------|
| Ava       | auditor    | `Ava::1220c46a7bbdf53355024cf5f0d594709c8b53cb93c95ca29166de413a7cb1855041` |
| AuditCo   | company    | `AuditCo::122003cf17bf60b2a00c56197b24fca788296d890de490608a910a76d29c2845b13e` |
| Carl      | contractor | `Carl::1220b19273b30780b4192ce01ba77c2979aae4524ad67f5b0735a0b61aa3c8ae7e0a` |
| PrivateCo | company    | `PrivateCo::12201c9687ad379926545ded8031cb07bef6645324161a1967c6b461f58a62f92d75` (never designates Ava) |

## Lifecycle (every tx signed in-browser; full updateIds from `/v2/updates/flats` **filtered by Ava's party** — i.e. Canton delivered each one to the auditor)

1. AuditCo designates Ava (`SetAuditors`, confirm modal shows the visibility grant).
2. Offer to Carl ($40/h Engineer; modal shows new "Visible to auditor: Ava" row)
   `1220829bf26e9c53ca64a0a38f0268e27b3990e2ef56942182789017c3297a3d6ee8`
3. Carl countersigns → Agreement
   `12204ea2f4c113b9e86a9f37edc5ccd727c4837f57b21313efab4e86ef27b2ebcdd4`
4. Carl invoices 5h "audit demo sprint" → $200 Invoice
   `1220ce9b768197c5a0f1d2f4d56b2d42cba7f3519ba180fac56788af1e020ddcde97`
5. AuditCo approves
   `122008d35f328cc9fc709155a490bb8b280a7af2a495c533dd608a99cf87b3b80e60`
6. Payday (atomic: Treasury+ApprovedInvoice archived, Payment+Treasury created; 20,000 → 19,800)
   `1220695ebe8be8120c6085c4f85ec7c5754d60815ae7f3527dd66fea54431612d048`

## Assertions verified

- **Positive audit view**: Ava's read-only dashboard shows AuditCo's treasury ($19,800.00),
  Carl's agreement incl. hourly rate, and the paid $200 payment — delivered by the ledger.
- **Receipt as stakeholder**: `/w/<ava-fp>/tx/<payday-id>` renders all four payday events;
  both created contracts carry `auditors: Ava`.
- **Negative (undesignated company)**: PrivateCo created a $50,000 treasury
  (`1220801306c172deb96fd265c74e2d777a7b7f30ae8a6c87dedbeb3181e67e290adf`) and an offer to Carl
  (`12204537661ad9609429d9fc012a038e06cd3d9d8c7ee1488cca5513d9a7d1ed503f`); Ava's dashboard
  shows **no PrivateCo section**, and opening that offer's receipt as Ava returns
  "update not found — or this party was not a stakeholder of it".
- **Role detection**: `POST /api/wallet/load` with Ava's public key →
  `{"role":"auditor", ...}` (auditor key files restore like any other wallet).

## Upgrade lessons (devnet, hard-won)

- Same name+version re-upload → `KNOWN_PACKAGE_VERSION`; bump `daml.yaml` version.
- Non-`Optional` new field → `NOT_VALID_UPGRADE_PACKAGE`; `Optional` fields make the upgrade
  valid and old contracts stay exercisable (read as `None`).
- Restart the backend after editing `config.json` — it is read at import time.

## Browser-driving gotchas (Claude extension)

- Screenshots are ~0.864× of the viewport — coordinate clicks miss; use `find`/refs.
- The app re-renders on a 2.5s state poll, so refs go stale between `find` and click;
  a second find+click usually lands. The reliable fallback is `javascript_tool` with
  native-setter input + `.click()` on the exact button.
