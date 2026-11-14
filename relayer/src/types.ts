/**
 * SpireFi - Relayer Core Types (contract ABI v3.1)
 *
 * Mirrors the on-chain view/change surface the relayer talks to.
 * Numeric u64/u128 fields may arrive as strings, numbers, or scientific-notation
 * floats from JSON-RPC; see `parseYoctoSafe` / `toBigInt`.
 */

export type Triple = [number, number, number];

export interface ResistanceConfig {
  totalBps: number; // 13500
  minBps: number; // 1000
  maxBps: number; // 8500
}

export const DEFAULT_RESISTANCE_CONFIG: ResistanceConfig = {
  totalBps: 13500,
  minBps: 1000,
  maxBps: 8500,
};

export const MAX_SHIFT_BPS = 2500;
export const MIN_BUYBACK_BPS = 10000;
export const MAX_BUYBACK_BPS = 40000;
export const MAX_TAUNT_CHARS = 200;
export const ONE_NEAR_YOCTO = 1_000_000_000_000_000_000_000_000n; // 10^24 yoctoNEAR
export const TRIBUTE_THRESHOLD_BPS = 7000;
export const ELEMENT_COUNT = 3;
export const MAX_FLOOR = 3;
export const TICKET_JACKPOT_SHARE_BPS = 9000;

/**
 * Parses integer, decimal, or scientific-notation numbers/strings (e.g. "2.3683e+24",
 * 4e+22, "5.7e+22") into exact bigint without floating-point precision loss.
 * Fractional yocto digits (if any) are truncated toward zero.
 */
export function parseYoctoSafe(value: string | number | bigint): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  let raw: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid yocto value: ${value}`);
    }
    raw = String(value);
  } else if (typeof value === "string") {
    raw = value.trim();
  } else {
    throw new Error(`Unsupported yocto value type: ${typeof value}`);
  }

  if (raw.length === 0) {
    throw new Error("Invalid yocto value: empty string");
  }

  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match) {
    throw new Error(`Invalid yocto value: ${value}`);
  }

  const sign = match[1] === "-" ? "-" : "";
  const intPart = match[2] ?? "";
  const fracPart = match[3] ?? match[4] ?? "";
  const exp = match[5] !== undefined ? Number.parseInt(match[5], 10) : 0;
  if (!Number.isFinite(exp)) {
    throw new Error(`Invalid yocto exponent: ${value}`);
  }

  const digits = intPart + fracPart;
  if (/^0+$/.test(digits)) {
    return 0n;
  }

  const shift = exp - fracPart.length;
  if (shift > 10000) {
    throw new RangeError(`Yocto exponent too large: ${value}`);
  }

  let integerDigits: string;
  if (shift >= 0) {
    integerDigits = digits + "0".repeat(shift);
  } else {
    const cut = digits.length + shift;
    if (cut <= 0) {
      return 0n;
    }
    integerDigits = digits.slice(0, cut);
  }

  const normalized = integerDigits.replace(/^0+/, "") || "0";
  if (normalized === "0") {
    return 0n;
  }
  return BigInt(sign + normalized);
}

export function toBigInt(value: number | string | bigint): bigint {
  return parseYoctoSafe(value);
}

/** get_meta() */
export interface MetaResponse {
  epoch: number;
  resistance: Triple;
  /** Relative countdown (ns) until epoch rollover is ready; 0 = rollover ready now. */
  next_epoch_in_ns: number | string;
  /** Element shift counter across epochs. */
  shifted_by: number;
  supply: Triple;
  /** Element the meta is currently weakest against (0..2). */
  weak_element: number;
}

/** get_floor(floor) / get_tower().floors[] (0-indexed floors 0..2) */
export interface FloorResponse {
  floor: number;
  /** Live contract field: current boss HP. */
  hp?: number;
  /** Legacy unit-test compatibility alias for `hp`. */
  boss_hp?: number;
  max_hp?: number;
  round?: number;
  first_attack_ns?: number | string;
  /** Round duration (ns) from first_attack_ns (0 = no deadline). */
  deadline_ns?: number | string;
  /** Remaining countdown (ns) until expiry; 0 = expired/ready for lazy settlement (or no deadline). */
  time_left_ns?: number | string;
  expired?: boolean;
  jackpot?: number | string;
  buyback_reserve?: number | string;
  dividend_pool?: number | string;
  backer_total_shares?: number | string;
  backer_cycle?: number;
  total_damage?: number | string;
  loot?: Triple;
  volume_buyback_epoch?: number;
  unlocked?: boolean;
  ward_element?: number | null;
  enrage?: boolean;
  /** Legacy unit-test compatibility fields for enrage evaluation. */
  floor_start_ns?: number | string;
  enrage_ticks?: number;
}

/** get_tower() - accepts either a bare array or { floors: [...] } from the contract. */
export interface TowerResponse {
  floors: FloorResponse[];
  current_floor?: number;
}

/** get_ai_state(floor) */
export interface AiStateResponse {
  floor?: number;
  epoch: number;
  buyback_multiplier_bps: Triple;
  nonce: number;
  taunt?: string | null;
  altar_recipe_id?: string | null;
  chat_id?: string | null;
  signature_hex?: string;
}

/** get_ai_state(floor) - v3.1 ABI name. */
export type AiState = AiStateResponse;

/** Payload submitted to apply_ai_proposal: field order matches the contract canonical payload. */
export interface AiProposal {
  floor: number;
  epoch: number;
  buyback_multiplier_bps: Triple;
  altar_recipe_id: string | null;
  taunt: string | null;
  nonce: number;
}

export interface SignedAiProposal {
  proposal: AiProposal;
  signature: string; // hex encoded Ed25519 signature over canonical message (64 bytes)
  publicKey: string; // hex encoded Ed25519 public key (32 bytes)
  chatId?: string;
  /** Optional NEAR AI Cloud chat audit signature from GET /signature/{chatId}. */
  auditSignature?: string;
  /** Optional NEAR AI Cloud TEE signing address / public key from GET /signature/{chatId}. */
  auditPublicKey?: string;
  /** The exact canonical message that was signed (for ops/debugging). */
  message: string;
}

/** get_inventory(account) - weapons + gatherable items. Shapes kept tolerant (u64 as string). */
export interface PlayerInventoryResponse {
  account_id: string;
  weapons: Array<{ token_id: string; element: number; power: number; is_starter?: boolean }>;
  items: Record<string, string | number>;
  balance_yocto?: string;
}

/** get_merchant() */
export interface MerchantResponse {
  item_stocks: Record<string, number>;
  reserve_yocto: string;
  buyback_multiplier_bps: number;
  is_open?: boolean;
}

/** get_quote(item, side, qty) */
export interface MerchantQuote {
  item: string;
  side: "buy" | "sell";
  qty: number;
  price_yocto: string;
  reason?: string;
}

/** get_buyback_quote(floor, element) */
export interface BuybackQuote {
  floor: number;
  element: number;
  multiplier_bps: number;
  qty: number;
  unit_price_yocto: string;
  total_price_yocto: string;
  is_open: boolean;
  reason: string;
}

/** get_backer(floor, account) */
export interface BackerResponse {
  account_id: string;
  floor: number;
  cycle: number;
  staked_yocto: string;
  pending_dividend_yocto?: string;
}

export interface JackpotDistribution {
  totalJackpot: bigint;
  lastBonus: bigint;
  proportionalPool: bigint;
  playerShare: bigint;
  totalPayout: bigint;
}

// NEP-297 Standard Event Types
export interface Nep297Event<T = unknown> {
  standard: string;
  version: string;
  event: string;
  data: T[];
}

export interface DepositEventData {
  account_id: string;
  amount: string;
}

export interface CraftEventData {
  account_id: string;
  recipe: string;
  output_token: string;
  amount: number;
  materials_consumed: Array<{ token_id: string; amount: number }>;
}

export interface ReforgeEventData {
  account_id: string;
  burn_element: string;
  received_element: string;
  burned_count: number;
  minted_count: number;
}

export interface RaidEventData {
  account_id: string;
  floor: number;
  round: number;
  weapon: string;
  damage: number;
  boss_remaining_hp: number;
  ticket_paid: string;
  tribute_taken: boolean;
}

export interface BossDefeatedEventData {
  floor: number;
  round: number;
  killer: string;
  total_jackpot: string;
  total_damage: number;
  trophy_token_id: string | null;
}

export interface AiProposalAppliedEventData {
  epoch: number;
  old_resistance: Triple;
  new_resistance: Triple;
  buyback_multiplier_bps: number | Triple;
  proposer: string;
  memo: string;
}

export interface MerchantTradeEventData {
  account_id: string;
  action: "buy" | "sell" | string;
  item_id: string;
  amount: number;
  price_paid: string;
  current_stock: number;
  treasury_reserve: string;
}

export interface RoundExpiredEventData {
  floor: number;
  round: number;
  total_damage?: number;
}

export interface FloorUnlockedEventData {
  floor: number;
  unlocked_by?: string;
}

export interface PayoutClaimedEventData {
  account_id: string;
  floor: number;
  round: number;
  amount: string;
}

export interface MetaUpdatedEventData {
  epoch: number;
  resistance?: Triple;
  shifted_by?: number;
  weak_element?: number;
  taunt?: string | null;
}

export interface TributeSeizedEventData {
  account_id: string;
  floor?: number;
  element?: number;
  weapon?: string;
}

export interface BuybackEventData {
  account_id: string;
  floor: number;
  element: number;
  qty?: number;
  amount: string;
}

export interface BackerStakedEventData {
  account_id: string;
  floor: number;
  cycle: number;
  amount: string;
}

export interface DividendClaimedEventData {
  account_id: string;
  floor: number;
  cycle: number;
  amount: string;
}

export interface GatherEventData {
  account_id: string;
  item_id: string;
  amount: number;
}

export interface StarterClaimedEventData {
  account_id: string;
}

export interface WithdrawEventData {
  account_id: string;
  amount: string;
}

export type SpireEventData =
  | { event: "deposit"; data: DepositEventData }
  | { event: "craft"; data: CraftEventData }
  | { event: "reforge"; data: ReforgeEventData }
  | { event: "raid"; data: RaidEventData }
  | { event: "boss_defeated"; data: BossDefeatedEventData }
  | { event: "ai_proposal_applied"; data: AiProposalAppliedEventData }
  | { event: "merchant_trade"; data: MerchantTradeEventData }
  | { event: "round_expired"; data: RoundExpiredEventData }
  | { event: "floor_unlocked"; data: FloorUnlockedEventData }
  | { event: "payout_claimed"; data: PayoutClaimedEventData }
  | { event: "meta_updated"; data: MetaUpdatedEventData }
  | { event: "tribute_seized"; data: TributeSeizedEventData }
  | { event: "buyback"; data: BuybackEventData }
  | { event: "backer_staked"; data: BackerStakedEventData }
  | { event: "dividend_claimed"; data: DividendClaimedEventData }
  | { event: "gather"; data: GatherEventData }
  | { event: "starter_claimed"; data: StarterClaimedEventData }
  | { event: "withdraw"; data: WithdrawEventData };

/** Landing page summary served on GET /api/stats. */
export interface SpireStats {
  epoch: number;
  totalJackpotYocto: string;
  totalRaids: number;
  totalDamage: number;
  supply: Triple;
  resistance: Triple;
  weakElement: number | null;
  lastTaunt: string | null;
  floors: Record<number, { jackpotYocto: string; raids: number; rounds: number }>;
}
