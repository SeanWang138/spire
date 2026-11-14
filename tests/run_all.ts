/**
 * The Spire v3.1 / BossVault Protocol - Master E2E Test Suite Runner
 *
 * Scope:
 * - Tiers 1-4 verify the protocol reference models (`tests/protocol_models.ts`).
 * - Cross-Layer Parity verifies live math & vector parity across `web/`,
 *   `test-vectors/`, `relayer/merchant_vectors.json`, and `relayer/dist/`
 *   (when built).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTier1 } from "./tier1_feature_tests.ts";
import { runTier2 } from "./tier2_boundary_tests.ts";
import { runTier3 } from "./tier3_pairwise_tests.ts";
import { runTier4 } from "./tier4_workload_tests.ts";
import { runCrossLayerParity } from "./cross_layer_math_parity.ts";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(THIS_DIR, "..");

async function main() {
  const startTime = Date.now();
  console.log("\x1b[1m\x1b[35m");
  console.log("================================================================================");
  console.log("   THE SPIRE v3.1 / BOSSVAULT PROTOCOL - E2E TEST VERIFICATION SUITE");
  console.log("================================================================================\x1b[0m");

  const results: Array<{ tier: string; name: string; passed: boolean; note?: string }> = [];

  console.log("\n\x1b[1m\x1b[34m>>> EXECUTING TIER 1: FEATURE COVERAGE & CATEGORY-PARTITION SUITE...\x1b[0m");
  const t1Passed = await runTier1();
  results.push({ tier: "Tier 1", name: "Feature Coverage (Category-Partition)", passed: t1Passed });

  console.log("\n\x1b[1m\x1b[34m>>> EXECUTING TIER 2: BOUNDARY VALUE ANALYSIS & CORNER CASES SUITE...\x1b[0m");
  const t2Passed = await runTier2();
  results.push({ tier: "Tier 2", name: "Boundary Value Analysis & Corner Cases", passed: t2Passed });

  console.log("\n\x1b[1m\x1b[34m>>> EXECUTING TIER 3: CROSS-FEATURE INTERACTIONS SUITE...\x1b[0m");
  const t3Passed = await runTier3();
  results.push({ tier: "Tier 3", name: "Pairwise Cross-Feature Interactions", passed: t3Passed });

  console.log("\n\x1b[1m\x1b[34m>>> EXECUTING TIER 4: REAL-WORLD WORKLOAD SIMULATION SUITE...\x1b[0m");
  const t4Passed = await runTier4();
  results.push({ tier: "Tier 4", name: "Real-World Tower Assault Simulation", passed: t4Passed });

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
