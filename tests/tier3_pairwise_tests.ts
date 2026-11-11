/**
 * Tier 3: Cross-Feature Interactions (Pairwise Combinatorial Testing)
 * Validates cross-system multi-stage interaction cascades:
 * 1. Deposit -> Craft -> Attack -> Internal ledger debit & damage mitigation
 * 2. Merchant Trade -> Supply Shift -> Adaptive Resistance Recalibration -> Combat Damage
 * 3. TEE Proposal -> Meta Update -> Merchant Spread & Sell Price Adjustment
 * 4. Multi-User Concurrent Raid -> Boss Defeat -> 90/10 Proportional Jackpot Split
 * 5. Floor 2 Frost Ward Attack: Solar amplification (+25%) vs Frost mitigation (-50%)
 * 6. Floor 3 Lazy Enrage Evaluation over Multiple Turns & Intervals
 * 7. Reforge Weapon Burn -> Realm Supply Shift -> Boss Tribute Confiscation Trigger
 */

import { createSuiteRegistry, expect } from "./test_harness.ts";
const registry = createSuiteRegistry();
const describe = registry.describe;
const it = registry.it;
import {
  computeAdaptiveResistance,
  computeMerchantPrice,
  computeBossDamage,
  evaluateBossTribute,
  computeJackpotPayouts,
  computeFloor3EnrageHeal,
  validateAiProposal,
  SimulatedLedger,
  SimulatedInventory,
  TOKEN_IDS,
  ONE_NEAR_YOCTO,
  TICKET_PRICE_YOCTO,
} from "./protocol_models.ts";

describe("Tier 3 - Interaction 1: Deposit -> Craft -> Attack Lifecycle", () => {
  it("Step 1.1: Player deposits 1 NEAR, crafts Solar Blade, and executes signless attack", () => {
    const ledger = new SimulatedLedger();
    const inv = new SimulatedInventory();

    // 1. Player deposits 1 NEAR into vault
    ledger.deposit("alice.testnet", ONE_NEAR_YOCTO);
    expect(ledger.getBalance("alice.testnet")).toBe(ONE_NEAR_YOCTO);

    // 2. Player has materials and crafts Solar Blade
    inv.setBalance("alice.testnet", TOKEN_IDS.ORE_IRON, 2);
    inv.setBalance("alice.testnet", TOKEN_IDS.ESSENCE_SOLAR, 1);
    inv.craft("alice.testnet", "solar");

    expect(inv.getBalance("alice.testnet", TOKEN_IDS.WEAPON_SOLAR)).toBe(1);
    expect(inv.weaponSupply[0]).toBe(1);

    // 3. Player attacks Floor 1 boss with Solar Blade
    // Debits 0.1 NEAR ticket
    ledger.debit("alice.testnet", TICKET_PRICE_YOCTO);
    expect(ledger.getBalance("alice.testnet")).toBe(ONE_NEAR_YOCTO - TICKET_PRICE_YOCTO);

    // 4. Compute boss damage against initial resistance
    const resistances = computeAdaptiveResistance(inv.weaponSupply);
    const damage = computeBossDamage({
      basePower: 400,
      resistanceBps: resistances[0],
      floor: 1,
      bossHp: 1000,
    });

    expect(damage).toBeGreaterThan(0);
    expect(damage).toBeLessThanOrEqual(400);
  });
});

describe("Tier 3 - Interaction 2: Merchant Trade -> Supply Shift -> Resistance Recalibration", () => {
  it("Step 2.1: Buying materials from NPC, crafting weapons, and observing resistance and damage shift", () => {
    const inv = new SimulatedInventory();
    inv.weaponSupply = [10, 10, 10]; // Initial equal supply

    // Initial resistances
    const rInitial = computeAdaptiveResistance(inv.weaponSupply);
    expect(rInitial).toEqual([4500, 4500, 4500]);

    // Initial damage with Solar weapon
    const dmgBefore = computeBossDamage({
      basePower: 400,
      resistanceBps: rInitial[0],
      floor: 1,
    });
    // 400 * (10000 - 4500) / 10000 = 220
    expect(dmgBefore).toBe(220);

    // Player trades at NPC Merchant: buys iron ore and essences to craft 70 Solar weapons
    for (let i = 0; i < 70; i++) {
      inv.weaponSupply[0]++;
    }
    // Now supplies: [80, 10, 10] -> total 100
    // Solar resistance recalibrates dynamically
    const rAfter = computeAdaptiveResistance(inv.weaponSupply);
    expect(rAfter[0]).toBe(8500); // Solar clamped to max 8500 bps!
    expect(rAfter[1]).toBe(2500); // Frost drops to 2500 bps
    expect(rAfter[2]).toBe(2500); // Void drops to 2500 bps

    // Solar damage now heavily mitigated
    const dmgSolarAfter = computeBossDamage({
      basePower: 400,
      resistanceBps: rAfter[0],
      floor: 1,
    });
    // 400 * (10000 - 8500) / 10000 = 60 damage
    expect(dmgSolarAfter).toBe(60);

    // Meanwhile Frost damage is now amplified due to lowered Frost resistance
    const dmgFrostAfter = computeBossDamage({
      basePower: 400,
      resistanceBps: rAfter[1],
      floor: 1,
    });
    // 400 * (10000 - 2500) / 10000 = 300 damage!
    expect(dmgFrostAfter).toBe(300);
    expect(dmgFrostAfter).toBeGreaterThan(dmgSolarAfter);
  });
});

describe("Tier 3 - Interaction 3: TEE Proposal -> Meta Update -> Merchant Spread Adjustment", () => {
  it("Step 3.1: AI TEE applies buyback multiplier boost and shifts meta resistances", () => {
    const curResistance: [number, number, number] = [4500, 4500, 4500];
    const proposal = {
      epoch: 10,
      target_resistances: [6500, 3500, 3500] as [number, number, number],
      buyback_multiplier_bps: 15000, // 1.5x buyback boost
      nonce: 42,
    };

    // 1. Verify proposal acceptance
    const validation = validateAiProposal(curResistance, proposal, 41);
    expect(validation.valid).toBe(true);

    // 2. Before AI proposal: merchant sell price with standard 10000 bps multiplier
    const pStandard = computeMerchantPrice({
      stock: 100,
      buybackMultiplierBps: 10000,
      basePriceYocto: 100_000_000_000_000_000_000_000n, // 0.1 NEAR
    });
    expect(pStandard.sellPriceYocto).toBe(90_000_000_000_000_000_000_000n); // 0.09 NEAR

    // 3. After AI proposal: merchant sell price boosted by 1.5x (15000 bps)
    const pBoosted = computeMerchantPrice({
      stock: 100,
      buybackMultiplierBps: proposal.buyback_multiplier_bps,
      basePriceYocto: 100_000_000_000_000_000_000_000n,
    });
    // 0.09 * 1.5 = 0.135 NEAR
    expect(pBoosted.sellPriceYocto).toBe(135_000_000_000_000_000_000_000n);
    expect(pBoosted.sellPriceYocto).toBeGreaterThan(pStandard.sellPriceYocto);
  });
});

describe("Tier 3 - Interaction 4: Multi-User Concurrent Raid -> Boss Defeat -> Jackpot Split", () => {
  it("Step 4.1: 3 players attack boss, Alice & Bob deal damage, Charlie lands killing blow", () => {
    let bossHp = 1000;
    const playerDamage = new Map<string, number>([
      ["alice.testnet", 0],
      ["bob.testnet", 0],
      ["charlie.testnet", 0],
    ]);

    // Alice attacks 3 times (deals 300 x 2 = 600 damage)
    bossHp -= 600;
    playerDamage.set("alice.testnet", 600);

    // Bob attacks (deals 300 damage)
    bossHp -= 300;
    playerDamage.set("bob.testnet", 300);

    // Charlie lands killing blow for remaining 100 HP
    bossHp -= 100;
    playerDamage.set("charlie.testnet", 100);

    expect(bossHp).toBe(0);

    // Settle jackpot: total jackpot = 10 NEAR (9 NEAR proportional, 1 NEAR last bonus)
    const totalJackpot = ONE_NEAR_YOCTO * 10n;
    const settlement = computeJackpotPayouts(totalJackpot, 1000, playerDamage, "charlie.testnet");

    // Alice (60% of 9 NEAR = 5.4 NEAR)
    const aliceExpected = (ONE_NEAR_YOCTO * 54n) / 10n;
    expect(settlement.payouts.get("alice.testnet")).toBe(aliceExpected);

    // Bob (30% of 9 NEAR = 2.7 NEAR)
    const bobExpected = (ONE_NEAR_YOCTO * 27n) / 10n;
    expect(settlement.payouts.get("bob.testnet")).toBe(bobExpected);

    // Charlie (10% of 9 NEAR = 0.9 NEAR + 1.0 NEAR killer bonus = 1.9 NEAR)
    const charlieExpected = (ONE_NEAR_YOCTO * 19n) / 10n;
    expect(settlement.payouts.get("charlie.testnet")).toBe(charlieExpected);

    // Total conservation: 5.4 + 2.7 + 1.9 = 10.0 NEAR
    expect(settlement.totalDistributed).toBe(totalJackpot);
  });
});

describe("Tier 3 - Interaction 5: Floor 2 Frost Ward Elemental Differentiation", () => {
  it("Step 5.1: Frost weapon suffers 50% penalty while Solar weapon gains +25% bonus", () => {
    const resistanceBps = 2000; // 20% resistance

    const frostDmg = computeBossDamage({
      basePower: 400,
      resistanceBps,
      floor: 2,
      weaponElement: 1, // Frost
    });

    const solarDmg = computeBossDamage({
      basePower: 400,
      resistanceBps,
      floor: 2,
      weaponElement: 0, // Solar
    });

    const voidDmg = computeBossDamage({
      basePower: 400,
      resistanceBps,
      floor: 2,
      weaponElement: 2, // Void (standard)
    });

    // Base mitigated = 400 * 0.8 = 320
    // Frost: floor(320 * 0.5) = 160
    // Solar: floor(320 * 1.25) = 400
    // Void: 320
    expect(frostDmg).toBe(160);
    expect(voidDmg).toBe(320);
    expect(solarDmg).toBe(400);

    expect(solarDmg).toBe(frostDmg * 2.5);
  });
});

describe("Tier 3 - Interaction 6: Floor 3 Lazy Enrage Evaluation over Multiple Turns", () => {
  it("Step 6.1: Enrage heals boss after idle interval, capped at max HP", () => {
    let bossHp = 4000; // Damaged from 5000 max HP

    // 1. After 4 minutes (240s): 0 heals
    let res = computeFloor3EnrageHeal(240, bossHp, 5000);
    expect(res.healedHp).toBe(0);
    expect(res.finalHp).toBe(4000);

    // 2. After 5 minutes (300s): 1 heal (+500 HP) -> 4500 HP
    res = computeFloor3EnrageHeal(300, bossHp, 5000);
    expect(res.healedHp).toBe(500);
    expect(res.finalHp).toBe(4500);

    // 3. After 15 minutes (900s): 3 heals (+1500 HP potential, capped at +1000 HP) -> 5000 HP
    res = computeFloor3EnrageHeal(900, bossHp, 5000);
    expect(res.healedHp).toBe(1000);
    expect(res.finalHp).toBe(5000);
  });
});

describe("Tier 3 - Interaction 7: Reforge Burn -> Realm Supply Shift -> Boss Tribute Trigger", () => {
  it("Step 7.1: Burning Frost weapons into Solar weapons elevates Solar resistance >= 7000 bps and triggers Boss Tribute", () => {
    const inv = new SimulatedInventory();
    // Start with balanced supply
    inv.weaponSupply = [40, 40, 20];
    inv.setBalance("alice.testnet", TOKEN_IDS.WEAPON_FROST, 10);
    inv.setBalance("alice.testnet", TOKEN_IDS.WEAPON_SOLAR, 2);

    // Initial Solar resistance
    const rInitial = computeAdaptiveResistance(inv.weaponSupply);
    expect(rInitial[0]).toBeLessThan(7000);

    // Initially safe to attack with Solar Blade
    let tribute = evaluateBossTribute({
      resistanceBps: rInitial[0],
      isStarterLocked: false,
      totalWeaponsOwned: inv.getTotalWeapons("alice.testnet"),
    });
    expect(tribute.confiscated).toBe(false);

    // Alice reforges Frost weapons into Solar weapons repeatedly
    // 5 reforges burn 10 Frost weapons and mint 5 Solar weapons
    for (let i = 0; i < 5; i++) {
      inv.reforge("alice.testnet", "frost", "solar");
    }

    // New supply: Solar = 45, Frost = 30, Void = 20 -> Solar rises further
    // Simulate more players crafting Solar:
    inv.weaponSupply[0] += 40; // Now Solar = 85
    const rNew = computeAdaptiveResistance(inv.weaponSupply);
    expect(rNew[0]).toBe(8500); // Exceeds 7000 bps threshold!

    // Now attacking with Solar Blade triggers Boss Tribute confiscation!
    tribute = evaluateBossTribute({
      resistanceBps: rNew[0],
      isStarterLocked: false,
      totalWeaponsOwned: inv.getTotalWeapons("alice.testnet"), // Alice has 7 weapons
    });
    expect(tribute.confiscated).toBe(true);

    // If Alice is down to her last weapon, immunity protects her:
    tribute = evaluateBossTribute({
      resistanceBps: rNew[0],
      isStarterLocked: false,
      totalWeaponsOwned: 1, // Last weapon
    });
    expect(tribute.confiscated).toBe(false);
  });
});

export async function runTier3(): Promise<boolean> {
  return registry.run("Tier 3: Cross-Feature Interactions Test Suite");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTier3().then((passed) => {
    process.exit(passed ? 0 : 1);
  });
}
