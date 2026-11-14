/**
 * The Spire v3.1 / BossVault Protocol - Master Parity & Live Invariant Suite Runner
 *
 * Scope:
 * - Cross-Layer Parity verifies deterministic math & vector parity across `web/`,
 *   `test-vectors/`, and `relayer/dist/` (when built).
 * - Live Testnet Invariant Probe performs read-only JSON-RPC view queries against
 *   `spire.testnet` (`get_meta`, `get_tower`, `get_merchant`, `nft_metadata`) to
 *   assert resistance conservation, bounds, 3-floor invariants, and valid schemas.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCrossLayerParity } from "./cross_layer_math_parity.ts";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(THIS_DIR, "..");

const CONTRACT_ID = process.env.CONTRACT_ID || "spire.testnet";
const RPC_ENDPOINTS = Array.from(
  new Set([
    process.env.NEAR_RPC_URL || "https://rpc.testnet.fastnear.com",
    "https://rpc.testnet.fastnear.com",
    "https://test.rpc.fastnear.com",
  ])
);

async function rpcView<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
  const argsBase64 = Buffer.from(JSON.stringify(args)).toString("base64");
  let lastError = "all RPC endpoints failed";

  for (const url of RPC_ENDPOINTS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `spirefi-test-${methodName}`,
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: CONTRACT_ID,
            method_name: methodName,
            args_base64: argsBase64,
          },
        }),
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status} from ${url}`;
        continue;
      }
      const json = (await response.json()) as {
        error?: { message?: string };
        result?: { error?: string; result?: number[] };
      };
      if (json.error) {
        lastError = json.error.message || JSON.stringify(json.error);
        continue;
      }
      if (json.result?.error) {
        lastError = json.result.error;
        continue;
      }
      if (Array.isArray(json.result?.result)) {
        const raw = Buffer.from(json.result.result).toString("utf8");
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(`RPC view ${methodName} on ${CONTRACT_ID} failed: ${lastError}`);
}

async function runLiveTestnetInvariants(): Promise<boolean> {
  const failures: string[] = [];

  try {
    const [meta, tower, merchant, nftMeta] = await Promise.all([
      rpcView<{
        epoch: number;
        resistance: [number, number, number];
        supply: [number, number, number];
        weak_element: number;
      }>("get_meta"),
      rpcView<{
        floors: Array<{
          floor: number;
          hp: number;
          max_hp: number;
          round: number;
          jackpot: string;
          buyback_reserve: string;
          dividend_pool: string;
          backer_total_shares: string;
          total_damage: string;
          unlocked: boolean;
        }>;
      }>("get_tower"),
      rpcView<{
        cash: string;
        stock: Record<string, number>;
        is_open: boolean;
      }>("get_merchant"),
      rpcView<{
        name: string;
        symbol: string;
      }>("nft_metadata"),
    ]);

    if (!Array.isArray(meta.resistance) || meta.resistance.length !== 3) {
      failures.push(`get_meta().resistance invalid: ${JSON.stringify(meta.resistance)}`);
    } else {
      const sum = meta.resistance[0] + meta.resistance[1] + meta.resistance[2];
      if (sum !== 13500) {
        failures.push(`Resistance conservation violated on ${CONTRACT_ID}: sum=${sum} (expected 13500)`);
      }
      for (let i = 0; i < 3; i++) {
        if (meta.resistance[i] < 1000 || meta.resistance[i] > 8500) {
          failures.push(`Resistance[${i}]=${meta.resistance[i]} outside [1000, 8500]`);
        }
      }
    }

    if (![0, 1, 2].includes(meta.weak_element)) {
      failures.push(`Invalid weak_element=${meta.weak_element}`);
    }

    const expectedMaxHp = [1000, 1600, 2500];
    if (!Array.isArray(tower.floors) || tower.floors.length !== 3) {
      failures.push(`get_tower().floors expected length 3, got ${tower.floors?.length}`);
    } else {
      for (let i = 0; i < 3; i++) {
        const fl = tower.floors[i];
        if (fl.floor !== i) failures.push(`Floor[${i}].floor expected ${i}, got ${fl.floor}`);
        if (fl.max_hp !== expectedMaxHp[i]) {
          failures.push(`Floor[${i}].max_hp expected ${expectedMaxHp[i]}, got ${fl.max_hp}`);
        }
        if (fl.hp < 0 || fl.hp > fl.max_hp) {
          failures.push(`Floor[${i}].hp=${fl.hp} out of [0, ${fl.max_hp}]`);
        }
        for (const field of [
          fl.jackpot,
          fl.buyback_reserve,
          fl.dividend_pool,
          fl.backer_total_shares,
          fl.total_damage,
        ]) {
          if (BigInt(field) < 0n) {
            failures.push(`Floor[${i}] negative u128 string field`);
          }
        }
      }
    }

    if (BigInt(merchant.cash) < 0n) {
      failures.push(`Invalid merchant cash: ${merchant.cash}`);
    }
    if (typeof merchant.is_open !== "boolean") {
      failures.push(`Invalid merchant.is_open type`);
    }
    for (const key of ["ore:iron", "essence:solar", "essence:frost", "essence:void"]) {
      if (typeof merchant.stock?.[key] !== "number") {
        failures.push(`Missing merchant stock key '${key}'`);
      }
    }

    if (!nftMeta.name || !nftMeta.symbol) {
      failures.push(`Invalid nft_metadata: ${JSON.stringify(nftMeta)}`);
    }

    if (failures.length === 0) {
      console.log(
        `  ✔ Live ${CONTRACT_ID}: epoch=${meta.epoch}, resistance=[${meta.resistance.join(", ")}] (sum=13500), 3 floors OK, merchant open=${merchant.is_open}, NFT=${nftMeta.name} (${nftMeta.symbol})`
      );
      return true;
    }
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
  }

  console.error("\n✖ LIVE TESTNET INVARIANT FAILURES:");
  for (const f of failures) {
    console.error(`  - ${f}`);
  }
  return false;
}

async function main() {
  const startTime = Date.now();
  console.log("\x1b[1m\x1b[35m");
  console.log("================================================================================");
  console.log("   THE SPIRE v3.1 / BOSSVAULT PROTOCOL - PARITY & LIVE INVARIANT SUITE");
  console.log("================================================================================\x1b[0m");

  const results: Array<{ tier: string; name: string; passed: boolean }> = [];

  const hasRelayerDist =
    fs.existsSync(path.join(ROOT_DIR, "relayer", "dist", "pricing.js")) &&
    fs.existsSync(path.join(ROOT_DIR, "relayer", "dist", "types.js"));

  console.log("\n\x1b[1m\x1b[34m>>> EXECUTING CROSS-LAYER MATH & SCHEMA PARITY SUITE...\x1b[0m");
  const parityPassed = await runCrossLayerParity({ requireRelayerDist: hasRelayerDist });
  results.push({
    tier: "Parity",
    name: hasRelayerDist
      ? "Cross-Layer Math & Schema Parity"
      : "Parity (Web+Vectors; relayer unbuilt)",
    passed: parityPassed,
  });

  if (process.env.SKIP_LIVE_RPC_CHECK === "true") {
    console.log("\n\x1b[33m>>> SKIPPING LIVE TESTNET INVARIANT PROBE (SKIP_LIVE_RPC_CHECK=true)\x1b[0m");
  } else {
    console.log(`\n\x1b[1m\x1b[34m>>> EXECUTING READ-ONLY LIVE TESTNET INVARIANT PROBE (${CONTRACT_ID})...\x1b[0m`);
    const livePassed = await runLiveTestnetInvariants();
    results.push({
      tier: "LiveRPC",
      name: `Read-Only Contract Invariants (${CONTRACT_ID})`,
      passed: livePassed,
    });
  }

  const totalTime = Date.now() - startTime;
  const allPassed = results.every((r) => r.passed);

  console.log("\n\x1b[1m\x1b[35m================================================================================\x1b[0m");
  console.log("\x1b[1m               MASTER E2E VERIFICATION SUITE SUMMARY MATRIX                     \x1b[0m");
  console.log("\x1b[1m\x1b[35m================================================================================\x1b[0m");
  console.log(" Tier    | Suite Description                         | Status");
  console.log("---------+-------------------------------------------+--------------------------");
  for (const r of results) {
    const status = r.passed ? "\x1b[32m✔ PASSED (100%)\x1b[0m" : "\x1b[31m✖ FAILED\x1b[0m";
    console.log(` ${r.tier.padEnd(7)} | ${r.name.padEnd(41)} | ${status}`);
  }
  console.log("---------+-------------------------------------------+--------------------------");
  console.log(` Total Execution Time: ${totalTime}ms`);
  console.log(` Overall Result: ${allPassed ? "\x1b[1m\x1b[32mALL TIERS PASSED PERFECTLY\x1b[0m" : "\x1b[1m\x1b[31mFAILURES DETECTED\x1b[0m"}`);
  console.log("\x1b[1m\x1b[35m================================================================================\x1b[0m\n");

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error running test runner:", err);
  process.exit(1);
});
