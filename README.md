# Paydae — Setup Test (Hello World on Canton)

Minimal Daml hello-world to verify the toolchain end to end before building
Paydae proper. Mirrors the layout of `../canton-counter` (known-working with
SDK 3.5.2).

## Layout

```
setuptest/
├── daml/                     # main Daml package
│   ├── daml.yaml             #   sdk 3.5.2, package "paydae-hello"
│   └── daml/
│       └── Hello.daml        #   Greeting template + Reply choice
└── daml-tests/               # test package (kept separate so the shipped
    ├── daml.yaml             #   DAR has no daml-script dependency)
    └── daml/
        └── HelloTest.daml    #   Daml Script: create -> exercise -> assert
```

## Commands

```bash
# 1. build the DAR (output: daml/.daml/dist/paydae-hello-0.1.0.dar)
cd daml && dpm build

# 2. run the script test against an ephemeral ledger
cd ../daml-tests && dpm build && dpm test

# 3. local sandbox (optional)
dpm sandbox
```

## Devnet deployment (next step)

Per https://docs.canton.network/appdev/quickstart/deploy-to-devnet.md —
upload `paydae-hello-0.1.0.dar` to the Devnet validator's Ledger API
(`/v2/packages`), then create a Greeting contract on-ledger to confirm.
See also ../canton-counter/README.md for the DevNet ledger URL + OAuth env.

## Docs

- dpm CLI: https://docs.canton.network/sdks-tools/cli-tools/dpm
- Quickstart: https://docs.canton.network/appdev/quickstart/index.md
- Deploy to DevNet: https://docs.canton.network/appdev/quickstart/deploy-to-devnet.md
