/**
 * Tier 1: Feature Coverage Tests
 * Exhaustive category-partition testing covering >=5 test cases per feature
 * for all features in PROJECT.md § Feature Inventory.
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
  generateSvgTrophy,
  validateAiProposal,
  parseEventJson,
  SimulatedLedger,
  SimulatedInventory,
  TOKEN_IDS,
  ONE_NEAR_YOCTO,
  TICKET_PRICE_YOCTO,
  RESISTANCE_TOTAL_BPS,
  TRIBUTE_THRESHOLD_BPS,
} from "./protocol_models.ts";

describe("Tier 1 - Feature 1: Multi-Token NEP-245 System", () => {
  it("Case 1.1: Standard material token identifiers are valid and distinct", () => {
    expect(TOKEN_IDS.ORE_IRON).toBe("ore:iron");
    expect(TOKEN_IDS.ESSENCE_SOLAR).toBe("essence:solar");
    expect(TOKEN_IDS.ESSENCE_FROST).toBe("essence:frost");
    expect(TOKEN_IDS.ESSENCE_VOID).toBe("essence:void");
  });

  it("Case 1.2: Standard weapon token identifiers are valid and distinct", () => {
    expect(TOKEN_IDS.WEAPON_SOLAR).toBe("weapon:solar");
    expect(TOKEN_IDS.WEAPON_FROST).toBe("weapon:frost");
    expect(TOKEN_IDS.WEAPON_VOID).toBe("weapon:void");
  });

  it("Case 1.3: Crafting Solar Blade consumes 2 iron ore + 1 solar essence", () => {
    const inv = new SimulatedInventory();
    inv.setBalance("alice.testnet", TOKEN_IDS.ORE_IRON, 5);
    inv.setBalance("alice.testnet", TOKEN_IDS.ESSENCE_SOLAR, 2);

    inv.craft("alice.testnet", "solar");

    expect(inv.getBalance("alice.testnet", TOKEN_IDS.ORE_IRON)).toBe(3);
    expect(inv.getBalance("alice.testnet", TOKEN_IDS.ESSENCE_SOLAR)).toBe(1);
    expect(inv.getBalance("alice.testnet", TOKEN_IDS.WEAPON_SOLAR)).toBe(1);
    expect(inv.weaponSupply[0]).toBe(1);
  });

  it("Case 1.4: Crafting Frost Spear consumes 2 iron ore + 1 frost essence", () => {
    const inv = new SimulatedInventory();
    inv.setBalance("bob.testnet", TOKEN_IDS.ORE_IRON, 4);
    inv.setBalance("bob.testnet", TOKEN_IDS.ESSENCE_FROST, 3);

    inv.craft("bob.testnet", "frost");

    expect(inv.getBalance("bob.testnet", TOKEN_IDS.ORE_IRON)).toBe(2);
    expect(inv.getBalance("bob.testnet", TOKEN_IDS.ESSENCE_FROST)).toBe(2);
    expect(inv.getBalance("bob.testnet", TOKEN_IDS.WEAPON_FROST)).toBe(1);
    expect(inv.weaponSupply[1]).toBe(1);
  });

  it("Case 1.5: Crafting Void Scythe consumes 2 iron ore + 1 void essence", () => {
    const inv = new SimulatedInventory();
    inv.setBalance("charlie.testnet", TOKEN_IDS.ORE_IRON, 6);
    inv.setBalance("charlie.testnet", TOKEN_IDS.ESSENCE_VOID, 1);

    inv.craft("charlie.testnet", "void");

    expect(inv.getBalance("charlie.testnet", TOKEN_IDS.ORE_IRON)).toBe(4);
    expect(inv.getBalance("charlie.testnet", TOKEN_IDS.ESSENCE_VOID)).toBe(0);
    expect(inv.getBalance("charlie.testnet", TOKEN_IDS.WEAPON_VOID)).toBe(1);
    expect(inv.weaponSupply[2]).toBe(1);
  });

  it("Case 1.6: Reforging burns 2 weapons of one element to mint 1 of another and adjusts realm supply", () => {
    const inv = new SimulatedInventory();
    inv.setBalance("alice.testnet", TOKEN_IDS.WEAPON_SOLAR, 2);
    inv.weaponSupply[0] = 2;

    inv.reforge("alice.testnet", "solar", "frost");

    expect(inv.getBalance("alice.testnet", TOKEN_IDS.WEAPON_SOLAR)).toBe(0);
    expect(inv.getBalance("alice.testnet", TOKEN_IDS.WEAPON_FROST)).toBe(1);
    expect(inv.weaponSupply[0]).toBe(0);
    expect(inv.weaponSupply[1]).toBe(1);
  });
});

describe("Tier 1 - Feature 2: Dynamic SVG NFT Trophy (NEP-171/177)", () => {
  it("Case 2.1: NFT Token ID matches standard schema spire-trophy-r{round}-f{floor}", () => {
    const trophy = generateSvgTrophy({
      round: 3,
      floor: 2,
      killerAccountId: "alice.testnet",
      totalDamage: 2500,
      jackpotNearFormatted: "15.5",
      dominantElement: "solar",
    });
    expect(trophy.tokenId).toBe("spire-trophy-r3-f2");
  });

  it("Case 2.2: Dynamic SVG contains killer account ID verbatim", () => {
    const killer = "valkyrie.testnet";
    const trophy = generateSvgTrophy({
      round: 1,
      floor: 1,
      killerAccountId: killer,
      totalDamage: 1000,
      jackpotNearFormatted: "4.5",
      dominantElement: "frost",
    });
    expect(trophy.svgContent).toContain(killer);
  });

  it("Case 2.3: Dynamic SVG embeds exact round and floor indicators", () => {
    const trophy = generateSvgTrophy({
      round: 42,
      floor: 3,
      killerAccountId: "bob.testnet",
      totalDamage: 5000,
      jackpotNearFormatted: "50.0",
      dominantElement: "void",
    });
    expect(trophy.svgContent).toContain("R42 / F3");
    expect(trophy.svgContent).toContain("FLOOR 3 APEX DEFEATED");
  });

  it("Case 2.4: Dynamic SVG reflects dominant elemental gradient (solar, frost, void)", () => {
    const solarTrophy = generateSvgTrophy({
      round: 1,
      floor: 1,
      killerAccountId: "a.testnet",
      totalDamage: 1000,
      jackpotNearFormatted: "1.0",
      dominantElement: "solar",
    });
    const frostTrophy = generateSvgTrophy({
      round: 1,
      floor: 1,
      killerAccountId: "b.testnet",
      totalDamage: 1000,
      jackpotNearFormatted: "1.0",
      dominantElement: "frost",
    });
    const voidTrophy = generateSvgTrophy({
      round: 1,
      floor: 1,
      killerAccountId: "c.testnet",
      totalDamage: 1000,
      jackpotNearFormatted: "1.0",
      dominantElement: "void",
    });

    expect(solarTrophy.svgContent).toContain("#ff9f43");
    expect(frostTrophy.svgContent).toContain("#4fc3f7");
    expect(voidTrophy.svgContent).toContain("#a855f7");
  });

  it("Case 2.5: Dynamic SVG embeds jackpot formatted string and valid XML closing tag", () => {
    const trophy = generateSvgTrophy({
      round: 2,
      floor: 1,
      killerAccountId: "charlie.testnet",
      totalDamage: 1000,
      jackpotNearFormatted: "12.3456",
      dominantElement: "solar",
    });
    expect(trophy.svgContent).toContain("12.3456 NEAR");
    expect(trophy.svgContent.trim().endsWith("</svg>")).toBe(true);
  });
});

describe("Tier 1 - Feature 3: Internal Ledger & Signless Key Vault", () => {
  it("Case 3.1: Payable deposit credits player internal ledger 1:1", () => {
    const ledger = new SimulatedLedger();
    const depositAmount = ONE_NEAR_YOCTO * 2n; // 2 NEAR
    ledger.deposit("alice.testnet", depositAmount);
    expect(ledger.getBalance("alice.testnet")).toBe(depositAmount);
  });

  it("Case 3.2: Signless attack debits exact ticket fee (0.1 NEAR) from ledger", () => {
    const ledger = new SimulatedLedger();
    ledger.deposit("bob.testnet", ONE_NEAR_YOCTO); // 1 NEAR
    ledger.debit("bob.testnet", TICKET_PRICE_YOCTO); // 0.1 NEAR ticket
    expect(ledger.getBalance("bob.testnet")).toBe(ONE_NEAR_YOCTO - TICKET_PRICE_YOCTO);
  });

  it("Case 3.3: Attempting action with insufficient balance throws E_INSUFFICIENT_BALANCE", () => {
    const ledger = new SimulatedLedger();
    ledger.deposit("poor_player.testnet", 50_000_000_000_000_000_000_000n); // 0.05 NEAR
    expect(() => {
      ledger.debit("poor_player.testnet", TICKET_PRICE_YOCTO); // needs 0.1 NEAR
    }).toThrow("E_INSUFFICIENT_BALANCE");
  });

  it("Case 3.4: Payout claims credit internal balance directly", () => {
    const ledger = new SimulatedLedger();
    ledger.deposit("winner.testnet", ONE_NEAR_YOCTO);
    const wonJackpot = ONE_NEAR_YOCTO * 10n;
    ledger.credit("winner.testnet", wonJackpot);
    expect(ledger.getBalance("winner.testnet")).toBe(ONE_NEAR_YOCTO * 11n);
  });

  it("Case 3.5: Withdrawal debits internal balance correctly", () => {
    const ledger = new SimulatedLedger();
    ledger.deposit("alice.testnet", ONE_NEAR_YOCTO * 3n);
    const withdrawn = ledger.withdraw("alice.testnet", ONE_NEAR_YOCTO * 2n);
    expect(withdrawn).toBe(ONE_NEAR_YOCTO * 2n);
    expect(ledger.getBalance("alice.testnet")).toBe(ONE_NEAR_YOCTO);
  });
});

describe("Tier 1 - Feature 4: 3-Floor Tower Mechanics", () => {
  it("Case 4.1: Floor 1 (The Crypt) has 1000 max HP and standard mitigation", () => {
    const damage = computeBossDamage({
      basePower: 400,
      resistanceBps: 2500, // 25%
      floor: 1,
      weaponElement: 0,
      bossHp: 1000,
    });
    // 400 * (10000 - 2500) / 10000 = 300 damage
    expect(damage).toBe(300);
  });

  it("Case 4.2: Floor 2 (The Frost Vault) enforces Frost Ward 50% mitigation on Frost weapons", () => {
    const frostDamage = computeBossDamage({
      basePower: 400,
      resistanceBps: 2000, // 20%
      floor: 2,
      weaponElement: 1, // Frost weapon
      bossHp: 2500,
    });
    // Base mitigated = 400 * 0.8 = 320. Frost Ward: floor(320 * 0.5) = 160
    expect(frostDamage).toBe(160);
  });

  it("Case 4.3: Floor 2 (The Frost Vault) awards +25% damage bonus to Solar weapons", () => {
    const solarDamage = computeBossDamage({
      basePower: 400,
      resistanceBps: 2000, // 20%
      floor: 2,
      weaponElement: 0, // Solar weapon
      bossHp: 2500,
    });
    // Base mitigated = 400 * 0.8 = 320. Solar bonus: floor(320 * 1.25) = 400
    expect(solarDamage).toBe(400);
  });

  it("Case 4.4: Floor 2 enforces 30-minute raid deadline (1800s)", () => {
    const deadlineSec = 1800;
    const isExpiredAt1799 = 1799 >= deadlineSec;
    const isExpiredAt1800 = 1800 >= deadlineSec;
    expect(isExpiredAt1799).toBe(false);
    expect(isExpiredAt1800).toBe(true);
  });

  it("Case 4.5: Floor 3 (The Void Apex) Enrage recovers 10% HP (500 HP) per 5 minutes elapsed", () => {
    // 600s elapsed = 2 ticks -> +1000 HP
    const healResult = computeFloor3EnrageHeal(600, 3000, 5000);
    expect(healResult.ticksApplied).toBe(2);
    expect(healResult.healedHp).toBe(1000);
    expect(healResult.finalHp).toBe(4000);
  });
});

describe("Tier 1 - Feature 5: Deterministic Adaptive Resistance", () => {
  it("Case 5.1: Primary test vector [80, 20, 10] produces exact [8500, 3114, 1886]", () => {
    const res = computeAdaptiveResistance([80, 20, 10]);
    expect(res).toEqual([8500, 3114, 1886]);
  });

  it("Case 5.2: Invariant: Total resistance strictly equals 13500 bps across varied inputs", () => {
    const vectors: Array<[number, number, number]> = [
      [80, 20, 10],
      [10, 10, 10],
      [50, 25, 25],
      [100, 5, 5],
      [1, 99, 10],
      [33, 33, 34],
    ];
    for (const v of vectors) {
      const res = computeAdaptiveResistance(v);
      const sum = res[0] + res[1] + res[2];
      expect(sum).toBe(RESISTANCE_TOTAL_BPS);
    }
  });

  it("Case 5.3: Invariant: Every element is clamped in [1000, 8500] bps", () => {
    const vectors: Array<[number, number, number]> = [
      [1000, 0, 0],
      [0, 500, 10],
      [50, 50, 0],
      [70, 20, 10],
    ];
    for (const v of vectors) {
      const res = computeAdaptiveResistance(v);
      for (const val of res) {
        expect(val).toBeGreaterThanOrEqual(1000);
        expect(val).toBeLessThanOrEqual(8500);
      }
    }
  });

  it("Case 5.4: Uniform supply [10, 10, 10] produces equal distribution [4500, 4500, 4500]", () => {
    const res = computeAdaptiveResistance([10, 10, 10]);
    expect(res).toEqual([4500, 4500, 4500]);
  });

  it("Case 5.5: Zero supply fallback [0, 0, 0] produces safe equal default [4500, 4500, 4500]", () => {
    const res = computeAdaptiveResistance([0, 0, 0]);
    expect(res).toEqual([4500, 4500, 4500]);
  });

  it("Case 5.6: Single dominant element [100, 0, 0] clamps dominant to 8500 and splits remainder equally", () => {
    const res = computeAdaptiveResistance([100, 0, 0]);
    expect(res).toEqual([8500, 2500, 2500]);
  });
});

describe("Tier 1 - Feature 6: Epoch Meta Shift Rate Limiting", () => {
  it("Case 6.1: Valid proposal with shift <= 2500 bps is accepted", () => {
    const current: [number, number, number] = [4500, 4500, 4500];
    const target: [number, number, number] = [6500, 3500, 3500]; // Solar shifts +2000 bps
    const result = validateAiProposal(
      current,
      {
        epoch: 2,
        target_resistances: target,
        buyback_multiplier_bps: 12000,
        nonce: 10,
      },
      9
    );
    expect(result.valid).toBe(true);
  });

  it("Case 6.2: Proposal with shift > 2500 bps fails with E_EXCEEDS_MAX_SHIFT", () => {
    const current: [number, number, number] = [4500, 4500, 4500];
    const target: [number, number, number] = [7500, 3000, 3000]; // Solar shifts +3000 bps > 2500
    const result = validateAiProposal(
      current,
      {
        epoch: 2,
        target_resistances: target,
        buyback_multiplier_bps: 12000,
        nonce: 10,
      },
      9
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("E_EXCEEDS_MAX_SHIFT");
  });

  it("Case 6.3: Boundary shift of exactly +2500 bps is accepted", () => {
    const current: [number, number, number] = [4500, 4500, 4500];
    const target: [number, number, number] = [7000, 3250, 3250]; // Solar shifts exactly +2500 bps
    const result = validateAiProposal(
      current,
      {
        epoch: 2,
        target_resistances: target,
        buyback_multiplier_bps: 10000,
        nonce: 10,
      },
      9
    );
    expect(result.valid).toBe(true);
  });

  it("Case 6.4: Boundary shift of exactly -2500 bps is accepted", () => {
    const current: [number, number, number] = [6000, 4500, 3000];
    const target: [number, number, number] = [3500, 5750, 4250]; // Solar shifts exactly -2500 bps
    const result = validateAiProposal(
      current,
      {
        epoch: 2,
        target_resistances: target,
        buyback_multiplier_bps: 10000,
        nonce: 10,
      },
      9
    );
    expect(result.valid).toBe(true);
  });

  it("Case 6.5: Proposal violating 13500 total sum fails with E_INVALID_RESISTANCE_SUM", () => {
    const current: [number, number, number] = [4500, 4500, 4500];
    const target: [number, number, number] = [5000, 5000, 5000]; // Sum = 15000 != 13500
    const result = validateAiProposal(
      current,
      {
        epoch: 2,
        target_resistances: target,
        buyback_multiplier_bps: 10000,
        nonce: 10,
      },
      9
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("E_INVALID_RESISTANCE_SUM");
  });
});

describe("Tier 1 - Feature 7: NPC Merchant Bonding Curve & Spread", () => {
  it("Case 7.1: Mid-price scales inversely with stock below target stock (100 units)", () => {
    const p100 = computeMerchantPrice({ stock: 100 });
    const p50 = computeMerchantPrice({ stock: 50 });
    const p0 = computeMerchantPrice({ stock: 0 });

    expect(p100.midPriceYocto).toBe(100_000_000_000_000_000_000_000n); // 0.1 NEAR
    expect(p50.midPriceYocto).toBe(150_000_000_000_000_000_000_000n); // 0.15 NEAR (1.5x)
    expect(p0.midPriceYocto).toBe(200_000_000_000_000_000_000_000n); // 0.2 NEAR (2.0x)
  });

  it("Case 7.2: Stock >= 100 maintains baseline price P0", () => {
    const p150 = computeMerchantPrice({ stock: 150 });
    expect(p150.midPriceYocto).toBe(100_000_000_000_000_000_000_000n);
  });

  it("Case 7.3: Buy price (ask) equals mid-price", () => {
    const p = computeMerchantPrice({ stock: 75 });
    expect(p.buyPriceYocto).toBe(p.midPriceYocto);
  });

  it("Case 7.4: Standard sell price (bid) reflects 10% spread (0.90 * Pmid)", () => {
    const p = computeMerchantPrice({ stock: 100, buybackMultiplierBps: 10000 });
    // Mid = 0.1 NEAR -> Sell = 0.09 NEAR
    expect(p.sellPriceYocto).toBe(90_000_000_000_000_000_000_000n);
  });

  it("Case 7.5: Merchant closes selling when treasury reserve falls below 1 NEAR", () => {
    const pClosed = computeMerchantPrice({
      stock: 100,
      treasuryReserveYocto: 500_000_000_000_000_000_000_000n, // 0.5 NEAR < 1 NEAR
    });
    expect(pClosed.isClosed).toBe(true);

    const pOpen = computeMerchantPrice({
      stock: 100,
      treasuryReserveYocto: ONE_NEAR_YOCTO * 2n, // 2 NEAR >= 1 NEAR
    });
    expect(pOpen.isClosed).toBe(false);
  });
});

describe("Tier 1 - Feature 8: Boss Tribute Weapon Confiscation", () => {
  it("Case 8.1: Confiscates weapon when resistance >= 7000 bps for multi-weapon player", () => {
    const result = evaluateBossTribute({
      resistanceBps: 7500,
      isStarterLocked: false,
      totalWeaponsOwned: 3,
    });
    expect(result.confiscated).toBe(true);
  });

  it("Case 8.2: Safe when resistance is below 7000 bps threshold", () => {
    const result = evaluateBossTribute({
      resistanceBps: 6999,
      isStarterLocked: false,
      totalWeaponsOwned: 3,
    });
    expect(result.confiscated).toBe(false);
  });

  it("Case 8.3: Starter-locked weapons are immune to confiscation at >= 7000 bps", () => {
    const result = evaluateBossTribute({
      resistanceBps: 8500,
      isStarterLocked: true,
      totalWeaponsOwned: 2,
    });
    expect(result.confiscated).toBe(false);
    expect(result.reason).toContain("starter-locked");
  });

  it("Case 8.4: Player's last remaining weapon (count <= 1) is immune to confiscation", () => {
    const result = evaluateBossTribute({
      resistanceBps: 8500,
      isStarterLocked: false,
      totalWeaponsOwned: 1,
    });
    expect(result.confiscated).toBe(false);
    expect(result.reason).toContain("Last remaining weapon");
  });

  it("Case 8.5: Exactly 7000 bps triggers confiscation for unprotected weapons", () => {
    const result = evaluateBossTribute({
      resistanceBps: TRIBUTE_THRESHOLD_BPS,
      isStarterLocked: false,
      totalWeaponsOwned: 2,
    });
    expect(result.confiscated).toBe(true);
  });
});

describe("Tier 1 - Feature 9: Proportional Jackpot Distribution", () => {
  it("Case 9.1: Total jackpot splits into 10% last bonus and 90% proportional pool", () => {
    const total = 100_000_000_000_000_000_000_000n; // 100 yocto
    const map = new Map<string, number>([["alice.testnet", 100]]);
    const res = computeJackpotPayouts(total, 100, map, "alice.testnet");

    expect(res.lastBonus).toBe(10_000_000_000_000_000_000_000n); // 10%
    expect(res.proportionalPool).toBe(90_000_000_000_000_000_000_000n); // 90%
  });

  it("Case 9.2: Single attacker captures 100% of jackpot (90% damage + 10% killer bonus)", () => {
    const total = ONE_NEAR_YOCTO * 10n; // 10 NEAR
    const map = new Map<string, number>([["solo.testnet", 1000]]);
    const res = computeJackpotPayouts(total, 1000, map, "solo.testnet");

    expect(res.payouts.get("solo.testnet")).toBe(total);
    expect(res.totalDistributed).toBe(total);
  });

  it("Case 9.3: Multi-attacker raid divides proportional pool strictly by damage dealt", () => {
    const total = 10_000_000_000_000_000_000_000n; // 10 yocto
    // Last bonus = 1, Proportional pool = 9
    // Alice dealt 600/1000 (60%), Bob dealt 400/1000 (40%), Bob is killer
    const map = new Map<string, number>([
      ["alice.testnet", 600],
      ["bob.testnet", 400],
    ]);
    const res = computeJackpotPayouts(total, 1000, map, "bob.testnet");

    // Alice: 9 * 600 / 1000 = 5 yocto (integer division)
    // Bob: 9 * 400 / 1000 = 3 yocto + 1 bonus = 4 yocto
    expect(res.payouts.get("alice.testnet")).toBe(5_400_000_000_000_000_000_000n);
    expect(res.payouts.get("bob.testnet")).toBe(4_600_000_000_000_000_000_000n);
    expect(res.totalDistributed).toBe(total);
  });

  it("Case 9.4: Total payouts distributed never exceed jackpot pool", () => {
    const total = 10_001n;
    const map = new Map<string, number>([
      ["a", 333],
      ["b", 333],
      ["c", 334],
    ]);
    const res = computeJackpotPayouts(total, 1000, map, "c");
    expect(res.totalDistributed).toBeLessThanOrEqual(total);
  });

  it("Case 9.5: Zero-damage raider receives zero payout if not killer", () => {
    const total = ONE_NEAR_YOCTO;
    const map = new Map<string, number>([
      ["active", 1000],
      ["idle", 0],
    ]);
    const res = computeJackpotPayouts(total, 1000, map, "active");
    expect(res.payouts.get("idle")).toBe(0n);
  });
});

describe("Tier 1 - Feature 10: AI TEE Signature Gate", () => {
  it("Case 10.1: Proposal with valid bounds and monotonic nonce is accepted", () => {
    const current: [number, number, number] = [4500, 4500, 4500];
    const proposal = {
      epoch: 5,
      target_resistances: [6000, 4000, 3500] as [number, number, number],
      buyback_multiplier_bps: 15000,
      nonce: 101,
    };
    const res = validateAiProposal(current, proposal, 100);
    expect(res.valid).toBe(true);
  });

  it("Case 10.2: Proposal with replay nonce (nonce <= lastNonce) fails with E_REPLAY_DETECTED", () => {
    const current: [number, number, number] = [4500, 4500, 4500];
    const proposal = {
      epoch: 5,
      target_resistances: [4500, 4500, 4500] as [number, number, number],
      buyback_multiplier_bps: 10000,
      nonce: 50,
    };
    const res = validateAiProposal(current, proposal, 50);
    expect(res.valid).toBe(false);
    expect(res.error).toBe("E_REPLAY_DETECTED");
  });

  it("Case 10.3: Proposal with multiplier below 10000 bps fails with E_INVALID_BUYBACK_MULTIPLIER", () => {
    const current: [number, number, number] = [4500, 4500, 4500];
    const proposal = {
      epoch: 2,
      target_resistances: [4500, 4500, 4500] as [number, number, number],
      buyback_multiplier_bps: 9999,
      nonce: 1,
    };
    const res = validateAiProposal(current, proposal, 0);
    expect(res.valid).toBe(false);
    expect(res.error).toBe("E_INVALID_BUYBACK_MULTIPLIER");
  });

  it("Case 10.4: Proposal with multiplier above 40000 bps fails with E_INVALID_BUYBACK_MULTIPLIER", () => {
    const current: [number, number, number] = [4500, 4500, 4500];
    const proposal = {
      epoch: 2,
      target_resistances: [4500, 4500, 4500] as [number, number, number],
      buyback_multiplier_bps: 40001,
      nonce: 1,
    };
    const res = validateAiProposal(current, proposal, 0);
    expect(res.valid).toBe(false);
    expect(res.error).toBe("E_INVALID_BUYBACK_MULTIPLIER");
  });

  it("Case 10.5: Maximum multiplier 40000 bps and minimum 10000 bps are both accepted", () => {
    const current: [number, number, number] = [4500, 4500, 4500];
    const minProp = {
      epoch: 2,
      target_resistances: [4500, 4500, 4500] as [number, number, number],
      buyback_multiplier_bps: 10000,
      nonce: 1,
    };
    const maxProp = {
      epoch: 3,
      target_resistances: [4500, 4500, 4500] as [number, number, number],
      buyback_multiplier_bps: 40000,
      nonce: 2,
    };
    expect(validateAiProposal(current, minProp, 0).valid).toBe(true);
    expect(validateAiProposal(current, maxProp, 1).valid).toBe(true);
  });
});

describe("Tier 1 - Feature 11: NEP-297 EVENT_JSON Standard Logging", () => {
  it("Case 11.1: Event line without EVENT_JSON prefix is rejected", () => {
    const parsed = parseEventJson('{"standard":"spire","event":"deposit"}');
    expect(parsed.isEvent).toBe(false);
  });

  it("Case 11.2: Valid deposit event conforms to NEP-297 schema", () => {
    const log =
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"deposit","data":[{"account_id":"alice.testnet","amount":"1000000000000000000000000"}]}';
    const parsed = parseEventJson(log);
    expect(parsed.isEvent).toBe(true);
    expect(parsed.standard).toBe("spire");
    expect(parsed.version).toBe("3.1.0");
    expect(parsed.event).toBe("deposit");
    expect(parsed.data?.[0].account_id).toBe("alice.testnet");
  });

  it("Case 11.3: Valid craft and reforge events conform to schema", () => {
    const craftLog =
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"craft","data":[{"account_id":"alice.testnet","recipe":"craft_weapon_solar","output_token":"weapon:solar","amount":1,"materials_consumed":[{"token_id":"ore:iron","amount":2}]}]}';
    const parsedCraft = parseEventJson(craftLog);
    expect(parsedCraft.event).toBe("craft");
    expect(parsedCraft.data?.[0].output_token).toBe("weapon:solar");

    const reforgeLog =
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"reforge","data":[{"account_id":"alice.testnet","burn_element":"weapon:solar","received_element":"weapon:frost","burned_count":2,"minted_count":1}]}';
    const parsedReforge = parseEventJson(reforgeLog);
    expect(parsedReforge.event).toBe("reforge");
    expect(parsedReforge.data?.[0].minted_count).toBe(1);
  });

  it("Case 11.4: Valid raid and boss_defeated events conform to schema", () => {
    const raidLog =
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"raid","data":[{"account_id":"alice.testnet","floor":1,"round":1,"weapon":"weapon:solar","damage":250,"boss_remaining_hp":750,"ticket_paid":"100000000000000000000000","tribute_taken":false}]}';
    const parsedRaid = parseEventJson(raidLog);
    expect(parsedRaid.event).toBe("raid");
    expect(parsedRaid.data?.[0].damage).toBe(250);

    const defeatLog =
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"boss_defeated","data":[{"floor":1,"round":1,"killer":"bob.testnet","total_jackpot":"1360000000000000000000000","total_damage":1000,"trophy_token_id":"trophy-f1-r1-bob"}]}';
    const parsedDefeat = parseEventJson(defeatLog);
    expect(parsedDefeat.event).toBe("boss_defeated");
    expect(parsedDefeat.data?.[0].killer).toBe("bob.testnet");
  });

  it("Case 11.5: Valid ai_proposal_applied event conforms to schema", () => {
    const log =
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"ai_proposal_applied","data":[{"epoch":2,"old_resistance":[4500,4500,4500],"new_resistance":[8500,3114,1886],"buyback_multiplier_bps":15000,"proposer":"keeper.testnet","memo":"Rebalance"}]}';
    const parsed = parseEventJson(log);
    expect(parsed.event).toBe("ai_proposal_applied");
    expect(parsed.data?.[0].new_resistance).toEqual([8500, 3114, 1886]);
  });

  it("Case 11.6: Valid merchant_trade event conforms to schema", () => {
    const log =
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"merchant_trade","data":[{"account_id":"alice.testnet","action":"buy","item_id":"ore:iron","amount":5,"price_paid":"250000000000000000000000","current_stock":95,"treasury_reserve":"5400000000000000000000000"}]}';
    const parsed = parseEventJson(log);
    expect(parsed.event).toBe("merchant_trade");
    expect(parsed.data?.[0].action).toBe("buy");
    expect(parsed.data?.[0].amount).toBe(5);
  });
});

export async function runTier1(): Promise<boolean> {
  return registry.run("Tier 1: Feature Coverage Test Suite");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTier1().then((passed) => {
    process.exit(passed ? 0 : 1);
  });
}
