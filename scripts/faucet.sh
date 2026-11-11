#!/usr/bin/env bash
# SpireFi self-hosted faucet: create + fund player subaccounts via near-cli.
#
# No external faucet needed — any funded parent account can create and fund
# subaccounts (X.spire.testnet). Top-level `name.testnet` accounts would need
# the registrar, which we deliberately avoid.
#
# Usage (inside WSL, from the repo root):
#   export FAUCET_PARENT=bob.testnet          # funded account whose key near-cli holds
#   ./scripts/faucet.sh hero1                 # creates hero1.spire.testnet (0.05 NEAR)
#   ./scripts/faucet.sh hero1 raider2 yuni    # batch
#   FUNDING="0.2 NEAR" ./scripts/faucet.sh whale1
#
#near-cli-rs must already hold the parent key (run `near keys bob.testnet` to check;
# it will prompt for / store the key on first use).

set -euo pipefail

FAUCET_PARENT="${FAUCET_PARENT:?set FAUCET_PARENT (funded account, e.g. bob.testnet)}"
SUFFIX="${SUFFIX:-.spire.testnet}"
FUNDING="${FUNDING:-0.05 NEAR}"

[[ $# -ge 1 ]] || { echo "usage: $0 <name> [name2 ...]   (creates <name>${SUFFIX})"; exit 1; }

for NAME in "$@"; do
  ACC="$NAME"
  [[ "$NAME" == *.* ]] || ACC="${NAME}${SUFFIX}"

  echo "== faucet: $ACC (${FUNDING}) from ${FAUCET_PARENT} =="

  if near account view-account "$ACC" network testnet >/dev/null 2>&1; then
    echo "   $ACC already exists — skipping creation."
    continue
  fi

  near account create-account fund-myself "$ACC" "$FUNDING" sign-as "$FAUCET_PARENT" network testnet
  echo "   created: $ACC"
done

echo
echo "Done. Players can now log in with these names at /game/start."
echo "Note: the in-game faucet for visitors is the relayer (AUTO_CREATE_ACCOUNTS=true)."
