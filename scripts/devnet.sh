#!/usr/bin/env bash
# Devnet helper: token exchange + common Ledger API calls.
# Usage: source .env first (or run from setuptest/), then:
#   ./scripts/devnet.sh token            -> prints a fresh JWT (8h expiry)
#   ./scripts/devnet.sh ledger-end       -> current ledger offset
#   ./scripts/devnet.sh upload <dar>     -> upload a DAR
#   ./scripts/devnet.sh allocate <hint>  -> allocate a party
#   ./scripts/devnet.sh grant <userId> <party>  -> grant actAs+readAs
#   ./scripts/devnet.sh acs <party>      -> active contracts for party
set -euo pipefail
cd "$(dirname "$0")/.."
source .env

token() {
  curl -s -X POST "$AUTH_URL" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data 'grant_type=client_credentials' \
    --data "client_id=$CLIENT_ID" \
    --data "client_secret=$CLIENT_SECRET" \
    --data "audience=$CLIENT_ID" \
    --data 'scope=daml_ledger_api' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])"
}

case "${1:-}" in
  token) token ;;
  ledger-end)
    curl -s "$LEDGER_API/v2/state/ledger-end" -H "Authorization: Bearer $(token)" ;;
  upload)
    curl -s -X POST "$LEDGER_API/v2/packages" -H "Authorization: Bearer $(token)" \
      -H "Content-Type: application/octet-stream" --data-binary "@$2" -w "\nHTTP %{http_code}\n" ;;
  allocate)
    curl -s -X POST "$LEDGER_API/v2/parties" -H "Authorization: Bearer $(token)" \
      -H "Content-Type: application/json" -d "{\"partyIdHint\":\"$2\",\"identityProviderId\":\"\"}" ;;
  grant)
    curl -s -X POST "$LEDGER_API/v2/users/$2/rights" -H "Authorization: Bearer $(token)" \
      -H "Content-Type: application/json" \
      -d "{\"userId\":\"$2\",\"rights\":[{\"kind\":{\"CanActAs\":{\"value\":{\"party\":\"$3\"}}}},{\"kind\":{\"CanReadAs\":{\"value\":{\"party\":\"$3\"}}}}]}" ;;
  acs)
    T=$(token)
    OFF=$(curl -s "$LEDGER_API/v2/state/ledger-end" -H "Authorization: Bearer $T" | python3 -c "import json,sys;print(json.load(sys.stdin)['offset'])")
    curl -s -X POST "$LEDGER_API/v2/state/active-contracts" -H "Authorization: Bearer $T" \
      -H "Content-Type: application/json" \
      -d "{\"filter\":{\"filtersByParty\":{\"$2\":{}}},\"verbose\":true,\"activeAtOffset\":$OFF}" ;;
  *) echo "usage: devnet.sh token|ledger-end|upload <dar>|allocate <hint>|grant <userId> <party>|acs <party>"; exit 1 ;;
esac
