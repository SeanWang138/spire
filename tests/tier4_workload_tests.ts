/**
 * Tier 4: Real-World Scenarios & Tower Campaign Workload
 * Simulates a full, realistic 3-floor tower assault campaign:
 * 1. Multi-user signless onboarding & crafting
 * 2. Floor 1 (The Crypt, 1,000 HP): Multi-turn assault & defeat
 * 3. Floor 2 (The Frost Vault, 2,500 HP): Tactical adaptation to Frost Ward within 30m deadline
 * 4. Floor 3 (The Void Apex, 5,000 HP): High-intensity assault overcoming Enrage regen within 20m deadline
 * 5. Dynamic live SVG trophy generation & metadata validation
 * 6. Proportional jackpot payout settlement & strict yocto conservation check
 */

import { createSuiteRegistry, expect } from "./test_harness.ts";
const registry = createSuiteRegistry();
const describe = registry.describe;
const it = registry.it;
import {
  computeAdaptiveResistance,
  computeBossDamage,
  computeJackpotPayouts,
  computeFloor3EnrageHeal,
  generateSvgTrophy,
  SimulatedLedger,
  SimulatedInventory,
  TOKEN_IDS,
  ONE_NEAR_YOCTO,
  TICKET_PRICE_YOCTO,
} from "./protocol_models.ts";

describe("Tier 4: Full 3-Floor Tower Assault Simulation Campaign", () => {
  // Campaign State
  let ledger = new SimulatedLedger();
  let inv = new SimulatedInventory();
  let jackpotPool = 0n;
  let reservePool = 0n;
  const campaignDamage = new Map<string, number>([
    ["alice.testnet", 0],
    ["bob.testnet", 0],
    ["charlie.testnet", 0],
  ]);

  it("Stage 1: Multi-User Onboarding, Ledger Deposits & Crafting Forge", () => {
    // Reset state for clean run
    ledger = new SimulatedLedger();
    inv = new SimulatedInventory();
    jackpotPool = 0n;
    reservePool = 0n;
    campaignDamage.set("alice.testnet", 0);
    campaignDamage.set("bob.testnet", 0);
    campaignDamage.set("charlie.testnet", 0);

    // 3 Raiders join: Alice, Bob, Charlie
    const players = ["alice.testnet", "bob.testnet", "charlie.testnet"];

    for (const player of players) {
      // 1. One-time payable deposit of 5 NEAR each into internal ledger
      ledger.deposit(player, ONE_NEAR_YOCTO * 5n);
      expect(ledger.getBalance(player)).toBe(ONE_NEAR_YOCTO * 5n);

      // 2. Starter material allocation: 10 iron ore + 5 essences each
      inv.setBalance(player, TOKEN_IDS.ORE_IRON, 10);
      inv.setBalance(player, TOKEN_IDS.ESSENCE_SOLAR, 5);
      inv.setBalance(player, TOKEN_IDS.ESSENCE_FROST, 5);
      inv.setBalance(player, TOKEN_IDS.ESSENCE_VOID, 5);
    }

    // Alice specializes in Solar Blades (crafts 3)
    inv.craft("alice.testnet", "solar");
    inv.craft("alice.testnet", "solar");
    inv.craft("alice.testnet", "solar");
    expect(inv.getBalance("alice.testnet", TOKEN_IDS.WEAPON_SOLAR)).toBe(3);

    // Bob specializes in Frost Spears (crafts 3)
    inv.craft("bob.testnet", "frost");
    inv.craft("bob.testnet", "frost");
    inv.craft("bob.testnet", "frost");
    expect(inv.getBalance("bob.testnet", TOKEN_IDS.WEAPON_FROST)).toBe(3);

    // Charlie specializes in Void Scythes (crafts 3)
    inv.craft("charlie.testnet", "void");
    inv.craft("charlie.testnet", "void");
    inv.craft("charlie.testnet", "void");
    expect(inv.getBalance("charlie.testnet", TOKEN_IDS.WEAPON_VOID)).toBe(3);

    // Initial realm weapon supply is perfectly balanced [3, 3, 3]
    expect(inv.weaponSupply).toEqual([3, 3, 3]);
    const rInitial = computeAdaptiveResistance(inv.weaponSupply);
    expect(rInitial).toEqual([4500, 4500, 4500]);
  });

  it("Stage 2: Floor 1 (The Crypt, 1,000 HP) Assault & Victory", () => {
    let floor1Hp = 1000;
    const currentResistances = computeAdaptiveResistance(inv.weaponSupply);

    // Function to execute a raid turn
    function executeTurn(player: string, weaponElement: number, stance: number = 0) {
      // Debit 0.1 NEAR ticket: 90% (0.09 NEAR) to jackpot, 10% (0.01 NEAR) to protocol reserve
      ledger.debit(player, TICKET_PRICE_YOCTO);
      jackpotPool += (TICKET_PRICE_YOCTO * 90n) / 100n;
      reservePool += (TICKET_PRICE_YOCTO * 10n) / 100n;

      const dmg = computeBossDamage({
        basePower: 400,
        resistanceBps: currentResistances[weaponElement],
        floor: 1,
        weaponElement,
        stance,
        bossHp: floor1Hp,
      });

      floor1Hp -= dmg;
      const cur = campaignDamage.get(player) ?? 0;
      campaignDamage.set(player, cur + dmg);
      return dmg;
    }

    // Turn 1: Alice attacks with Solar Blade (Balanced) -> 400 * (1 - 0.45) = 220 dmg
    const d1 = executeTurn("alice.testnet", 0, 0);
    expect(d1).toBe(220);
    expect(floor1Hp).toBe(780);

    // Turn 2: Bob attacks with Frost Spear (Aggressive: +25%) -> floor(220 * 1.25) = 275 dmg
    const d2 = executeTurn("bob.testnet", 1, 1);
    expect(d2).toBe(275);
    expect(floor1Hp).toBe(505);

    // Turn 3: Charlie attacks with Void Scythe (Aggressive: +25%) -> 275 dmg
    const d3 = executeTurn("charlie.testnet", 2, 1);
    expect(d3).toBe(275);
    expect(floor1Hp).toBe(230);

    // Turn 4: Alice strikes with Aggressive stance (floor(220 * 1.25) = 275, capped at remaining 230 HP)
    const d4 = executeTurn("alice.testnet", 0, 1);
    expect(d4).toBe(230);
    expect(floor1Hp).toBe(0);

    // Floor 1 cleared! Progression to Floor 2
    expect(floor1Hp).toBe(0);
  });

  it("Stage 3: Floor 2 (The Frost Vault, 2,500 HP) Frost Ward & Timed Assault", () => {
    let floor2Hp = 2500;
    const startTimeSec = 1000;
    let currentTimeSec = startTimeSec;
    const deadlineSec = 1800; // 30 minutes

    // More weapons crafted across realm: Solar popularity rises [15, 5, 5]
    inv.weaponSupply = [15, 5, 5];
    const floor2Resistances = computeAdaptiveResistance(inv.weaponSupply);
    // Solar raw = 15/25 * 13500 = 8100 bps
    expect(floor2Resistances[0]).toBeGreaterThan(7000);

    function executeFloor2Turn(player: string, weaponElement: number, stance: number = 0) {
      expect(currentTimeSec - startTimeSec).toBeLessThan(deadlineSec);

      ledger.debit(player, TICKET_PRICE_YOCTO);
      jackpotPool += (TICKET_PRICE_YOCTO * 90n) / 100n;
      reservePool += (TICKET_PRICE_YOCTO * 10n) / 100n;

      const dmg = computeBossDamage({
        basePower: 400,
        resistanceBps: floor2Resistances[weaponElement],
        floor: 2,
        weaponElement,
        stance,
        bossHp: floor2Hp,
      });

      floor2Hp -= dmg;
      const cur = campaignDamage.get(player) ?? 0;
      campaignDamage.set(player, cur + dmg);
      currentTimeSec += 60; // 1 minute per round
      return dmg;
    }

    // Bob tests Frost Spear: suffers 50% mitigation from Frost Ward!
    const frostDmg = executeFloor2Turn("bob.testnet", 1, 0);
    // Frost resistance is low (~2700 bps), but Frost Ward cuts damage in half!
    expect(frostDmg).toBeLessThan(200);

    // Alice attacks with Solar Blade: gains +25% bonus against Frost Ward
    const solarDmg = executeFloor2Turn("alice.testnet", 0, 0);
    expect(solarDmg).toBeGreaterThan(0);

    // Charlie uses Void Scythe (unaffected by ward) in Aggressive stance to push damage
    while (floor2Hp > 0) {
      executeFloor2Turn("charlie.testnet", 2, 1);
    }

    expect(floor2Hp).toBe(0);
    expect(currentTimeSec - startTimeSec).toBeLessThan(deadlineSec);
  });

  it("Stage 4: Floor 3 (The Void Apex, 5,000 HP) Enrage Regen Race & Final Defeat", () => {
    let floor3Hp = 5000;
    const startTimeSec = 5000;
    let currentTimeSec = startTimeSec;
    const deadlineSec = 1200; // 20 minutes limit
    let lastHealTimeSec = startTimeSec;

    const floor3Resistances = computeAdaptiveResistance(inv.weaponSupply);

    function executeFloor3Turn(player: string, weaponElement: number, stance: number = 1) {
      // 1. Evaluate Enrage lazy heal before strike
      const elapsedSinceHeal = currentTimeSec - lastHealTimeSec;
      if (elapsedSinceHeal >= 300) {
        const heal = computeFloor3EnrageHeal(elapsedSinceHeal, floor3Hp, 5000);
        floor3Hp = heal.finalHp;
        lastHealTimeSec += heal.ticksApplied * 300;
      }

      ledger.debit(player, TICKET_PRICE_YOCTO);
      jackpotPool += (TICKET_PRICE_YOCTO * 90n) / 100n;
      reservePool += (TICKET_PRICE_YOCTO * 10n) / 100n;

      const dmg = computeBossDamage({
        basePower: 400,
        resistanceBps: floor3Resistances[weaponElement],
        floor: 3,
        weaponElement,
        stance,
        bossHp: floor3Hp,
      });

      floor3Hp -= dmg;
      const cur = campaignDamage.get(player) ?? 0;
      campaignDamage.set(player, cur + dmg);
      currentTimeSec += 45; // 45 seconds per coordinated attack
      return dmg;
    }

    // Coordinated high-speed assault to beat enrage regen & 20m timeout
    let turns = 0;
    let killer = "";
    while (floor3Hp > 0) {
      turns++;
      const player = turns % 3 === 0 ? "alice.testnet" : turns % 3 === 1 ? "bob.testnet" : "charlie.testnet";
      const weapon = turns % 3 === 0 ? 0 : turns % 3 === 1 ? 1 : 2;
      executeFloor3Turn(player, weapon, 1);
      if (floor3Hp === 0) {
        killer = player;
      }
    }

    expect(floor3Hp).toBe(0);
    expect(currentTimeSec - startTimeSec).toBeLessThan(deadlineSec);
    expect(killer).toBeTruthy();
  });

  it("Stage 5: Dynamic On-Chain SVG Trophy Generation (NEP-171/177)", () => {
    const killer = "bob.testnet";
    const totalDmg =
      (campaignDamage.get("alice.testnet") ?? 0) +
      (campaignDamage.get("bob.testnet") ?? 0) +
      (campaignDamage.get("charlie.testnet") ?? 0);

    const jackpotFormatted = (Number(jackpotPool) / 1e24).toFixed(2);

    const trophy = generateSvgTrophy({
      round: 1,
      floor: 3,
      killerAccountId: killer,
      totalDamage: totalDmg,
      jackpotNearFormatted: jackpotFormatted,
      dominantElement: "solar",
    });

    expect(trophy.tokenId).toBe("spire-trophy-r1-f3");
    expect(trophy.svgContent).toContain("THE SPIRE CONQUEROR");
    expect(trophy.svgContent).toContain("FLOOR 3 APEX DEFEATED");
    expect(trophy.svgContent).toContain(killer);
    expect(trophy.svgContent).toContain(`${totalDmg}`);
    expect(trophy.svgContent).toContain(`${jackpotFormatted} NEAR`);
    expect(trophy.svgContent.includes("<svg") && trophy.svgContent.includes("</svg>")).toBe(true);
  });

  it("Stage 6: Proportional Jackpot Payout Settlement & Strict Conservation", () => {
    const killer = "bob.testnet";
    const totalDmg =
      (campaignDamage.get("alice.testnet") ?? 0) +
      (campaignDamage.get("bob.testnet") ?? 0) +
      (campaignDamage.get("charlie.testnet") ?? 0);

    expect(totalDmg).toBeGreaterThan(0);
    expect(jackpotPool).toBeGreaterThan(0n);

    // Compute payout settlement
    const settlement = computeJackpotPayouts(jackpotPool, totalDmg, campaignDamage, killer);

    // Verify 10% bonus for killer
    expect(settlement.lastBonus).toBe(jackpotPool / 10n);
    expect(settlement.proportionalPool).toBe(jackpotPool - settlement.lastBonus);

    // Each player claims their payout into internal ledger
    for (const [player, payout] of settlement.payouts.entries()) {
      expect(payout).toBeGreaterThan(0n);
      ledger.credit(player, payout);
    }

    // Conservation Invariant: Total distributed + residual equals exact jackpot pool
    expect(settlement.totalDistributed + settlement.residualReserve).toBe(jackpotPool);
    expect(settlement.totalDistributed).toBeLessThanOrEqual(jackpotPool);

    // Verify players can withdraw their remaining balances back to NEAR wallet
    for (const player of ["alice.testnet", "bob.testnet", "charlie.testnet"]) {
      const balance = ledger.getBalance(player);
      expect(balance).toBeGreaterThan(0n);
      const withdrawn = ledger.withdraw(player, balance);
      expect(withdrawn).toBe(balance);
      expect(ledger.getBalance(player)).toBe(0n);
    }
  });
});

export async function runTier4(): Promise<boolean> {
  return registry.run("Tier 4: Real-World Workload Simulation Test Suite");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTier4().then((passed) => {
    process.exit(passed ? 0 : 1);
  });
}
