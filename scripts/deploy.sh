#!/usr/bin/env bash
# SpireFi — one-shot testnet deploy script.
#
# Usage (from repo root, inside WSL):
#   export TARGET_ACCOUNT=spirefi.testnet      # account that will host the contract
#   export OWNER_ID=bob.testnet                # contract owner
#   export RELAYER_ID=spirefi.testnet          # account allowed to submit AI proposals
#   export TEE_PUBLIC_KEY=ed25519:<64-hex>     # TEE signer pubkey pinned at init
#   ./scripts/deploy.sh
#
# Requirements: near-cli-rs installed (cargo install near-cli-rs), key for
# TARGET_ACCOUNT available to near-cli (keychain or ~/.near-credentials).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASM="$REPO_DIR/contract/target/near/spire.wasm"

TARGET_ACCOUNT="${TARGET_ACCOUNT:?set TARGET_ACCOUNT (e.g. spirefi.testnet)}"
OWNER_ID="${OWNER_ID:?set OWNER_ID}"
RELAYER_ID="${RELAYER_ID:?set RELAYER_ID}"
TEE_PUBLIC_KEY="${TEE_PUBLIC_KEY:?set TEE_PUBLIC_KEY (ed25519:<64-hex>)}"

[[ -f "$WASM" ]] || { echo "wasm not found: $WASM — build with: near build (in contract/)"; exit 1; }
[[ "$TEE_PUBLIC_KEY" == ed25519:* ]] || { echo "TEE_PUBLIC_KEY must start with 'ed25519:'"; exit 1; }
HEX="${TEE_PUBLIC_KEY#ed25519:}"
[[ "$HEX" =~ ^[0-9a-fA-F]{64}$ ]] || { echo "TEE_PUBLIC_KEY hex part must be 64 chars"; exit 1; }

echo "== SpireFi deploy =="
echo "  target : $TARGET_ACCOUNT"
echo "  owner  : $OWNER_ID"
echo "  relayer: $RELAYER_ID"
echo

echo "== [1/3] Pre-flight: account exists? =="
near account view-account "$TARGET_ACCOUNT" network testnet || {
  echo "account $TARGET_ACCOUNT not found on testnet"; exit 1;
}

echo "== [2/3] Deploy + init =="
near contract deploy "$TARGET_ACCOUNT" use-file-adapter "$WASM" \
  network testnet \
  --init-function new \
  --init-args "{\"owner\":\"$OWNER_ID\",\"relayer\":\"$RELAYER_ID\",\"tee_public_key\":\"$TEE_PUBLIC_KEY\"}" \
  --init

echo "== [3/3] Smoke: get_tower =="
near contract call-view "$TARGET_ACCOUNT" get_tower '{}' network testnet

echo
echo "Deployed. Set these before starting the relayer & web:"
echo "  relayer/.env : CONTRACT_ID=$TARGET_ACCOUNT  KEEPER_ACCOUNT_ID=$TARGET_ACCOUNT  AUTO_CREATE_ACCOUNTS=true"
echo "  web .env     : NEXT_PUBLIC_CONTRACT_ID=$TARGET_ACCOUNT"
