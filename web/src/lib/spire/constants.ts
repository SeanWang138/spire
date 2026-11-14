/**
 * SpireFi v3.1 — shared protocol constants (mirror of contract/src/types.rs).
 * Every gameplay number the UI displays comes from here so the web client and
 * the on-chain contract can never drift apart.
 */

// --- Elements / tokens ---------------------------------------------------

export const ELEMENT_NAMES = ["Solar", "Frost", "Void"] as const;

export const TOKEN_ORE_IRON = "ore:iron";
export const TOKEN_ESSENCE_SOLAR = "essence:solar";
export const TOKEN_ESSENCE_FROST = "essence:frost";
export const TOKEN_ESSENCE_VOID = "essence:void";
export const TOKEN_WEAPON_SOLAR = "weapon:solar";
export const TOKEN_WEAPON_FROST = "weapon:frost";
export const TOKEN_WEAPON_VOID = "weapon:void";

export const MATERIAL_TOKENS = [
  TOKEN_ORE_IRON,
  TOKEN_ESSENCE_SOLAR,
  TOKEN_ESSENCE_FROST,
  TOKEN_ESSENCE_VOID,
] as const;

export const WEAPON_TOKENS = [
  TOKEN_WEAPON_SOLAR,
  TOKEN_WEAPON_FROST,
  TOKEN_WEAPON_VOID,
] as const;

// --- Tower floors ----------------------------------------------------------

export const FLOOR_COUNT = 3;
/** Boss HP per floor (index 0 = floor 1). */
export const FLOOR_MAX_HP: [number, number, number] = [1000, 1600, 2500];
/** Raid ticket cost per floor, whole NEAR (index 0 = floor 1). */
export const FLOOR_TICKET_COST_NEAR: [number, number, number] = [0.1, 0.15, 0.25];
/** Floor deadline (ns) from the first attack; 0 = no deadline (floor 1). */
export const DEFAULT_FLOOR_DEADLINE_NS: [number, number, number] = [
  0,
  1_800_000_000_000,
  1_200_000_000_000,
];

/** Floor 2 applies Frost Ward (+1500 bps effective resistance vs Frost). */
export const FROST_WARD_FLOOR = 2;
export const FROST_ELEMENT = 1;
export const FROST_WARD_BONUS_BPS = 1500;

/** Floor 3 is the Enrage floor: +10% max HP regen per 5 minutes. */
export const ENRAGE_FLOOR = 3;
export const ENRAGE_INTERVAL_NS = 300_000_000_000;
export const ENRAGE_HEAL_BPS = 1000;

/** 10% of the jackpot drips to the next floor when a boss falls. */
export const FLOOR_DRIP_BPS = 1000;
/** 10% of the post-drip pool goes to the last attacker. */
export const LAST_BONUS_BPS = 1000;

// --- Combat ----------------------------------------------------------------

export const ATTACK_BASE_POWER = 140;
/** Stance damage multipliers in bps: Aggressive / Feint / Pierce. */
export const STANCE_BPS: [number, number, number] = [12000, 10000, 9500];
/** Random damage roll bounds (bps of the stance-adjusted strike). */
export const RAND_RANGE: [number, number] = [9000, 11000];
/** Feint roll bounds — feint trades power for variance protection. */
export const FEINT_RANGE: [number, number] = [10000, 11000];
/** Pierce cuts the boss's effective resistance by 1500 bps. */
export const PIERCE_RES_CUT_BPS = 1500;

export const STANCE_IDS = { aggressive: 0, feint: 1, pierce: 2 } as const;

// --- Adaptive resistance -----------------------------------------------------

export const EPOCH_DURATION_NS = 3_600_000_000_000; // 1 hour per epoch
export const RESISTANCE_TOTAL_BPS = 13500;
export const RESISTANCE_MIN_CLAMP = 1000;
export const RESISTANCE_MAX_CLAMP = 8500;
export const RESISTANCE_NEUTRAL: [number, number, number] = [4500, 4500, 4500];
export const MAX_SHIFT_BPS = 2500;
export const TRIBUTE_THRESHOLD_BPS = 7000;

// --- Economy splits ----------------------------------------------------------

/** Ticket split: 70% jackpot / 15% backer dividends / 10% buyback / 5% merchant. */
export const SPLIT_JACKPOT_BPS = 7000;
export const SPLIT_BACKER_BPS = 1500;
export const SPLIT_BUYBACK_BPS = 1000;
export const SPLIT_MERCHANT_BPS = 500;

/**
 * Live contract `BACKER_SHARE_UNIT = 10_000_000_000_000_000` yoctoNEAR (1e16 = 10^-8 NEAR)
 * in `contract/src/types.rs:75` (Jalur A ABI freeze on spire.testnet).
 */
export const BACKER_SHARE_UNIT_NEAR = 1e-8;
export const DIVIDEND_SCALE = 1_000_000;

// --- Starter kit / gathering -------------------------------------------------

/** Starter weapons: 4x solar / 1x frost / 0x void. */
export const STARTER_WEAPONS: [number, number, number] = [4, 1, 0];
export const STARTER_ORE = 4;
export const STARTER_ESSENCE = 3;

export const GATHER_AMOUNT = 2;
export const GATHER_COOLDOWN_NS = 30_000_000_000; // 30 s
export const GATHER_EPOCH_CAP = 20; // units per account per epoch

export const CRAFT_ORE_COST = 2;
export const CRAFT_ESSENCE_COST = 3;

// --- Altar recipes (AI-activated reforge plans) -------------------------------

export const ALTAR_RECIPE_2_TO_1 = "reforge_2_to_1";
export const ALTAR_RECIPE_3_TO_2 = "reforge_3_to_2";
/** Source element must hold >= 50% of weapon supply for a reforge. */
export const REFORGE_SHARE_MIN_BPS = 5000;

// --- NPC merchant -------------------------------------------------------------

export const MERCHANT_BASE_PRICE_NEAR = 0.05;
export const MERCHANT_TARGET_STOCK = 100;
export const MERCHANT_SPREAD_BPS = 1000; // 10% two-way spread
export const MERCHANT_STOCK_PRESSURE_WEIGHT_BPS = 5000;
export const MERCHANT_DEMAND_WEIGHT_BPS = 3000;
export const MERCHANT_MIN_CASH_NEAR = 1.0;
export const MERCHANT_CAP_PER_ITEM_EPOCH = 40;

// --- Boss buyback -------------------------------------------------------------

export const BUYBACK_BASE_NEAR = 0.1;
export const BUYBACK_MIN_BPS = 10000;
export const BUYBACK_MAX_BPS = 40000;
export const BUYBACK_MAX_PER_FLOOR_EPOCH = 5;
export const BUYBACK_MAX_PER_ACCOUNT_EPOCH = 2;

// --- Misc -----------------------------------------------------------------------

export const YOCTO_PER_NEAR = 1e24;

/**
 * Safely parses integer, decimal, or scientific-notation yoctoNEAR values
 * (e.g. "2.3683e+24", "5.7e+22", "4e+22") into bigint. Returns 0n on null,
 * undefined, non-finite numbers, or malformed strings without throwing SyntaxError.
 */
export function parseYoctoSafe(
  value: string | number | bigint | null | undefined
): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;

  let raw: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    raw = String(value);
  } else if (typeof value === "string") {
    raw = value.trim();
  } else {
    return 0n;
  }

  if (!raw) return 0n;

  const match =
    /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match) return 0n;

  const sign = match[1] === "-" ? "-" : "";
  const intPart = match[2] ?? "";
  const fracPart = match[3] ?? match[4] ?? "";
  const exp = match[5] !== undefined ? Number.parseInt(match[5], 10) : 0;
  if (!Number.isSafeInteger(exp)) return 0n;

  const digits = intPart + fracPart;
  if (!digits || /^0+$/.test(digits)) return 0n;

  const shift = exp - fracPart.length;
  if (!Number.isSafeInteger(shift) || shift > 10000) return 0n;

  let integerDigits: string;
  if (shift >= 0) {
    integerDigits = digits + "0".repeat(shift);
  } else {
    const cut = digits.length + shift;
    if (cut <= 0) return 0n;
    integerDigits = digits.slice(0, cut);
  }

  const normalized = integerDigits.replace(/^0+/, "") || "0";
  if (normalized === "0") return 0n;

  try {
    return BigInt(sign + normalized);
  } catch {
    return 0n;
  }
}

/** Whole NEAR → yoctoNEAR string (no floats beyond the given precision). */
export function nearToYocto(near: number): string {
  const fixed = near.toFixed(24).replace(".", "");
  return fixed.replace(/^0+(?=\d)/, "") || "0";
}

/** yoctoNEAR string/number/bigint → whole NEAR (display float). */
export function yoctoToNear(
  yocto: string | number | bigint | null | undefined
): number {
  return Number(parseYoctoSafe(yocto)) / YOCTO_PER_NEAR;
}
