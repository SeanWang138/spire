/**
 * SpireFi - Mirror Pricing Engine
 *
 * Deterministic mirror of contract math, used to sanity-check keeper decisions:
 * 1. 3-element adaptive resistance renormalization with clamping & conservation
 * 2. NPC merchant mid price with stock & demand pressure, 10% two-way spread
 * 3. Epoch shift cap (MAX_SHIFT_BPS) helper
 * 4. Boss combat damage mitigation & tribute confiscation rules
 * 5. 90/10 proportional jackpot payout distribution
 */

import {
  ResistanceConfig,
  DEFAULT_RESISTANCE_CONFIG,
  MAX_SHIFT_BPS,
  ONE_NEAR_YOCTO,
  TRIBUTE_THRESHOLD_BPS,
  JackpotDistribution,
  Triple,
  BuybackQuote,
} from "./types.js";

/** Boss buyback base price: 0.10 NEAR in yocto (v3.1 ABI BUYBACK_BASE). */
export const BUYBACK_BASE_YOCTO = 100_000_000_000_000_000_000_000n;
export const BUYBACK_MIN_BPS = 10000;
export const BUYBACK_MAX_BPS = 40000;

/**
 * Caps the movement of a single value (resistance bps or buyback bps) and
 * returns the resulting value: current + clamp(target - current, ±maxShift).
 */
export function computeShiftWithCap(
  current: number,
  target: number,
  maxShift: number = MAX_SHIFT_BPS
): number {
  const delta = Math.max(-maxShift, Math.min(maxShift, target - current));
  return current + delta;
}

/**
 * Calculates deterministic 3-element adaptive resistances based on circulating weapon supplies.
 *
 * Algorithmic steps:
 * 1. Allocate raw bps proportionally: raw_i = supplies[i] * totalBps / total_supply.
 * 2. Iterative relaxation clamp:
 *    - Clamp elements exceeding maxBps to maxBps, redistribute excess to unclamped elements.
 *    - Clamp elements below minBps to minBps, deduct deficit from unclamped elements.
 * 3. Round to integers deterministically.
 * 4. Preserve sum invariant: sum(resistances) === totalBps exactly.
 *
 * Passes canonical test vector: [80, 20, 10] -> [8500, 3114, 1886] (total 13500 bps).
 */
export function calculateAdaptiveResistance(
  supplies: [number, number, number],
  config: ResistanceConfig = DEFAULT_RESISTANCE_CONFIG
): [number, number, number] {
  const { totalBps, minBps, maxBps } = config;
  const tot = supplies[0] + supplies[1] + supplies[2];

  if (tot === 0) {
    const base = Math.floor(totalBps / 3);
    const rem = totalBps - base * 2;
    return [base, base, rem];
  }

  // Step 1: Raw proportional allocation
  const res: [number, number, number] = [
    (supplies[0] * totalBps) / tot,
    (supplies[1] * totalBps) / tot,
    (supplies[2] * totalBps) / tot,
  ];

  const fixed = [false, false, false];

  // Step 2: Iterative relaxation clamp
  for (let iter = 0; iter < 3; iter++) {
    let excess = 0;
    let deficit = 0;
    let newlyClamped = false;

    // Upper bound pass
    for (let i = 0; i < 3; i++) {
      if (!fixed[i] && res[i] >= maxBps) {
        excess += res[i] - maxBps;
        res[i] = maxBps;
        fixed[i] = true;
        newlyClamped = true;
      }
    }

    if (newlyClamped && excess > 0) {
      const unfixed = [0, 1, 2].filter((i) => !fixed[i]);
      if (unfixed.length > 0) {
        const share = excess / unfixed.length;
        for (const i of unfixed) {
          res[i] += share;
        }
      }
    }

    // Lower bound pass
    newlyClamped = false;
    for (let i = 0; i < 3; i++) {
      if (!fixed[i] && res[i] <= minBps) {
        deficit += minBps - res[i];
        res[i] = minBps;
        fixed[i] = true;
        newlyClamped = true;
      }
    }

    if (newlyClamped && deficit > 0) {
      const unfixed = [0, 1, 2].filter((i) => !fixed[i]);
      if (unfixed.length > 0) {
        const share = deficit / unfixed.length;
        for (const i of unfixed) {
          res[i] -= share;
        }
      }
    }

    if (!newlyClamped && excess === 0 && deficit === 0) {
      break;
    }
  }

  // Step 3: Deterministic rounding
  const rounded: [number, number, number] = [
    Math.round(res[0]),
    Math.round(res[1]),
    Math.round(res[2]),
  ];

  // Step 4: Strict sum preservation
  const currentSum = rounded[0] + rounded[1] + rounded[2];
  let diff = totalBps - currentSum;

  if (diff !== 0) {
    // Attempt adjustment on unfixed elements first
    for (let i = 0; i < 3 && diff !== 0; i++) {
      if (!fixed[i] && rounded[i] + diff >= minBps && rounded[i] + diff <= maxBps) {
        rounded[i] += diff;
        diff = 0;
        break;
      }
    }

    // Fallback: Adjust any element that will not breach bounds
    if (diff !== 0) {
      for (let i = 0; i < 3 && diff !== 0; i++) {
        const step = diff > 0 ? 1 : -1;
        while (diff !== 0 && rounded[i] + step >= minBps && rounded[i] + step <= maxBps) {
          rounded[i] += step;
          diff -= step;
        }
      }
    }
  }

  return rounded;
}

/** clamp helper for integer bps math */
function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const MERCHANT_TARGET_STOCK = 100;
export const MERCHANT_SPREAD_BPS = 1000; // 10% applied on both sides of mid

export interface MerchantQuoteParams {
  stock: number;
  targetStock?: number;
  basePriceYocto?: bigint | string;
  /** Demand pressure in units (e.g. units bought since the last reprice). */
  demand?: number;
  treasuryReserveYocto?: bigint | string;
}

export interface MerchantQuoteDetail {
  midPriceYocto: bigint;
  /** Price the player pays to buy from the merchant. */
  buyPriceYocto: bigint;
  /** Price the player receives when selling to the merchant. */
  sellPriceYocto: bigint;
  spreadBps: number;
  stockPressureBps: number;
  demandPressureBps: number;
  isClosed: boolean;
  reason: string;
}

/**
 * Merchant mid price mirror:
 *   mid = base * (1 + 0.5 * stock_pressure + 0.3 * demand_pressure), factor clamped to [0.5, 2.0]
 * with stock_pressure = (target - stock) / target and demand_pressure = demand / target (both [0,1]).
 * Spread is 10% on each side: buy = mid * 1.1, sell = mid * 0.9.
 */
export function calculateMerchantQuote(params: MerchantQuoteParams): MerchantQuoteDetail {
  const stock = Math.max(0, params.stock);
  const targetStock = params.targetStock ?? MERCHANT_TARGET_STOCK;
  const basePriceYocto = BigInt(params.basePriceYocto ?? "100000000000000000000000"); // 0.1 NEAR
  const demand = Math.max(0, params.demand ?? 0);
  const treasuryReserveYocto = BigInt(params.treasuryReserveYocto ?? ONE_NEAR_YOCTO * 5n);

  // Stock pressure is signed: scarcity (+), surplus (-), both capped at 100%.
  const stockPressureBps =
    targetStock > 0 ? clampInt(Math.floor(((targetStock - stock) * 10000) / targetStock), -10000, 10000) : 0;
  const demandPressureBps =
    targetStock > 0 ? clampInt(Math.floor((demand * 10000) / targetStock), 0, 10000) : 0;

  // factor in bps: 10000 + 0.5 * stock_pressure + 0.3 * demand_pressure
  const factorBps = clampInt(
    10000 + Math.floor((5000 * stockPressureBps) / 10000) + Math.floor((3000 * demandPressureBps) / 10000),
    5000,
    20000
  );

  const midPriceYocto = (basePriceYocto * BigInt(factorBps)) / 10000n;
  const buyPriceYocto = (midPriceYocto * BigInt(10000 + MERCHANT_SPREAD_BPS)) / 10000n;
  const sellPriceYocto = (midPriceYocto * BigInt(10000 - MERCHANT_SPREAD_BPS)) / 10000n;

  const isClosed = treasuryReserveYocto < ONE_NEAR_YOCTO;

  return {
    midPriceYocto,
    buyPriceYocto,
    sellPriceYocto,
    spreadBps: MERCHANT_SPREAD_BPS,
    stockPressureBps,
    demandPressureBps,
    isClosed,
    reason: isClosed ? "treasury_below_min_reserve" : "ok",
  };
}

/** Convenience wrapper matching the contract's get_quote(item, side, qty) shape. */
export function calculateQuoteForSide(
  params: MerchantQuoteParams,
  side: "buy" | "sell",
  qty: number = 1
): { price: string; reason: string } {
  const quote = calculateMerchantQuote(params);
  const unit = side === "buy" ? quote.buyPriceYocto : quote.sellPriceYocto;
  const reason = quote.isClosed
    ? quote.reason
    : side === "buy" && quote.stockPressureBps >= 10000
      ? "out_of_stock"
      : quote.reason;
  return { price: (unit * BigInt(Math.max(1, qty))).toString(), reason };
}

/**
 * Mirror of the contract's get_buyback_quote(floor, element):
 *   unit = BUYBACK_BASE * buyback_multiplier_bps / 10000 (multiplier clamped to [10000, 40000]).
 * The quote is only fillable while the boss vault covers the total payout.
 */
export function calculateBuybackQuote(params: {
  floor: number;
  element: number;
  /** Per-floor buyback multiplier from get_ai_state(floor).buyback_multiplier_bps[element]. */
  buybackMultiplierBps: number;
  qty?: number;
  /** Current boss vault balance; omit to check pricing only. */
  vaultBalanceYocto?: bigint | string;
}): BuybackQuote {
  const multiplierBps = clampInt(
    Math.floor(Number(params.buybackMultiplierBps)),
    BUYBACK_MIN_BPS,
    BUYBACK_MAX_BPS
  );
  const qty = Math.max(1, Math.floor(params.qty ?? 1));
  const unitPriceYocto = (BUYBACK_BASE_YOCTO * BigInt(multiplierBps)) / 10000n;
  const totalPriceYocto = unitPriceYocto * BigInt(qty);
  const isOpen =
    params.vaultBalanceYocto === undefined
      ? true
      : BigInt(params.vaultBalanceYocto) >= totalPriceYocto;

  return {
    floor: params.floor,
    element: params.element,
    multiplier_bps: multiplierBps,
    qty,
    unit_price_yocto: unitPriceYocto.toString(),
    total_price_yocto: totalPriceYocto.toString(),
    is_open: isOpen,
    reason: isOpen ? "ok" : "vault_below_quote",
  };
}

/**
 * Calculates mitigated combat damage against the tower boss.
 *
 * damage = floor(basePower * (10000 - resistanceBps) / 10000)
 * Clamped to boss current HP if provided.
 */
export function calculateBossDamage(
  basePower: number,
  resistanceBps: number,
  bossHp?: number
): number {
  if (resistanceBps >= 10000) return 0;
  const rawDamage = Math.floor((basePower * (10000 - resistanceBps)) / 10000);
  const positiveDamage = Math.max(0, rawDamage);
  if (bossHp !== undefined) {
    return Math.min(positiveDamage, bossHp);
  }
  return positiveDamage;
}

export interface BossTributeCheckParams {
  weaponElement: number;
  resistanceBps: number;
  isStarterLocked: boolean;
  inventoryCount: number;
}

export interface BossTributeResult {
  tributeTaken: boolean;
  reason: string;
}

/**
 * Evaluates Boss Tribute weapon confiscation rules:
 * - If elemental resistance >= 7000 bps (70%), boss confiscates weapon.
 * - Exemptions: Starter-locked weapons and player's last remaining weapon are protected.
 */
export function checkBossTribute(params: BossTributeCheckParams): BossTributeResult {
  if (params.resistanceBps >= TRIBUTE_THRESHOLD_BPS) {
    if (params.isStarterLocked) {
      return {
        tributeTaken: false,
        reason: "Weapon protected by starter lock immunity",
      };
    }
    if (params.inventoryCount <= 1) {
      return {
        tributeTaken: false,
        reason: "Weapon protected: last remaining weapon in player inventory",
      };
    }
    return {
      tributeTaken: true,
      reason: `Boss tribute claimed: element resistance ${params.resistanceBps} bps >= ${TRIBUTE_THRESHOLD_BPS} bps threshold`,
    };
  }
  return {
    tributeTaken: false,
    reason: `Safe: element resistance ${params.resistanceBps} bps is below tribute threshold`,
  };
}

/**
 * Calculates the 90/10 proportional jackpot payout distribution.
 *
 * - 10% bonus awarded to the killer (last attacker).
 * - 90% proportional pool shared strictly by relative damage dealt.
 */
export function calculateJackpotDistribution(
  totalJackpotYocto: bigint | string,
  totalDamage: number,
  playerDamage: number,
  isKiller: boolean
): JackpotDistribution {
  const totalJackpot = BigInt(totalJackpotYocto);
  if (totalJackpot === 0n) {
    return {
      totalJackpot: 0n,
      lastBonus: 0n,
      proportionalPool: 0n,
      playerShare: 0n,
      totalPayout: 0n,
    };
  }

  const lastBonus = totalJackpot / 10n; // 10%
  const proportionalPool = totalJackpot - lastBonus; // 90%

  let playerShare = 0n;
  if (totalDamage > 0 && playerDamage > 0) {
    playerShare = (proportionalPool * BigInt(playerDamage)) / BigInt(totalDamage);
  }

  const totalPayout = playerShare + (isKiller ? lastBonus : 0n);

  return {
    totalJackpot,
    lastBonus,
    proportionalPool,
    playerShare,
    totalPayout,
  };
}

/**
 * Applies epoch meta shift bounds: restricts resistance shifts per element to MAX_SHIFT_BPS (2500 bps).
 */
export function applyMaxShiftLimit(
  currentResistances: Triple,
  targetResistances: Triple,
  maxShiftBps: number = MAX_SHIFT_BPS
): Triple {
  const bounded: Triple = [0, 0, 0];

  for (let i = 0; i < 3; i++) {
    bounded[i] = computeShiftWithCap(
      currentResistances[i],
      targetResistances[i],
      maxShiftBps
    );
  }

  // Ensure elements stay within [minBps, maxBps]
  for (let i = 0; i < 3; i++) {
    bounded[i] = Math.max(
      DEFAULT_RESISTANCE_CONFIG.minBps,
      Math.min(DEFAULT_RESISTANCE_CONFIG.maxBps, bounded[i])
    );
  }

  // Renormalize to ensure sum remains totalBps (13500) without breaching maxShiftBps
  const currentSum = bounded[0] + bounded[1] + bounded[2];
  let diff = DEFAULT_RESISTANCE_CONFIG.totalBps - currentSum;

  if (diff !== 0) {
    for (let i = 0; i < 3 && diff !== 0; i++) {
      const allowedMax = Math.min(
        DEFAULT_RESISTANCE_CONFIG.maxBps,
        currentResistances[i] + maxShiftBps
      );
      const allowedMin = Math.max(
        DEFAULT_RESISTANCE_CONFIG.minBps,
        currentResistances[i] - maxShiftBps
      );

      if (diff > 0 && bounded[i] < allowedMax) {
        const room = Math.min(diff, allowedMax - bounded[i]);
        bounded[i] += room;
        diff -= room;
      } else if (diff < 0 && bounded[i] > allowedMin) {
        const room = Math.min(-diff, bounded[i] - allowedMin);
        bounded[i] -= room;
        diff += room;
      }
    }
  }

  return bounded;
}
