/**
 * The Spire v3.1 / BossVault Protocol - Reference Protocol Models
 * Authoritative mathematical and interface models derived from ORIGINAL_REQUEST.md & PROJECT.md
 */

export const RESISTANCE_TOTAL_BPS = 13500;
export const RESISTANCE_MIN_CLAMP_BPS = 1000;
export const RESISTANCE_MAX_CLAMP_BPS = 8500;
export const MAX_SHIFT_BPS = 2500;
export const TRIBUTE_THRESHOLD_BPS = 7000;
export const ONE_NEAR_YOCTO = 1_000_000_000_000_000_000_000_000n; // 10^24 yoctoNEAR
export const TICKET_PRICE_YOCTO = 100_000_000_000_000_000_000_000n; // 0.1 NEAR
export const MIN_BUYBACK_BPS = 10000;
export const MAX_BUYBACK_BPS = 40000;

export type ElementType = "solar" | "frost" | "void";
export const ELEMENT_INDEX: Record<ElementType, number> = {
  solar: 0,
  frost: 1,
  void: 2,
};

export const TOKEN_IDS = {
  ORE_IRON: "ore:iron",
  ESSENCE_SOLAR: "essence:solar",
  ESSENCE_FROST: "essence:frost",
  ESSENCE_VOID: "essence:void",
  WEAPON_SOLAR: "weapon:solar",
  WEAPON_FROST: "weapon:frost",
  WEAPON_VOID: "weapon:void",
} as const;

export interface ResistanceConfig {
  totalBps: number;
  minBps: number;
  maxBps: number;
}

export const DEFAULT_RESISTANCE_CONFIG: ResistanceConfig = {
  totalBps: RESISTANCE_TOTAL_BPS,
  minBps: RESISTANCE_MIN_CLAMP_BPS,
  maxBps: RESISTANCE_MAX_CLAMP_BPS,
};

/**
 * Deterministic Adaptive Resistance Renormalization
 * Input: [s0, s1, s2] circulating weapon supplies
 * Passes canonical test vector: [80, 20, 10] -> [8500, 3114, 1886] (total 13500 bps)
 */
export function computeAdaptiveResistance(
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
  let res: [number, number, number] = [
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

    // Upper clamp
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

    // Lower clamp
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

  // Step 3: Rounding
  const rounded: [number, number, number] = [
    Math.round(res[0]),
    Math.round(res[1]),
    Math.round(res[2]),
  ];

  // Step 4: Strict sum preservation
  const currentSum = rounded[0] + rounded[1] + rounded[2];
  let diff = totalBps - currentSum;

  if (diff !== 0) {
    for (let i = 0; i < 3 && diff !== 0; i++) {
      if (!fixed[i] && rounded[i] + diff >= minBps && rounded[i] + diff <= maxBps) {
        rounded[i] += diff;
        diff = 0;
        break;
      }
    }

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

export interface MerchantPriceInput {
  stock: number;
  targetStock?: number;
  basePriceYocto?: bigint | string;
  buybackMultiplierBps?: number;
  treasuryReserveYocto?: bigint | string;
}

export interface MerchantPriceOutput {
  midPriceYocto: bigint;
  buyPriceYocto: bigint;
  sellPriceYocto: bigint;
  stock: number;
  isClosed: boolean;
  spreadBps: number;
}

/**
 * NPC Merchant Bonding Curve & Spread
 */
export function computeMerchantPrice(input: MerchantPriceInput): MerchantPriceOutput {
  const stock = input.stock;
  const targetStock = input.targetStock ?? 100;
  const basePriceYocto = BigInt(input.basePriceYocto ?? "100000000000000000000000"); // 0.1 NEAR
  const buybackMultiplierBps = BigInt(input.buybackMultiplierBps ?? 10000);
  const treasuryReserveYocto = BigInt(input.treasuryReserveYocto ?? ONE_NEAR_YOCTO * 5n);

  let midPriceYocto: bigint;
  if (targetStock > 0 && stock < targetStock) {
    const deficit = BigInt(targetStock - stock);
    midPriceYocto = basePriceYocto + (basePriceYocto * deficit) / BigInt(targetStock);
  } else {
    midPriceYocto = basePriceYocto;
  }

  const buyPriceYocto = midPriceYocto;
  // Sell price = midPrice * 0.90 * (multiplier / 10000)
  const sellPriceYocto = (midPriceYocto * 9000n * buybackMultiplierBps) / (10000n * 10000n);
  const isClosed = treasuryReserveYocto < ONE_NEAR_YOCTO;

  return {
    midPriceYocto,
    buyPriceYocto,
    sellPriceYocto,
    stock,
    isClosed,
    spreadBps: 1000, // 10%
  };
}

export interface BossDamageParams {
  basePower?: number;
  resistanceBps: number;
  floor?: number;
  weaponElement?: number; // 0: solar, 1: frost, 2: void
  stance?: number; // 0: balanced, 1: aggressive (+25%), 2: defensive (-20%)
  bossHp?: number;
}

/**
 * Boss Combat Damage Calculation
 */
export function computeBossDamage(params: BossDamageParams): number {
  const basePower = params.basePower ?? 400;
  const resistanceBps = params.resistanceBps;
  if (resistanceBps >= 10000) return 0;

  let damage = Math.floor((basePower * (10000 - resistanceBps)) / 10000);

  // Floor 2 Frost Ward modifier
  if (params.floor === 2) {
    if (params.weaponElement === 1) {
      // Frost weapon suffers 50% mitigation
      damage = Math.floor(damage * 0.5);
    } else if (params.weaponElement === 0) {
      // Solar weapon gains +25% bonus
      damage = Math.floor(damage * 1.25);
    }
  }

  // Stance modifier
  if (params.stance === 1) {
    // Aggressive
    damage = Math.floor(damage * 1.25);
  } else if (params.stance === 2) {
    // Defensive
    damage = Math.floor(damage * 0.8);
  }

  damage = Math.max(0, damage);
  if (params.bossHp !== undefined) {
    damage = Math.min(damage, params.bossHp);
  }
  return damage;
}

export interface BossTributeParams {
  resistanceBps: number;
  isStarterLocked: boolean;
  totalWeaponsOwned: number;
}

export interface BossTributeResult {
  confiscated: boolean;
  reason: string;
}

/**
 * Boss Tribute Evaluation
 */
export function evaluateBossTribute(params: BossTributeParams): BossTributeResult {
  if (params.resistanceBps >= TRIBUTE_THRESHOLD_BPS) {
    if (params.isStarterLocked) {
      return {
        confiscated: false,
        reason: "Weapon is starter-locked (immune)",
      };
    }
    if (params.totalWeaponsOwned <= 1) {
      return {
        confiscated: false,
        reason: "Last remaining weapon protected (immune)",
      };
    }
    return {
      confiscated: true,
      reason: `Resistance ${params.resistanceBps} bps >= ${TRIBUTE_THRESHOLD_BPS} bps threshold`,
    };
  }
  return {
    confiscated: false,
    reason: "Resistance below tribute threshold",
  };
}

export interface JackpotSettlement {
  totalJackpot: bigint;
  lastBonus: bigint;
  proportionalPool: bigint;
  payouts: Map<string, bigint>;
  totalDistributed: bigint;
  residualReserve: bigint;
}

/**
 * Proportional Jackpot Payout Calculation (90% damage / 10% killer bonus)
 */
export function computeJackpotPayouts(
  jackpotYocto: bigint | string,
  totalDamage: number,
  playerDamageMap: Map<string, number>,
  killerAccountId: string
): JackpotSettlement {
  const totalJackpot = BigInt(jackpotYocto);
  if (totalJackpot === 0n || totalDamage === 0) {
    return {
      totalJackpot: 0n,
      lastBonus: 0n,
      proportionalPool: 0n,
      payouts: new Map(),
      totalDistributed: 0n,
      residualReserve: 0n,
    };
  }

  const lastBonus = totalJackpot / 10n; // 10%
  const proportionalPool = totalJackpot - lastBonus; // 90%
  const payouts = new Map<string, bigint>();
  let totalDistributed = 0n;

  for (const [accountId, dmg] of playerDamageMap.entries()) {
    if (dmg <= 0) {
      payouts.set(accountId, 0n);
      continue;
    }
    const propShare = (proportionalPool * BigInt(dmg)) / BigInt(totalDamage);
    const killerShare = accountId === killerAccountId ? lastBonus : 0n;
    const payout = propShare + killerShare;
    payouts.set(accountId, payout);
    totalDistributed += payout;
  }

  // If killer had 0 damage, killer still gets bonus
  if (!playerDamageMap.has(killerAccountId) || playerDamageMap.get(killerAccountId) === 0) {
    payouts.set(killerAccountId, lastBonus);
    totalDistributed += lastBonus;
  }

  const residualReserve = totalJackpot - totalDistributed;

  return {
    totalJackpot,
    lastBonus,
    proportionalPool,
    payouts,
    totalDistributed,
    residualReserve,
  };
}

/**
 * Floor 3 Enrage Lazy Healing Evaluation
 */
export function computeFloor3EnrageHeal(
  elapsedSeconds: number,
  currentHp: number,
  maxHp: number = 5000
): { healedHp: number; finalHp: number; ticksApplied: number } {
  const intervalSeconds = 300; // 5 minutes
  const ticksApplied = Math.floor(elapsedSeconds / intervalSeconds);
  const healPerTick = Math.floor(maxHp * 0.1); // 10% = 500 HP
  const potentialHeal = ticksApplied * healPerTick;
  const finalHp = Math.min(maxHp, currentHp + potentialHeal);
  const healedHp = finalHp - currentHp;

  return { healedHp, finalHp, ticksApplied };
}

/**
 * Dynamic On-Chain SVG Trophy Generator (NEP-171/177)
 */
export function generateSvgTrophy(params: {
  round: number;
  floor: number;
  killerAccountId: string;
  totalDamage: number;
  jackpotNearFormatted: string;
  dominantElement: ElementType;
}): { tokenId: string; svgContent: string } {
  const tokenId = `spire-trophy-r${params.round}-f${params.floor}`;
  const gradientColors: Record<ElementType, [string, string]> = {
    solar: ["#ff9f43", "#ee5253"],
    frost: ["#4fc3f7", "#0abde3"],
    void: ["#a855f7", "#5f27cd"],
  };

  const [colorStart, colorEnd] = gradientColors[params.dominantElement] || ["#f59e0b", "#d97706"];

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#080B11"/>
      <stop offset="50%" stop-color="#161D33"/>
      <stop offset="100%" stop-color="${colorEnd}" stop-opacity="0.3"/>
    </linearGradient>
    <linearGradient id="elemGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${colorStart}"/>
      <stop offset="100%" stop-color="${colorEnd}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="800" rx="24" fill="url(#bgGrad)" stroke="${colorStart}" stroke-width="4"/>
  <circle cx="300" cy="240" r="140" fill="none" stroke="url(#elemGrad)" stroke-width="6" opacity="0.8"/>
  <polygon points="300,120 380,280 220,280" fill="${colorStart}" opacity="0.4"/>
  <text x="300" y="440" font-family="monospace" font-size="32" font-weight="bold" fill="#FFFFFF" text-anchor="middle">THE SPIRE CONQUEROR</text>
  <text x="300" y="480" font-family="monospace" font-size="20" fill="${colorStart}" text-anchor="middle">FLOOR ${params.floor} APEX DEFEATED</text>
  <line x1="100" y1="520" x2="500" y2="520" stroke="#FFFFFF" stroke-opacity="0.2" stroke-width="2"/>
  <text x="120" y="560" font-family="monospace" font-size="16" fill="#94A3B8">CHAMPION:</text>
  <text x="480" y="560" font-family="monospace" font-size="16" font-weight="bold" fill="#FFFFFF" text-anchor="end">${params.killerAccountId}</text>
  <text x="120" y="600" font-family="monospace" font-size="16" fill="#94A3B8">ROUND / FLOOR:</text>
  <text x="480" y="600" font-family="monospace" font-size="16" font-weight="bold" fill="#FFFFFF" text-anchor="end">R${params.round} / F${params.floor}</text>
  <text x="120" y="640" font-family="monospace" font-size="16" fill="#94A3B8">TOTAL DAMAGE:</text>
  <text x="480" y="640" font-family="monospace" font-size="16" font-weight="bold" fill="#FFFFFF" text-anchor="end">${params.totalDamage}</text>
  <text x="120" y="680" font-family="monospace" font-size="16" fill="#94A3B8">JACKPOT AWARD:</text>
  <text x="480" y="680" font-family="monospace" font-size="16" font-weight="bold" fill="#00EC97" text-anchor="end">${params.jackpotNearFormatted} NEAR</text>
  <text x="300" y="750" font-family="monospace" font-size="14" fill="#64748B" text-anchor="middle">BossVault Protocol v3.1 NEP-171/177</text>
</svg>`;

  return { tokenId, svgContent };
}

/**
 * AI Proposal Validation Model
 */
export function validateAiProposal(
  currentResistance: [number, number, number],
  proposal: {
    epoch: number;
    target_resistances: [number, number, number];
    buyback_multiplier_bps: number;
    nonce: number;
  },
  lastNonce: number
): { valid: boolean; error?: string } {
  if (proposal.nonce <= lastNonce) {
    return { valid: false, error: "E_REPLAY_DETECTED" };
  }
  if (
    proposal.buyback_multiplier_bps < MIN_BUYBACK_BPS ||
    proposal.buyback_multiplier_bps > MAX_BUYBACK_BPS
  ) {
    return { valid: false, error: "E_INVALID_BUYBACK_MULTIPLIER" };
  }
  const sum =
    proposal.target_resistances[0] +
    proposal.target_resistances[1] +
    proposal.target_resistances[2];
  if (sum !== RESISTANCE_TOTAL_BPS) {
    return { valid: false, error: "E_INVALID_RESISTANCE_SUM" };
  }
  for (let i = 0; i < 3; i++) {
    const val = proposal.target_resistances[i];
    if (val < RESISTANCE_MIN_CLAMP_BPS || val > RESISTANCE_MAX_CLAMP_BPS) {
      return { valid: false, error: "E_RESISTANCE_OUT_OF_BOUNDS" };
    }
    const shift = Math.abs(val - currentResistance[i]);
    if (shift > MAX_SHIFT_BPS) {
      return { valid: false, error: "E_EXCEEDS_MAX_SHIFT" };
    }
  }
  return { valid: true };
}

/**
 * NEP-297 EVENT_JSON Parser and Validator
 */
export function parseEventJson(logLine: string): {
  isEvent: boolean;
  standard?: string;
  version?: string;
  event?: string;
  data?: any[];
} {
  const prefix = "EVENT_JSON:";
  if (!logLine.startsWith(prefix)) {
    return { isEvent: false };
  }
  try {
    const jsonStr = logLine.substring(prefix.length).trim();
    const parsed = JSON.parse(jsonStr);
    if (!parsed.standard || !parsed.version || !parsed.event || !Array.isArray(parsed.data)) {
      return { isEvent: false };
    }
    return {
      isEvent: true,
      standard: parsed.standard,
      version: parsed.version,
      event: parsed.event,
      data: parsed.data,
    };
  } catch {
    return { isEvent: false };
  }
}

/**
 * Simulated Internal Ledger Vault
 */
export class SimulatedLedger {
  private balances = new Map<string, bigint>();

  deposit(account: string, amount: bigint): void {
    if (amount <= 0n) throw new Error("E_ZERO_DEPOSIT");
    const cur = this.balances.get(account) ?? 0n;
    this.balances.set(account, cur + amount);
  }

  withdraw(account: string, amount: bigint): bigint {
    const cur = this.balances.get(account) ?? 0n;
    if (cur < amount) throw new Error("E_INSUFFICIENT_BALANCE");
    this.balances.set(account, cur - amount);
    return amount;
  }

  debit(account: string, amount: bigint): void {
    const cur = this.balances.get(account) ?? 0n;
    if (cur < amount) throw new Error("E_INSUFFICIENT_BALANCE");
    this.balances.set(account, cur - amount);
  }

  credit(account: string, amount: bigint): void {
    const cur = this.balances.get(account) ?? 0n;
    this.balances.set(account, cur + amount);
  }

  getBalance(account: string): bigint {
    return this.balances.get(account) ?? 0n;
  }
}

/**
 * Simulated Multi-Token NEP-245 Inventory & Crafting
 */
export class SimulatedInventory {
  // (account:tokenId) -> count
  private balances = new Map<string, number>();
  // global weapon supply [solar, frost, void]
  public weaponSupply: [number, number, number] = [0, 0, 0];

  getBalance(account: string, tokenId: string): number {
    return this.balances.get(`${account}:${tokenId}`) ?? 0;
  }

  setBalance(account: string, tokenId: string, amount: number): void {
    this.balances.set(`${account}:${tokenId}`, amount);
  }

  addBalance(account: string, tokenId: string, amount: number): void {
    const cur = this.getBalance(account, tokenId);
    this.balances.set(`${account}:${tokenId}`, cur + amount);
  }

  subtractBalance(account: string, tokenId: string, amount: number): void {
    const cur = this.getBalance(account, tokenId);
    if (cur < amount) throw new Error("E_INSUFFICIENT_TOKENS");
    this.balances.set(`${account}:${tokenId}`, cur - amount);
  }

  craft(account: string, weaponType: ElementType): void {
    const ironCount = this.getBalance(account, TOKEN_IDS.ORE_IRON);
    const essenceId =
      weaponType === "solar"
        ? TOKEN_IDS.ESSENCE_SOLAR
        : weaponType === "frost"
        ? TOKEN_IDS.ESSENCE_FROST
        : TOKEN_IDS.ESSENCE_VOID;
    const essenceCount = this.getBalance(account, essenceId);

    if (ironCount < 2 || essenceCount < 1) {
      throw new Error("E_INSUFFICIENT_MATERIALS");
    }

    this.subtractBalance(account, TOKEN_IDS.ORE_IRON, 2);
    this.subtractBalance(account, essenceId, 1);

    const weaponId =
      weaponType === "solar"
        ? TOKEN_IDS.WEAPON_SOLAR
        : weaponType === "frost"
        ? TOKEN_IDS.WEAPON_FROST
        : TOKEN_IDS.WEAPON_VOID;

    this.addBalance(account, weaponId, 1);
    this.weaponSupply[ELEMENT_INDEX[weaponType]]++;
  }

  reforge(account: string, burnElement: ElementType, targetElement: ElementType): void {
    if (burnElement === targetElement) throw new Error("E_SAME_ELEMENT");
    const burnWeaponId =
      burnElement === "solar"
        ? TOKEN_IDS.WEAPON_SOLAR
        : burnElement === "frost"
        ? TOKEN_IDS.WEAPON_FROST
        : TOKEN_IDS.WEAPON_VOID;
    const burnCount = this.getBalance(account, burnWeaponId);
    if (burnCount < 2) throw new Error("E_INSUFFICIENT_WEAPONS");

    this.subtractBalance(account, burnWeaponId, 2);
    this.weaponSupply[ELEMENT_INDEX[burnElement]] -= 2;

    const targetWeaponId =
      targetElement === "solar"
        ? TOKEN_IDS.WEAPON_SOLAR
        : targetElement === "frost"
        ? TOKEN_IDS.WEAPON_FROST
        : TOKEN_IDS.WEAPON_VOID;

    this.addBalance(account, targetWeaponId, 1);
    this.weaponSupply[ELEMENT_INDEX[targetElement]] += 1;
  }

  getTotalWeapons(account: string): number {
    return (
      this.getBalance(account, TOKEN_IDS.WEAPON_SOLAR) +
      this.getBalance(account, TOKEN_IDS.WEAPON_FROST) +
      this.getBalance(account, TOKEN_IDS.WEAPON_VOID)
    );
  }
}
