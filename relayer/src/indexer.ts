/**
 * SpireFi - Real-time Indexer, Stats Collector & Account Queue API
 *
 * Implements:
 * 1. Log scraper filtering for NEP-297 EVENT_JSON prefix
 * 2. Strict schema validation for every contract event (raids, meta, merchant,
 *    backers, payouts, gathering, withdrawals, ...)
 * 3. In-memory event buffer + WebSocket broadcast
 * 4. Landing page stats collector served on GET /api/stats
 * 5. Account pre-registration queue served on POST /api/accounts (validation +
 *    in-memory queue only; actual account creation is wired by the mandor later)
 */

import { EventEmitter } from "node:events";
import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { connect, keyStores, KeyPair, utils } from "near-api-js";
import { WebSocketServer, WebSocket } from "ws";
import {
  Nep297Event,
  DepositEventData,
  CraftEventData,
  ReforgeEventData,
  RaidEventData,
  BossDefeatedEventData,
  AiProposalAppliedEventData,
  MerchantTradeEventData,
  PayoutClaimedEventData,
  MetaUpdatedEventData,
  TributeSeizedEventData,
  BuybackEventData,
  BackerStakedEventData,
  DividendClaimedEventData,
  GatherEventData,
  StarterClaimedEventData,
  WithdrawEventData,
  RoundExpiredEventData,
  FloorUnlockedEventData,
  Triple,
  MetaResponse,
  FloorResponse,
  MerchantResponse,
  SpireStats,
  TICKET_JACKPOT_SHARE_BPS,
  parseYoctoSafe,
} from "./types.js";
import { normalizeTower } from "./keeper.js";

export const NEP297_PREFIX = "EVENT_JSON:";
export const SUPPORTED_STANDARDS = ["spire", "spire-gamefi"];
export const SUPPORTED_EVENTS = [
  "deposit",
  "craft",
  "reforge",
  "raid",
  "boss_defeated",
  "ai_proposal_applied",
  "merchant_trade",
  "round_expired",
  "floor_unlocked",
  "payout_claimed",
  "meta_updated",
  "tribute_seized",
  "buyback",
  "backer_staked",
  "dividend_claimed",
  "gather",
  "starter_claimed",
  "withdraw",
] as const;

export type SupportedEventType = (typeof SUPPORTED_EVENTS)[number];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTriple(value: unknown): value is Triple {
  return Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === "number");
}

export function validateDepositData(data: unknown): data is DepositEventData {
  if (!isObject(data)) return false;
  return typeof data.account_id === "string";
}

export function validateCraftData(data: unknown): data is CraftEventData {
  if (!isObject(data)) return false;
  if (
    typeof data.account_id !== "string" ||
    typeof data.output_token !== "string" ||
    (data.amount !== undefined && typeof data.amount !== "number") ||
    !Array.isArray(data.materials_consumed)
  ) {
    return false;
  }
  return data.materials_consumed.every((m) => isObject(m) && typeof m.token_id === "string");
}

export function validateReforgeData(data: unknown): data is ReforgeEventData {
  if (!isObject(data)) return false;
  return (
    typeof data.account_id === "string" &&
    typeof data.burn_element === "string" &&
    typeof data.received_element === "string" &&
    typeof data.burned_count === "number" &&
    typeof data.minted_count === "number"
  );
}

export function validateRaidData(data: unknown): data is RaidEventData {
  if (!isObject(data)) return false;
  return (
    typeof data.account_id === "string" &&
    typeof data.floor === "number" &&
    typeof data.round === "number" &&
    typeof data.weapon === "string" &&
    typeof data.damage === "number" &&
    typeof data.boss_remaining_hp === "number" &&
    typeof data.ticket_paid === "string" &&
    typeof data.tribute_taken === "boolean"
  );
}

export function validateBossDefeatedData(data: unknown): data is BossDefeatedEventData {
  if (!isObject(data)) return false;
  return (
    typeof data.floor === "number" &&
    typeof data.round === "number" &&
    typeof data.killer === "string" &&
    typeof data.total_jackpot === "string" &&
    (typeof data.total_damage === "number" || typeof data.total_damage === "string") &&
    (typeof data.trophy_token_id === "string" || data.trophy_token_id === null)
  );
}

export function validateAiProposalAppliedData(data: unknown): data is AiProposalAppliedEventData {
  if (!isObject(data)) return false;
  if (typeof data.epoch !== "number") return false;
  const isV31LiveShape =
    typeof data.floor === "number" &&
    typeof data.nonce === "number" &&
    isTriple(data.buyback_multiplier_bps);
  const isLegacyVectorShape =
    isTriple(data.old_resistance) &&
    isTriple(data.new_resistance) &&
    typeof data.proposer === "string";
  return isV31LiveShape || isLegacyVectorShape;
}

export function validateMerchantTradeData(data: unknown): data is MerchantTradeEventData {
  if (!isObject(data)) return false;
  if (typeof data.account_id !== "string" || typeof data.item_id !== "string") {
    return false;
  }
  const isV31LiveShape =
    typeof data.side === "string" &&
    typeof data.qty === "number" &&
    typeof data.total_price === "string";
  const isLegacyVectorShape =
    typeof data.action === "string" &&
    typeof data.amount === "number" &&
    typeof data.price_paid === "string";
  return isV31LiveShape || isLegacyVectorShape;
}

export function validateRoundExpiredData(data: unknown): data is RoundExpiredEventData {
  if (!isObject(data)) return false;
  return typeof data.floor === "number" && typeof data.round === "number";
}

export function validateFloorUnlockedData(data: unknown): data is FloorUnlockedEventData {
  if (!isObject(data)) return false;
  return typeof data.floor === "number";
}

export function validatePayoutClaimedData(data: unknown): data is PayoutClaimedEventData {
  if (!isObject(data)) return false;
  return (
    typeof data.account_id === "string" &&
    typeof data.floor === "number" &&
    typeof data.amount === "string"
  );
}

export function validateMetaUpdatedData(data: unknown): data is MetaUpdatedEventData {
  if (!isObject(data)) return false;
  if (typeof data.epoch !== "number") return false;
  if (data.resistance !== undefined && !isTriple(data.resistance)) return false;
  if (data.taunt !== undefined && data.taunt !== null && typeof data.taunt !== "string") return false;
  return true;
}

export function validateTributeSeizedData(data: unknown): data is TributeSeizedEventData {
  if (!isObject(data)) return false;
  return typeof data.account_id === "string";
}

export function validateBuybackData(data: unknown): data is BuybackEventData {
  if (!isObject(data)) return false;
  return (
    typeof data.account_id === "string" &&
    typeof data.floor === "number" &&
    typeof data.element === "number" &&
    (typeof data.total_price === "string" || typeof data.amount === "string")
  );
}

export function validateBackerStakedData(data: unknown): data is BackerStakedEventData {
  if (!isObject(data)) return false;
  return (
    typeof data.account_id === "string" &&
    typeof data.floor === "number" &&
    typeof data.amount === "string"
  );
}

export function validateDividendClaimedData(data: unknown): data is DividendClaimedEventData {
  if (!isObject(data)) return false;
  return (
    typeof data.account_id === "string" &&
    typeof data.floor === "number" &&
    typeof data.amount === "string"
  );
}

export function validateGatherData(data: unknown): data is GatherEventData {
  if (!isObject(data)) return false;
  return (
    typeof data.account_id === "string" &&
    typeof data.item_id === "string" &&
    typeof data.amount === "number"
  );
}

export function validateStarterClaimedData(data: unknown): data is StarterClaimedEventData {
  if (!isObject(data)) return false;
  return typeof data.account_id === "string";
}

export function validateWithdrawData(data: unknown): data is WithdrawEventData {
  if (!isObject(data)) return false;
  return typeof data.account_id === "string" && typeof data.amount === "string";
}

const EVENT_VALIDATORS: Record<SupportedEventType, (data: unknown) => boolean> = {
  deposit: validateDepositData,
  craft: validateCraftData,
  reforge: validateReforgeData,
  raid: validateRaidData,
  boss_defeated: validateBossDefeatedData,
  ai_proposal_applied: validateAiProposalAppliedData,
  merchant_trade: validateMerchantTradeData,
  round_expired: validateRoundExpiredData,
  floor_unlocked: validateFloorUnlockedData,
  payout_claimed: validatePayoutClaimedData,
  meta_updated: validateMetaUpdatedData,
  tribute_seized: validateTributeSeizedData,
  buyback: validateBuybackData,
  backer_staked: validateBackerStakedData,
  dividend_claimed: validateDividendClaimedData,
  gather: validateGatherData,
  starter_claimed: validateStarterClaimedData,
  withdraw: validateWithdrawData,
};

export function validateEventPayload(event: Nep297Event): boolean {
  if (!event || !Array.isArray(event.data) || event.data.length === 0) return false;
  const validator = EVENT_VALIDATORS[event.event as SupportedEventType];
  if (!validator) return false;
  return event.data.every((item) => validator(item));
}

/**
 * Parses a single log line, looking for the NEP-297 EVENT_JSON prefix.
 * Returns the parsed and validated event, or null if invalid or irrelevant.
 */
export function parseEventJson(logLine: string): Nep297Event | null {
  if (typeof logLine !== "string") return null;

  const idx = logLine.indexOf(NEP297_PREFIX);
  if (idx === -1) return null;

  const rawJson = logLine.substring(idx + NEP297_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(rawJson) as Nep297Event;
    if (!parsed.standard || !SUPPORTED_STANDARDS.includes(parsed.standard)) return null;
    if (!parsed.event || !SUPPORTED_EVENTS.includes(parsed.event as SupportedEventType)) return null;
    if (!validateEventPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Extracts all valid NEP-297 SpireFi events from a list of log lines.
 */
export function extractEventsFromLogs(logs: string[]): Nep297Event[] {
  if (!Array.isArray(logs)) return [];
  const events: Nep297Event[] = [];
  for (const log of logs) {
    const ev = parseEventJson(log);
    if (ev) events.push(ev);
  }
  return events;
}

const TOKEN_ELEMENTS: Record<string, number> = {
  "weapon:solar": 0,
  solar: 0,
  "weapon:frost": 1,
  frost: 1,
  "weapon:void": 2,
  void: 2,
};

function elementFromToken(token: unknown): number | null {
  return typeof token === "string" && token in TOKEN_ELEMENTS ? TOKEN_ELEMENTS[token] : null;
}

/**
 * Aggregates the landing page summary: jackpots, raids, supply, resistance, taunt.
 * Supply/resistance are best-effort from events; `updateMeta` is authoritative.
 */
export class StatsCollector {
  private epoch = 0;
  private supply: Triple = [0, 0, 0];
  private resistance: Triple = [0, 0, 0];
  private weakElement: number | null = null;
  private lastTaunt: string | null = null;
  private totalRaids = 0;
  private totalDamage = 0;
  private floorJackpot = new Map<number, bigint>();
  private floorRaids = new Map<number, number>();
  private floorRounds = new Map<number, number>();

  constructor(private readonly ticketJackpotShareBps = TICKET_JACKPOT_SHARE_BPS) {}

  /** Authoritative refresh from get_meta(). */
  public updateMeta(meta: MetaResponse): void {
    this.epoch = meta.epoch;
    if (isTriple(meta.supply)) this.supply = [...meta.supply] as Triple;
    if (isTriple(meta.resistance)) this.resistance = [...meta.resistance] as Triple;
    this.weakElement = typeof meta.weak_element === "number" ? meta.weak_element : this.weakElement;
  }

  public ingest(event: Nep297Event): void {
    const payload = event.data[0];
    if (!isObject(payload)) return;

    switch (event.event) {
      case "raid": {
        const floor = Number(payload.floor ?? 0);
        this.totalRaids += 1;
        this.totalDamage += Number(payload.damage ?? 0);
        this.floorRaids.set(floor, (this.floorRaids.get(floor) ?? 0) + 1);
        const ticket = parseYoctoSafe(payload.ticket_paid as string);
        const share = (ticket * BigInt(this.ticketJackpotShareBps)) / 10000n;
        this.addJackpot(floor, share);
        break;
      }
      case "boss_defeated": {
        const floor = Number(payload.floor ?? 0);
        this.floorJackpot.set(floor, parseYoctoSafe(payload.total_jackpot as string));
        this.floorRounds.set(floor, (this.floorRounds.get(floor) ?? 0) + 1);
        break;
      }
      case "round_expired": {
        const floor = Number(payload.floor ?? 0);
        this.floorRounds.set(floor, (this.floorRounds.get(floor) ?? 0) + 1);
        break;
      }
      case "payout_claimed": {
        this.addJackpot(Number(payload.floor ?? 0), -parseYoctoSafe(payload.amount as string));
        break;
      }
      case "meta_updated": {
        this.epoch = Number(payload.epoch ?? this.epoch);
        if (isTriple(payload.resistance)) this.resistance = [...payload.resistance] as Triple;
        if (typeof payload.weak_element === "number") this.weakElement = payload.weak_element;
        if (typeof payload.taunt === "string" && payload.taunt.length > 0) this.lastTaunt = payload.taunt;
        break;
      }
      case "ai_proposal_applied": {
        this.epoch = Number(payload.epoch ?? this.epoch);
        if (isTriple(payload.new_resistance)) this.resistance = [...payload.new_resistance] as Triple;
        break;
      }
      case "craft": {
        const element = elementFromToken(payload.output_token);
        if (element !== null) this.addSupply(element, Number(payload.amount ?? 1));
        break;
      }
      case "reforge": {
        const burned = elementFromToken(payload.burn_element);
        const minted = elementFromToken(payload.received_element);
        if (burned !== null) this.addSupply(burned, -Number(payload.burned_count ?? 0));
        if (minted !== null) this.addSupply(minted, Number(payload.minted_count ?? 0));
        break;
      }
      case "tribute_seized": {
        const element =
          typeof payload.element === "number"
            ? payload.element
            : elementFromToken(payload.weapon);
        if (element !== null) this.addSupply(element, -1);
        break;
      }
      case "buyback": {
        const qty = Number(payload.qty ?? 1);
        this.addSupply(Number(payload.element ?? 0), -qty);
        break;
      }
      default:
        break;
    }
  }

  private addJackpot(floor: number, delta: bigint): void {
    const next = (this.floorJackpot.get(floor) ?? 0n) + delta;
    this.floorJackpot.set(floor, next > 0n ? next : 0n);
  }

  private addSupply(element: number, delta: number): void {
    if (element < 0 || element > 2) return;
    this.supply[element] = Math.max(0, this.supply[element] + delta);
  }

  public getStats(): SpireStats {
    const floors: SpireStats["floors"] = {};
    let totalJackpot = 0n;
    for (const [floor, jackpot] of this.floorJackpot) {
      totalJackpot += jackpot;
      floors[floor] = {
        jackpotYocto: jackpot.toString(),
        raids: this.floorRaids.get(floor) ?? 0,
        rounds: this.floorRounds.get(floor) ?? 0,
      };
    }

    return {
      epoch: this.epoch,
      totalJackpotYocto: totalJackpot.toString(),
      totalRaids: this.totalRaids,
      totalDamage: this.totalDamage,
      supply: [...this.supply] as Triple,
      resistance: [...this.resistance] as Triple,
      weakElement: this.weakElement,
      lastTaunt: this.lastTaunt,
      floors,
    };
  }
}

export const ACCOUNT_SUFFIX = process.env.ACCOUNT_SUFFIX || ".spire.testnet";
export const ACCOUNT_LABEL_RE = /^[a-z0-9._-]{2,32}$/;

/** Normalizes "alice" or "alice.spire.testnet" to a validated full account id. */
export function normalizeAccountName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const label = trimmed.endsWith(ACCOUNT_SUFFIX)
    ? trimmed.slice(0, -ACCOUNT_SUFFIX.length)
    : trimmed;
  if (!ACCOUNT_LABEL_RE.test(label)) return null;
  return `${label}${ACCOUNT_SUFFIX}`;
}

/** In-memory pre-registration queue (real account creation is wired later). */
export class AccountQueue {
  private readonly pending: string[] = [];

  public enqueue(raw: unknown): string | null {
    const accountId = normalizeAccountName(raw);
    if (accountId === null) return null;
    if (!this.pending.includes(accountId)) this.pending.push(accountId);
    return accountId;
  }

  public list(): string[] {
    return [...this.pending];
  }

  public size(): number {
    return this.pending.length;
  }
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

/** Contract snapshot served on POST /api/stats (get_tower, get_meta, get_supply, get_merchant, total). */
export interface LiveStatsSnapshot {
  tower: { floors: FloorResponse[] };
  meta: MetaResponse;
  supply: Triple;
  merchant: MerchantResponse | null;
  total: {
    floors: number;
    defeatedFloors: number;
    bossHpTotal: string;
    totalJackpotYocto: string;
    totalRaids: number;
    totalDamage: number;
  };
}

export interface AsyncApiOptions {
  /** Live contract read for POST /api/stats; without it the route returns 501. */
  fetchLiveStats?: () => Promise<LiveStatsSnapshot>;
  /** Reads recent indexed NEP-297 events for GET /api/events. */
  getRecentEvents?: (limit: number) => Nep297Event[];
  /** Real subaccount creation for POST /api/accounts; without it accounts are queued pending.
   * The second argument is the browser-provided Function Call public key (may be undefined). */
  createAccount?: (
    accountId: string,
    publicKey?: string
  ) => Promise<{ created: boolean; detail?: string }>;
}

/**
 * Pure async router: POST /api/stats (live), GET /api/events, and POST /api/accounts (create)
 * plus everything the sync router already serves. No sockets involved, so it is testable.
 */
export async function handleApiRequestAsync(
  method: string,
  rawPath: string,
  body: unknown,
  collector: StatsCollector,
  accounts: AccountQueue,
  opts: AsyncApiOptions = {}
): Promise<ApiResponse> {
  const [pathPart, queryPart = ""] = rawPath.split("?");
  const path = pathPart.replace(/\/+$/, "") || "/";

  if (method === "GET" && path === "/api/events") {
    const params = new URLSearchParams(queryPart);
    const parsedLimit = Number(params.get("limit") ?? 30);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(100, Math.max(1, Math.floor(parsedLimit)))
      : 30;
    const events = opts.getRecentEvents ? opts.getRecentEvents(limit) : [];
    return { status: 200, body: { events } };
  }

  if (method === "POST" && path === "/api/stats") {
    if (!opts.fetchLiveStats) {
      return { status: 501, body: { error: "live_stats_unavailable" } };
    }
    try {
      return { status: 200, body: await opts.fetchLiveStats() };
    } catch (err: any) {
      return {
        status: 502,
        body: { error: "upstream_error", detail: err?.message || String(err) },
      };
    }
  }

  if (method === "POST" && path === "/api/accounts") {
    const payload = isObject(body) ? body : {};
    const accountId = normalizeAccountName(payload.account_id ?? payload.name);
    if (accountId === null) {
      return {
        status: 400,
        body: { error: "invalid_account", expected: `^[a-z0-9._-]{2,32}${ACCOUNT_SUFFIX}$` },
      };
    }
    if (opts.createAccount) {
      try {
        const outcome = await opts.createAccount(accountId, typeof payload.public_key === "string" ? payload.public_key : undefined);
        return {
          status: 200,
          body: {
            account_id: accountId,
            status: outcome.created ? "created" : "pending",
            detail: outcome.detail ?? null,
          },
        };
      } catch (err: any) {
        const detail = err?.message || String(err);
        if (/already exists|AccountAlreadyExists/i.test(detail)) {
          return {
            status: 409,
            body: { error: "account_exists", detail },
          };
        }
        return {
          status: 502,
          body: { error: "account_creation_failed", detail },
        };
      }
    }
    accounts.enqueue(accountId);
    return { status: 200, body: { account_id: accountId, status: "pending" } };
  }

  return handleApiRequest(method, rawPath, body, collector, accounts);
}

export interface SubaccountCreationResult {
  account_id: string;
  public_key: string;
  /** Present only when the relayer generated the key (operator-managed). When a
   * browser key is registered, the private half lives in the user's localStorage. */
  private_key: string | null;
}

export const DEFAULT_SUBACCOUNT_FUNDING_YOCTO = "600000000000000000000000"; // 0.60 NEAR

/**
 * Parses and validates an Ed25519 public key in either canonical NEAR `ed25519:<base58>`
 * format or 64-char hex (with or without `ed25519:` prefix) via `utils.PublicKey.from`.
 */
export function parseEd25519PublicKey(rawPublicKey: string): InstanceType<typeof utils.PublicKey> {
  const trimmed = (rawPublicKey ?? "").trim();
  if (!trimmed) {
    throw new Error("invalid_public_key: empty Ed25519 public key");
  }

  const maybeHex = trimmed.startsWith("ed25519:")
    ? trimmed.slice("ed25519:".length)
    : trimmed;

  if (/^[0-9a-fA-F]{64}$/.test(maybeHex)) {
    const encoded = utils.serialize.base_encode(Buffer.from(maybeHex, "hex"));
    return utils.PublicKey.from(`ed25519:${encoded}`);
  }

  if (trimmed.startsWith("ed25519:")) {
    try {
      const pk = utils.PublicKey.from(trimmed);
      if (pk.data.length !== 32) {
        throw new Error(`expected 32-byte Ed25519 key, got ${pk.data.length}`);
      }
      return pk;
    } catch (err: any) {
      throw new Error(
        `invalid_public_key: malformed ed25519:<base58> public key (${err?.message || String(err)})`
      );
    }
  }

  throw new Error(
    "invalid_public_key: expected ed25519:<base58> or 64-char hex ed25519 public key"
  );
}

/**
 * Creates a playable `<label>.spire.testnet` subaccount funded by the parent account
 * (default 0.60 NEAR >= minimum needed for account storage + gameplay deposit) with a
 * Full Access Key (`createAccount` adds a full access key on NEAR).
 *
 * Two key paths:
 * - `browserPublicKey` provided (normal player onboarding): the account is created
 *   with the browser's key (`ed25519:<base58>` or 64-char hex), so the user's
 *   localStorage key is the only credential and no private key passes through the server.
 * - No key provided (operator path): a fresh keypair is generated and its private
 *   key is returned ONCE to the operator (never served over the API).
 */
export async function createPlayableSubaccount(
  parentAccountId: string,
  parentPrivateKey: string,
  rpcUrl: string,
  subAccountId: string,
  fundingYocto: string = DEFAULT_SUBACCOUNT_FUNDING_YOCTO,
  browserPublicKey?: string
): Promise<SubaccountCreationResult> {
  let publicKey: InstanceType<typeof utils.PublicKey>;
  let generatedPrivateKey: string | null = null;
  if (browserPublicKey) {
    // Validate the browser-provided key strictly — a malformed key would otherwise
    // create an account nobody can use.
    publicKey = parseEd25519PublicKey(browserPublicKey);
  } else {
    const keyPair = KeyPair.fromRandom("ed25519");
    publicKey = keyPair.getPublicKey();
    generatedPrivateKey = keyPair.toString();
  }
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(
    "testnet",
    parentAccountId,
    KeyPair.fromString(parentPrivateKey as Parameters<typeof KeyPair.fromString>[0])
  );
  const near = await connect({ networkId: "testnet", nodeUrl: rpcUrl, keyStore } as never);
  const parent = await near.account(parentAccountId);
  await parent.createAccount(subAccountId, publicKey, parseYoctoSafe(fundingYocto));
  return {
    account_id: subAccountId,
    public_key: publicKey.toString(),
    private_key: generatedPrivateKey,
  };
}

/** Compatibility export alias for `createPlayableSubaccount`. */
export const createSubaccountWithFunctionKey = createPlayableSubaccount;

/**
 * Pure HTTP router so the routes can be tested without sockets.
 */
export function handleApiRequest(
  method: string,
  rawPath: string,
  body: unknown,
  collector: StatsCollector,
  accounts: AccountQueue
): ApiResponse {
  const path = rawPath.split("?")[0].replace(/\/+$/, "") || "/";

  if (method === "GET" && path === "/api/stats") {
    return { status: 200, body: collector.getStats() };
  }

  if (method === "POST" && path === "/api/accounts") {
    const payload = isObject(body) ? body : {};
    const accountId = accounts.enqueue(payload.account_id ?? payload.name);
    if (accountId === null) {
      return {
        status: 400,
        body: { error: "invalid_account", expected: `^[a-z0-9._-]{2,32}${ACCOUNT_SUFFIX}$` },
      };
    }
    return { status: 200, body: { account_id: accountId, status: "pending" } };
  }

  return { status: 404, body: { error: "not_found" } };
}

export interface IndexerConfig {
  rpcUrl?: string;
  contractId?: string;
  pollIntervalMs?: number;
  maxCachedEvents?: number;
  /** Overrides the default RPC-backed POST /api/stats snapshot (tests). */
  fetchLiveStats?: () => Promise<LiveStatsSnapshot>;
}

const MAX_BODY_BYTES = 16 * 1024;

/**
 * Autonomous Indexer, Telemetry Streamer, Stats & Account API.
 */
export class SpireIndexer extends EventEmitter {
  private rpcUrl: string;
  private contractId: string;
  private pollIntervalMs: number;
  private maxCachedEvents: number;
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private lastBlockHeight = 0;
  private seenTxHashes = new Set<string>();
  private eventHistory: Nep297Event[] = [];
  private wss: WebSocketServer | null = null;
  private httpServer: Server | null = null;

  public readonly stats = new StatsCollector();
  public readonly accounts = new AccountQueue();

  /** Injectable real subaccount creator; null = queue accounts as pending. */
  public accountCreator:
    | ((accountId: string, publicKey?: string) => Promise<{ created: boolean; detail?: string }>)
    | null = null;
  private fetchLiveStatsImpl: (() => Promise<LiveStatsSnapshot>) | null = null;

  constructor(config: IndexerConfig = {}) {
    super();
    this.rpcUrl = config.rpcUrl || process.env.NEAR_RPC_URL || "https://test.rpc.fastnear.com";
    this.contractId = config.contractId || process.env.CONTRACT_ID || "spire.testnet";
    this.pollIntervalMs = config.pollIntervalMs ?? Number(process.env.POLL_INTERVAL_MS || 5000);
    this.maxCachedEvents = config.maxCachedEvents || 500;
    this.fetchLiveStatsImpl = config.fetchLiveStats ?? null;
  }

  /**
   * Processes incoming logs: caches, emits, broadcasts and feeds the stats collector.
   */
  public ingestLogs(logs: string | string[]): Nep297Event[] {
    const events = extractEventsFromLogs(Array.isArray(logs) ? logs : [logs]);

    for (const ev of events) {
      this.eventHistory.push(ev);
      if (this.eventHistory.length > this.maxCachedEvents) {
        this.eventHistory.shift();
      }

      this.stats.ingest(ev);
      this.emit("event", ev);
      this.emit(ev.event, ev);
      this.broadcast(ev);
    }

    return events;
  }

  private broadcast(event: Nep297Event): void {
    if (!this.wss) return;
    const msg = JSON.stringify(event);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  /**
   * Starts the HTTP API (/api/stats, /api/accounts) and the WebSocket streamer
   * on the same port (STREAMER_PORT).
   */
  public startStreamer(port: number = 8080): WebSocketServer {
    if (this.wss) return this.wss;

    this.httpServer = createServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on("connection", (ws) => {
      for (const ev of this.getRecentEvents(20)) {
        ws.send(JSON.stringify(ev));
      }
    });

    this.httpServer.listen(port);
    return this.wss;
  }

  private async rpcView<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `spirefi-view-${methodName}`,
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: this.contractId,
          method_name: methodName,
          args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`RPC HTTP ${response.status}: ${await response.text()}`);
    }
    const json = (await response.json()) as any;
    if (json.error) {
      throw new Error(`RPC error in ${methodName}: ${JSON.stringify(json.error)}`);
    }
    return JSON.parse(Buffer.from(json.result.result).toString("utf-8")) as T;
  }

  /**
   * Live POST /api/stats body: get_tower, get_meta, get_supply, get_merchant + totals.
   * Also refreshes the authoritative collector meta.
   */
  public async fetchLiveStats(): Promise<LiveStatsSnapshot> {
    if (this.fetchLiveStatsImpl) return this.fetchLiveStatsImpl();

    const [towerRaw, meta, supplyRaw, merchant] = await Promise.all([
      this.rpcView<unknown>("get_tower").catch(() => null),
      this.rpcView<MetaResponse>("get_meta"),
      this.rpcView<Triple>("get_supply").catch(() => null),
      this.rpcView<MerchantResponse>("get_merchant").catch(() => null),
    ]);

    const floors = normalizeTower(towerRaw);
    this.stats.updateMeta(meta);
    const cached = this.stats.getStats();

    let bossHpTotal = 0n;
    let defeatedFloors = 0;
    let liveJackpotTotal = 0n;
    let liveDamageTotal = 0;
    for (const floor of floors) {
      const parsedHp = parseYoctoSafe(floor.hp ?? floor.boss_hp ?? 0);
      const hp = parsedHp > 0n ? parsedHp : 0n;
      bossHpTotal += hp;
      if (hp === 0n) defeatedFloors += 1;

      if (floor.jackpot !== undefined && floor.jackpot !== null) {
        try {
          const parsedJackpot = parseYoctoSafe(floor.jackpot);
          if (parsedJackpot > 0n) liveJackpotTotal += parsedJackpot;
        } catch {
          // ignore malformed jackpot field
        }
      }
      if (floor.total_damage !== undefined && floor.total_damage !== null) {
        try {
          const parsedDamage = Number(parseYoctoSafe(floor.total_damage));
          if (Number.isFinite(parsedDamage) && parsedDamage > 0) {
            liveDamageTotal += parsedDamage;
          }
        } catch {
          // ignore malformed total_damage field
        }
      }
    }

    const cachedJackpot = parseYoctoSafe(cached.totalJackpotYocto);
    const totalJackpotYocto =
      cachedJackpot > 0n ? cached.totalJackpotYocto : liveJackpotTotal.toString();
    const totalDamage = cached.totalDamage > 0 ? cached.totalDamage : liveDamageTotal;

    return {
      tower: { floors },
      meta,
      supply: (supplyRaw ?? meta.supply) as Triple,
      merchant: merchant ?? null,
      total: {
        floors: floors.length,
        defeatedFloors,
        bossHpTotal: bossHpTotal.toString(),
        totalJackpotYocto,
        totalRaids: cached.totalRaids,
        totalDamage,
      },
    };
  }

  private getCorsHeaders(): Record<string, string> {
    return {
      "Access-Control-Allow-Origin": process.env.INDEXER_CORS_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const cors = this.getCorsHeaders();
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      let body: unknown = undefined;
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (raw.length > 0) {
        try {
          body = JSON.parse(raw);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json", ...cors });
          res.end(JSON.stringify({ error: "invalid_json" }));
          return;
        }
      }

      void (async () => {
        try {
          const result = await handleApiRequestAsync(
            req.method ?? "GET",
            req.url ?? "/",
            body,
            this.stats,
            this.accounts,
            {
              fetchLiveStats: () => this.fetchLiveStats(),
              getRecentEvents: (limit) => this.getRecentEvents(limit),
              createAccount: this.accountCreator ?? undefined,
            }
          );
          res.writeHead(result.status, { "Content-Type": "application/json", ...cors });
          res.end(JSON.stringify(result.body));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json", ...cors });
          res.end(JSON.stringify({ error: "internal_error", detail: err?.message || String(err) }));
        }
      })();
    });
  }

  public getStats(): SpireStats {
    return this.stats.getStats();
  }

  public getPendingAccounts(): string[] {
    return this.accounts.list();
  }

  public stopStreamer(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
  }

  public getRecentEvents(limit?: number): Nep297Event[] {
    if (limit && limit > 0) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  public getEventCount(): number {
    return this.eventHistory.length;
  }

  public start(startBlockHeight?: number): void {
    if (this.isRunning) return;
    this.isRunning = true;
    if (startBlockHeight) this.lastBlockHeight = startBlockHeight;

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        await this.pollLatestBlocks();
      } catch (err) {
        this.emit("error", err);
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(poll, this.pollIntervalMs);
        }
      }
    };

    void poll();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.stopStreamer();
  }

  private async rpcCall<T>(method: string, params: unknown): Promise<T | null> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `spirefi-indexer-${method}`,
          method,
          params,
        }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as any;
      return (data?.result ?? null) as T | null;
    } catch {
      return null;
    }
  }

  private rememberTxHash(txHash: string): void {
    this.seenTxHashes.add(txHash);
    if (this.seenTxHashes.size > 500) {
      const oldest = this.seenTxHashes.values().next().value;
      if (oldest) this.seenTxHashes.delete(oldest);
    }
  }

  /**
   * Polls the latest finalized block(s) from NEAR JSON-RPC, traverses chunk
   * transactions targeting CONTRACT_ID, and ingests NEP-297 contract logs.
   */
  public async pollLatestBlocks(): Promise<void> {
    const latestBlock = await this.rpcCall<any>("block", { finality: "final" });
    const latestHeight = Number(latestBlock?.header?.height ?? 0);
    if (!Number.isFinite(latestHeight) || latestHeight <= 0) return;
    if (latestHeight <= this.lastBlockHeight) return;

    const startHeight =
      this.lastBlockHeight === 0
        ? latestHeight
        : Math.max(this.lastBlockHeight + 1, latestHeight - 2);

    for (let height = startHeight; height <= latestHeight; height++) {
      const block =
        height === latestHeight
          ? latestBlock
          : await this.rpcCall<any>("block", { block_id: height });
      const chunks = Array.isArray(block?.chunks) ? block.chunks : [];

      for (const chunkHeader of chunks) {
        const chunkHash = chunkHeader?.chunk_hash;
        if (typeof chunkHash !== "string" || !chunkHash) continue;

        const chunk = await this.rpcCall<any>("chunk", { chunk_id: chunkHash });
        const txs = Array.isArray(chunk?.transactions) ? chunk.transactions : [];

        for (const tx of txs) {
          const txHash = tx?.hash;
          const signerId = tx?.signer_id;
          const receiverId = tx?.receiver_id;
          if (typeof txHash !== "string" || typeof signerId !== "string") continue;
          if (receiverId !== this.contractId) continue;
          if (this.seenTxHashes.has(txHash)) continue;

          const txStatus = await this.rpcCall<any>("EXPERIMENTAL_tx_status", [txHash, signerId]);
          if (!txStatus) continue;
          this.rememberTxHash(txHash);

          const txOutcome = txStatus.transaction_outcome?.outcome;
          if (txOutcome?.executor_id === this.contractId && Array.isArray(txOutcome.logs) && txOutcome.logs.length > 0) {
            this.ingestLogs(txOutcome.logs);
          }

          const receipts = Array.isArray(txStatus.receipts_outcome) ? txStatus.receipts_outcome : [];
          for (const rec of receipts) {
            const outcome = rec?.outcome;
            if (
              outcome?.executor_id === this.contractId &&
              Array.isArray(outcome.logs) &&
              outcome.logs.length > 0
            ) {
              this.ingestLogs(outcome.logs);
            }
          }
        }
      }
    }

    this.lastBlockHeight = latestHeight;
  }
}
