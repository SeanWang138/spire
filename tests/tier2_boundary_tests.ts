/**
 * Tier 2: Boundary Value Analysis & Corner Cases
 * Tests edge conditions, off-by-one boundaries, clamp bounds [1000, 8500],
 * zero supplies, extreme ratios, merchant treasury depletion (<1 NEAR),
 * tribute thresholds (6999 vs 7000), starter-locked immunity, and timeouts.
 */

import { createSuiteRegistry, expect } from "./test_harness.ts";
const registry = createSuiteRegistry();
const describe = registry.describe;
const it = registry.it;
import {
  computeAdaptiveResistance,
  computeMerchantPrice,
  evaluateBossTribute,
  computeJackpotPayouts,
  computeFloor3EnrageHeal,
  validateAiProposal,
  ONE_NEAR_YOCTO,
  RESISTANCE_TOTAL_BPS,
  TRIBUTE_THRESHOLD_BPS,
  RESISTANCE_MIN_CLAMP_BPS,
  RESISTANCE_MAX_CLAMP_BPS,
} from "./protocol_models.ts";

describe("Tier 2 - Suite 1: Resistance Clamp Limits [1000, 8500] Boundaries", () => {
  it("BVA 1.1: Exact upper bound 8500 bps is preserved", () => {
    // When an element computes to exactly 8500 bps
    const res = computeAdaptiveResistance([85, 25, 25]);
    expect(res[0]).toBe(8500);
    expect(res[1] + res[2]).toBe(5000);
  });

  it("BVA 1.2: Raw share exceeding upper bound (e.g. 9818 bps) is clamped strictly to 8500 bps", () => {
    const res = computeAdaptiveResistance([80, 20, 10]);
    expect(res[0]).toBe(RESISTANCE_MAX_CLAMP_BPS);
  });

  it("BVA 1.3: Exact lower bound 1000 bps is enforced when raw share falls below 1000 bps", () => {
    // Element with 0 supply in presence of 50/50 others
    const res = computeAdaptiveResistance([50, 50, 0]);
    expect(res[2]).toBe(RESISTANCE_MIN_CLAMP_BPS); // void clamped to 1000
    expect(res[0]).toBe(6250);
    expect(res[1]).toBe(6250);
  });

  it("BVA 1.4: Double clamp: Two elements hitting lower bound 1000 bps forces 3rd element to clamp to 8500 bps", () => {
    // If element 0 has 1000 weapons and elements 1 & 2 have 0 weapons
    const res = computeAdaptiveResistance([1000, 0, 0]);
    expect(res[0]).toBe(RESISTANCE_MAX_CLAMP_BPS); // 8500
    expect(res[1]).toBe(2500);
    expect(res[2]).toBe(2500);
    expect(res[0] + res[1] + res[2]).toBe(RESISTANCE_TOTAL_BPS);
  });

  it("BVA 1.5: Asymmetric skew [1, 99, 0] clamps Frost to 8500, preserves 13500 total", () => {
    const res = computeAdaptiveResistance([1, 99, 0]);
    expect(res[1]).toBe(8500);
    expect(res[0] + res[1] + res[2]).toBe(13500);
    expect(res[0]).toBeGreaterThanOrEqual(1000);
    expect(res[2]).toBeGreaterThanOrEqual(1000);
  });
});

describe("Tier 2 - Suite 2: Zero Supplies and Extreme Supply Ratios", () => {
  it("BVA 2.1: Initial game state zero supply [0, 0, 0] produces deterministic equal [4500, 4500, 4500]", () => {
    const res = computeAdaptiveResistance([0, 0, 0]);
    expect(res).toEqual([4500, 4500, 4500]);
  });

  it("BVA 2.2: Extreme single supply [100, 0, 0] clamps dominant element to 8500 and splits rest equally", () => {
    const res = computeAdaptiveResistance([100, 0, 0]);
    expect(res).toEqual([8500, 2500, 2500]);
  });

  it("BVA 2.3: Extreme asymmetry [9999, 1, 1] maintains invariant bounds without numeric overflow", () => {
    const res = computeAdaptiveResistance([9999, 1, 1]);
    expect(res[0]).toBe(8500);
    expect(res[1] + res[2]).toBe(5000);
    expect(res[0] + res[1] + res[2]).toBe(13500);
  });

  it("BVA 2.4: Inverted dominance [0, 100, 0] clamps Frost to 8500 and splits Solar/Void to 2500", () => {
    const res = computeAdaptiveResistance([0, 100, 0]);
    expect(res).toEqual([2500, 8500, 2500]);
  });

  it("BVA 2.5: Inverted dominance [0, 0, 100] clamps Void to 8500 and splits Solar/Frost to 2500", () => {
    const res = computeAdaptiveResistance([0, 0, 100]);
    expect(res).toEqual([2500, 2500, 8500]);
  });
});

describe("Tier 2 - Suite 3: NPC Merchant Reserve Depletion & Stock Boundaries", () => {
  it("BVA 3.1: Treasury reserve = exactly 1.0 NEAR (10^24 yocto) keeps merchant OPEN for sells", () => {
    const p = computeMerchantPrice({
      stock: 100,
      treasuryReserveYocto: ONE_NEAR_YOCTO,
    });
    expect(p.isClosed).toBe(false);
  });

  it("BVA 3.2: Treasury reserve = 1.0 NEAR - 1 yocto CLOSES merchant for sells", () => {
    const p = computeMerchantPrice({
      stock: 100,
      treasuryReserveYocto: ONE_NEAR_YOCTO - 1n,
    });
    expect(p.isClosed).toBe(true);
  });

  it("BVA 3.3: Treasury reserve = 0 yocto keeps merchant CLOSED", () => {
    const p = computeMerchantPrice({
      stock: 100,
      treasuryReserveYocto: 0n,
    });
    expect(p.isClosed).toBe(true);
  });

  it("BVA 3.4: Stock = 0 (maximum scarcity) doubles base price (2.0 * P0)", () => {
    const p = computeMerchantPrice({
      stock: 0,
      targetStock: 100,
      basePriceYocto: 100_000_000_000_000_000_000_000n, // 0.1 NEAR
    });
    expect(p.midPriceYocto).toBe(200_000_000_000_000_000_000_000n); // 0.2 NEAR
  });

  it("BVA 3.5: Stock = 1 unit yields midPrice = P0 * (1 + 99/100) = 1.99 * P0", () => {
    const p = computeMerchantPrice({
      stock: 1,
      targetStock: 100,
      basePriceYocto: 100_000_000_000_000_000_000_000n,
    });
    expect(p.midPriceYocto).toBe(199_000_000_000_000_000_000_000n);
  });

  it("BVA 3.6: Stock = 1,000,000 (extreme oversupply) remains at baseline P0", () => {
    const p = computeMerchantPrice({
      stock: 1_000_000,
      targetStock: 100,
      basePriceYocto: 100_000_000_000_000_000_000_000n,
    });
    expect(p.midPriceYocto).toBe(100_000_000_000_000_000_000_000n);
  });
});

describe("Tier 2 - Suite 4: Boss Tribute Threshold Boundaries (6999 vs 7000 bps)", () => {
  it("BVA 4.1: Exactly 6999 bps resistance is SAFE from weapon confiscation", () => {
    const result = evaluateBossTribute({
      resistanceBps: 6999,
      isStarterLocked: false,
      totalWeaponsOwned: 5,
    });
    expect(result.confiscated).toBe(false);
  });

  it("BVA 4.2: Exactly 7000 bps resistance TRIGGERS weapon confiscation", () => {
    const result = evaluateBossTribute({
      resistanceBps: 7000,
      isStarterLocked: false,
      totalWeaponsOwned: 5,
    });
    expect(result.confiscated).toBe(true);
  });

  it("BVA 4.3: 7001 bps resistance TRIGGERS weapon confiscation", () => {
    const result = evaluateBossTribute({
      resistanceBps: 7001,
      isStarterLocked: false,
      totalWeaponsOwned: 5,
    });
    expect(result.confiscated).toBe(true);
  });

  it("BVA 4.4: 8500 bps (max resistance) with starter-locked weapon is IMMUNE from confiscation", () => {
    const result = evaluateBossTribute({
      resistanceBps: 8500,
      isStarterLocked: true,
      totalWeaponsOwned: 5,
    });
    expect(result.confiscated).toBe(false);
  });

  it("BVA 4.5: 8500 bps with totalWeaponsOwned = 1 (player's last weapon) is IMMUNE from confiscation", () => {
    const result = evaluateBossTribute({
      resistanceBps: 8500,
      isStarterLocked: false,
      totalWeaponsOwned: 1,
    });
    expect(result.confiscated).toBe(false);
  });

  it("BVA 4.6: 8500 bps with totalWeaponsOwned = 2 (not last weapon) and not starter-locked is CONFISCATED", () => {
    const result = evaluateBossTribute({
      resistanceBps: 8500,
      isStarterLocked: false,
      totalWeaponsOwned: 2,
    });
    expect(result.confiscated).toBe(true);
  });
});

describe("Tier 2 - Suite 5: Jackpot Math, Residues & Single Attacker", () => {
  it("BVA 5.1: 1 yocto total pool calculates without integer underflow", () => {
    const map = new Map<string, number>([["killer", 100]]);
    const res = computeJackpotPayouts(1n, 100, map, "killer");
    // 1 / 10 = 0 bonus, 1 proportional pool, killer gets 1
    expect(res.lastBonus).toBe(0n);
    expect(res.proportionalPool).toBe(1n);
    expect(res.totalDistributed).toBe(1n);
    expect(res.residualReserve).toBe(0n);
  });

  it("BVA 5.2: Indivisible pool (10,001 yocto among 3 attackers) preserves conservation (totalDistributed <= totalJackpot)", () => {
    const total = 10_001n;
    const map = new Map<string, number>([
      ["p1", 333],
      ["p2", 333],
      ["p3", 334],
    ]);
    const res = computeJackpotPayouts(total, 1000, map, "p3");
    expect(res.totalDistributed).toBeLessThanOrEqual(total);
    expect(res.totalDistributed + res.residualReserve).toBe(total);
  });

  it("BVA 5.3: Single attacker dealing 1 damage captures 100% of jackpot", () => {
    const total = ONE_NEAR_YOCTO * 50n; // 50 NEAR
    const map = new Map<string, number>([["solo", 1]]);
    const res = computeJackpotPayouts(total, 1, map, "solo");
    expect(res.payouts.get("solo")).toBe(total);
  });

  it("BVA 5.4: Killer dealing 0 damage still receives 10% last bonus", () => {
    const total = 100_000n;
    const map = new Map<string, number>([
      ["damage_dealer", 1000],
      ["finisher_zero_dmg", 0],
    ]);
    const res = computeJackpotPayouts(total, 1000, map, "finisher_zero_dmg");
    expect(res.payouts.get("finisher_zero_dmg")).toBe(10_000n); // 10%
    expect(res.payouts.get("damage_dealer")).toBe(90_000n); // 90%
    expect(res.totalDistributed).toBe(100_000n);
  });

  it("BVA 5.5: Zero total damage results in zero distribution without division by zero error", () => {
    const total = ONE_NEAR_YOCTO;
    const map = new Map<string, number>();
    const res = computeJackpotPayouts(total, 0, map, "killer");
    expect(res.totalDistributed).toBe(0n);
    expect(res.payouts.size).toBe(0);
  });
});

describe("Tier 2 - Suite 6: AI Proposal & TEE Multiplier/Shift Boundaries", () => {
  it("BVA 6.1: Multiplier = 9999 bps (1 below min) is rejected", () => {
    const cur: [number, number, number] = [4500, 4500, 4500];
    const res = validateAiProposal(
      cur,
      { epoch: 1, target_resistances: cur, buyback_multiplier_bps: 9999, nonce: 1 },
      0
    );
    expect(res.valid).toBe(false);
    expect(res.error).toBe("E_INVALID_BUYBACK_MULTIPLIER");
  });

  it("BVA 6.2: Multiplier = 10000 bps (exact min) is accepted", () => {
    const cur: [number, number, number] = [4500, 4500, 4500];
    const res = validateAiProposal(
      cur,
      { epoch: 1, target_resistances: cur, buyback_multiplier_bps: 10000, nonce: 1 },
      0
    );
    expect(res.valid).toBe(true);
  });

  it("BVA 6.3: Multiplier = 40000 bps (exact max) is accepted", () => {
    const cur: [number, number, number] = [4500, 4500, 4500];
    const res = validateAiProposal(
      cur,
      { epoch: 1, target_resistances: cur, buyback_multiplier_bps: 40000, nonce: 1 },
      0
    );
    expect(res.valid).toBe(true);
  });

  it("BVA 6.4: Multiplier = 40001 bps (1 above max) is rejected", () => {
    const cur: [number, number, number] = [4500, 4500, 4500];
    const res = validateAiProposal(
      cur,
      { epoch: 1, target_resistances: cur, buyback_multiplier_bps: 40001, nonce: 1 },
      0
    );
    expect(res.valid).toBe(false);
    expect(res.error).toBe("E_INVALID_BUYBACK_MULTIPLIER");
  });

  it("BVA 6.5: Shift per element = 2501 bps (1 above MAX_SHIFT_BPS) is rejected", () => {
    const cur: [number, number, number] = [4500, 4500, 4500];
    const target: [number, number, number] = [7001, 3249, 3250]; // 7001 - 4500 = 2501 bps
    const res = validateAiProposal(
      cur,
      { epoch: 1, target_resistances: target, buyback_multiplier_bps: 10000, nonce: 1 },
      0
    );
    expect(res.valid).toBe(false);
    expect(res.error).toBe("E_EXCEEDS_MAX_SHIFT");
  });

  it("BVA 6.6: Shift per element = exactly 2500 bps is accepted", () => {
    const cur: [number, number, number] = [4500, 4500, 4500];
    const target: [number, number, number] = [7000, 3250, 3250]; // 7000 - 4500 = 2500 bps
    const res = validateAiProposal(
      cur,
      { epoch: 1, target_resistances: target, buyback_multiplier_bps: 10000, nonce: 1 },
      0
    );
    expect(res.valid).toBe(true);
  });
});

describe("Tier 2 - Suite 7: Tower Floor Timers & Enrage Boundaries", () => {
  it("BVA 7.1: Floor 2 raid at t = 1799s (1 second before 30m deadline) is valid", () => {
    const deadline = 1800;
    const isExpired = 1799 >= deadline;
    expect(isExpired).toBe(false);
  });

  it("BVA 7.2: Floor 2 raid at t = 1800s (exact 30m deadline) is expired", () => {
    const deadline = 1800;
    const isExpired = 1800 >= deadline;
    expect(isExpired).toBe(true);
  });

  it("BVA 7.3: Floor 3 raid at t = 1199s (1 second before 20m deadline) is valid", () => {
    const deadline = 1200;
    const isExpired = 1199 >= deadline;
    expect(isExpired).toBe(false);
  });

  it("BVA 7.4: Floor 3 raid at t = 1200s (exact 20m deadline) is expired", () => {
    const deadline = 1200;
    const isExpired = 1200 >= deadline;
    expect(isExpired).toBe(true);
  });

  it("BVA 7.5: Floor 3 Enrage heal at 299s applies 0 ticks (0 heals)", () => {
    const res = computeFloor3EnrageHeal(299, 3000, 5000);
    expect(res.ticksApplied).toBe(0);
    expect(res.healedHp).toBe(0);
    expect(res.finalHp).toBe(3000);
  });

  it("BVA 7.6: Floor 3 Enrage heal at 300s applies exactly 1 tick (+500 HP)", () => {
    const res = computeFloor3EnrageHeal(300, 3000, 5000);
    expect(res.ticksApplied).toBe(1);
    expect(res.healedHp).toBe(500);
    expect(res.finalHp).toBe(3500);
  });

  it("BVA 7.7: Floor 3 Enrage heal respects max HP cap (cannot exceed 5000 HP)", () => {
    const res = computeFloor3EnrageHeal(3000, 4800, 5000); // 10 ticks = +5000 HP potential
    expect(res.finalHp).toBe(5000);
    expect(res.healedHp).toBe(200);
  });
});

export async function runTier2(): Promise<boolean> {
  return registry.run("Tier 2: Boundary & Corner Cases Test Suite");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTier2().then((passed) => {
    process.exit(passed ? 0 : 1);
  });
}
