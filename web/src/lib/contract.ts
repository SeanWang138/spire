/**
 * SpireFi v3.1 Contract Adapter — typed mapping of the SpireFi ABI to NEAR.
 *
 * View calls use a raw JSON-RPC query against the public testnet endpoints so
 * they work even without a local wallet session. Change (write) methods are
 * signed with the player's Ephemeral Testnet Session Subaccount keypair
 * (`FullAccess`, funded ~0.60 NEAR via /api/accounts, held in localStorage —
 * see lib/near.ts SessionManager) for zero-popup signless play on testnet.
 *
 * u128 fields arrive as strings from the contract's JSON serializer and stay
 * strings on this side to avoid float drift.
 */

import { KeyPair, Near, transactions, keyStores } from "near-api-js";
import type { Account } from "near-api-js";
import { SessionManager, NETWORK_ID, RPC_ENDPOINTS } from "./near";
import {
  FLOOR_COUNT,
  MATERIAL_TOKENS,
  WEAPON_TOKENS,
  nearToYocto,
} from "./spire/constants";

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID || "spire.testnet";

export const RELAYER_URL =
  process.env.NEXT_PUBLIC_RELAYER_URL || "";

// ---------------------------------------------------------------------------
// Domain types (mirrors of the v3.1 contract JSON shapes)
// ---------------------------------------------------------------------------

export type ElementIndex = 0 | 1 | 2;

export type ItemId =
  | "ore:iron"
  | "essence:solar"
  | "essence:frost"
  | "essence:void"
  | "weapon:solar"
  | "weapon:frost"
  | "weapon:void";

export type StanceIndex = 0 | 1 | 2; // 0 aggressive / 1 feint / 2 pierce

/** Per-floor live state — mirror of contract FloorResponse. */
export interface FloorResponse {
  floor: number;
  hp: number;
  max_hp: number;
  round: number;
  first_attack_ns: number;
  deadline_ns: number;
  time_left_ns: number;
  expired: boolean;
  jackpot: string;
  buyback_reserve: string;
  dividend_pool: string;
  backer_total_shares: string;
  backer_cycle: number;
  total_damage: string;
  loot: [number, number, number];
  volume_buyback_epoch: number;
  unlocked: boolean;
  ward_element: number | null;
  enrage: boolean;
}

/** All 3 floors run parallel raid cycles — mirror of contract TowerResponse. */
export interface TowerResponse {
  floors: FloorResponse[];
}

export interface MetaResponse {
  epoch: number;
  resistance: [number, number, number];
  next_epoch_in_ns: number;
  shifted_by: number;
  supply: [number, number, number];
  weak_element: number;
}

/** Player inventory — weapons & locked starter weapons as [u64;3]. */
export interface PlayerInventory {
  weapons: [number, number, number];
  starter_locked: [number, number, number];
  materials: Record<ItemId, number>;
}

export interface MerchantResponse {
  /** Merchant cash reserve, yoctoNEAR string. */
  cash: string;
  stock: Record<ItemId, number>;
  is_open: boolean;
}

export interface MerchantQuote {
  item_id: string;
  side: "buy" | "sell";
  qty: number;
  unit_price: string;
  total_price: string;
  is_open: boolean;
  reason: string;
}

export interface BuybackQuote {
  floor: number;
  element: number;
  unit_price: string;
  multiplier_bps: number;
}

export interface BackerResponse {
  floor: number;
  account_id: string;
  shares: string;
  current_cycle: number;
  join_cycle: number;
  last_claimed_cycle: number;
}

/** Boss Brain proposal persisted on-chain — mirror of contract AiState. */
export interface AiStateResponse {
  floor: number;
  epoch: number;
  nonce: number;
  buyback_multiplier_bps: [number, number, number];
  altar_recipe_id: string;
  taunt: string | null;
  chat_id: string | null;
  signature_hex: string;
}

export interface AiProposalPayload {
  /** 0-indexed on-chain floor (0..2), matching the canonical signed message. */
  floor: number;
  epoch: number;
  buyback_multiplier_bps: [number, number, number];
  altar_recipe_id: string | null;
  taunt: string | null;
  nonce: number;
}

export interface ChangeResult {
  txHash: string;
}

export interface NftTokenMetadata {
  title?: string | null;
  description?: string | null;
  media?: string | null;
  issued_at?: number | null;
}

export interface NftToken {
  token_id: string;
  owner_id: string;
  metadata: NftTokenMetadata | null;
}

// ---------------------------------------------------------------------------
// Raw RPC plumbing
// ---------------------------------------------------------------------------

function base64Args(args: Record<string, unknown>): string {
  const json = JSON.stringify(args);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

export class RpcUnavailableError extends Error {
  public readonly method: string;

  constructor(method: string, cause?: unknown) {
    const detail =
      cause instanceof Error
        ? cause.message
        : cause
          ? String(cause)
          : "all RPC endpoints failed";
    super(`VIEW_UNAVAILABLE: ${method} (${detail})`);
    this.name = "RpcUnavailableError";
    this.method = method;
  }
}

async function rpcViewRaw(
  method: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const body = {
    jsonrpc: "2.0",
    id: "spirefi-view",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "optimistic",
      account_id: CONTRACT_ID,
      method_name: method,
      args_base64: base64Args(args),
    },
  };

  let lastError: unknown;
  for (const url of RPC_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${url}`);
        continue;
      }
      const data = await res.json();
      if (data?.error) {
        lastError = new Error(
          typeof data.error?.message === "string"
            ? data.error.message
            : JSON.stringify(data.error)
        );
        continue;
      }
      if (data?.result?.error) {
        lastError = new Error(String(data.result.error));
        continue;
      }
      if (data.result?.result) {
        const rawBytes = new Uint8Array(data.result.result);
        return JSON.parse(new TextDecoder().decode(rawBytes));
      }
      lastError = new Error(`Malformed RPC response for ${method} from ${url}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw new RpcUnavailableError(method, lastError);
}

async function rpcView<T>(
  method: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  return (await rpcViewRaw(method, args)) as T;
}

// ---------------------------------------------------------------------------
// View calls (ABI v3.1)
// ---------------------------------------------------------------------------

/**
 * Floor indexing: the contract is 0-based (0/1/2), the UI is 1-based (Floor 1/2/3).
 * Every floor value crossing this adapter is converted HERE and nowhere else.
 */
function toOnchainFloor(uiFloor: number): number {
  return uiFloor - 1;
}

export async function get_floor(floor: number): Promise<FloorResponse> {
  const resp = await rpcView<FloorResponse>("get_floor", {
    floor: toOnchainFloor(floor),
  });
  return { ...resp, floor: resp.floor + 1 };
}

export async function get_tower(): Promise<TowerResponse> {
  const resp = await rpcView<{ floors?: FloorResponse[] }>("get_tower");
  return {
    floors: (resp.floors ?? []).map((f) => ({ ...f, floor: f.floor + 1 })),
  };
}

export async function get_meta(): Promise<MetaResponse> {
  return rpcView<MetaResponse>("get_meta");
}

/**
 * Legacy alias — kept only for old callers. ABI v3.1 exposes supply through
 * get_meta().supply; prefer that.
 */
export async function get_supply(): Promise<[number, number, number]> {
  const meta = await get_meta();
  return meta.supply;
}

export async function get_balance(account: string): Promise<string> {
  return rpcView<string>("get_balance", { account_id: account });
}

/** Contract inventory response → UI PlayerInventory. */
export async function get_inventory(account: string): Promise<PlayerInventory> {
  const resp = await rpcView<{
    weapons?: [number, number, number];
    starter_locked?: [number, number, number];
    materials?: Record<string, number>;
  }>("get_inventory", { account_id: account });

  const materials = {} as Record<ItemId, number>;
  for (const id of MATERIAL_TOKENS) {
    materials[id] = resp.materials?.[id] ?? 0;
  }

  return {
    weapons: resp.weapons ?? [0, 0, 0],
    starter_locked: resp.starter_locked ?? [0, 0, 0],
    materials,
  };
}

export function emptyInventory(): PlayerInventory {
  const materials = {} as Record<ItemId, number>;
  for (const id of MATERIAL_TOKENS) materials[id] = 0;
  return { weapons: [0, 0, 0], starter_locked: [0, 0, 0], materials };
}

export async function get_claimable(
  account: string,
  floor: number,
  round: number
): Promise<string> {
  return rpcView<string>("get_claimable", {
    account_id: account,
    floor: toOnchainFloor(floor),
    round,
  });
}

/** Seized tribute loot claimable for a completed (floor, round) — [u64;3]. */
export async function get_claimable_loot(
  account: string,
  floor: number,
  round: number
): Promise<[number, number, number]> {
  return rpcView<[number, number, number]>("get_claimable_loot", {
    account_id: account,
    floor: toOnchainFloor(floor),
    round,
  });
}

export async function get_merchant(): Promise<MerchantResponse> {
  const resp = await rpcView<{
    cash?: string;
    stock?: Record<string, number>;
    is_open?: boolean;
  }>("get_merchant");

  const stock = {} as Record<ItemId, number>;
  const ordered: ItemId[] = [...MATERIAL_TOKENS, ...WEAPON_TOKENS];
  for (const id of ordered) stock[id] = resp.stock?.[id] ?? 0;

  return {
    cash: resp.cash ?? "0",
    stock,
    is_open: Boolean(resp.is_open),
  };
}

function assertMerchantMaterialItem(item: string): void {
  if (
    item.startsWith("weapon:") ||
    !(MATERIAL_TOKENS as readonly string[]).includes(item)
  ) {
    throw new Error(
      `E_INVALID_ARGS: NPC Merchant trades materials only (${MATERIAL_TOKENS.join(", ")}); "${item}" is rejected client-side (sell weapons at Boss Buyback).`
    );
  }
}

export async function get_quote(
  item: ItemId,
  side: "buy" | "sell",
  qty: number
): Promise<MerchantQuote> {
  assertMerchantMaterialItem(item);
  return rpcView<MerchantQuote>("get_quote", { item, side, qty });
}

export async function get_buyback_quote(
  floor: number,
  element: ElementIndex
): Promise<BuybackQuote> {
  const resp = await rpcView<BuybackQuote>("get_buyback_quote", {
    floor: toOnchainFloor(floor),
    element,
  });
  return { ...resp, floor: resp.floor + 1 };
}

export async function get_ai_state(floor: number): Promise<AiStateResponse | null> {
  const resp = await rpcView<AiStateResponse | null>("get_ai_state", {
    floor: toOnchainFloor(floor),
  });
  if (!resp) return null;
  return { ...resp, floor: resp.floor + 1 };
}

export async function get_backer(
  floor: number,
  account: string
): Promise<BackerResponse> {
  const resp = await rpcView<BackerResponse>("get_backer", {
    floor: toOnchainFloor(floor),
    account_id: account,
  });
  return { ...resp, floor: resp.floor + 1 };
}

export async function get_damage(
  account: string,
  floor: number,
  round: number
): Promise<number> {
  return rpcView<number>("get_damage", {
    account_id: account,
    floor: toOnchainFloor(floor),
    round,
  });
}

export async function nft_total_supply(): Promise<string> {
  return rpcView<string>("nft_total_supply");
}

export async function nft_token(tokenId: string): Promise<NftToken | null> {
  return rpcView<NftToken | null>("nft_token", { token_id: tokenId });
}

// ---------------------------------------------------------------------------
// Change calls (signed with Ephemeral Testnet Session Subaccount keypair)
// ---------------------------------------------------------------------------

const DEFAULT_GAS = 30_000_000_000_000n; // 30 TGas (optimal for 0.60 NEAR subaccount)

async function signedCall(
  sessionAccountId: string,
  sessionSecretKey: string,
  methodName: string,
  args: Record<string, unknown> = {},
  opts?: { attachedDepositYocto?: string; gas?: bigint }
): Promise<ChangeResult> {
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(
    NETWORK_ID,
    sessionAccountId,
    KeyPair.fromString(sessionSecretKey as Parameters<typeof KeyPair.fromString>[0])
  );
  const near = new Near({ networkId: NETWORK_ID, nodeUrl: RPC_ENDPOINTS[0], keyStore });
  const account: Account = await near.account(sessionAccountId);

  try {
    const result = await account.signAndSendTransaction({
      receiverId: CONTRACT_ID,
      actions: [
        transactions.functionCall(
          methodName,
          args,
          opts?.gas ?? DEFAULT_GAS,
          BigInt(opts?.attachedDepositYocto ?? "0")
        ),
      ],
    });

    const txHash = result?.transaction_outcome?.id ?? "pending";
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("spire:tx", {
          detail: { method: methodName, txHash, at: Date.now() },
        })
      );
    }
    return { txHash };
  } catch (err: unknown) {
    console.error(`[SpireFi Client] On-chain call ${methodName} failed:`, err);
    throw err;
  }
}

async function requireSession() {
  const session = SessionManager.getInstance().getSession();
  if (!session) throw new Error("E_NO_SESSION");
  return session;
}

/** Generic signless call for pages that build their own args. */
export async function changeCall(
  methodName: string,
  args: Record<string, unknown> = {},
  opts?: { attachedDepositYocto?: string; gas?: bigint }
): Promise<ChangeResult> {
  const session = await requireSession();
  return signedCall(
    session.accountId,
    session.secretKey,
    methodName,
    args,
    opts
  );
}

// --- Player progression ---

export async function claim_starter(): Promise<ChangeResult> {
  return changeCall("claim_starter", {}, { gas: 30_000_000_000_000n });
}

/** Gather GATHER_AMOUNT units of one material node (cooldown + epoch cap apply). */
export async function gather(item_id: ItemId): Promise<ChangeResult> {
  return changeCall("gather", { item_id }, { gas: 30_000_000_000_000n });
}

/** Craft a weapon of the given element (0 solar / 1 frost / 2 void). */
export async function craft_weapon(element: ElementIndex): Promise<ChangeResult> {
  return changeCall("craft_weapon", { element }, { gas: 40_000_000_000_000n });
}

/** Transmute weapons: burn weapons of `burn_element` into `target_element`. */
export async function reforge(
  burn_element: ElementIndex,
  target_element: ElementIndex
): Promise<ChangeResult> {
  return changeCall("reforge", { burn_element, target_element }, { gas: 40_000_000_000_000n });
}

/**
 * Execute a raid: pick the floor, one weapon element and 3 stances
 * ([u8;3], one per turn — 0 aggressive / 1 feint / 2 pierce).
 * Ticket cost for the floor is debited from the internal ledger.
 */
export async function attack(
  floor: number,
  weapon_element: ElementIndex,
  stances: [StanceIndex, StanceIndex, StanceIndex]
): Promise<ChangeResult> {
  return changeCall(
    "attack",
    { floor: toOnchainFloor(floor), weapon_element, stances },
    { gas: 50_000_000_000_000n } // 50 TGas
  );
}

/** Claim the jackpot payout for a completed (floor, round). */
export async function claim_payout(
  floor: number,
  round: number
): Promise<ChangeResult> {
  return changeCall("claim_payout", { floor: toOnchainFloor(floor), round }, { gas: 40_000_000_000_000n });
}

/** Claim the seized-tribute loot for a completed (floor, round). */
export async function claim_jackpot(): Promise<ChangeResult> {
  return changeCall("claim_jackpot", {}, { gas: 50_000_000_000_000n });
}

/**
 * @deprecated `resolve_expired` does not exist on the live contract — lazy settlement runs on next `attack()`.
 */
export async function resolve_expired(_floor: number): Promise<ChangeResult> {
  throw new Error(
    "resolve_expired does not exist on live contract — lazy settlement runs on next attack()"
  );
}

/** Keeper/TEE admin entry point (kept for ABI completeness). */
export async function update_meta(): Promise<ChangeResult> {
  return changeCall("update_meta");
}

// --- Merchant ---

export async function sell_to_merchant(
  item: ItemId,
  qty: number
): Promise<ChangeResult> {
  assertMerchantMaterialItem(item);
  return changeCall("sell_to_merchant", { item, qty });
}

export async function buy_from_merchant(
  item: ItemId,
  qty: number
): Promise<ChangeResult> {
  assertMerchantMaterialItem(item);
  return changeCall("buy_from_merchant", { item, qty });
}

// --- Boss buyback ---

/** Sell weapons back to the Boss Brain at the AI-set multiplier. */
export async function sell_to_boss_buyback(
  floor: number,
  element: ElementIndex,
  qty: number
): Promise<ChangeResult> {
  return changeCall("sell_to_boss_buyback", {
    floor: toOnchainFloor(floor),
    element,
    qty,
  });
}

// --- Backer dividends ---

export async function claim_backer_dividend(
  floor: number,
  cycle: number
): Promise<ChangeResult> {
  return changeCall("claim_backer_dividend", {
    floor: toOnchainFloor(floor),
    cycle,
  });
}

// --- Ledger (payable) ---

/** Deposit NEAR into the internal ledger. */
export async function deposit(amountYocto: string): Promise<ChangeResult> {
  return changeCall("deposit", {}, { attachedDepositYocto: amountYocto });
}

/** Withdraw from the internal ledger. `null` withdraws the whole balance. */
export async function withdraw(amountYocto: string | null): Promise<ChangeResult> {
  return changeCall(
    "withdraw",
    { amount: amountYocto === null ? null : amountYocto }
  );
}

/** Fund a specific floor's jackpot directly (payable). */
export async function fund_jackpot(
  floor: number,
  amountYocto: string
): Promise<ChangeResult> {
  return changeCall(
    "fund_jackpot",
    { floor: toOnchainFloor(floor) },
    { attachedDepositYocto: amountYocto }
  );
}

/** Refill the merchant's cash reserve (payable). */
export async function fund_merchant(amountYocto: string): Promise<ChangeResult> {
  return changeCall("fund_merchant", {}, { attachedDepositYocto: amountYocto });
}

/** Back the Boss Vault of a floor — earns 15% ticket dividends (payable). */
export async function back_boss_vault(
  floor: number,
  amountYocto: string
): Promise<ChangeResult> {
  return changeCall(
    "back_boss_vault",
    { floor: toOnchainFloor(floor) },
    { attachedDepositYocto: amountYocto }
  );
}

// --- Boss Brain proposal (signed by the TEE, relayed) ---

/**
 * Submits a TEE-signed AI proposal for UI `floor` (1..3 -> 0-indexed `0..2`,
 * consistent with `get_ai_state`). `proposal.floor` must already match the
 * 0-indexed on-chain floor from the signed canonical message.
 */
export async function apply_ai_proposal(
  floor: number,
  proposal: AiProposalPayload,
  chat_id: string | null,
  signature: number[]
): Promise<ChangeResult> {
  const onchainFloor = toOnchainFloor(floor);
  if (!Number.isInteger(onchainFloor) || onchainFloor < 0 || onchainFloor >= FLOOR_COUNT) {
    throw new Error(`E_INVALID_ARGS: invalid UI floor ${floor}`);
  }
  if (proposal.floor !== onchainFloor) {
    throw new Error(
      `E_INVALID_PROPOSAL: proposal.floor (${proposal.floor}) must match 0-indexed contract floor (${onchainFloor}) for UI floor ${floor}`
    );
  }
  return changeCall(
    "apply_ai_proposal",
    { floor: onchainFloor, proposal, chat_id, signature },
    { gas: 200_000_000_000_000n }
  );
}

// ---------------------------------------------------------------------------
// Relayer account provisioning (signless *.spire.testnet sub-accounts)
// ---------------------------------------------------------------------------

export type ProvisionStatus = "provisioned" | "queued";

/** True when the account exists on NEAR testnet (used by the provision poller). */
export async function account_exists(accountId: string): Promise<boolean> {
  const res = await fetch(RPC_ENDPOINTS[0], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "spire",
      method: "query",
      params: {
        request_type: "view_account",
        finality: "final",
        account_id: accountId,
      },
    }),
  });
  const json = await res.json();
  return Boolean(json?.result?.amount);
}

/**
 * Verifies on-chain whether `publicKey` is an active access key for `accountId`.
 */
export async function verify_account_key(
  accountId: string,
  publicKey: string
): Promise<boolean> {
  try {
    const res = await fetch(RPC_ENDPOINTS[0], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "spire",
        method: "query",
        params: {
          request_type: "view_access_key_list",
          finality: "final",
          account_id: accountId,
        },
      }),
    });
    const json = (await res.json()) as {
      result?: { keys?: Array<{ public_key?: string }> };
    };
    const keys = json?.result?.keys;
    if (!Array.isArray(keys)) return false;
    return keys.some((k) => k.public_key === publicKey);
  } catch {
    return false;
  }
}

export async function provision_account(
  accountId: string,
  publicKey: string
): Promise<ProvisionStatus> {
  const endpoint = RELAYER_URL ? `${RELAYER_URL}/api/accounts` : "/api/accounts";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: accountId, public_key: publicKey }),
  });
  if (!res.ok) {
    let errMsg = `RELAYER_UNAVAILABLE ${res.status}`;
    try {
      const errJson = (await res.json()) as { error?: string };
      if (res.status === 409) {
        errMsg = `ACCOUNT_EXISTS: ${errJson.error || "Account name is already taken."}`;
      } else if (errJson.error) {
        errMsg = errJson.error;
      }
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(errMsg);
  }
  return "provisioned";
}

// ---------------------------------------------------------------------------
// Shared formatting helpers (kept close to the adapter for convenience)
// ---------------------------------------------------------------------------

export { nearToYocto, yoctoToNear } from "./spire/constants";
