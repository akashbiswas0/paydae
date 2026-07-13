#!/usr/bin/env bash
# Starts the Paydae wallet stack: auth-injecting proxy (127.0.0.1:9000) +
# Canton Wallet Gateway (localhost:3030).
#
# Vendored from https://github.com/akashbiswas0/canton-start (quickstart/gateway/
# start-devnet.sh), derived from Digital Asset's canton-network-quickstart.
# Adapted for Paydae: the OAuth secret is read from the repo-root .env by
# devnet-proxy.mjs itself — no env var needed.
#
# Usage: npm run devnet   (from wallet/)
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -x node_modules/.bin/wallet-gateway ]]; then
  echo "Wallet Gateway dependencies are missing. Run npm install in $(pwd) first." >&2
  exit 1
fi

node devnet-proxy.mjs &
PROXY_PID=$!
trap 'kill "$PROXY_PID" 2>/dev/null' EXIT

exec node_modules/.bin/wallet-gateway -c ./config.fivenorth-devnet.json
