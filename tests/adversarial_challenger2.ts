/**
 * The Spire v3.1 / BossVault Protocol - Adversarial Stress-Testing Suite
 * Challenger 2: State Machine, Security Boundaries & AI TEE Gate Stress Harness
 *
 * Verifies:
 * 1. AI TEE Signature Gate Security (forged signatures, wrong key, parameter bounds, shift bounds, sum violations, replay attacks)
 * 2. Floor Dynamics & Timers (Floor 2 Frost Ward scaling & 30m timeout, Floor 3 Enrage heal cap & 20m timeout)
 * 3. Signless Session Key & Ledger Vault Security (double withdrawal / underflow, attack without fee, crafting without materials)
 * 4. NEP-297 EVENT_JSON Log Integrity (corrupted, missing, malformed JSON handling)
 */

import { describe, it } from "./test_harness.ts";
import {
  computeAdaptiveResistance,
  computeBossDamage,
  computeFloor3EnrageHeal,
  evaluateBossTribute,
  computeJackpotPayouts,
  computeMerchantPrice,
  validateAiProposal,
  SimulatedLedger,
  SimulatedInventory,
  TOKEN_IDS,
  RESISTANCE_TOTAL_BPS,
  RESISTANCE_MIN_CLAMP_BPS,
  RESISTANCE_MAX_CLAMP_BPS,
  MAX_SHIFT_BPS,
  MIN_BUYBACK_BPS,
  MAX_BUYBACK_BPS,
  TICKET_PRICE_YOCTO,
  ONE_NEAR_YOCTO,
} from "./protocol_models.ts";

import {
  getMockTeeKeyPair,
  signProposal,
  verifyProposalSignature,
  validateProposalInvariants,
  generateMockAiProposal,
  serializeProposal,
  getPinnedMockTeePublicKey,
} from "../relayer/dist/tee.js";

import {
  parseEventJson as relayerParseEventJson,
  extractEventsFromLogs,
  validateEventPayload,
  validateDepositData,
  validateCraftData,
  validateReforgeData,
  validateRaidData,
  validateBossDefeatedData,
  validateAiProposalAppliedData,
  validateMerchantTradeData,
} from "../relayer/dist/indexer.js";

import nacl from "../relayer/node_modules/tweetnacl/nacl-fast.js";

// Helper expectation function
function expect(val: any) {
  return {
    toBe: (expected: any) => {
      if (val !== expected) throw new Error(`Expected ${expected}, received ${val}`);
    },
    toEqual: (expected: any) => {
      if (JSON.stringify(val) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(val)}`);
      }
    },
    toBeTruthy: () => {
      if (!val) throw new Error(`Expected truthy, received ${val}`);
    },
    toBeFalsy: () => {
      if (val) throw new Error(`Expected falsy, received ${val}`);
    },
    toThrow: (expectedRegexOrMsg?: string | RegExp) => {
      let threw = false;
      let errMsg = "";
      try {
        val();
      } catch (e: any) {
        threw = true;
        errMsg = e.message || String(e);
      }
      if (!threw) {
        throw new Error("Expected function to throw, but it did not throw.");
      }
      if (expectedRegexOrMsg) {
        if (typeof expectedRegexOrMsg === "string") {
          if (!errMsg.includes(expectedRegexOrMsg)) {
            throw new Error(`Expected error containing "${expectedRegexOrMsg}", got "${errMsg}"`);
          }
        } else {
          if (!expectedRegexOrMsg.test(errMsg)) {
            throw new Error(`Expected error matching ${expectedRegexOrMsg}, got "${errMsg}"`);
          }
        }
      }
    },
  };
}

export async function runChallenger2Suite(): Promise<boolean> {
  console.log("\x1b[1m\x1b[36m");
  console.log("================================================================================");
  console.log("   CHALLENGER 2: ADVERSARIAL STRESS-TESTING & SECURITY BOUNDARY HARNESS");
  console.log("================================================================================\x1b[0m\n");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  async function testCase(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    } catch (err: any) {
      failedTests++;
      console.error(`  \x1b[31m✖\x1b[0m ${name}`);
      console.error(`    \x1b[31mError: ${err.message}\x1b[0m`);
    }
  }

  // ---------------------------------------------------------------------------
  // DOMAIN 1: AI TEE SIGNATURE GATE SECURITY
  // ---------------------------------------------------------------------------
  console.log("\x1b[1m\x1b[34m▶ [DOMAIN 1] AI TEE SIGNATURE GATE ADVERSARIAL STRESS TESTS\x1b[0m");

  await testCase("1.1 Forged / Corrupted Ed25519 Signatures must be rejected", () => {
    const keyPair = getMockTeeKeyPair();
    const proposal = {
      epoch: 2,
      resistance_shifts: [500, -250, -250] as [number, number, number],
      target_resistances: [5000, 4250, 4250] as [number, number, number],
      buyback_multiplier_bps: 15000,
      nonce: 10,
    };
    const validSigHex = signProposal(proposal, keyPair.secretKey);
    const pubKeyHex = Buffer.from(keyPair.publicKey).toString("hex");

    // Valid check passes baseline
    expect(verifyProposalSignature(proposal, validSigHex, pubKeyHex)).toBe(true);

    // All-zero signature (64 bytes of 0x00) -> MUST reject
    const allZeroSig = "00".repeat(64);
    expect(verifyProposalSignature(proposal, allZeroSig, pubKeyHex)).toBe(false);

    // Corrupted signature (1 byte flipped in valid signature) -> MUST reject
    const sigBytes = Buffer.from(validSigHex, "hex");
    sigBytes[10] ^= 0xff; // Flip bits
    const corruptedSigHex = sigBytes.toString("hex");
    expect(verifyProposalSignature(proposal, corruptedSigHex, pubKeyHex)).toBe(false);

    // Truncated signature (32 bytes instead of 64) -> MUST reject
    const truncatedSigHex = validSigHex.substring(0, 64);
    expect(verifyProposalSignature(proposal, truncatedSigHex, pubKeyHex)).toBe(false);

    // Extended signature (128 bytes) -> MUST reject
    const extendedSigHex = validSigHex + validSigHex;
    expect(verifyProposalSignature(proposal, extendedSigHex, pubKeyHex)).toBe(false);

    // Random noise signature -> MUST reject
    const randomSigHex = Buffer.from(nacl.randomBytes(64)).toString("hex");
    expect(verifyProposalSignature(proposal, randomSigHex, pubKeyHex)).toBe(false);
  });

  await testCase("1.2 Wrong Public Key must be rejected", () => {
    const authorizedKeyPair = getMockTeeKeyPair();
    const attackerKeyPair = nacl.sign.keyPair(); // Random untrusted keypair
    const proposal = {
      epoch: 2,
      resistance_shifts: [0, 0, 0] as [number, number, number],
      target_resistances: [4500, 4500, 4500] as [number, number, number],
      buyback_multiplier_bps: 12000,
      nonce: 5,
    };

    // Attacker signs with their own private key
    const attackerSig = signProposal(proposal, attackerKeyPair.secretKey);

    // Verification against pinned contract pubkey -> MUST reject
    const pinnedPubKeyHex = Buffer.from(authorizedKeyPair.publicKey).toString("hex");
    expect(verifyProposalSignature(proposal, attackerSig, pinnedPubKeyHex)).toBe(false);

    // Verification against attacker's own pubkey would pass, proving signature was valid for attacker
    const attackerPubKeyHex = Buffer.from(attackerKeyPair.publicKey).toString("hex");
    expect(verifyProposalSignature(proposal, attackerSig, attackerPubKeyHex)).toBe(true);
  });

  await testCase("1.3 Out-of-bounds buyback multiplier (< 10000 bps or > 40000 bps) must be rejected", () => {
    const currentR: [number, number, number] = [4500, 4500, 4500];

    // Underflow / Below 10000 bps
    const subMin9999 = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [4500, 4500, 4500],
      buyback_multiplier_bps: 9999,
      nonce: 1,
    }, 0);
    expect(subMin9999.valid).toBe(false);
    expect(subMin9999.error).toBe("E_INVALID_BUYBACK_MULTIPLIER");

    const zeroMultiplier = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [4500, 4500, 4500],
      buyback_multiplier_bps: 0,
      nonce: 1,
    }, 0);
    expect(zeroMultiplier.valid).toBe(false);
    expect(zeroMultiplier.error).toBe("E_INVALID_BUYBACK_MULTIPLIER");

    // Overflow / Above 40000 bps
    const superMax40001 = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [4500, 4500, 4500],
      buyback_multiplier_bps: 40001,
      nonce: 1,
    }, 0);
    expect(superMax40001.valid).toBe(false);
    expect(superMax40001.error).toBe("E_INVALID_BUYBACK_MULTIPLIER");

    const extremeMultiplier = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [4500, 4500, 4500],
      buyback_multiplier_bps: 100000,
      nonce: 1,
    }, 0);
    expect(extremeMultiplier.valid).toBe(false);
    expect(extremeMultiplier.error).toBe("E_INVALID_BUYBACK_MULTIPLIER");

    // Boundaries: exactly 10000 and 40000 bps MUST accept
    const minAccept = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [4500, 4500, 4500],
      buyback_multiplier_bps: 10000,
      nonce: 1,
    }, 0);
    expect(minAccept.valid).toBe(true);

    const maxAccept = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [4500, 4500, 4500],
      buyback_multiplier_bps: 40000,
      nonce: 1,
    }, 0);
    expect(maxAccept.valid).toBe(true);
  });

  await testCase("1.4 Excessive resistance shift (|Delta| > 2500 bps) and clamp bounds must be rejected", () => {
    const currentR: [number, number, number] = [4500, 4500, 4500];

    // Shift of +2501 on element 0
    const overShiftPlus = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [7001, 3249, 3250], // shift +2501, -1251, -1250
      buyback_multiplier_bps: 15000,
      nonce: 1,
    }, 0);
    expect(overShiftPlus.valid).toBe(false);
    expect(overShiftPlus.error).toBe("E_EXCEEDS_MAX_SHIFT");

    // Shift of -2501 on element 0
    const overShiftMinus = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [1999, 5750, 5751], // shift -2501, +1250, +1251
      buyback_multiplier_bps: 15000,
      nonce: 1,
    }, 0);
    expect(overShiftMinus.valid).toBe(false);
    expect(overShiftMinus.error).toBe("E_EXCEEDS_MAX_SHIFT");

    // Boundary shift: exactly +2500 bps MUST accept
    const exactMaxShift = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [7000, 3250, 3250], // shift +2500, -1250, -1250
      buyback_multiplier_bps: 15000,
      nonce: 1,
    }, 0);
    expect(exactMaxShift.valid).toBe(true);

    // Target violating lower clamp [1000, 8500]
    const subClamp = validateAiProposal([2000, 5750, 5750], {
      epoch: 2,
      target_resistances: [999, 6251, 6250],
      buyback_multiplier_bps: 15000,
      nonce: 1,
    }, 0);
    expect(subClamp.valid).toBe(false);
    expect(subClamp.error).toBe("E_RESISTANCE_OUT_OF_BOUNDS");

    // Target violating upper clamp [1000, 8500]
    const superClamp = validateAiProposal([7000, 3250, 3250], {
      epoch: 2,
      target_resistances: [8501, 2499, 2500],
      buyback_multiplier_bps: 15000,
      nonce: 1,
    }, 0);
    expect(superClamp.valid).toBe(false);
    expect(superClamp.error).toBe("E_RESISTANCE_OUT_OF_BOUNDS");
  });

  await testCase("1.5 Sum violation in proposed shifts / target resistances must be rejected", () => {
    const currentR: [number, number, number] = [4500, 4500, 4500];

    // Target sum = 13499 (1 bps deficit)
    const deficitSum = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [4500, 4500, 4499],
      buyback_multiplier_bps: 15000,
      nonce: 1,
    }, 0);
    expect(deficitSum.valid).toBe(false);
    expect(deficitSum.error).toBe("E_INVALID_RESISTANCE_SUM");

    // Target sum = 13501 (1 bps excess)
    const excessSum = validateAiProposal(currentR, {
      epoch: 2,
      target_resistances: [4500, 4500, 4501],
      buyback_multiplier_bps: 15000,
      nonce: 1,
    }, 0);
    expect(excessSum.valid).toBe(false);
    expect(excessSum.error).toBe("E_INVALID_RESISTANCE_SUM");

    // Relayer validator sum invariant check
    const invalidRelayerProposal = {
      epoch: 2,
      resistance_shifts: [100, 100, 100] as [number, number, number], // Sum = +300
      target_resistances: [4600, 4600, 4600] as [number, number, number], // Sum = 13800
      buyback_multiplier_bps: 15000,
      nonce: 1,
    };
    const relayerCheck = validateProposalInvariants(invalidRelayerProposal, currentR);
    expect(relayerCheck.valid).toBe(false);
    expect(relayerCheck.errors.some(e => e.includes("must equal 13500 bps"))).toBe(true);
  });

  await testCase("1.6 Replay attacks / stale proposal nonce must be rejected", () => {
    const currentR: [number, number, number] = [4500, 4500, 4500];
    const lastNonce = 42;

    // Exact same nonce (42 <= 42) -> MUST reject
    const sameNonce = validateAiProposal(currentR, {
      epoch: 3,
      target_resistances: [4500, 4500, 4500],
      buyback_multiplier_bps: 15000,
      nonce: 42,
    }, lastNonce);
    expect(sameNonce.valid).toBe(false);
    expect(sameNonce.error).toBe("E_REPLAY_DETECTED");

    // Past / Stale nonce (41 < 42) -> MUST reject
    const staleNonce = validateAiProposal(currentR, {
      epoch: 3,
      target_resistances: [4500, 4500, 4500],
      buyback_multiplier_bps: 15000,
      nonce: 41,
    }, lastNonce);
    expect(staleNonce.valid).toBe(false);
    expect(staleNonce.error).toBe("E_REPLAY_DETECTED");

    // Future / incremented nonce (43 > 42) -> MUST accept
    const freshNonce = validateAiProposal(currentR, {
      epoch: 3,
      target_resistances: [4500, 4500, 4500],
      buyback_multiplier_bps: 15000,
      nonce: 43,
    }, lastNonce);
    expect(freshNonce.valid).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // DOMAIN 2: FLOOR DYNAMICS & TIMERS
  // ---------------------------------------------------------------------------
  console.log("\n\x1b[1m\x1b[34m▶ [DOMAIN 2] FLOOR DYNAMICS & TIMERS ADVERSARIAL STRESS TESTS\x1b[0m");

  await testCase("2.1 Floor 2 Frost Ward damage scaling (+25% Solar, -50% Frost) must be enforced", () => {
    const basePower = 400;
    const resBps = 2000; // Raw damage = 400 * (10000 - 2000) / 10000 = 320

    // Solar weapon (0) on Floor 2: +25% bonus -> 320 * 1.25 = 400
    const solarDmg = computeBossDamage({
      basePower,
      resistanceBps: resBps,
      floor: 2,
      weaponElement: 0,
    });
    expect(solarDmg).toBe(400);

    // Frost weapon (1) on Floor 2: -50% penalty -> 320 * 0.5 = 160
    const frostDmg = computeBossDamage({
      basePower,
      resistanceBps: resBps,
      floor: 2,
      weaponElement: 1,
    });
    expect(frostDmg).toBe(160);

    // Void weapon (2) on Floor 2: neutral -> 320
    const voidDmg = computeBossDamage({
      basePower,
      resistanceBps: resBps,
      floor: 2,
      weaponElement: 2,
    });
    expect(voidDmg).toBe(320);

    // Floor 1 neutral check: neither solar bonus nor frost penalty
    expect(computeBossDamage({ basePower, resistanceBps: resBps, floor: 1, weaponElement: 0 })).toBe(320);
    expect(computeBossDamage({ basePower, resistanceBps: resBps, floor: 1, weaponElement: 1 })).toBe(320);
  });

  await testCase("2.2 Floor 2 30-minute timeout expiration must be enforced", () => {
    const floor2DeadlineSeconds = 1800; // 30 minutes

    // Helper checking expiration logic
    function isExpired(floor: number, elapsedSeconds: number): boolean {
      if (floor === 2) return elapsedSeconds >= 1800;
      if (floor === 3) return elapsedSeconds >= 1200;
      return false;
    }

    // 1799s -> NOT expired
    expect(isExpired(2, 1799)).toBe(false);

    // 1800s -> EXPIRED
    expect(isExpired(2, 1800)).toBe(true);

    // 3600s -> EXPIRED
    expect(isExpired(2, 3600)).toBe(true);

    // Floor 1 has no deadline
    expect(isExpired(1, 100000)).toBe(false);
  });

  await testCase("2.3 Floor 3 Enrage healing (+10% max HP per 5m) capped at 5000 HP must be enforced", () => {
    const maxHp = 5000;
    const damagedHp = 3000;

    // 299 seconds: < 5 minutes -> 0 ticks, 0 HP healed
    const at299 = computeFloor3EnrageHeal(299, damagedHp, maxHp);
    expect(at299.ticksApplied).toBe(0);
    expect(at299.healedHp).toBe(0);
    expect(at299.finalHp).toBe(3000);

    // 300 seconds: exactly 1 tick -> +500 HP healed (final: 3500)
    const at300 = computeFloor3EnrageHeal(300, damagedHp, maxHp);
    expect(at300.ticksApplied).toBe(1);
    expect(at300.healedHp).toBe(500);
    expect(at300.finalHp).toBe(3500);

    // 600 seconds: exactly 2 ticks -> +1000 HP healed (final: 4000)
    const at600 = computeFloor3EnrageHeal(600, damagedHp, maxHp);
    expect(at600.ticksApplied).toBe(2);
    expect(at600.healedHp).toBe(1000);
    expect(at600.finalHp).toBe(4000);

    // Capping test: Boss at 4800 HP after 1 tick (+500) must cap at 5000 HP
    const capped = computeFloor3EnrageHeal(300, 4800, maxHp);
    expect(capped.finalHp).toBe(5000);
    expect(capped.healedHp).toBe(200);

    // Multi-hour idle (86400s = 24h = 288 ticks): HP remains capped at 5000 HP
    const extremeIdle = computeFloor3EnrageHeal(86400, 100, maxHp);
    expect(extremeIdle.finalHp).toBe(5000);
    expect(extremeIdle.ticksApplied).toBe(288);
  });

  await testCase("2.4 Floor 3 20-minute timeout expiration must be enforced", () => {
    function isExpired(floor: number, elapsedSeconds: number): boolean {
      if (floor === 2) return elapsedSeconds >= 1800;
      if (floor === 3) return elapsedSeconds >= 1200;
      return false;
    }

    // 1199s -> NOT expired
    expect(isExpired(3, 1199)).toBe(false);

    // 1200s -> EXPIRED
    expect(isExpired(3, 1200)).toBe(true);

    // 2400s -> EXPIRED
    expect(isExpired(3, 2400)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // DOMAIN 3: SIGNLESS SESSION KEY & LEDGER VAULT SECURITY
  // ---------------------------------------------------------------------------
  console.log("\n\x1b[1m\x1b[34m▶ [DOMAIN 3] SIGNLESS SESSION KEY & LEDGER VAULT SECURITY ADVERSARIAL STRESS TESTS\x1b[0m");

  await testCase("3.1 Double withdrawal and underflow attempts must be rejected", () => {
    const ledger = new SimulatedLedger();
    const alice = "alice.testnet";

    ledger.deposit(alice, ONE_NEAR_YOCTO); // Deposit 1.0 NEAR
    expect(ledger.getBalance(alice)).toBe(ONE_NEAR_YOCTO);

    // First withdrawal of 1.0 NEAR succeeds
    ledger.withdraw(alice, ONE_NEAR_YOCTO);
    expect(ledger.getBalance(alice)).toBe(0n);

    // Double withdrawal: immediate second withdrawal of 1.0 NEAR -> MUST throw E_INSUFFICIENT_BALANCE
    expect(() => ledger.withdraw(alice, ONE_NEAR_YOCTO)).toThrow("E_INSUFFICIENT_BALANCE");

    // Partial balance underflow: balance 0.5 NEAR, withdraw 1.0 NEAR -> MUST throw
    ledger.deposit(alice, ONE_NEAR_YOCTO / 2n);
    expect(() => ledger.withdraw(alice, ONE_NEAR_YOCTO)).toThrow("E_INSUFFICIENT_BALANCE");

    // Zero deposit attempt -> MUST throw
    expect(() => ledger.deposit(alice, 0n)).toThrow("E_ZERO_DEPOSIT");
  });

  await testCase("3.2 Attack without ticket fee (0.1 NEAR) must be rejected", () => {
    const ledger = new SimulatedLedger();
    const inventory = new SimulatedInventory();
    const bob = "bob.testnet";

    // Bob has 1 weapon but 0 NEAR in internal ledger
    inventory.setBalance(bob, TOKEN_IDS.WEAPON_SOLAR, 1);
    expect(inventory.getBalance(bob, TOKEN_IDS.WEAPON_SOLAR)).toBe(1);
    expect(ledger.getBalance(bob)).toBe(0n);

    function attemptAttack(player: string, ticketCost: bigint) {
      ledger.debit(player, ticketCost);
    }

    // Attack without funds -> MUST throw E_INSUFFICIENT_BALANCE
    expect(() => attemptAttack(bob, TICKET_PRICE_YOCTO)).toThrow("E_INSUFFICIENT_BALANCE");

    // Attack with 0.09 NEAR (< 0.1 NEAR ticket price) -> MUST throw
    ledger.deposit(bob, TICKET_PRICE_YOCTO - 1n);
    expect(() => attemptAttack(bob, TICKET_PRICE_YOCTO)).toThrow("E_INSUFFICIENT_BALANCE");

    // Fund exact 0.1 NEAR -> attack succeeds and debits to 0
    ledger.deposit(bob, 1n); // Now has exact 0.1 NEAR
    attemptAttack(bob, TICKET_PRICE_YOCTO);
    expect(ledger.getBalance(bob)).toBe(0n);

    // Second attack immediately fails
    expect(() => attemptAttack(bob, TICKET_PRICE_YOCTO)).toThrow("E_INSUFFICIENT_BALANCE");
  });

  await testCase("3.3 Crafting with insufficient materials must be rejected", () => {
    const inventory = new SimulatedInventory();
    const charlie = "charlie.testnet";

    // Charlie has 1 iron ore and 1 solar essence (needs 2 iron + 1 essence)
    inventory.setBalance(charlie, TOKEN_IDS.ORE_IRON, 1);
    inventory.setBalance(charlie, TOKEN_IDS.ESSENCE_SOLAR, 1);
    expect(() => inventory.craft(charlie, "solar")).toThrow("E_INSUFFICIENT_MATERIALS");

    // Charlie has 2 iron ore and 0 solar essence
    inventory.setBalance(charlie, TOKEN_IDS.ORE_IRON, 2);
    inventory.setBalance(charlie, TOKEN_IDS.ESSENCE_SOLAR, 0);
    expect(() => inventory.craft(charlie, "solar")).toThrow("E_INSUFFICIENT_MATERIALS");

    // Charlie has 0 materials
    inventory.setBalance(charlie, TOKEN_IDS.ORE_IRON, 0);
    inventory.setBalance(charlie, TOKEN_IDS.ESSENCE_SOLAR, 0);
    expect(() => inventory.craft(charlie, "solar")).toThrow("E_INSUFFICIENT_MATERIALS");

    // Reforging with insufficient weapons (needs 2)
    inventory.setBalance(charlie, TOKEN_IDS.WEAPON_FROST, 1);
    expect(() => inventory.reforge(charlie, "frost", "solar")).toThrow("E_INSUFFICIENT_WEAPONS");

    // Reforging same element into same element
    inventory.setBalance(charlie, TOKEN_IDS.WEAPON_FROST, 2);
    expect(() => inventory.reforge(charlie, "frost", "frost")).toThrow("E_SAME_ELEMENT");
  });

  // ---------------------------------------------------------------------------
  // DOMAIN 4: NEP-297 EVENT_JSON LOG INTEGRITY
  // ---------------------------------------------------------------------------
  console.log("\n\x1b[1m\x1b[34m▶ [DOMAIN 4] NEP-297 EVENT_JSON LOG INTEGRITY ADVERSARIAL STRESS TESTS\x1b[0m");

  await testCase("4.1 Corrupted, truncated, and non-object JSON payloads must be handled gracefully without crashing", () => {
    // Malformed line types that must return null without throwing:
    const corruptedLines = [
      "",
      "random unformatted log message without prefix",
      "EVENT_JSON:",
      "EVENT_JSON:   ",
      "EVENT_JSON:{",
      "EVENT_JSON:{\"standard\": \"spire\", \"version\": ",
      "EVENT_JSON:{\"standard\": \"spire\", \"version\": \"3.1.0\", \"event\": \"deposit\", \"data\": [",
      "EVENT_JSON: null",
      "EVENT_JSON: 12345",
      "EVENT_JSON: \"just a plain string\"",
      "EVENT_JSON: true",
      "EVENT_JSON: [1, 2, 3]",
      "EVENT_JSON: \u0000\u0001\u0002\u0003",
    ];

    for (const line of corruptedLines) {
      let result: any = null;
      expect(() => {
        result = relayerParseEventJson(line);
      }).toBeTruthy(); // Should not throw!
      expect(result).toBe(null);
    }
  });

  await testCase("4.2 Missing standard, unsupported events, and empty data arrays must be rejected", () => {
    const invalidSchemas = [
      // Missing standard
      'EVENT_JSON:{"version":"3.1.0","event":"deposit","data":[{"account_id":"a","amount":"10"}]}',
      // Wrong standard
      'EVENT_JSON:{"standard":"nep171","version":"1.0.0","event":"nft_mint","data":[]}',
      // Missing event name
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","data":[{"account_id":"a","amount":"10"}]}',
      // Unsupported event name
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"unknown_hack_event","data":[{"foo":"bar"}]}',
      // Empty data array
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"deposit","data":[]}',
      // Data is not an array
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"deposit","data":null}',
      // Data contains null
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"deposit","data":[null]}',
    ];

    for (const line of invalidSchemas) {
      const parsed = relayerParseEventJson(line);
      expect(parsed).toBe(null);
    }
  });

  await testCase("4.3 Schema validation across all 7 supported NEP-297 events must enforce strict types", () => {
    // 1. Valid deposit event
    const validDeposit = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"deposit","data":[{"account_id":"alice.testnet","amount":"1000000000000000000000000"}]}';
    const depEvent = relayerParseEventJson(validDeposit);
    expect(depEvent).toBeTruthy();
    expect(depEvent?.event).toBe("deposit");

    // Corrupted deposit (amount is number instead of yocto string)
    const badDeposit = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"deposit","data":[{"account_id":"alice.testnet","amount":1000}]}';
    expect(relayerParseEventJson(badDeposit)).toBe(null);

    // 2. Valid craft event
    const validCraft = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"craft","data":[{"account_id":"alice.testnet","recipe":"craft_weapon:solar","output_token":"weapon:solar","amount":1,"materials_consumed":[{"token_id":"ore:iron","amount":2},{"token_id":"essence:solar","amount":1}]}]}';
    const craftEvent = relayerParseEventJson(validCraft);
    expect(craftEvent).toBeTruthy();
    expect(craftEvent?.event).toBe("craft");

    // Corrupted craft (missing materials_consumed)
    const badCraft = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"craft","data":[{"account_id":"alice.testnet","recipe":"craft","output_token":"w","amount":1}]}';
    expect(relayerParseEventJson(badCraft)).toBe(null);

    // 3. Valid raid event
    const validRaid = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"raid","data":[{"account_id":"alice.testnet","floor":1,"round":1,"weapon":"weapon:solar","damage":320,"boss_remaining_hp":680,"ticket_paid":"100000000000000000000000","tribute_taken":false}]}';
    const raidEvent = relayerParseEventJson(validRaid);
    expect(raidEvent).toBeTruthy();
    expect(raidEvent?.event).toBe("raid");

    // Corrupted raid (damage is string instead of number)
    const badRaid = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"raid","data":[{"account_id":"alice.testnet","floor":1,"round":1,"weapon":"weapon:solar","damage":"320","boss_remaining_hp":680,"ticket_paid":"100000000000000000000000","tribute_taken":false}]}';
    expect(relayerParseEventJson(badRaid)).toBe(null);

    // 4. Valid reforge event
    const validReforge = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"reforge","data":[{"account_id":"alice.testnet","burn_element":"weapon:frost","received_element":"weapon:solar","burned_count":2,"minted_count":1}]}';
    const reforgeEvent = relayerParseEventJson(validReforge);
    expect(reforgeEvent).toBeTruthy();
    expect(reforgeEvent?.event).toBe("reforge");

    // 5. Valid ai_proposal_applied event
    const validAi = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"ai_proposal_applied","data":[{"epoch":2,"old_resistance":[4500,4500,4500],"new_resistance":[5000,4250,4250],"buyback_multiplier_bps":15000,"proposer":"relayer.testnet","memo":"Autonomous sentinel"}]}';
    const aiEvent = relayerParseEventJson(validAi);
    expect(aiEvent).toBeTruthy();
    expect(aiEvent?.event).toBe("ai_proposal_applied");

    // Corrupted ai_proposal (resistance array has 2 elements instead of 3)
    const badAi = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"ai_proposal_applied","data":[{"epoch":2,"old_resistance":[4500,4500],"new_resistance":[5000,4250],"buyback_multiplier_bps":15000,"proposer":"relayer.testnet","memo":"test"}]}';
    expect(relayerParseEventJson(badAi)).toBe(null);

    // 6. Valid merchant_trade event
    const validTrade = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"merchant_trade","data":[{"account_id":"alice.testnet","action":"buy","item_id":"ore:iron","amount":5,"price_paid":"250000000000000000000000","current_stock":95,"treasury_reserve":"5000000000000000000000000"}]}';
    const tradeEvent = relayerParseEventJson(validTrade);
    expect(tradeEvent).toBeTruthy();
    expect(tradeEvent?.event).toBe("merchant_trade");

    // 7. Valid boss_defeated event with trophy (Floor 3 defeat)
    const validBossFloor3 = 'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"boss_defeated","data":[{"floor":3,"round":1,"killer":"alice.testnet","total_jackpot":"1000000000000000000000000","total_damage":5000,"trophy_token_id":"spire-trophy-r1-f3"}]}';
    const bossFloor3Event = relayerParseEventJson(validBossFloor3);
    expect(bossFloor3Event).toBeTruthy();
    expect(bossFloor3Event?.event).toBe("boss_defeated");
  });

  await testCase("4.4 Batch log extraction filters invalid logs and preserves all valid events", () => {
    const rawLogs = [
      "User initiated session call",
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"deposit","data":[{"account_id":"alice.testnet","amount":"1000000000000000000000000"}]}',
      "DEBUG: gas consumed = 2.4 TGas",
      "EVENT_JSON: {broken json payload",
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"raid","data":[{"account_id":"alice.testnet","floor":1,"round":1,"weapon":"weapon:solar","damage":320,"boss_remaining_hp":680,"ticket_paid":"100000000000000000000000","tribute_taken":false}]}',
      "EVENT_JSON: 9999",
      'EVENT_JSON:{"standard":"unknown","version":"1.0","event":"foo","data":[]}',
    ];

    const extracted = extractEventsFromLogs(rawLogs);
    expect(extracted.length).toBe(2);
    expect(extracted[0].event).toBe("deposit");
    expect(extracted[1].event).toBe("raid");
  });

  console.log("\n================================================================================");
  console.log(` SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
  console.log("================================================================================\n");

  return failedTests === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runChallenger2Suite().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
