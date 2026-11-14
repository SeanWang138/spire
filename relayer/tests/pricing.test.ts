import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateAdaptiveResistance,
  calculateMerchantQuote,
  calculateQuoteForSide,
  calculateBossDamage,
  checkBossTribute,
  calculateJackpotDistribution,
  applyMaxShiftLimit,
  computeShiftWithCap,
  calculateBuybackQuote,
  BUYBACK_BASE_YOCTO,
  MERCHANT_BASE_PRICE_YOCTO,
} from "../dist/pricing.js";
import {
  DEFAULT_RESISTANCE_CONFIG,
  ONE_NEAR_YOCTO,
  parseYoctoSafe,
  toBigInt,
} from "../dist/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ResistanceVectorFixture {
  name: string;
  description: string;
  input_supplies: [number, number, number];
  expected_resistances: [number, number, number];
  total_bps: number;
}

interface MerchantVectorFixture {
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

interface BuybackVectorFixture {
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
  merchant: MerchantVectorFixture[];
  buyback: BuybackVectorFixture[];
}

const vectors: MerchantVectorsFile = JSON.parse(
  readFileSync(resolve(__dirname, "../merchant_vectors.json"), "utf-8")
) as MerchantVectorsFile;

const BASE = 100_000_000_000_000_000_000_000n; // 0.1 NEAR
const MERCHANT_BASE = 50_000_000_000_000_000_000_000n; // 0.05 NEAR

describe("Pricing Engine - Adaptive Resistance", () => {
  it("passes canonical test vector [80, 20, 10] -> [8500, 3114, 1886]", () => {
    const result = calculateAdaptiveResistance([80, 20, 10]);
    assert.deepStrictEqual(result, [8500, 3114, 1886]);
    assert.strictEqual(result[0] + result[1] + result[2], 13500);
    assert.strictEqual(result.every((r) => r >= 1000 && r <= 8500), true);
  });

  it("passes all test vectors defined in test-vectors/resistance_vectors.json", () => {
    const raw = readFileSync(resolve(__dirname, "../../test-vectors/resistance_vectors.json"), "utf-8");
    const fixture = JSON.parse(raw) as { vectors: ResistanceVectorFixture[] };

    for (const vector of fixture.vectors) {
      const output = calculateAdaptiveResistance(vector.input_supplies);
      assert.deepStrictEqual(output, vector.expected_resistances, `Failed vector ${vector.name}`);
      assert.strictEqual(output[0] + output[1] + output[2], vector.total_bps);
      for (const r of output) {
        assert.ok(r >= 1000, `Resistance ${r} should be >= 1000 in ${vector.name}`);
        assert.ok(r <= 8500, `Resistance ${r} should be <= 8500 in ${vector.name}`);
      }
    }
  });

  it("strictly enforces conservation and clamping invariants across randomized inputs", () => {
    for (let trial = 0; trial < 100; trial++) {
      const supplies: [number, number, number] = [
        Math.floor(Math.random() * 500),
        Math.floor(Math.random() * 500),
        Math.floor(Math.random() * 500),
      ];
      const res = calculateAdaptiveResistance(supplies);
      assert.strictEqual(res[0] + res[1] + res[2], DEFAULT_RESISTANCE_CONFIG.totalBps);
      for (const r of res) {
        assert.ok(r >= DEFAULT_RESISTANCE_CONFIG.minBps && r <= DEFAULT_RESISTANCE_CONFIG.maxBps);
      }
    }
  });
});

describe("Pricing Engine - Merchant quote", () => {
  it("returns base price with no stock or demand pressure", () => {
    const quote = calculateMerchantQuote({
      stock: 100,
      targetStock: 100,
      basePriceYocto: BASE,
      treasuryReserveYocto: ONE_NEAR_YOCTO * 5n,
    });
    assert.strictEqual(quote.midPriceYocto, BASE);
    assert.strictEqual(quote.stockPressureBps, 0);
    assert.strictEqual(quote.demandPressureBps, 0);
    assert.strictEqual(quote.buyPriceYocto, (BASE * 11000n) / 10000n); // +10%
    assert.strictEqual(quote.sellPriceYocto, (BASE * 9000n) / 10000n); // -10%
    assert.strictEqual(quote.reason, "ok");
    assert.strictEqual(quote.isClosed, false);
  });

  it("applies 0.5 * stock pressure and 0.3 * demand pressure to mid", () => {
    // Stock at half target -> stock pressure 5000 bps -> mid factor 1 + 0.5*0.5 = 1.25
    const stocked = calculateMerchantQuote({ stock: 50, targetStock: 100, basePriceYocto: BASE });
    assert.strictEqual(stocked.stockPressureBps, 5000);
    assert.strictEqual(stocked.midPriceYocto, (BASE * 12500n) / 10000n);

    // Empty stock + full demand -> factor 1 + 0.5 + 0.3 = 1.8
    const scarce = calculateMerchantQuote({
      stock: 0,
      targetStock: 100,
      basePriceYocto: BASE,
      demand: 100,
    });
    assert.strictEqual(scarce.stockPressureBps, 10000);
    assert.strictEqual(scarce.demandPressureBps, 10000);
    assert.strictEqual(scarce.midPriceYocto, (BASE * 18000n) / 10000n);
  });

  it("clamps the mid factor to [0.5, 2.0] and ignores overstock", () => {
    const overstock = calculateMerchantQuote({ stock: 500, demand: 0, basePriceYocto: BASE });
    assert.strictEqual(overstock.midPriceYocto, (BASE * 5000n) / 10000n); // floor 0.5x

    const crowded = calculateMerchantQuote({
      stock: 0,
      demand: 1000, // clamped to 10000 bps demand pressure
      basePriceYocto: BASE,
    });
    assert.strictEqual(crowded.midPriceYocto, (BASE * 18000n) / 10000n); // 1.8x (below 2.0 cap)
  });

  it("keeps both sides of the spread inside 10% of mid", () => {
    const quote = calculateMerchantQuote({ stock: 90, demand: 10, basePriceYocto: BASE });
    assert.strictEqual(quote.buyPriceYocto - quote.midPriceYocto, quote.midPriceYocto / 10n);
    assert.strictEqual(quote.midPriceYocto - quote.sellPriceYocto, quote.midPriceYocto / 10n);
    assert.ok(quote.buyPriceYocto > quote.sellPriceYocto);
  });

  it("closes the merchant when the treasury reserve drops below 1 NEAR", () => {
    const quote = calculateMerchantQuote({
      stock: 100,
      basePriceYocto: BASE,
      treasuryReserveYocto: ONE_NEAR_YOCTO - 1n,
    });
    assert.strictEqual(quote.isClosed, true);
    assert.strictEqual(quote.reason, "treasury_below_min_reserve");
  });

  it("mirrors get_quote(item, side, qty) price and reason", () => {
    const buy = calculateQuoteForSide({ stock: 100, basePriceYocto: BASE }, "buy", 2);
    assert.strictEqual(buy.price, ((BASE * 11000n) / 10000n * 2n).toString());
    assert.strictEqual(buy.reason, "ok");

    const sell = calculateQuoteForSide({ stock: 100, basePriceYocto: BASE }, "sell", 1);
    assert.strictEqual(sell.price, ((BASE * 9000n) / 10000n).toString());
  });

  it("defaults basePriceYocto to 0.05 NEAR (50000000000000000000000 yocto)", () => {
    assert.strictEqual(MERCHANT_BASE_PRICE_YOCTO, MERCHANT_BASE);
    const quote = calculateMerchantQuote({ stock: 100 });
    assert.strictEqual(quote.midPriceYocto, 50_000_000_000_000_000_000_000n);
    assert.strictEqual(quote.buyPriceYocto, 55_000_000_000_000_000_000_000n);
    assert.strictEqual(quote.sellPriceYocto, 45_000_000_000_000_000_000_000n);
    assert.strictEqual(quote.isClosed, false);
    assert.strictEqual(quote.reason, "ok");
  });

  it("passes every vector in relayer/merchant_vectors.json (merchant)", () => {
    for (const vector of vectors.merchant) {
      const quote = calculateMerchantQuote({
        stock: vector.stock,
        targetStock: vector.target_stock,
        basePriceYocto: MERCHANT_BASE,
        demand: vector.demand,
        treasuryReserveYocto: BigInt(vector.reserve_yocto),
      });
      assert.strictEqual(
        quote.midPriceYocto.toString(),
        vector.expected.midPriceYocto,
        `mid mismatch in ${vector.name}`
      );
      assert.strictEqual(
        quote.buyPriceYocto.toString(),
        vector.expected.buyPriceYocto,
        `buy mismatch in ${vector.name}`
      );
      assert.strictEqual(
        quote.sellPriceYocto.toString(),
        vector.expected.sellPriceYocto,
        `sell mismatch in ${vector.name}`
      );
      assert.strictEqual(quote.isClosed, vector.expected.isClosed, `isClosed mismatch in ${vector.name}`);
      assert.strictEqual(quote.reason, vector.expected.reason, `reason mismatch in ${vector.name}`);
    }
  });

  it("passes every vector in relayer/merchant_vectors.json (buyback)", () => {
    for (const vector of vectors.buyback) {
      const quote = calculateBuybackQuote({
        floor: vector.floor,
        element: vector.element,
        buybackMultiplierBps: vector.multiplier_bps,
        qty: vector.qty,
        vaultBalanceYocto: vector.vault_balance_yocto,
      });
      assert.strictEqual(quote.unit_price_yocto, vector.expected.unitPriceYocto, `unit mismatch in ${vector.name}`);
      assert.strictEqual(quote.total_price_yocto, vector.expected.totalPriceYocto, `total mismatch in ${vector.name}`);
      assert.strictEqual(quote.multiplier_bps, vector.expected.multiplier_bps, `multiplier mismatch in ${vector.name}`);
      assert.strictEqual(quote.is_open, vector.expected.isOpen, `is_open mismatch in ${vector.name}`);
      assert.strictEqual(quote.reason, vector.expected.reason, `reason mismatch in ${vector.name}`);
    }
  });

  it("mirrors get_buyback_quote base pricing", () => {
    assert.strictEqual(BUYBACK_BASE_YOCTO, 100_000_000_000_000_000_000_000n); // 0.1 NEAR
    // Neutral multiplier quotes the base price.
    const neutral = calculateBuybackQuote({ floor: 1, element: 0, buybackMultiplierBps: 10000 });
    assert.strictEqual(neutral.unit_price_yocto, BUYBACK_BASE_YOCTO.toString());
    // 40000 bps => 4x base; multiplier above range clamps to 40000.
    const maxed = calculateBuybackQuote({ floor: 2, element: 1, buybackMultiplierBps: 99999 });
    assert.strictEqual(maxed.unit_price_yocto, (BUYBACK_BASE_YOCTO * 4n).toString());
    assert.strictEqual(maxed.multiplier_bps, 40000);
    // Without vault info the quote is open.
    assert.strictEqual(maxed.is_open, true);
  });
});

describe("Pricing Engine - Shift cap", () => {
  it("caps positive and negative shifts at maxShift", () => {
    assert.strictEqual(computeShiftWithCap(10000, 40000, 2500), 12500);
    assert.strictEqual(computeShiftWithCap(40000, 10000, 2500), 37500);
    assert.strictEqual(computeShiftWithCap(10000, 11000, 2500), 11000);
  });

  it("clamps resistance shifts exceeding MAX_SHIFT_BPS (2500 bps)", () => {
    const current: [number, number, number] = [4500, 4500, 4500];
    const target: [number, number, number] = [8500, 2500, 2500];

    const bounded = applyMaxShiftLimit(current, target, 2500);
    assert.ok(bounded[0] <= 7000);
    assert.strictEqual(bounded[0] + bounded[1] + bounded[2], 13500);
  });
});

describe("Pricing Engine - Boss Combat & Tribute", () => {
  it("calculates mitigated damage accurately with clamp", () => {
    assert.strictEqual(calculateBossDamage(400, 4500), 220);
    assert.strictEqual(calculateBossDamage(400, 4500, 150), 150);
    assert.strictEqual(calculateBossDamage(400, 10000), 0);
    assert.strictEqual(calculateBossDamage(400, 12000), 0);
  });

  it("evaluates Boss Tribute weapon confiscation rules", () => {
    assert.strictEqual(
      checkBossTribute({ weaponElement: 0, resistanceBps: 7500, isStarterLocked: false, inventoryCount: 3 })
        .tributeTaken,
      true
    );
    assert.strictEqual(
      checkBossTribute({ weaponElement: 0, resistanceBps: 8500, isStarterLocked: true, inventoryCount: 3 })
        .tributeTaken,
      false
    );
    assert.strictEqual(
      checkBossTribute({ weaponElement: 0, resistanceBps: 8000, isStarterLocked: false, inventoryCount: 1 })
        .tributeTaken,
      false
    );
    assert.strictEqual(
      checkBossTribute({ weaponElement: 0, resistanceBps: 6999, isStarterLocked: false, inventoryCount: 5 })
        .tributeTaken,
      false
    );
  });
});

describe("Pricing Engine - 90/10 Proportional Jackpot", () => {
  it("correctly allocates 10% last attack bonus and 90% proportional damage pool", () => {
    const totalJackpot = 1_000_000_000_000_000_000_000_000n; // 1 NEAR
    const totalDamage = 1000;

    const payoutA = calculateJackpotDistribution(totalJackpot, totalDamage, 400, false);
    assert.strictEqual(payoutA.lastBonus, 100_000_000_000_000_000_000_000n);
    assert.strictEqual(payoutA.proportionalPool, 900_000_000_000_000_000_000_000n);
    assert.strictEqual(payoutA.playerShare, 360_000_000_000_000_000_000_000n);
    assert.strictEqual(payoutA.totalPayout, 360_000_000_000_000_000_000_000n);

    const payoutB = calculateJackpotDistribution(totalJackpot, totalDamage, 600, true);
    assert.strictEqual(payoutB.playerShare, 540_000_000_000_000_000_000_000n);
    assert.strictEqual(payoutB.totalPayout, 640_000_000_000_000_000_000_000n);

    assert.strictEqual(payoutA.totalPayout + payoutB.totalPayout, totalJackpot);
  });
});

describe("Types - parseYoctoSafe & toBigInt", () => {
  it("parses integers, decimals, and scientific notation strings/numbers cleanly", () => {
    assert.strictEqual(parseYoctoSafe("2.3683e+24"), 2368300000000000000000000n);
    assert.strictEqual(parseYoctoSafe(2.3683e+24), 2368300000000000000000000n);
    assert.strictEqual(parseYoctoSafe("4e+22"), 40000000000000000000000n);
    assert.strictEqual(parseYoctoSafe(4e+22), 40000000000000000000000n);
    assert.strictEqual(parseYoctoSafe("5.7e+22"), 57000000000000000000000n);
    assert.strictEqual(parseYoctoSafe("0"), 0n);
    assert.strictEqual(parseYoctoSafe(0), 0n);
    assert.strictEqual(parseYoctoSafe(42n), 42n);
    assert.strictEqual(parseYoctoSafe("123.0"), 123n);
    assert.strictEqual(parseYoctoSafe("123.99"), 123n);
    assert.strictEqual(parseYoctoSafe("0.5"), 0n);
    assert.strictEqual(parseYoctoSafe("-2.5e+2"), -250n);
    assert.strictEqual(toBigInt("2.3683e+24"), 2368300000000000000000000n);
  });

  it("accepts scientific notation reserve/jackpot inputs in pricing helpers", () => {
    const merchant = calculateMerchantQuote({
      stock: 100,
      treasuryReserveYocto: "2.3683e+24",
    });
    assert.strictEqual(merchant.isClosed, false);
    assert.strictEqual(merchant.midPriceYocto, MERCHANT_BASE);

    const buyback = calculateBuybackQuote({
      floor: 0,
      element: 0,
      buybackMultiplierBps: 10000,
      vaultBalanceYocto: "4e+22",
    });
    assert.strictEqual(buyback.is_open, false);
  });

  it("rejects empty or non-numeric inputs", () => {
    assert.throws(() => parseYoctoSafe(""), /Invalid yocto/);
    assert.throws(() => parseYoctoSafe("not-a-number"), /Invalid yocto/);
    assert.throws(() => parseYoctoSafe(Number.NaN), /Invalid yocto/);
    assert.throws(() => parseYoctoSafe(Number.POSITIVE_INFINITY), /Invalid yocto/);
  });
});
