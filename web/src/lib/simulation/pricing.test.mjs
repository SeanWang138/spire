import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(SRC_ROOT, "../..");
const requireFromTest = createRequire(import.meta.url);
const moduleCache = new Map();

/**
 * Minimal in-memory TypeScript CJS loader using repo's `typescript` dependency
 * so Node's built-in test runner can execute web/src/lib modules without extra tooling.
 */
function loadTsModule(absolutePath) {
  const normalized = path.resolve(absolutePath);
  if (moduleCache.has(normalized)) {
    return moduleCache.get(normalized).exports;
  }

  const tsCode = fs.readFileSync(normalized, "utf8");
  const jsCode = ts.transpileModule(tsCode, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const mod = { exports: {} };
  moduleCache.set(normalized, mod);

  const localRequire = (specifier) => {
    let targetPath = null;
    if (specifier.startsWith("@/")) {
      targetPath = path.join(SRC_ROOT, specifier.slice(2));
    } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
      targetPath = path.resolve(path.dirname(normalized), specifier);
    }

    if (targetPath) {
      const candidates = [
        targetPath,
        `${targetPath}.ts`,
        `${targetPath}.tsx`,
        path.join(targetPath, "index.ts"),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return loadTsModule(candidate);
        }
      }
    }
    return requireFromTest(specifier);
  };

  const fn = new Function("exports", "require", "module", "__filename", "__dirname", jsCode);
  fn(mod.exports, localRequire, mod, normalized, path.dirname(normalized));
  return mod.exports;
}

const pricing = loadTsModule(path.join(SRC_ROOT, "lib/simulation/pricing.ts"));
const cn = loadTsModule(path.join(SRC_ROOT, "lib/utils/cn.ts"));
const constants = loadTsModule(path.join(SRC_ROOT, "lib/spire/constants.ts"));

// --- Adaptive Resistance (MUST remain unchanged) ---

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

// --- NPC Merchant Bonding Curve (contract/src/merchant.rs parity) ---

test("NPC Merchant: 0.05 NEAR equilibrium at target 100 & ±10% spread", () => {
  const quote = pricing.calculateMerchantPrice(100);
  assert.equal(quote.targetStock, 100);
  assert.equal(quote.midPriceNear, 0.05);
  assert.equal(quote.buyPriceNear, 0.055);
  assert.equal(quote.sellPriceNear, 0.045);
  assert.equal(quote.spreadBps, 1000);
  assert.equal(quote.isClosed, false);
});

test("NPC Merchant: signed stock pressure discounts surplus > 100 & raises scarce < 100", () => {
  const surplus = pricing.calculateMerchantPrice(300, 100, 0.05, 5.0, 0);
  assert.equal(surplus.midPriceNear, 0.025);
  assert.equal(surplus.buyPriceNear, 0.0275);
  assert.equal(surplus.sellPriceNear, 0.0225);

  const scarce = pricing.calculateMerchantPrice(0, 100, 0.05, 5.0, 0);
  assert.equal(scarce.midPriceNear, 0.075);
  assert.equal(scarce.buyPriceNear, 0.0825);
  assert.equal(scarce.sellPriceNear, 0.0675);
});

test("NPC Merchant: demand pressure & closure below 1.0 NEAR", () => {
  const withDemand = pricing.calculateMerchantPrice(100, 100, 0.05, 5.0, 100);
  assert.equal(withDemand.midPriceNear, 0.065);
  assert.equal(withDemand.buyPriceNear, 0.0715);
  assert.equal(withDemand.sellPriceNear, 0.0585);
  assert.equal(withDemand.isClosed, false);

  const closed = pricing.calculateMerchantPrice(100, 100, 0.05, 0.8, 0);
  assert.equal(closed.isClosed, true);
});

test("NPC Merchant: full parity against relayer/merchant_vectors.json", () => {
  const vectorsPath = path.join(REPO_ROOT, "relayer/merchant_vectors.json");
  const vectorsDoc = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));
  const baseNear = Number(cn.parseYoctoSafe(vectorsDoc.merchant_base_price_yocto)) / 1e24;

  for (const vec of vectorsDoc.merchant) {
    const reserveYocto = cn.parseYoctoSafe(vec.reserve_yocto);
    // Preserve sub-1.0 NEAR distinction against IEEE-754 float64 rounding (e.g., 10^24 - 1 yocto).
    const reserveNear =
      reserveYocto < 10n ** 24n
        ? Math.min(0.999999999, Number(reserveYocto) / 1e24)
        : Number(reserveYocto) / 1e24;
    const quote = pricing.calculateMerchantPrice(
      vec.stock,
      vec.target_stock,
      baseNear,
      reserveNear,
      vec.demand
    );
    const expectedMid = Number(cn.parseYoctoSafe(vec.expected.midPriceYocto)) / 1e24;
    const expectedBuy = Number(cn.parseYoctoSafe(vec.expected.buyPriceYocto)) / 1e24;
    const expectedSell = Number(cn.parseYoctoSafe(vec.expected.sellPriceYocto)) / 1e24;

    assert.equal(quote.midPriceNear, Number(expectedMid.toFixed(6)), `${vec.name} mid`);
    assert.equal(quote.buyPriceNear, Number(expectedBuy.toFixed(6)), `${vec.name} buy`);
    assert.equal(quote.sellPriceNear, Number(expectedSell.toFixed(6)), `${vec.name} sell`);
    assert.equal(quote.isClosed, vec.expected.isClosed, `${vec.name} isClosed`);
  }
});

// --- Scientific-notation Yocto Parser & Constants ---

test("parseYoctoSafe, formatNearAmount, and yoctoToNear handle scientific notation & invalid values safely", () => {
  assert.equal(cn.parseYoctoSafe("2.3683e+24"), 2368300000000000000000000n);
  assert.equal(cn.parseYoctoSafe("5.7e+22"), 57000000000000000000000n);
  assert.equal(cn.parseYoctoSafe("4e+22"), 40000000000000000000000n);
  assert.equal(cn.parseYoctoSafe(4e22), 40000000000000000000000n);
  assert.equal(cn.parseYoctoSafe("123.45"), 123n);
  assert.equal(cn.parseYoctoSafe(500n), 500n);
  assert.equal(cn.parseYoctoSafe(null), 0n);
  assert.equal(cn.parseYoctoSafe(undefined), 0n);
  assert.equal(cn.parseYoctoSafe(""), 0n);
  assert.equal(cn.parseYoctoSafe("not-a-number"), 0n);
  assert.equal(cn.parseYoctoSafe(Number.NaN), 0n);

  assert.equal(cn.formatNearAmount("2.3683e+24", 4), "2.3683 NEAR");
  assert.equal(cn.formatNearAmount("5.7e+22", 3), "0.057 NEAR");
  assert.equal(cn.formatNearAmount("invalid"), "0.00 NEAR");

  assert.equal(constants.yoctoToNear("2.3683e+24"), 2.3683);
  assert.equal(constants.yoctoToNear("invalid"), 0);
});

test("Protocol constants match live spire.testnet ABI (Jalur A)", () => {
  assert.equal(constants.MERCHANT_BASE_PRICE_NEAR, 0.05);
  assert.equal(constants.BACKER_SHARE_UNIT_NEAR, 1e-8);
  assert.equal(constants.FROST_WARD_BONUS_BPS, 1500);
  assert.deepEqual(constants.FLOOR_MAX_HP, [1000, 1600, 2500]);
  assert.deepEqual(constants.FLOOR_TICKET_COST_NEAR, [0.1, 0.15, 0.25]);
});

// --- Combat Damage & Jackpot Split ---

test("Boss Damage & Stances (v3.1: Aggressive / Feint / Pierce)", () => {
  const dmgAgg = pricing.calculateRaidDamage(0, "aggressive", 5000, 1, false);
  assert.equal(dmgAgg.isConfiscated, false);
  assert.ok(dmgAgg.effectiveDamage > 0);

  const dmgConfiscated = pricing.calculateRaidDamage(0, "aggressive", 8500, 1, false);
  assert.equal(dmgConfiscated.isConfiscated, true);

  const dmgProtected = pricing.calculateRaidDamage(0, "aggressive", 8500, 1, true);
  assert.equal(dmgProtected.isConfiscated, false);

  const dmgPierce = pricing.calculateRaidDamage(2, "pierce", 7000, 1, false);
  const dmgFeint = pricing.calculateRaidDamage(2, "feint", 7000, 1, false);
  assert.ok(dmgPierce.effectiveDamage > dmgFeint.effectiveDamage);

  const frostF1 = pricing.calculateRaidDamage(1, "feint", 3000, 1, false);
  const frostF2 = pricing.calculateRaidDamage(1, "feint", 3000, 2, false);
  assert.ok(frostF2.effectiveDamage < frostF1.effectiveDamage);
});

test("Jackpot Split: 90% Proportional / 10% Last Attack Executioner", () => {
  const split = pricing.calculateJackpotSplit(100, 200, 1000, false);
  assert.equal(split.totalJackpotNear, 100);
  assert.equal(split.lastAttackBountyNear, 10);
  assert.equal(split.proportionalPoolNear, 90);
  assert.equal(split.playerEstimatedPayoutNear, 18);

  const splitWinner = pricing.calculateJackpotSplit(100, 200, 1000, true);
  assert.equal(splitWinner.playerEstimatedPayoutNear, 28);
});

// --- Combat Rules (Wave 2 helpers) ---

test("combat-rules: effective resistances, free weapon counts, and 4 tribute tiers", () => {
  const combatRules = loadTsModule(path.join(SRC_ROOT, "lib/combat-rules.ts"));

  assert.deepEqual(combatRules.getEffectiveResistances([4000, 6000, 3500], 1), [4000, 6000, 3500]);
  assert.deepEqual(combatRules.getEffectiveResistances([4000, 6000, 3500], 2), [4000, 7500, 3500]);
  assert.deepEqual(combatRules.getEffectiveResistances([4000, 6000, 3500], 3), [4000, 6000, 3500]);

  assert.deepEqual(combatRules.getFreeWeaponCounts([7, 1, 0], [4, 1, 0]), [3, 0, 0]);
  assert.deepEqual(combatRules.getFreeWeaponCounts([1, 0, 2], [4, 1, 0]), [0, 0, 2]);

  const safeWard = combatRules.getWeaponTributeStatus({
    total: 5,
    free: 1,
    isOnlyWeapon: false,
    effectiveResBps: 6999,
    stance: "aggressive",
  });
  assert.equal(safeWard.tier, "safe-below-ward");
  assert.equal(safeWard.atRisk, false);

  const starterSafe = combatRules.getWeaponTributeStatus({
    total: 4,
    free: 0,
    isOnlyWeapon: false,
    effectiveResBps: 8500,
    stance: "aggressive",
  });
  assert.equal(starterSafe.tier, "starter-safe");
  assert.equal(starterSafe.atRisk, false);

  const lastSafe = combatRules.getWeaponTributeStatus({
    total: 1,
    free: 1,
    isOnlyWeapon: true,
    effectiveResBps: 8500,
    stance: "feint",
  });
  assert.equal(lastSafe.tier, "last-weapon-safe");
  assert.equal(lastSafe.atRisk, false);

  const risk = combatRules.getWeaponTributeStatus({
    total: 5,
    free: 1,
    isOnlyWeapon: false,
    effectiveResBps: 7500,
    stance: "pierce",
  });
  assert.equal(risk.tier, "tribute-risk");
  assert.equal(risk.atRisk, true);
  assert.ok(risk.label.length > 0 && risk.detail.length > 0);
});

// --- Merchant Reasoning (Wave 2 helper) ---

test("merchant-reasoning: concise economic reasoning and never literal 'ok'", () => {
  const reasoning = loadTsModule(path.join(SRC_ROOT, "lib/merchant-reasoning.ts"));

  const msg = reasoning.explainMerchantQuote({
    itemId: "ore:iron",
    side: "buy",
    stock: 100,
    demand: 0,
    cashNear: 5.0,
    unitPriceNear: 0.055,
    basePriceNear: 0.05,
    rawReason: "ok",
  });
  assert.notEqual(msg.trim().toLowerCase(), "ok");
  assert.match(msg, /0\.05 NEAR/);
  assert.match(msg, /100\/100/);
  assert.match(msg, /10%/);
  assert.match(msg, /1\.00 NEAR|1\.0 NEAR/);

  const closedMsg = reasoning.explainMerchantQuote({
    itemId: "essence:solar",
    side: "sell",
    stock: 160,
    demand: 10,
    cashNear: 0.75,
    unitPriceNear: 0.0315,
    basePriceNear: 0.05,
    rawReason: "shop_closed",
  });
  assert.notEqual(closedMsg.trim().toLowerCase(), "ok");
  assert.match(closedMsg, /closed|paused/i);
  assert.match(closedMsg, /1\.00 NEAR|1\.0 NEAR/);
});

// --- NEAR Session & Contract Client Honesty ---

test("near.ts: SessionData uses 0.6 NEAR ephemeral-full-access mode", () => {
  const nearMod = loadTsModule(path.join(SRC_ROOT, "lib/near.ts"));
  const store = new Map();
  const prevWindow = globalThis.window;
  const prevStorage = globalThis.localStorage;
  globalThis.window = { dispatchEvent: () => true };
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };

  try {
    const sess = nearMod.SessionManager.getInstance().createSession("hero.spire.testnet");
    assert.equal(sess.allowanceNear, 0.6);
    assert.equal(sess.keyMode, "ephemeral-full-access");
  } finally {
    globalThis.window = prevWindow;
    globalThis.localStorage = prevStorage;
  }
});

test("contract.ts: throws RpcUnavailableError on RPC failure, rejects weapon:*, deprecates resolve_expired, checks apply_ai_proposal", async () => {
  const contract = loadTsModule(path.join(SRC_ROOT, "lib/contract.ts"));
  const prevFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("ECONNREFUSED");
  };

  try {
    await assert.rejects(
      () => contract.get_tower(),
      (err) => err instanceof contract.RpcUnavailableError && err.message.includes("VIEW_UNAVAILABLE")
    );
    assert.ok(fetchCalls >= 1);

    await assert.rejects(
      () => contract.resolve_expired(1),
      /resolve_expired does not exist on live contract/
    );

    const callsBeforeWeapon = fetchCalls;
    await assert.rejects(() => contract.get_quote("weapon:solar", "buy", 1), /E_INVALID_ARGS/);
    await assert.rejects(() => contract.buy_from_merchant("weapon:frost", 1), /E_INVALID_ARGS/);
    await assert.rejects(() => contract.sell_to_merchant("weapon:void", 1), /E_INVALID_ARGS/);
    assert.equal(fetchCalls, callsBeforeWeapon, "weapon:* must be rejected before RPC/session");

    const sig = new Array(64).fill(7);
    await assert.rejects(
      () =>
        contract.apply_ai_proposal(
          1,
          {
            floor: 1,
            epoch: 1,
            buyback_multiplier_bps: [10000, 10000, 10000],
            altar_recipe_id: null,
            taunt: null,
            nonce: 1,
          },
          null,
          sig
        ),
      /0-indexed|floor/i
    );

    await assert.rejects(
      () =>
        contract.apply_ai_proposal(
          1,
          {
            floor: 0,
            epoch: 1,
            buyback_multiplier_bps: [10000, 10000, 10000],
            altar_recipe_id: null,
            taunt: null,
            nonce: 1,
          },
          null,
          sig
        ),
      /E_NO_SESSION/
    );
  } finally {
    globalThis.fetch = prevFetch;
  }
});
