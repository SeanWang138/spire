import fs from "node:fs";
import { calculateAdaptiveResistance as relayerCalc } from "../relayer/dist/pricing.js";
import { calculateAdaptiveResistance as webCalc } from "../web/src/lib/simulation/pricing.ts";

console.log("=== EMPIRICAL CROSS-LAYER MATHEMATICAL PARITY CHALLENGE ===");

// 1. Check test-vectors/resistance_vectors.json
const rawVectors = JSON.parse(
  fs.readFileSync("test-vectors/resistance_vectors.json", "utf-8")
);

console.log(`\nTesting ${rawVectors.vectors.length} test-vectors against Relayer and Web:`);
let vectorMismatches = 0;
for (const v of rawVectors.vectors) {
  const inp = v.input_supplies;
  const exp = v.expected_resistances;
  const rRelayer = relayerCalc(inp);
  const rWeb = webCalc(inp);

  const relayerMatch = JSON.stringify(rRelayer) === JSON.stringify(exp);
  const webMatch = JSON.stringify(rWeb) === JSON.stringify(exp);

  console.log(`Vector: ${v.name} [${inp.join(",")}]`);
  console.log(`  Expected : [${exp.join(",")}]`);
  console.log(`  Relayer  : [${rRelayer.join(",")}] ${relayerMatch ? "✔" : "✖ MISMATCH"}`);
  console.log(`  Web      : [${rWeb.join(",")}] ${webMatch ? "✔" : "✖ MISMATCH"}`);

  if (!relayerMatch || !webMatch) {
    vectorMismatches++;
  }
}

// 2. Check 1000 Fuzz Samples from Rust
const fuzzData = JSON.parse(fs.readFileSync("/tmp/spire_fuzz_rust_1000.json", "utf-8"));
console.log(`\nTesting 1,000 Rust-generated samples against Relayer and Web:`);

let rustRelayerMismatches = 0;
let rustWebMismatches = 0;
let relayerWebMismatches = 0;

const sampleMismatches = [];

for (let i = 0; i < fuzzData.length; i++) {
  const { input, rust } = fuzzData[i];
  const rRelayer = relayerCalc(input);
  const rWeb = webCalc(input);

  const matchRustRelayer = JSON.stringify(rust) === JSON.stringify(rRelayer);
  const matchRustWeb = JSON.stringify(rust) === JSON.stringify(rWeb);
  const matchRelayerWeb = JSON.stringify(rRelayer) === JSON.stringify(rWeb);

  if (!matchRustRelayer) rustRelayerMismatches++;
  if (!matchRustWeb) rustWebMismatches++;
  if (!matchRelayerWeb) relayerWebMismatches++;

  if ((!matchRustRelayer || !matchRustWeb) && sampleMismatches.length < 10) {
    sampleMismatches.push({
      index: i,
      input,
      rust,
      relayer: rRelayer,
      web: rWeb,
    });
  }
}

console.log(`Results across 1,000 fuzzed distributions:`);
console.log(`  Rust vs Relayer Mismatches: ${rustRelayerMismatches} / 1000 (${(rustRelayerMismatches / 10).toFixed(1)}%)`);
console.log(`  Rust vs Web Mismatches    : ${rustWebMismatches} / 1000 (${(rustWebMismatches / 10).toFixed(1)}%)`);
console.log(`  Relayer vs Web Mismatches : ${relayerWebMismatches} / 1000 (${(relayerWebMismatches / 10).toFixed(1)}%)`);

if (sampleMismatches.length > 0) {
  console.log("\nSample Mismatch Discrepancies:");
  for (const s of sampleMismatches) {
    console.log(`Item #${s.index} Input [${s.input.join(", ")}]:`);
    console.log(`  Rust   : [${s.rust.join(", ")}]`);
    console.log(`  Relayer: [${s.relayer.join(", ")}]`);
    console.log(`  Web    : [${s.web.join(", ")}]`);
  }
}
