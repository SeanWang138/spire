/**
 * Fast-Forward Simulation Engine & Protocol Math Mirror
 * SpireFi Protocol
 *
 * Satisfies authoritative deterministic requirements:
 * - Adaptive resistance renormalization: input [80, 20, 10] -> [8500, 3114, 1886]
 * - Total resistance invariant: strictly 13500 bps
 * - Resistance clamp: [1000, 8500] bps per element
 * - NPC Merchant bonding curve with 10% two-way spread
 * - Boss damage mitigation & tactical stance multipliers (Aggressive / Feint / Pierce)
 * - Proportional jackpot distribution (90% damage pool / 10% last attack executioner bonus)
 */

export const TOTAL_RESISTANCE_BPS = 13500;
export const MIN_RESISTANCE_BPS = 1000;
export const MAX_RESISTANCE_BPS = 8500;
export const TRIBUTE_THRESHOLD_BPS = 7000;
export const MAX_SHIFT_BPS = 2500;

export const ATTACK_BASE_POWER = 140;
/** Stance damage multipliers in bps: Aggressive / Feint / Pierce. */
export const STANCE_BPS: [number, number, number] = [12000, 10000, 9500];
export const RAND_RANGE: [number, number] = [9000, 11000];
export const FEINT_RANGE: [number, number] = [10000, 11000];
export const PIERCE_RES_CUT_BPS = 1500;
export const FROST_WARD_FLOOR = 2;
export const FROST_ELEMENT = 1;
export const FROST_WARD_BONUS_BPS = 1500;

export const ELEMENT_NAMES = ["Solar", "Frost", "Void"] as const;
export type ElementIndex = 0 | 1 | 2;

export interface ResistanceAnalysis {
  resistance: [number, number, number];
  dominantElement: ElementIndex;
  weakestElement: ElementIndex;
  tributeRisk: boolean;
  tributeRiskElements: boolean[];
  totalBps: number;
}

/**
 * Deterministic Adaptive Resistance Renormalization
 * Renormalizes elemental weapon supplies into boss resistance bps.
 * Input [80, 20, 10] strictly yields [8500, 3114, 1886].
 */
export function calculateAdaptiveResistance(
  supplies: [number, number, number]
): [number, number, number] {
  const totalSupply = supplies[0] + supplies[1] + supplies[2];
  if (totalSupply === 0) {
    return [4500, 4500, 4500];
  }

  // Step 1: Raw proportional allocation
  let res: [number, number, number] = [
    (supplies[0] * TOTAL_RESISTANCE_BPS) / totalSupply,
    (supplies[1] * TOTAL_RESISTANCE_BPS) / totalSupply,
    (supplies[2] * TOTAL_RESISTANCE_BPS) / totalSupply,
  ];

  const fixed = [false, false, false];

  // Step 2: Iterative relaxation clamp
  for (let iter = 0; iter < 3; iter++) {
    let excess = 0;
    let deficit = 0;
    let newlyClamped = false;

    // Upper bound pass
    for (let i = 0; i < 3; i++) {
      if (!fixed[i] && res[i] >= MAX_RESISTANCE_BPS) {
        excess += res[i] - MAX_RESISTANCE_BPS;
        res[i] = MAX_RESISTANCE_BPS;
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
      if (!fixed[i] && res[i] <= MIN_RESISTANCE_BPS) {
        deficit += MIN_RESISTANCE_BPS - res[i];
        res[i] = MIN_RESISTANCE_BPS;
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
  let diff = TOTAL_RESISTANCE_BPS - currentSum;

  if (diff !== 0) {
    // Attempt adjustment on unfixed elements first
    for (let i = 0; i < 3 && diff !== 0; i++) {
      if (!fixed[i] && rounded[i] + diff >= MIN_RESISTANCE_BPS && rounded[i] + diff <= MAX_RESISTANCE_BPS) {
        rounded[i] += diff;
        diff = 0;
        break;
      }
    }

    // Fallback: Adjust any element that will not breach bounds
    if (diff !== 0) {
      for (let i = 0; i < 3 && diff !== 0; i++) {
        const step = diff > 0 ? 1 : -1;
        while (diff !== 0 && rounded[i] + step >= MIN_RESISTANCE_BPS && rounded[i] + step <= MAX_RESISTANCE_BPS) {
          rounded[i] += step;
          diff -= step;
        }
      }
    }
  }

  return rounded;
}

export function analyzeResistance(
  resistance: [number, number, number]
): ResistanceAnalysis {
  let dominant: ElementIndex = 0;
  let weakest: ElementIndex = 0;
  for (let i = 1; i < 3; i++) {
    if (resistance[i] > resistance[dominant]) dominant = i as ElementIndex;
    if (resistance[i] < resistance[weakest]) weakest = i as ElementIndex;
  }

  const tributeRiskElements = [
    resistance[0] >= TRIBUTE_THRESHOLD_BPS,
    resistance[1] >= TRIBUTE_THRESHOLD_BPS,
    resistance[2] >= TRIBUTE_THRESHOLD_BPS,
  ];

  return {
    resistance,
    dominantElement: dominant,
    weakestElement: weakest,
    tributeRisk: tributeRiskElements.some(Boolean),
    tributeRiskElements,
    totalBps: resistance[0] + resistance[1] + resistance[2],
  };
}

/**
 * NPC Merchant Bonding Curve & 10% Dynamic Spread
 */
export interface MerchantQuote {
  buyPriceNear: number;
  sellPriceNear: number;
  spreadBps: number;
  isClosed: boolean;
  stock: number;
  targetStock: number;
}

export function calculateMerchantPrice(
  stock: number,
  targetStock: number = 50,
  basePriceNear: number = 0.5,
  reserveBalanceNear: number = 5.0,
  aiMultiplierBps: number = 10000
): MerchantQuote {
  const isClosed = reserveBalanceNear < 1.0;
  const scarcityFactor = Math.max(0, targetStock - stock) / targetStock;
  const pMid = basePriceNear * (1 + scarcityFactor);
  
  const buyPriceNear = Number(pMid.toFixed(4));
  // 10% spread base: sell price is 90% of buy price, modulated by AI buyback multiplier [10000, 40000] bps
  const buybackRatio = aiMultiplierBps / 10000;
  const sellPriceNear = Number((buyPriceNear * 0.90 * buybackRatio).toFixed(4));
  const spreadBps = Math.round(((buyPriceNear - sellPriceNear) / buyPriceNear) * 10000);

  return {
    buyPriceNear,
    sellPriceNear,
    spreadBps,
    isClosed,
    stock,
    targetStock,
  };
}

/**
 * Boss Combat Damage Calculation & Tactical Stances (ABI v3.1)
 * Stance ids match the contract: 0 aggressive / 1 feint / 2 pierce.
 */
export type TacticalStance = "aggressive" | "feint" | "pierce";

export interface StanceProfile {
  name: string;
  damageMultiplier: number;
  description: string;
}

export const STANCE_PROFILES: Record<TacticalStance, StanceProfile> = {
  aggressive: {
    name: "Aggressive",
    damageMultiplier: 1.2,
    description: "+20% raw strike power. Full tribute exposure at >=7000 bps.",
  },
  feint: {
    name: "Feint",
    damageMultiplier: 1.0,
    description: "Standard power with a tighter 10000–11000 bps damage roll — steadier rounds.",
  },
  pierce: {
    name: "Pierce",
    damageMultiplier: 0.95,
    description: "-5% raw power but cuts the boss's effective resistance by 1500 bps.",
  },
};

export const STANCE_IDS: Record<TacticalStance, 0 | 1 | 2> = {
  aggressive: 0,
  feint: 1,
  pierce: 2,
};

export interface DamageCalculationResult {
  baseDamage: number;
  effectiveDamage: number;
  mitigatedPercent: number;
  isConfiscated: boolean;
  floorModifierPercent: number;
}

/**
 * Mirror of the contract's tower.rs turn_damage for UI projection.
 * Uses midpoint damage rolls (deterministic) — the chain rolls randomness.
 */
export function calculateRaidDamage(
  element: ElementIndex,
  stance: TacticalStance,
  resistanceBps: number,
  floor: number = 1,
  isStarterLocked: boolean = false
): DamageCalculationResult {
  const stanceInfo = STANCE_PROFILES[stance];
  const rawBaseDamage = ATTACK_BASE_POWER;
  const stanceIdx = STANCE_IDS[stance];
  const stanceDamage = (rawBaseDamage * STANCE_BPS[stanceIdx]) / 10000;

  // Damage roll: midpoint of the stance range (9000–11000 / feint 10000–11000).
  const rollRange = stance === "feint" ? FEINT_RANGE : RAND_RANGE;
  const rollMid = (rollRange[0] + rollRange[1]) / 2 / 10000;

  // Floor 2 Frost Ward: +1500 bps effective resistance against Frost strikes.
  let floorModifierPercent = 0;
  if (floor === FROST_WARD_FLOOR && element === FROST_ELEMENT) {
    floorModifierPercent = FROST_WARD_BONUS_BPS / 100; // shown as extra resistance %
  }

  // Pierce cuts effective resistance by 1500 bps.
  let effectiveRes = resistanceBps + (floorModifierPercent * 100);
  if (stance === "pierce") effectiveRes -= PIERCE_RES_CUT_BPS;
  const mitigationRatio = Math.max(0, Math.min(10000, effectiveRes)) / 10000;

  const effectiveDamage = Math.max(
    1,
    Math.round(stanceDamage * rollMid * (1 - mitigationRatio))
  );
  const mitigatedPercent = Number((mitigationRatio * 100).toFixed(2));

  // Tribute confiscation: single on-chain threshold (starter-locked weapons are spared).
  const isConfiscated = !isStarterLocked && resistanceBps >= TRIBUTE_THRESHOLD_BPS;

  return {
    baseDamage: rawBaseDamage,
    effectiveDamage,
    mitigatedPercent,
    isConfiscated,
    floorModifierPercent,
  };
}

/**
 * Jackpot Distribution: 90% Proportional Damage Pool / 10% Last Attack Executioner Bonus
 */
export interface JackpotSplit {
  totalJackpotNear: number;
  lastAttackBountyNear: number;
  proportionalPoolNear: number;
  playerEstimatedPayoutNear: number;
}

export function calculateJackpotSplit(
  totalJackpotNear: number,
  playerDamage: number,
  totalRaidDamage: number,
  isLastAttacker: boolean = false
): JackpotSplit {
  const lastAttackBountyNear = Number((totalJackpotNear * 0.10).toFixed(4));
  const proportionalPoolNear = Number((totalJackpotNear * 0.90).toFixed(4));

  let playerShare = 0;
  if (totalRaidDamage > 0) {
    playerShare = (proportionalPoolNear * playerDamage) / totalRaidDamage;
  }
  if (isLastAttacker) {
    playerShare += lastAttackBountyNear;
  }

  return {
    totalJackpotNear,
    lastAttackBountyNear,
    proportionalPoolNear,
    playerEstimatedPayoutNear: Number(playerShare.toFixed(4)),
  };
}

/**
 * Self-test / Verification vector checker
 * Confirms strict equality for authoritative vector: [80, 20, 10] -> [8500, 3114, 1886]
 */
export function verifyAuthoritativeVector(): boolean {
  const result = calculateAdaptiveResistance([80, 20, 10]);
  return (
    result[0] === 8500 &&
    result[1] === 3114 &&
    result[2] === 1886 &&
    result[0] + result[1] + result[2] === 13500
  );
}
