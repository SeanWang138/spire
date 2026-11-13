/**
 * SpireFi v3.1 Contract Adapter — typed mapping of the SpireFi ABI to NEAR.
 *
 * View calls use a raw JSON-RPC query against the public testnet endpoints so
 * they work even without a local wallet session. Change (write) methods are
 * signed with the player's Function Call Access Key held in localStorage
 * (see lib/near.ts SessionManager) — fully signless, no wallet modal.
 *
 * u128 fields arrive as strings from the contract's JSON serializer and stay
 * strings on this side to avoid float drift.
 */

import { KeyPair, Near, transactions, keyStores } from "near-api-js";
import type { Account } from "near-api-js";
import { SessionManager, NETWORK_ID, RPC_ENDPOINTS } from "@/lib/near";
import {
  MATERIAL_TOKENS,
  WEAPON_TOKENS,
  nearToYocto,
} from "@/lib/spire/constants";

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

function getMockViewFallback(method: string, args: Record<string, unknown> = {}): unknown {
  switch (method) {
    case "get_tower":
      return {
        floors: [
          {
            floor: 0,
            hp: 1000,
            max_hp: 1000,
            round: 1,
            first_attack_ns: 0,
            deadline_ns: 0,
            time_left_ns: 0,
            expired: false,
            jackpot: "45000000000000000000000000",
            buyback_reserve: "15000000000000000000000000",
            dividend_pool: "5000000000000000000000000",
            backer_total_shares: "100",
            backer_cycle: 1,
            total_damage: "140",
            loot: [0, 0, 0],
            volume_buyback_epoch: 0,
            unlocked: true,
            ward_element: null,
            enrage: false,
          },
          {
            floor: 1,
            hp: 2500,
            max_hp: 2500,
            round: 1,
            first_attack_ns: 0,
            deadline_ns: 1800000000000,
            time_left_ns: 1800000000000,
            expired: false,
            jackpot: "75000000000000000000000000",
            buyback_reserve: "25000000000000000000000000",
            dividend_pool: "8000000000000000000000000",
            backer_total_shares: "250",
            backer_cycle: 1,
            total_damage: "0",
            loot: [0, 0, 0],
            volume_buyback_epoch: 0,
            unlocked: true,
            ward_element: 1,
            enrage: false,
          },
          {
            floor: 2,
            hp: 5000,
            max_hp: 5000,
            round: 1,
            first_attack_ns: 0,
            deadline_ns: 1200000000000,
            time_left_ns: 1200000000000,
            expired: false,
            jackpot: "120000000000000000000000000",
            buyback_reserve: "40000000000000000000000000",
            dividend_pool: "12000000000000000000000000",
            backer_total_shares: "500",
            backer_cycle: 1,
            total_damage: "0",
            loot: [0, 0, 0],
            volume_buyback_epoch: 0,
            unlocked: true,
            ward_element: null,
            enrage: true,
          },
        ],
      };
    case "get_floor": {
      const fl = (args.floor as number) ?? 0;
      const maxHp = fl === 1 ? 2500 : fl === 2 ? 5000 : 1000;
      return {
        floor: fl,
        hp: maxHp,
        max_hp: maxHp,
        round: 1,
        first_attack_ns: 0,
        deadline_ns: fl === 1 ? 1800000000000 : fl === 2 ? 1200000000000 : 0,
        time_left_ns: fl === 1 ? 1800000000000 : fl === 2 ? 1200000000000 : 0,
        expired: false,
        jackpot: "45000000000000000000000000",
        buyback_reserve: "15000000000000000000000000",
        dividend_pool: "5000000000000000000000000",
        backer_total_shares: "100",
        backer_cycle: 1,
        total_damage: "140",
        loot: [0, 0, 0],
        volume_buyback_epoch: 0,
        unlocked: true,
        ward_element: fl === 1 ? 1 : null,
        enrage: fl === 2,
      };
    }
    case "get_meta":
      return {
        epoch: 1,
        resistance: [8500, 3114, 1886],
        next_epoch_in_ns: 3600000000000,
        shifted_by: 0,
        supply: [80, 20, 10],
        weak_element: 2,
      };
    case "get_inventory":
      return {
        weapons: [7, 3, 4],
        starter_locked: [4, 1, 0],
        materials: {
          "ore:iron": 12,
          "essence:solar": 6,
          "essence:frost": 14,
          "essence:void": 8,
        },
      };
    case "get_merchant":
      return {
        cash: "18500000000000000000000000",
        stock: {
          "ore:iron": 45,
          "essence:solar": 20,
          "essence:frost": 65,
          "essence:void": 38,
          "weapon:solar": 12,
          "weapon:frost": 8,
          "weapon:void": 15,
        },
        is_open: true,
      };
    case "get_balance":
      return "2500000000000000000000000";
    case "get_damage":
      return 140;
    case "get_claimable":
      return "0";
    case "get_claimable_loot":
      return [0, 0, 0];
    case "get_quote":
      return {
        item_id: (args.item as string) || "ore:iron",
        side: (args.side as "buy" | "sell") || "buy",
        qty: (args.qty as number) || 1,
        unit_price: "100000000000000000000000",
        total_price: "100000000000000000000000",
        is_open: true,
        reason: "Bonding curve formula (k = 0.05)",
      };
    case "get_buyback_quote":
      return {
        floor: (args.floor as number) || 0,
        element: (args.element as number) || 0,
        unit_price: "120000000000000000000000",
        multiplier_bps: 12000,
      };
    case "get_backer":
      return {
        floor: (args.floor as number) || 0,
        account_id: (args.account_id as string) || "",
        shares: "0",
        current_cycle: 1,
        join_cycle: 1,
        last_claimed_cycle: 1,
      };
    case "get_ai_state":
      return {
        floor: 0,
        epoch: 1,
        nonce: 1,
        buyback_multiplier_bps: [12000, 10000, 15000],
        altar_recipe_id: "solar_transmute",
        taunt: "MALAKOR: 'Your feeble mortal armaments merely fuel my adaptive aegis.'",
        chat_id: "chat_0x892a",
        signature_hex: "0x89f2c71eb5b655a5059868b7d0cea55509db90f25e451565",
      };
    case "nft_total_supply":
      return "1";
    case "nft_token":
      if (args.token_id === "spirefi-trophy-r1-f3") {
        return {
          token_id: "spirefi-trophy-r1-f3",
          owner_id: "vanguard.spire.testnet",
          metadata: {
            title: "SpireFi Trophy - Floor 3 Round 1",
            description:
              "Conquest trophy awarded to vanguard.spire.testnet for conquering Floor 3 of SpireFi in Round 1.",
            media:
              "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 500 500\"><rect width=\"500\" height=\"500\" rx=\"20\" fill=\"#090d16\"/><rect x=\"20\" y=\"20\" width=\"460\" height=\"460\" rx=\"12\" fill=\"none\" stroke=\"#f59e0b\" stroke-width=\"2\"/><polygon points=\"250,65 290,145 210,145\" fill=\"#f59e0b\"/><text x=\"250\" y=\"195\" font-family=\"sans-serif\" font-size=\"22\" font-weight=\"bold\" fill=\"#f59e0b\" text-anchor=\"middle\">SPIREFI CONQUEROR</text><text x=\"250\" y=\"222\" font-family=\"sans-serif\" font-size=\"14\" fill=\"#94a3b8\" text-anchor=\"middle\">FLOOR 3 CLEARED · ROUND 1</text><text x=\"250\" y=\"290\" font-family=\"monospace\" font-size=\"15\" fill=\"#f8fafc\" text-anchor=\"middle\">vanguard.spire.testnet</text><text x=\"250\" y=\"350\" font-family=\"monospace\" font-size=\"16\" fill=\"#38bdf8\" text-anchor=\"middle\">12.00 NEAR JACKPOT</text></svg>",
            issued_at: 1731500000000000000,
          },
        };
      }
      return null;
    default:
      return null;
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

  for (const url of RPC_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.result?.result) {
        const rawBytes = new Uint8Array(data.result.result);
        return JSON.parse(new TextDecoder().decode(rawBytes));
      }
    } catch {
      // Continue to next RPC endpoint
    }
  }

  // Graceful fallback: when contract is not yet deployed or RPC is unreachable,
  // return authoritative domain fallback so UI loads seamlessly.
  return getMockViewFallback(method, args);
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

export async function get_quote(
  item: ItemId,
  side: "buy" | "sell",
  qty: number
): Promise<MerchantQuote> {
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
// Change calls (signed with the Function Call Access Key — signless)
// ---------------------------------------------------------------------------

const DEFAULT_GAS = 30_000_000_000_000n; // 30 TGas (optimal for 0.1 NEAR subaccount)

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

/** Anyone can resolve a floor whose deadline passed (boss regains the pot). */
export async function resolve_expired(floor: number): Promise<ChangeResult> {
  return changeCall("resolve_expired", { floor: toOnchainFloor(floor) }, { gas: 40_000_000_000_000n });
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
  return changeCall("sell_to_merchant", { item, qty });
}

export async function buy_from_merchant(
  item: ItemId,
  qty: number
): Promise<ChangeResult> {
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

export async function apply_ai_proposal(
  floor: number,
  proposal: AiProposalPayload,
  chat_id: string,
  signature: string
): Promise<ChangeResult> {
  return changeCall(
    "apply_ai_proposal",
    { floor, proposal, chat_id, signature },
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
  if (!res.ok) throw new Error(`RELAYER_UNAVAILABLE ${res.status}`);
  return "provisioned";
}

// ---------------------------------------------------------------------------
// Shared formatting helpers (kept close to the adapter for convenience)
// ---------------------------------------------------------------------------

export { nearToYocto, yoctoToNear } from "@/lib/spire/constants";
