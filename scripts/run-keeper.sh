#!/usr/bin/env bash
# ==============================================================================
# The Spire v3.1 / BossVault Protocol - Autonomous Keeper Launcher Script
# ==============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELAYER_DIR="$REPO_ROOT/relayer"

# Source environment variables if .env file exists
if [ -f "$REPO_ROOT/.env" ]; then
  # shellcheck source=/dev/null
  set -a; source "$REPO_ROOT/.env"; set +a
elif [ -f "$RELAYER_DIR/.env" ]; then
  # shellcheck source=/dev/null
  set -a; source "$RELAYER_DIR/.env"; set +a
fi

# Configurable environment defaults
export NEAR_NETWORK="${NEAR_NETWORK:-testnet}"
export NEAR_RPC_URL="${NEAR_RPC_URL:-https://rpc.testnet.fastnear.com}"
export CONTRACT_ID="${CONTRACT_ID:-spire.testnet}"
export KEEPER_ACCOUNT_ID="${KEEPER_ACCOUNT_ID:-keeper.spire.testnet}"
export KEEPER_PRIVATE_KEY="${KEEPER_PRIVATE_KEY:-}"
export MOCK_TEE="${MOCK_TEE:-false}"
export KEEPER_AI_MODE="${KEEPER_AI_MODE:-epoch-only}"
export POLL_INTERVAL_MS="${POLL_INTERVAL_MS:-5000}"
export STREAMER_PORT="${STREAMER_PORT:-8080}"

ROLE="${1:-keeper}"

echo "================================================="
echo "   LAUNCHING THE SPIRE v3.1 AUTONOMOUS SERVICE   "
echo "================================================="
echo "Working directory : $RELAYER_DIR"
echo "Active role       : $ROLE"
echo "NEAR Network      : $NEAR_NETWORK"
echo "RPC Endpoint      : $NEAR_RPC_URL"
echo "Contract ID       : $CONTRACT_ID"
echo "Keeper Account    : $KEEPER_ACCOUNT_ID"
echo "Mock TEE Enabled  : $MOCK_TEE"
echo "Poll Interval     : ${POLL_INTERVAL_MS}ms"
echo "================================================="

cd "$RELAYER_DIR"

# Ensure TypeScript compilation is up to date
echo "[Builder] Compiling TypeScript source files..."
./node_modules/.bin/tsc

# Execute Keeper daemon using Node.js
echo "[Launcher] Starting Spire daemon ($ROLE)..."
exec node dist/index.js --role "$ROLE"
