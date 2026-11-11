import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

console.log("=== EMPIRICAL CHALLENGER STRESS TEST HARNESS ===");

// 1. Setup minimal browser localStorage & window mock
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};
globalThis.window = globalThis;

// 2. Transpile TypeScript modules
const tmpPricingPath = new URL("./.test_pricing_emp.mjs", import.meta.url);
const tmpNearPath = new URL("./.test_near_emp.mjs", import.meta.url);

const pricingTs = fs.readFileSync(new URL("./src/lib/simulation/pricing.ts", import.meta.url), "utf8");
const pricingJs = ts.transpileModule(pricingTs, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
fs.writeFileSync(tmpPricingPath, pricingJs, "utf8");

let nearTs = fs.readFileSync(new URL("./src/lib/near.ts", import.meta.url), "utf8");
nearTs = nearTs.replace('from "./simulation/pricing"', 'from "./.test_pricing_emp.mjs"');
const nearJs = ts.transpileModule(nearTs, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
fs.writeFileSync(tmpNearPath, nearJs, "utf8");

const pricing = await import(tmpPricingPath.href);
const near = await import(tmpNearPath.href);

let totalPassed = 0;
let totalFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✔ PASS: ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(err);
    totalFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✔ PASS: ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(err);
    totalFailed++;
  }
}

// Reset singleton instance helper
function resetSessionManager() {
  near.SessionManager.instance = undefined;
}

console.log("\n--- SUITE 1: Starter Pack Single-Claim Validation & Isolation ---");

await runAsyncTest("Account A claims starter pack -> receives 10 iron, 15 essences, [4,1,1] weapons", async () => {
  mockStorage.clear();
  resetSessionManager();
  const mgr = near.SessionManager.getInstance();

  mgr.createSession("alice.testnet");
  const beforeClaim = await mgr.has_claimed_starter_pack("alice.testnet");
  assert.equal(beforeClaim, false, "alice.testnet should not have claimed before");

  // Initial state reference
  const stateBefore = mgr.getCachedState();
  const initIron = stateBefore.inventory.materials["ore:iron"];
  const initSolarEss = stateBefore.inventory.materials["essence:solar"];
  const initFrostEss = stateBefore.inventory.materials["essence:frost"];
  const initVoidEss = stateBefore.inventory.materials["essence:void"];
  const initSolarWpn = stateBefore.inventory.weapons["weapon:solar"];
  const initFrostWpn = stateBefore.inventory.weapons["weapon:frost"];
  const initVoidWpn = stateBefore.inventory.weapons["weapon:void"];

  const res = await mgr.claim_starter_pack();
  assert.equal(res.success, true, "Claim must succeed");

  const stateAfter = mgr.getCachedState();
  // Exact reward verification
  const gainedIron = stateAfter.inventory.materials["ore:iron"] - initIron;
  const gainedSolarEss = stateAfter.inventory.materials["essence:solar"] - initSolarEss;
  const gainedFrostEss = stateAfter.inventory.materials["essence:frost"] - initFrostEss;
  const gainedVoidEss = stateAfter.inventory.materials["essence:void"] - initVoidEss;
  const totalEssencesGained = gainedSolarEss + gainedFrostEss + gainedVoidEss;

  const gainedSolarWpn = stateAfter.inventory.weapons["weapon:solar"] - initSolarWpn;
  const gainedFrostWpn = stateAfter.inventory.weapons["weapon:frost"] - initFrostWpn;
  const gainedVoidWpn = stateAfter.inventory.weapons["weapon:void"] - initVoidWpn;

  assert.equal(gainedIron, 10, "Must grant exactly 10 iron ore");
  assert.equal(gainedSolarEss, 5, "Must grant 5 solar essence");
  assert.equal(gainedFrostEss, 5, "Must grant 5 frost essence");
  assert.equal(gainedVoidEss, 5, "Must grant 5 void essence");
  assert.equal(totalEssencesGained, 15, "Must grant exactly 15 total essences");
  assert.equal(gainedSolarWpn, 4, "Must grant 4 solar weapons");
  assert.equal(gainedFrostWpn, 1, "Must grant 1 frost weapon");
  assert.equal(gainedVoidWpn, 1, "Must grant 1 void weapon");
  assert.deepEqual([gainedSolarWpn, gainedFrostWpn, gainedVoidWpn], [4, 1, 1], "Weapons must match [4,1,1]");

  const afterClaim = await mgr.has_claimed_starter_pack("alice.testnet");
  assert.equal(afterClaim, true, "alice.testnet must now be marked claimed");
});

await runAsyncTest("Account A duplicate claim MUST be rejected with 'Starter pack already claimed'", async () => {
  const mgr = near.SessionManager.getInstance();
  const stateBefore = mgr.getCachedState();

  const dupRes = await mgr.claim_starter_pack();
  assert.equal(dupRes.success, false, "Duplicate claim MUST be false");
  assert.equal(dupRes.error, "Starter pack already claimed", "Error message must match exactly");

  // Verify inventory was NOT incremented on rejected claim
  const stateAfter = mgr.getCachedState();
  assert.equal(stateAfter.inventory.materials["ore:iron"], stateBefore.inventory.materials["ore:iron"]);
  assert.equal(stateAfter.inventory.weapons["weapon:solar"], stateBefore.inventory.weapons["weapon:solar"]);
});

await runAsyncTest("Account B (different account ID) MUST succeed in claiming independently", async () => {
  const mgr = near.SessionManager.getInstance();
  mgr.createSession("bob.testnet");

  const bobBefore = await mgr.has_claimed_starter_pack("bob.testnet");
  assert.equal(bobBefore, false, "bob.testnet must not have claimed yet");

  const bobClaim = await mgr.claim_starter_pack();
  assert.equal(bobClaim.success, true, "bob.testnet first claim MUST succeed");

  const bobAfter = await mgr.has_claimed_starter_pack("bob.testnet");
  assert.equal(bobAfter, true, "bob.testnet must now be claimed");

  // Duplicate claim for Bob must fail
  const bobDup = await mgr.claim_starter_pack();
  assert.equal(bobDup.success, false);
  assert.equal(bobDup.error, "Starter pack already claimed");

  // Alice must still be claimed
  const aliceCheck = await mgr.has_claimed_starter_pack("alice.testnet");
  assert.equal(aliceCheck, true, "alice.testnet remains claimed");
});

await runAsyncTest("Claimed status persists across session manager reloads (localStorage simulation)", async () => {
  // Simulate complete app restart / page reload
  resetSessionManager();
  const mgrFresh = near.SessionManager.getInstance();

  assert.equal(await mgrFresh.has_claimed_starter_pack("alice.testnet"), true);
  assert.equal(await mgrFresh.has_claimed_starter_pack("bob.testnet"), true);
  assert.equal(await mgrFresh.has_claimed_starter_pack("charlie.testnet"), false);

  mgrFresh.createSession("alice.testnet");
  const rejectRes = await mgrFresh.claim_starter_pack();
  assert.equal(rejectRes.success, false);
  assert.equal(rejectRes.error, "Starter pack already claimed");
});

console.log("\n--- SUITE 2: Crafting Validation & Resource Deduction ---");

await runAsyncTest("Crafting requires 2 iron ore + 1 essence; fails if iron ore < 2", async () => {
  const mgr = near.SessionManager.getInstance();
  mgr.saveMockState({
    inventory: {
      materials: {
        "ore:iron": 1,
        "essence:solar": 5,
        "essence:frost": 5,
        "essence:void": 5,
      },
      weapons: {
        "weapon:solar": 0,
        "weapon:frost": 0,
        "weapon:void": 0,
      },
      hasStarterClaimed: true,
    },
  });

  const res = await mgr.craft("weapon:solar");
  assert.equal(res.success, false);
  assert.equal(res.error, "Insufficient materials: requires 2 iron ore and 1 matching essence");

  const inv = mgr.getCachedState().inventory;
  assert.equal(inv.materials["ore:iron"], 1, "Iron ore must not be deducted");
  assert.equal(inv.materials["essence:solar"], 5, "Essence must not be deducted");
  assert.equal(inv.weapons["weapon:solar"], 0, "No weapon created");
});

await runAsyncTest("Crafting fails if matching essence < 1", async () => {
  const mgr = near.SessionManager.getInstance();
  mgr.saveMockState({
    inventory: {
      materials: {
        "ore:iron": 10,
        "essence:solar": 0,
        "essence:frost": 5,
        "essence:void": 5,
      },
      weapons: {
        "weapon:solar": 0,
        "weapon:frost": 0,
        "weapon:void": 0,
      },
      hasStarterClaimed: true,
    },
  });

  const res = await mgr.craft("weapon:solar");
  assert.equal(res.success, false);
  assert.equal(res.error, "Insufficient materials: requires 2 iron ore and 1 matching essence");
});

await runAsyncTest("Crafting fails if attempting to craft weapon without corresponding essence", async () => {
  const mgr = near.SessionManager.getInstance();
  // Player has iron and solar, but attempts to craft frost weapon
  mgr.saveMockState({
    inventory: {
      materials: {
        "ore:iron": 4,
        "essence:solar": 2,
        "essence:frost": 0,
        "essence:void": 0,
      },
      weapons: {
        "weapon:solar": 0,
        "weapon:frost": 0,
        "weapon:void": 0,
      },
      hasStarterClaimed: true,
    },
  });

  const resFrost = await mgr.craft("weapon:frost");
  assert.equal(resFrost.success, false);
  assert.equal(resFrost.error, "Insufficient materials: requires 2 iron ore and 1 matching essence");

  const resVoid = await mgr.craft("weapon:void");
  assert.equal(resVoid.success, false);
  assert.equal(resVoid.error, "Insufficient materials: requires 2 iron ore and 1 matching essence");

  // But crafting solar weapon succeeds
  const resSolar = await mgr.craft("weapon:solar");
  assert.equal(resSolar.success, true);
});

await runAsyncTest("Crafting succeeds and deducts exact amounts (2 iron + 1 essence) for all 3 weapon types", async () => {
  const mgr = near.SessionManager.getInstance();
  mgr.saveMockState({
    inventory: {
      materials: {
        "ore:iron": 6,
        "essence:solar": 1,
        "essence:frost": 1,
        "essence:void": 1,
      },
      weapons: {
        "weapon:solar": 0,
        "weapon:frost": 0,
        "weapon:void": 0,
      },
      hasStarterClaimed: true,
    },
  });

  // Craft Solar
  const c1 = await mgr.craft("weapon:solar");
  assert.equal(c1.success, true);
  let inv = mgr.getCachedState().inventory;
  assert.equal(inv.materials["ore:iron"], 4);
  assert.equal(inv.materials["essence:solar"], 0);
  assert.equal(inv.weapons["weapon:solar"], 1);

  // Craft Frost
  const c2 = await mgr.craft("weapon:frost");
  assert.equal(c2.success, true);
  inv = mgr.getCachedState().inventory;
  assert.equal(inv.materials["ore:iron"], 2);
  assert.equal(inv.materials["essence:frost"], 0);
  assert.equal(inv.weapons["weapon:frost"], 1);

  // Craft Void
  const c3 = await mgr.craft("weapon:void");
  assert.equal(c3.success, true);
  inv = mgr.getCachedState().inventory;
  assert.equal(inv.materials["ore:iron"], 0);
  assert.equal(inv.materials["essence:void"], 0);
  assert.equal(inv.weapons["weapon:void"], 1);

  // Next craft fails due to 0 iron
  const c4 = await mgr.craft("weapon:solar");
  assert.equal(c4.success, false);
});

console.log("\n--- SUITE 3: Combat Stances & Damage against Resistance ---");

runTest("Combat Stances multipliers: Aggressive (+40%), Balanced (100%), Defensive (-20%)", () => {
  assert.equal(pricing.STANCE_PROFILES.aggressive.damageMultiplier, 1.4);
  assert.equal(pricing.STANCE_PROFILES.balanced.damageMultiplier, 1.0);
  assert.equal(pricing.STANCE_PROFILES.defensive.damageMultiplier, 0.8);

  assert.equal(pricing.STANCE_PROFILES.aggressive.tributeThresholdBps, 6500);
  assert.equal(pricing.STANCE_PROFILES.balanced.tributeThresholdBps, 7000);
  assert.equal(pricing.STANCE_PROFILES.defensive.tributeThresholdBps, 8200);
});

runTest("Damage calculation against zero resistance (0 bps)", () => {
  // Raw base damage = 100
  const agg = pricing.calculateRaidDamage(0, "aggressive", 0, 1, false);
  const bal = pricing.calculateRaidDamage(0, "balanced", 0, 1, false);
  const def = pricing.calculateRaidDamage(0, "defensive", 0, 1, false);

  assert.equal(agg.effectiveDamage, 140, "Aggressive with 0 res = 140");
  assert.equal(bal.effectiveDamage, 100, "Balanced with 0 res = 100");
  assert.equal(def.effectiveDamage, 80, "Defensive with 0 res = 80");

  assert.equal(agg.mitigatedPercent, 0);
  assert.equal(bal.mitigatedPercent, 0);
  assert.equal(def.mitigatedPercent, 0);
});

runTest("Damage calculation against moderate resistance (5000 bps / 50%)", () => {
  const agg = pricing.calculateRaidDamage(0, "aggressive", 5000, 1, false);
  const bal = pricing.calculateRaidDamage(0, "balanced", 5000, 1, false);
  const def = pricing.calculateRaidDamage(0, "defensive", 5000, 1, false);

  assert.equal(agg.effectiveDamage, 70, "Aggressive: 140 * 0.5 = 70");
  assert.equal(bal.effectiveDamage, 50, "Balanced: 100 * 0.5 = 50");
  assert.equal(def.effectiveDamage, 40, "Defensive: 80 * 0.5 = 40");

  assert.equal(agg.mitigatedPercent, 50);
  assert.equal(bal.mitigatedPercent, 50);
  assert.equal(def.mitigatedPercent, 50);
});

runTest("Damage calculation against high resistance (8500 bps / 85%)", () => {
  const agg = pricing.calculateRaidDamage(0, "aggressive", 8500, 1, false);
  const bal = pricing.calculateRaidDamage(0, "balanced", 8500, 1, false);
  const def = pricing.calculateRaidDamage(0, "defensive", 8500, 1, false);

  // 140 * 0.15 = 21
  assert.equal(agg.effectiveDamage, 21);
  // 100 * 0.15 = 15
  assert.equal(bal.effectiveDamage, 15);
  // 80 * 0.15 = 12
  assert.equal(def.effectiveDamage, 12);

  assert.equal(agg.mitigatedPercent, 85);
});

runTest("Boss Tribute Confiscation triggers accurately per stance threshold", () => {
  // Aggressive: threshold 6500
  const aggBelow = pricing.calculateRaidDamage(0, "aggressive", 6499, 1, false);
  assert.equal(aggBelow.isConfiscated, false);
  const aggAt = pricing.calculateRaidDamage(0, "aggressive", 6500, 1, false);
  assert.equal(aggAt.isConfiscated, true);

  // Balanced: threshold 7000
  const balBelow = pricing.calculateRaidDamage(0, "balanced", 6999, 1, false);
  assert.equal(balBelow.isConfiscated, false);
  const balAt = pricing.calculateRaidDamage(0, "balanced", 7000, 1, false);
  assert.equal(balAt.isConfiscated, true);

  // Defensive: threshold 8200
  const defBelow = pricing.calculateRaidDamage(0, "defensive", 8199, 1, false);
  assert.equal(defBelow.isConfiscated, false);
  const defAt = pricing.calculateRaidDamage(0, "defensive", 8200, 1, false);
  assert.equal(defAt.isConfiscated, true);

  // Starter lock immunity protects weapon regardless of resistance
  const protectedAgg = pricing.calculateRaidDamage(0, "aggressive", 8500, 1, true);
  assert.equal(protectedAgg.isConfiscated, false, "Starter locked weapon must never be confiscated");
});

runTest("Floor 2 Frost Ward reduces frost attack damage by 50%", () => {
  const frostF1 = pricing.calculateRaidDamage(1, "balanced", 2000, 1, false);
  const frostF2 = pricing.calculateRaidDamage(1, "balanced", 2000, 2, false);

  // At 2000 bps: mitigation = 20% -> 100 * 0.8 = 80
  assert.equal(frostF1.effectiveDamage, 80);
  // Floor 2 modifier: -50% base -> 50 * 0.8 = 40
  assert.equal(frostF2.effectiveDamage, 40);
  assert.equal(frostF2.floorModifierPercent, -50);
});

console.log("\n--- SUITE 4: Vault Ticket Balance & Raid Execution ---");

await runAsyncTest("Raid execution fails if ledger balance < 0.1 NEAR", async () => {
  const mgr = near.SessionManager.getInstance();
  // Set balance to 0.05 NEAR
  mgr.saveMockState({
    playerBalanceYocto: "50000000000000000000000", // 0.05 NEAR
  });

  const raidRes = await mgr.executeSignlessCall("raid", { turns: [{ weapon_element: 0, stance: 0 }] });
  assert.equal(raidRes.success, false);
  assert.match(raidRes.error, /Insufficient Vault balance/);
});

await runAsyncTest("Raid execution succeeds with >= 0.1 NEAR, deducts fee and credits 90% to jackpot", async () => {
  const mgr = near.SessionManager.getInstance();
  const initBal = 1000000000000000000000000n; // 1.0 NEAR
  const initJackpot = 10000000000000000000000000n; // 10.0 NEAR
  mgr.saveMockState({
    playerBalanceYocto: initBal.toString(),
    jackpotYocto: initJackpot.toString(),
  });

  const raidRes = await mgr.executeSignlessCall("raid", { turns: [{ weapon_element: 0, stance: 0 }] });
  assert.equal(raidRes.success, true);

  const state = mgr.getCachedState();
  const ticketFee = 100000000000000000000000n; // 0.1 NEAR
  const expectedBal = (initBal - ticketFee).toString();
  const expectedJackpot = (initJackpot + (ticketFee * 9n) / 10n).toString(); // +0.09 NEAR

  assert.equal(state.playerBalanceYocto, expectedBal, "Balance must decrease by exactly 0.1 NEAR");
  assert.equal(state.jackpotYocto, expectedJackpot, "Jackpot must increase by exactly 0.09 NEAR");
});

console.log("\n--- SUITE 5: Adaptive Resistance Mathematical Invariants & Stress Fuzzing ---");

runTest("Authoritative test vector [80, 20, 10] -> strictly [8500, 3114, 1886]", () => {
  const res = pricing.calculateAdaptiveResistance([80, 20, 10]);
  assert.deepEqual(res, [8500, 3114, 1886]);
  assert.equal(res[0] + res[1] + res[2], 13500);
});

runTest("Fuzzing 1,000 random supply distributions preserves invariants", () => {
  for (let i = 0; i < 1000; i++) {
    const s0 = Math.floor(Math.random() * 500);
    const s1 = Math.floor(Math.random() * 500);
    const s2 = Math.floor(Math.random() * 500);

    const res = pricing.calculateAdaptiveResistance([s0, s1, s2]);
    const sum = res[0] + res[1] + res[2];
    assert.equal(sum, 13500, `Sum must be 13500 for inputs [${s0},${s1},${s2}], got ${sum}`);
    assert.ok(res[0] >= 1000 && res[0] <= 8500, `res[0] out of bounds: ${res[0]}`);
    assert.ok(res[1] >= 1000 && res[1] <= 8500, `res[1] out of bounds: ${res[1]}`);
    assert.ok(res[2] >= 1000 && res[2] <= 8500, `res[2] out of bounds: ${res[2]}`);
  }
});

// Cleanup temp transpiled modules
try { fs.unlinkSync(tmpPricingPath); } catch {}
try { fs.unlinkSync(tmpNearPath); } catch {}

console.log("\n=== EMPIRICAL STRESS TEST RESULTS ===");
console.log(`Passed: ${totalPassed}`);
console.log(`Failed: ${totalFailed}`);

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log("All empirical stress tests PASSED successfully!\n");
}
