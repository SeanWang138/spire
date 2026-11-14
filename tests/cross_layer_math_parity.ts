import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { calculateAdaptiveResistance as webCalc } from "../web/src/lib/simulation/pricing.ts";
import {
  BUYBACK_BASE_NEAR,
  MERCHANT_BASE_PRICE_NEAR,
  MERCHANT_MIN_CASH_NEAR,
  MERCHANT_SPREAD_BPS,
  MERCHANT_TARGET_STOCK,
} from "../web/src/lib/spire/constants.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(THIS_FILE), "..");

interface ResistanceVector {
  name: string;
  input_supplies: [number, number, number];
  expected_resistances: [number, number, number];
  total_bps: number;
}

interface ResistanceVectorsFile {
  config: {
    total_bps: number;
    min_bps: number;
    max_bps: number;
  };
  vectors: ResistanceVector[];
}

interface MerchantVectorCase {
  name: string;
  stock: number;
  target_stock: number;
  demand: number;
  reserve_yocto: string;
  expected: {
    midPriceYocto: string;
    buyPriceYocto: string;
    sellPriceYocto: string;
    isClosed: boolean;
    reason: string;
  };
}

interface BuybackVectorCase {
  name: string;
  floor: number;
  element: number;
  multiplier_bps: number;
  qty: number;
  vault_balance_yocto: string;
  expected: {
    unitPriceYocto: string;
    totalPriceYocto: string;
    multiplier_bps: number;
    isOpen: boolean;
    reason: string;
  };
}

interface MerchantVectorsFile {
  description?: string;
  merchant_base_price_yocto: string;
  merchant_target_stock: number;
  merchant_spread_bps: number;
  merchant_min_reserve_yocto: string;
  buyback_base_yocto: string;
  merchant: MerchantVectorCase[];
  buyback: BuybackVectorCase[];
  config?: unknown;
  vectors?: unknown;
}

interface RelayerPricingModule {
  MERCHANT_TARGET_STOCK: number;
  MERCHANT_SPREAD_BPS: number;
  BUYBACK_BASE_YOCTO: bigint;
  calculateAdaptiveResistance: (
    supplies: [number, number, number]
  ) => [number, number, number];
  calculateMerchantQuote: (params: {
    stock: number;
    targetStock?: number;
    basePriceYocto?: bigint | string;
    demand?: number;
    treasuryReserveYocto?: bigint | string;
  }) => {
    midPriceYocto: bigint;
    buyPriceYocto: bigint;
    sellPriceYocto: bigint;
    isClosed: boolean;
    reason: string;
  };
  calculateBuybackQuote: (params: {
    floor: number;
    element: number;
    buybackMultiplierBps: number;
    qty?: number;
    vaultBalanceYocto?: bigint | string;
  }) => {
    unit_price_yocto: string;
    total_price_yocto: string;
    multiplier_bps: number;
    is_open: boolean;
    reason: string;
  };
}

interface RelayerTypesModule {
  parseYoctoSafe?: (value: string | number | bigint) => bigint;
  toBigInt: (value: string | number | bigint) => bigint;
}

export interface CrossLayerParityOptions {
  requireRelayerDist?: boolean;
}

function validateMerchantSchema(
  doc: MerchantVectorsFile,
  label: string,
  failures: string[]
): void {
  if (doc.config !== undefined || doc.vectors !== undefined) {
    failures.push(`${label} still contains stale legacy v3 fields (config/vectors)`);
  }
  if (doc.merchant_base_price_yocto !== "50000000000000000000000") {
    failures.push(
      `${label}: expected merchant_base_price_yocto="50000000000000000000000", got ${String(doc.merchant_base_price_yocto)}`
    );
  }
  if (doc.merchant_target_stock !== 100) {
    failures.push(
      `${label}: expected merchant_target_stock=100, got ${String(doc.merchant_target_stock)}`
    );
  }
  if (doc.merchant_spread_bps !== 1000) {
    failures.push(
      `${label}: expected merchant_spread_bps=1000, got ${String(doc.merchant_spread_bps)}`
    );
  }
  if (doc.merchant_min_reserve_yocto !== "1000000000000000000000000") {
    failures.push(
      `${label}: expected merchant_min_reserve_yocto="1000000000000000000000000", got ${String(doc.merchant_min_reserve_yocto)}`
    );
  }
  if (doc.buyback_base_yocto !== "100000000000000000000000") {
    failures.push(
      `${label}: expected buyback_base_yocto="100000000000000000000000", got ${String(doc.buyback_base_yocto)}`
    );
  }
  if (!Array.isArray(doc.merchant) || doc.merchant.length === 0) {
    failures.push(`${label}: merchant vector array is missing or empty`);
  } else {
    for (const v of doc.merchant) {
      if (
        typeof v.name !== "string" ||
        typeof v.stock !== "number" ||
        typeof v.target_stock !== "number" ||
        typeof v.demand !== "number" ||
        typeof v.reserve_yocto !== "string" ||
        !v.expected ||
        typeof v.expected.midPriceYocto !== "string" ||
        typeof v.expected.buyPriceYocto !== "string" ||
        typeof v.expected.sellPriceYocto !== "string" ||
        typeof v.expected.isClosed !== "boolean" ||
        typeof v.expected.reason !== "string"
      ) {
        failures.push(`${label}: malformed merchant vector entry ${JSON.stringify(v)}`);
      }
    }
  }
  if (!Array.isArray(doc.buyback) || doc.buyback.length === 0) {
    failures.push(`${label}: buyback vector array is missing or empty`);
  } else {
    for (const v of doc.buyback) {
      if (
        typeof v.name !== "string" ||
        typeof v.floor !== "number" ||
        typeof v.element !== "number" ||
        typeof v.multiplier_bps !== "number" ||
        typeof v.qty !== "number" ||
        typeof v.vault_balance_yocto !== "string" ||
        !v.expected ||
        typeof v.expected.unitPriceYocto !== "string" ||
        typeof v.expected.totalPriceYocto !== "string" ||
        typeof v.expected.multiplier_bps !== "number" ||
        typeof v.expected.isOpen !== "boolean" ||
        typeof v.expected.reason !== "string"
      ) {
        failures.push(`${label}: malformed buyback vector entry ${JSON.stringify(v)}`);
      }
    }
  }
}

export async function runCrossLayerParity(
  options: CrossLayerParityOptions = {}
): Promise<boolean> {
  const requireRelayerDist = options.requireRelayerDist ?? true;
  const failures: string[] = [];

  console.log("=== EMPIRICAL CROSS-LAYER MATHEMATICAL & SCHEMA PARITY SUITE ===");

  const relayerPricingPath = path.join(ROOT_DIR, "relayer", "dist", "pricing.js");
  const relayerTypesPath = path.join(ROOT_DIR, "relayer", "dist", "types.js");
  const hasRelayerDist =
    fs.existsSync(relayerPricingPath) && fs.existsSync(relayerTypesPath);

  let relayerPricing: RelayerPricingModule | null = null;
  let relayerTypes: RelayerTypesModule | null = null;

  if (hasRelayerDist) {
    relayerPricing = (await import(
      pathToFileURL(relayerPricingPath).href
    )) as RelayerPricingModule;
    relayerTypes = (await import(
      pathToFileURL(relayerTypesPath).href
    )) as RelayerTypesModule;
  } else if (requireRelayerDist) {
    failures.push(
      `Compiled relayer artifacts missing at ${relayerPricingPath}; run "cd relayer && npm run build" first.`
    );
  } else {
    console.log(
      "\n[SKIP] relayer/dist/ is not built yet; skipping compiled relayer parity checks."
    );
  }

  // 1. Check test-vectors/resistance_vectors.json
  const resistancePath = path.join(ROOT_DIR, "test-vectors", "resistance_vectors.json");
  const rawVectors = JSON.parse(
    fs.readFileSync(resistancePath, "utf-8")
  ) as ResistanceVectorsFile;

  if (
    rawVectors.config?.total_bps !== 13500 ||
    rawVectors.config?.min_bps !== 1000 ||
    rawVectors.config?.max_bps !== 8500
  ) {
    failures.push(
      `resistance_vectors.json config mismatch: ${JSON.stringify(rawVectors.config)}`
    );
  }

  console.log(
    `\n[1] Testing ${rawVectors.vectors.length} adaptive resistance vectors against Web${relayerPricing ? " and Relayer" : ""}:`
  );
  let vectorMismatches = 0;
  for (const v of rawVectors.vectors) {
    const inp = v.input_supplies;
    const exp = v.expected_resistances;
    const rWeb = webCalc(inp);
    const webMatch = JSON.stringify(rWeb) === JSON.stringify(exp);
    const webSum = rWeb[0] + rWeb[1] + rWeb[2];
    const webBounds = rWeb.every((x) => x >= 1000 && x <= 8500);

    let relayerLine = "SKIPPED (no dist)";
    let relayerMatch = true;
    if (relayerPricing) {
      const rRelayer = relayerPricing.calculateAdaptiveResistance(inp);
      relayerMatch =
        JSON.stringify(rRelayer) === JSON.stringify(exp) &&
        JSON.stringify(rRelayer) === JSON.stringify(rWeb);
      relayerLine = `[${rRelayer.join(",")}] ${relayerMatch ? "✔" : "✖ MISMATCH"}`;
    }

    console.log(`  Vector: ${v.name} [${inp.join(",")}]`);
    console.log(`    Expected : [${exp.join(",")}]`);
    console.log(`    Web      : [${rWeb.join(",")}] ${webMatch ? "✔" : "✖ MISMATCH"}`);
    if (relayerPricing) {
      console.log(`    Relayer  : ${relayerLine}`);
    }

    if (!webMatch || !relayerMatch || webSum !== v.total_bps || !webBounds) {
      vectorMismatches++;
      failures.push(`Adaptive resistance mismatch for vector ${v.name}`);
    }
  }
  console.log(`  Resistance mismatches: ${vectorMismatches}`);

  // 2. Optional 1000 Fuzz Samples from Rust
  const fuzzPath = "/tmp/spire_fuzz_rust_1000.json";
  if (!fs.existsSync(fuzzPath)) {
    console.log(
      `\n[2] [SKIP] Optional external fuzz dump ${fuzzPath} not found; skipping 1,000-sample Rust fuzz check.`
    );
  } else {
    const fuzzData = JSON.parse(fs.readFileSync(fuzzPath, "utf-8")) as Array<{
      input: [number, number, number];
      rust: [number, number, number];
    }>;
    console.log(
      `\n[2] Testing ${fuzzData.length} Rust-generated samples against Web${relayerPricing ? " and Relayer" : ""}:`
    );

    let rustRelayerMismatches = 0;
    let rustWebMismatches = 0;
    let relayerWebMismatches = 0;
    const sampleMismatches: Array<{
      index: number;
      input: [number, number, number];
      rust: [number, number, number];
      relayer?: [number, number, number];
      web: [number, number, number];
    }> = [];

    for (let i = 0; i < fuzzData.length; i++) {
      const { input, rust } = fuzzData[i];
      const rWeb = webCalc(input);
      const matchRustWeb = JSON.stringify(rust) === JSON.stringify(rWeb);
      if (!matchRustWeb) rustWebMismatches++;

      let rRelayer: [number, number, number] | undefined;
      let matchRustRelayer = true;
      let matchRelayerWeb = true;
      if (relayerPricing) {
        rRelayer = relayerPricing.calculateAdaptiveResistance(input);
        matchRustRelayer = JSON.stringify(rust) === JSON.stringify(rRelayer);
        matchRelayerWeb = JSON.stringify(rRelayer) === JSON.stringify(rWeb);
        if (!matchRustRelayer) rustRelayerMismatches++;
        if (!matchRelayerWeb) relayerWebMismatches++;
      }

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

    console.log(`  Rust vs Web Mismatches    : ${rustWebMismatches} / ${fuzzData.length}`);
    if (relayerPricing) {
      console.log(`  Rust vs Relayer Mismatches: ${rustRelayerMismatches} / ${fuzzData.length}`);
      console.log(`  Relayer vs Web Mismatches : ${relayerWebMismatches} / ${fuzzData.length}`);
    }
    if (rustWebMismatches > 0 || rustRelayerMismatches > 0 || relayerWebMismatches > 0) {
      failures.push(
        `Rust fuzz parity mismatches (rust-web=${rustWebMismatches}, rust-relayer=${rustRelayerMismatches}, relayer-web=${relayerWebMismatches})`
      );
      for (const s of sampleMismatches) {
        console.log(`  Item #${s.index} [${s.input.join(", ")}]: rust=${JSON.stringify(s.rust)} web=${JSON.stringify(s.web)} relayer=${JSON.stringify(s.relayer)}`);
      }
    }
  }

  // 3. Live RPC scientific-notation yocto string parsing
  console.log("\n[3] Live RPC scientific-notation yocto parsing parity:");
  const scientificCases: Array<{ input: string; expected: bigint }> = [
    { input: "2.3683e+24", expected: 2_368_300_000_000_000_000_000_000n },
    { input: "5.7e+22", expected: 57_000_000_000_000_000_000_000n },
    { input: "4e+22", expected: 40_000_000_000_000_000_000_000n },
    { input: "0", expected: 0n },
    { input: "600000000000000000000000", expected: 600_000_000_000_000_000_000_000n },
  ];
  if (!relayerTypes) {
    console.log("  [SKIP] Relayer dist types.js unavailable; scientific-notation yocto check skipped.");
  } else if (typeof relayerTypes.parseYoctoSafe !== "function") {
    failures.push("relayer/dist/types.js must export parseYoctoSafe(value)");
    console.log("  ✖ Missing export parseYoctoSafe in relayer/dist/types.js");
  } else {
    for (const tc of scientificCases) {
      const parsedSafe = relayerTypes.parseYoctoSafe(tc.input);
      const parsedToBigInt = relayerTypes.toBigInt(tc.input);
      const ok = parsedSafe === tc.expected && parsedToBigInt === tc.expected;
      console.log(
        `  ${ok ? "✔" : "✖"} "${tc.input}" -> ${parsedSafe.toString()}n (expected ${tc.expected.toString()}n)`
      );
      if (!ok) {
        failures.push(
          `Scientific yocto parse mismatch for "${tc.input}": parseYoctoSafe=${parsedSafe}, toBigInt=${parsedToBigInt}, expected=${tc.expected}`
        );
      }
    }
  }

  // 4. Merchant vector schema & pricing consistency across test-vectors/ & relayer/
  console.log("\n[4] Merchant vector schema & pricing parity (v3.1):");
  const testMerchantPath = path.join(ROOT_DIR, "test-vectors", "merchant_vectors.json");
  const relayerMerchantPath = path.join(ROOT_DIR, "relayer", "merchant_vectors.json");
  const testMerchant = JSON.parse(
    fs.readFileSync(testMerchantPath, "utf-8")
  ) as MerchantVectorsFile;
  const relayerMerchant = JSON.parse(
    fs.readFileSync(relayerMerchantPath, "utf-8")
  ) as MerchantVectorsFile;

  validateMerchantSchema(testMerchant, "test-vectors/merchant_vectors.json", failures);
  validateMerchantSchema(relayerMerchant, "relayer/merchant_vectors.json", failures);

  const schemaParityOk =
    testMerchant.merchant_base_price_yocto === relayerMerchant.merchant_base_price_yocto &&
    testMerchant.merchant_target_stock === relayerMerchant.merchant_target_stock &&
    testMerchant.merchant_spread_bps === relayerMerchant.merchant_spread_bps &&
    testMerchant.merchant_min_reserve_yocto === relayerMerchant.merchant_min_reserve_yocto &&
    testMerchant.buyback_base_yocto === relayerMerchant.buyback_base_yocto &&
    JSON.stringify(testMerchant.merchant) === JSON.stringify(relayerMerchant.merchant) &&
    JSON.stringify(testMerchant.buyback) === JSON.stringify(relayerMerchant.buyback);

  console.log(
    `  ${schemaParityOk ? "✔" : "✖"} test-vectors/merchant_vectors.json matches relayer/merchant_vectors.json (${testMerchant.merchant?.length ?? 0} merchant, ${testMerchant.buyback?.length ?? 0} buyback)`
  );
  if (!schemaParityOk) {
    failures.push(
      "test-vectors/merchant_vectors.json does not match relayer/merchant_vectors.json"
    );
  }

  const webConstantsOk =
    MERCHANT_BASE_PRICE_NEAR === 0.05 &&
    MERCHANT_TARGET_STOCK === testMerchant.merchant_target_stock &&
    MERCHANT_SPREAD_BPS === testMerchant.merchant_spread_bps &&
    MERCHANT_MIN_CASH_NEAR === 1.0 &&
    BUYBACK_BASE_NEAR === 0.1;
  console.log(
    `  ${webConstantsOk ? "✔" : "✖"} web/src/lib/spire/constants.ts matches v3.1 merchant/buyback parameters`
  );
  if (!webConstantsOk) {
    failures.push("web/src/lib/spire/constants.ts merchant/buyback constants mismatch");
  }

  if (relayerPricing) {
    // Verify relayer default basePriceYocto is 0.05 NEAR (50_000_000_000_000_000_000_000n)
    const defaultEq = relayerPricing.calculateMerchantQuote({ stock: 100 });
    const defaultBaseOk =
      defaultEq.midPriceYocto === 50_000_000_000_000_000_000_000n &&
      relayerPricing.MERCHANT_TARGET_STOCK === 100 &&
      relayerPricing.MERCHANT_SPREAD_BPS === 1000 &&
      relayerPricing.BUYBACK_BASE_YOCTO === 100_000_000_000_000_000_000_000n;
    console.log(
      `  ${defaultBaseOk ? "✔" : "✖"} relayer default calculateMerchantQuote({ stock: 100 }) midPriceYocto=${defaultEq.midPriceYocto.toString()} (0.05 NEAR)`
    );
    if (!defaultBaseOk) {
      failures.push(
        `relayer default basePriceYocto mismatch: midPriceYocto=${defaultEq.midPriceYocto.toString()}`
      );
    }

    for (const vec of testMerchant.merchant) {
      const q = relayerPricing.calculateMerchantQuote({
        stock: vec.stock,
        targetStock: vec.target_stock,
        basePriceYocto: testMerchant.merchant_base_price_yocto,
        demand: vec.demand,
        treasuryReserveYocto: vec.reserve_yocto,
      });
      const ok =
        q.midPriceYocto.toString() === vec.expected.midPriceYocto &&
        q.buyPriceYocto.toString() === vec.expected.buyPriceYocto &&
        q.sellPriceYocto.toString() === vec.expected.sellPriceYocto &&
        q.isClosed === vec.expected.isClosed &&
        q.reason === vec.expected.reason;
      if (!ok) {
        failures.push(`Merchant vector "${vec.name}" mismatch against relayer/dist/pricing.js`);
      }
    }

    for (const vec of testMerchant.buyback) {
      const q = relayerPricing.calculateBuybackQuote({
        floor: vec.floor,
        element: vec.element,
        buybackMultiplierBps: vec.multiplier_bps,
        qty: vec.qty,
        vaultBalanceYocto: vec.vault_balance_yocto,
      });
      const ok =
        q.unit_price_yocto === vec.expected.unitPriceYocto &&
        q.total_price_yocto === vec.expected.totalPriceYocto &&
        q.multiplier_bps === vec.expected.multiplier_bps &&
        q.is_open === vec.expected.isOpen &&
        q.reason === vec.expected.reason;
      if (!ok) {
        failures.push(`Buyback vector "${vec.name}" mismatch against relayer/dist/pricing.js`);
      }
    }
    console.log(
      `  ✔ Executed ${testMerchant.merchant.length} merchant + ${testMerchant.buyback.length} buyback vectors against relayer/dist/pricing.js`
    );
  }

  if (failures.length > 0) {
    console.error("\n✖ CROSS-LAYER PARITY FAILURES:");
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    return false;
  }

  console.log("\n✔ ALL CROSS-LAYER MATHEMATICAL & SCHEMA PARITY CHECKS PASSED.");
  return true;
}

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isMain =
  entryFile.length > 0 &&
  (process.platform === "win32"
    ? THIS_FILE.toLowerCase() === entryFile.toLowerCase()
    : THIS_FILE === entryFile);

if (isMain) {
  runCrossLayerParity({ requireRelayerDist: true })
    .then((passed) => {
      process.exit(passed ? 0 : 1);
    })
    .catch((err) => {
      console.error("Fatal error running cross-layer parity:", err);
      process.exit(1);
    });
}
