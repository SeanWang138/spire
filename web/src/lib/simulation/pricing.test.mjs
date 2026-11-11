import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Transpile TypeScript source to ES module for test execution
const tsCode = fs.readFileSync(new URL("./pricing.ts", import.meta.url), "utf8");
const jsCode = ts.transpileModule(tsCode, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

const dataUri = "data:text/javascript;base64," + Buffer.from(jsCode).toString("base64");
const pricing = await import(dataUri);

test("Adaptive Resistance: Authoritative Test Vector [80, 20, 10] -> [8500, 3114, 1886]", () => {
  const result = pricing.calculateAdaptiveResistance([80, 20, 10]);
  assert.deepEqual(result, [8500, 3114, 1886]);
  assert.equal(result[0] + result[1] + result[2], 13500);
  assert.equal(pricing.verifyAuthoritativeVector(), true);
});

test("Adaptive Resistance: Symmetric Two Elements with Zero [50, 50, 0] -> [6250, 6250, 1000]", () => {
  const result = pricing.calculateAdaptiveResistance([50, 50, 0]);
  assert.deepEqual(result, [6250, 6250, 1000]);
  assert.equal(result[0] + result[1] + result[2], 13500);
});

test("Adaptive Resistance: Extreme Skew with Zero [1, 99, 0] -> [2567, 8500, 2433]", () => {
  const result = pricing.calculateAdaptiveResistance([1, 99, 0]);
  assert.deepEqual(result, [2567, 8500, 2433]);
  assert.equal(result[0] + result[1] + result[2], 13500);
});

test("Adaptive Resistance: Equal Supply [10, 10, 10] -> [4500, 4500, 4500]", () => {
  const result = pricing.calculateAdaptiveResistance([10, 10, 10]);
  assert.deepEqual(result, [4500, 4500, 4500]);
  assert.equal(result[0] + result[1] + result[2], 13500);
});

test("Adaptive Resistance: Zero Supply [0, 0, 0] -> Default [4500, 4500, 4500]", () => {
  const result = pricing.calculateAdaptiveResistance([0, 0, 0]);
  assert.deepEqual(result, [4500, 4500, 4500]);
  assert.equal(result[0] + result[1] + result[2], 13500);
});

test("Adaptive Resistance: Single Element Extreme Dominance [100, 0, 0]", () => {
  const result = pricing.calculateAdaptiveResistance([100, 0, 0]);
  assert.equal(result[0], 8500);
  assert.equal(result[0] + result[1] + result[2], 13500);
  assert.ok(result[1] >= 1000 && result[1] <= 8500);
  assert.ok(result[2] >= 1000 && result[2] <= 8500);
});

test("NPC Merchant: Price Curve & 10% Spread", () => {
  const quote = pricing.calculateMerchantPrice(30, 50, 0.5, 5.0, 10000);
  assert.equal(quote.isClosed, false);
  assert.ok(quote.buyPriceNear > 0.5);
  // Spread check: sell price is 90% of buy price
  assert.equal(quote.sellPriceNear, Number((quote.buyPriceNear * 0.90).toFixed(4)));
});

test("NPC Merchant: Closure Warning when Treasury Reserve < 1 NEAR", () => {
  const quoteClosed = pricing.calculateMerchantPrice(50, 50, 0.5, 0.8, 10000);
  assert.equal(quoteClosed.isClosed, true);
});

test("Boss Damage & Stances (v3.1: Aggressive / Feint / Pierce)", () => {
  // Aggressive stance (+20% raw power, standard threshold 7000)
  const dmgAgg = pricing.calculateRaidDamage(0, "aggressive", 5000, 1, false);
  assert.equal(dmgAgg.isConfiscated, false);
  assert.ok(dmgAgg.effectiveDamage > 0);

  // Confiscation triggered when resistance >= 7000 bps tribute threshold
  const dmgConfiscated = pricing.calculateRaidDamage(0, "aggressive", 8500, 1, false);
  assert.equal(dmgConfiscated.isConfiscated, true);

  // Starter lock protects from confiscation
  const dmgProtected = pricing.calculateRaidDamage(0, "aggressive", 8500, 1, true);
  assert.equal(dmgProtected.isConfiscated, false);

  // Pierce cuts effective resistance by 1500 bps -> strictly more damage than Feint
  const dmgPierce = pricing.calculateRaidDamage(2, "pierce", 7000, 1, false);
  const dmgFeint = pricing.calculateRaidDamage(2, "feint", 7000, 1, false);
  assert.ok(dmgPierce.effectiveDamage > dmgFeint.effectiveDamage);

  // Floor 2 Frost Ward penalizes Frost strikes
  const frostF1 = pricing.calculateRaidDamage(1, "feint", 3000, 1, false);
  const frostF2 = pricing.calculateRaidDamage(1, "feint", 3000, 2, false);
  assert.ok(frostF2.effectiveDamage < frostF1.effectiveDamage);
});

test("Jackpot Split: 90% Proportional / 10% Last Attack Executioner", () => {
  const split = pricing.calculateJackpotSplit(100, 200, 1000, false);
  assert.equal(split.totalJackpotNear, 100);
  assert.equal(split.lastAttackBountyNear, 10);
  assert.equal(split.proportionalPoolNear, 90);
  // Player did 20% of raid damage -> 20% of 90 NEAR = 18 NEAR
  assert.equal(split.playerEstimatedPayoutNear, 18);

  // With last attack executioner bonus: 18 + 10 = 28 NEAR
  const splitWinner = pricing.calculateJackpotSplit(100, 200, 1000, true);
  assert.equal(splitWinner.playerEstimatedPayoutNear, 28);
});
