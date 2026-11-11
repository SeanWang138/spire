/**
 * SpireFi - Autonomous Keeper
 *
 * One tick:
 *  a. read get_meta() + get_tower() (all floors)
 *  b. if the block timestamp passed meta.next_epoch_in_ns -> update_meta()
 *  c. for every new (floor, epoch) -> build a signed AI proposal and apply_ai_proposal
 *  d. resolve_expired(floor) for expired floors, surface Floor 3 enrage ticks
 *
 * Contract calls use near-api-js with the keeper key from env
 * (KEEPER_ACCOUNT_ID / KEEPER_PRIVATE_KEY). mockMode keeps the loop hermetic
 * for tests: no RPC, no signing of live proposals, no network.
 */

import { connect, keyStores, KeyPair, Account } from "near-api-js";
import {
  AiStateResponse,
  FloorResponse,
  MetaResponse,
  SignedAiProposal,
  Triple,
  toBigInt,
  MAX_FLOOR,
} from "./types.js";
import { NearAiTeeClient } from "./tee.js";
import { validateProposalInvariants, toProposalPayload } from "./tee.js";

export const FLOOR3_ENRAGE_INTERVAL_NS = 300n * 1_000_000_000n; // 5 minutes

export const GAS_APPLY_AI_PROPOSAL = 300n * 1_000_000_000_000n;
export const GAS_UPDATE_META = 150n * 1_000_000_000_000n;
export const GAS_RESOLVE_EXPIRED = 150n * 1_000_000_000_000n;

export interface KeeperConfig {
  rpcUrl?: string;
  contractId?: string;
  keeperAccountId?: string;
  keeperPrivateKey?: string;
  pollIntervalMs?: number;
  mockMode?: boolean;
  networkId?: string;
  teeClient?: NearAiTeeClient;
}

export interface KeeperMockState {
  meta: MetaResponse;
  floors: FloorResponse[];
  blockTimestampNs?: number | string;
  /** Optional per-floor AI state; defaults to neutral 10000 bps / nonce 0. */
  aiStates?: Record<number, AiStateResponse>;
}

export interface KeeperTickResult {
  blockTimestampNs: string;
  epoch: number;
  floors: FloorResponse[];
  /** Human readable actions that were executed or attempted. */
  actions: string[];
  proposals: SignedAiProposal[];
  errors: string[];
}

export interface CallResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Floor 3 enrage is applied lazily by the contract on the next attack; the keeper
 * only surfaces that a tick is due so ops can see a stalled boss.
 */
export function evaluateEnrageTick(floor: FloorResponse, nowNs: bigint): bigint | null {
  if (floor.floor !== 3 || floor.floor_start_ns === undefined || floor.enrage_ticks === undefined) {
    return null;
  }
  const elapsed = nowNs - toBigInt(floor.floor_start_ns);
  if (elapsed <= 0n) return null;
  const expectedTicks = elapsed / FLOOR3_ENRAGE_INTERVAL_NS;
  return expectedTicks > BigInt(floor.enrage_ticks) ? expectedTicks : null;
}

/**
 * Accepts both `[...]` and `{ floors: [...] }` shapes from get_tower, and drops
 * entries without a usable floor number.
 */
export function normalizeTower(raw: unknown): FloorResponse[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { floors?: unknown }).floors)
      ? ((raw as { floors: unknown[] }).floors as unknown[])
      : [];

  return list
    .filter((entry): entry is FloorResponse => !!entry && typeof entry === "object")
    .filter((entry) => Number.isInteger(entry.floor) && entry.floor >= 1);
}

export class SpireKeeper {
  private rpcUrl: string;
  private contractId: string;
  private keeperAccountId: string;
  private keeperPrivateKey: string;
  private pollIntervalMs: number;
  private networkId: string;
  private mockMode: boolean;
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private teeClient: NearAiTeeClient;
  private account: Account | null = null;

  private mockState: KeeperMockState | null = null;
  private lastNonce = 0;
  private submittedEpochs = new Set<string>();

  constructor(config: KeeperConfig = {}) {
    this.rpcUrl = config.rpcUrl || process.env.NEAR_RPC_URL || "https://test.rpc.fastnear.com";
    this.contractId = config.contractId || process.env.CONTRACT_ID || "spire.testnet";
    this.keeperAccountId =
      config.keeperAccountId || process.env.KEEPER_ACCOUNT_ID || "keeper.spire.testnet";
    this.keeperPrivateKey = config.keeperPrivateKey ?? process.env.KEEPER_PRIVATE_KEY ?? "";
    this.pollIntervalMs = config.pollIntervalMs ?? Number(process.env.POLL_INTERVAL_MS || 5000);
    this.networkId = config.networkId || "testnet";
    // Same explicit switch as the TEE client: never silently run in mock mode.
    this.mockMode = config.mockMode ?? process.env.MOCK_TEE === "true";
    this.teeClient =
      config.teeClient ?? new NearAiTeeClient({ mockMode: this.mockMode });
  }

  /** Hermetic state for tests / dry runs. */
  public setMockTelemetry(state: KeeperMockState): void {
    if (!this.mockMode) {
      throw new Error("setMockTelemetry requires mockMode: true");
    }
    this.mockState = state;
  }

  public isMockMode(): boolean {
    return this.mockMode;
  }

  // ---------------------------------------------------------------- contract IO

  private async rpcQuery<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: `spirefi-${method}`, method, params }),
    });

    if (!response.ok) {
      throw new Error(`RPC HTTP ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as any;
    if (json.error) {
      throw new Error(`RPC error in ${method}: ${JSON.stringify(json.error)}`);
    }
    return json.result as T;
  }

  public async callViewMethod<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.rpcQuery<{ result: number[] }>("query", {
      request_type: "call_function",
      finality: "final",
      account_id: this.contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    return JSON.parse(Buffer.from(result.result).toString("utf-8")) as T;
  }

  /** Latest final block timestamp in nanoseconds. */
  public async getBlockTimestampNs(): Promise<bigint> {
    const block = await this.rpcQuery<{ header: { timestamp_nanosec?: string; timestamp?: number } }>(
      "block",
      { finality: "final" }
    );
    const raw = block.header.timestamp_nanosec ?? block.header.timestamp ?? 0;
    return toBigInt(raw);
  }

  private async getAccount(): Promise<Account> {
    if (!this.account) {
      const keyStore = new keyStores.InMemoryKeyStore();
      await keyStore.setKey(
        this.networkId,
        this.keeperAccountId,
        KeyPair.fromString(this.keeperPrivateKey)
      );
      // near-api-js 5 surfaces an empty/incorrect ConnectConfig type under NodeNext,
      // so the config is built as a value and cast once here.
      const config = {
        networkId: this.networkId,
        nodeUrl: this.rpcUrl,
        keyStore,
      };
      const near = await connect(config as unknown as Parameters<typeof connect>[0]);
      this.account = await near.account(this.keeperAccountId);
    }
    return this.account;
  }

  /** Sends a change-method call; mockMode returns a synthetic tx hash. */
  public async callChangeMethod(
    methodName: string,
    args: Record<string, unknown> = {},
    gas: bigint = GAS_UPDATE_META,
    attachedDepositYocto: bigint = 0n
  ): Promise<CallResult> {
    if (this.mockMode) {
      return { success: true, txHash: `mock-tx-${methodName}-${Date.now()}` };
    }
    try {
      const account = await this.getAccount();
      const outcome = await account.functionCall({
        contractId: this.contractId,
        methodName,
        args,
        gas,
        attachedDeposit: attachedDepositYocto,
      });
      return { success: true, txHash: outcome.transaction_outcome.id };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  // ---------------------------------------------------------------------- state

  public async readState(): Promise<{ meta: MetaResponse; floors: FloorResponse[] }> {
    if (this.mockState) {
      return { meta: this.mockState.meta, floors: this.mockState.floors };
    }

    const meta = await this.callViewMethod<MetaResponse>("get_meta");

    let floors: FloorResponse[] = [];
    try {
      floors = normalizeTower(await this.callViewMethod<unknown>("get_tower"));
    } catch {
      // Older deployments expose per-floor views only.
      for (let floor = 1; floor <= MAX_FLOOR; floor++) {
        try {
          floors.push(await this.callViewMethod<FloorResponse>("get_floor", { floor }));
        } catch {
          // floor not deployed yet
        }
      }
    }

    return { meta, floors };
  }

  // ----------------------------------------------------------------------- ticks

  private isEpochDue(meta: MetaResponse, blockTimeNs: bigint): boolean {
    // next_epoch_in_ns is the absolute contract timestamp (ns) when update_meta becomes callable.
    const next = toBigInt(meta.next_epoch_in_ns ?? 0);
    return next > 0n && blockTimeNs >= next;
  }

  private async readAiState(floor: number, meta: MetaResponse): Promise<AiStateResponse> {
    if (this.mockState) {
      // Mock default models a floor with NO proposal applied yet this epoch
      // (epoch 0 < any real epoch), so keepers can still propose.
      return (
        this.mockState.aiStates?.[floor] ?? {
          floor,
          epoch: 0,
          buyback_multiplier_bps: [10000, 10000, 10000],
          nonce: 0,
        }
      );
    }
    return this.callViewMethod<AiStateResponse>("get_ai_state", { floor });
  }

  private async submitProposalForFloor(
    floor: number,
    meta: MetaResponse,
    actions: string[],
    proposals: SignedAiProposal[],
    errors: string[]
  ): Promise<void> {
    const key = `${floor}:${meta.epoch}`;
    if (this.submittedEpochs.has(key)) return;

    let aiState: AiStateResponse;
    try {
      aiState = await this.readAiState(floor, meta);
    } catch (err: any) {
      errors.push(`get_ai_state(${floor}) failed: ${err?.message || String(err)}`);
      return;
    }

    // E_SAME_EPOCH guard: a proposal is only valid for a NEW epoch. If the floor's
    // AI state already reflects the current epoch (or newer), skip and retry on
    // the next rollover instead of handing the contract E_SAME_EPOCH.
    if ((aiState.epoch ?? 0) >= meta.epoch) {
      actions.push(`ai_proposal_skipped:${floor}:epoch_${aiState.epoch}_already_applied`);
      return;
    }

    const currentBuyback: Triple = aiState.buyback_multiplier_bps ?? [10000, 10000, 10000];
    const nonce = Math.max(aiState.nonce ?? 0, this.lastNonce) + 1;

    let signed: SignedAiProposal;
    try {
      signed = await this.teeClient.getProposal({
        floor,
        epoch: meta.epoch,
        currentBuyback,
        supply: meta.supply,
        nonce,
      });
    } catch (err: any) {
      errors.push(`proposal(floor ${floor}, epoch ${meta.epoch}) failed: ${err?.message || String(err)}`);
      return;
    }

    const validation = validateProposalInvariants(signed.proposal, { currentBuyback });
    if (!validation.valid) {
      errors.push(`proposal(floor ${floor}) rejected locally: ${validation.errors.join("; ")}`);
      return;
    }

    const result = await this.callChangeMethod(
      "apply_ai_proposal",
      {
        floor,
        proposal: toProposalPayload(signed.proposal),
        chat_id: signed.chatId ?? `mock-${floor}-${meta.epoch}`,
        signature: Array.from(Buffer.from(signed.signature, "hex")),
      },
      GAS_APPLY_AI_PROPOSAL
    );

    if (!result.success) {
      errors.push(`apply_ai_proposal(floor ${floor}) failed: ${result.error}`);
      return;
    }

    this.lastNonce = signed.proposal.nonce;
    this.submittedEpochs.add(key);
    proposals.push(signed);
    actions.push(`apply_ai_proposal:${floor}:${meta.epoch}:${result.txHash ?? "ok"}`);
  }

  /**
   * Executes one keeper tick.
   */
  public async tickOnce(nowNs?: number | bigint): Promise<KeeperTickResult> {
    const actions: string[] = [];
    const proposals: SignedAiProposal[] = [];
    const errors: string[] = [];

    const blockTimeNs =
      nowNs !== undefined
        ? toBigInt(nowNs)
        : this.mockMode && this.mockState?.blockTimestampNs !== undefined
          ? toBigInt(this.mockState.blockTimestampNs)
          : this.mockMode
            ? BigInt(Date.now()) * 1_000_000n
            : await this.getBlockTimestampNs().catch((err) => {
                errors.push(`block timestamp failed: ${err?.message || String(err)}`);
                return 0n;
              });

    let meta: MetaResponse;
    let floors: FloorResponse[];
    try {
      ({ meta, floors } = await this.readState());
    } catch (err: any) {
      errors.push(`state read failed: ${err?.message || String(err)}`);
      return { blockTimestampNs: blockTimeNs.toString(), epoch: 0, floors: [], actions, proposals, errors };
    }

    // (b) epoch rollover
    if (this.isEpochDue(meta, blockTimeNs)) {
      const result = await this.callChangeMethod("update_meta", {}, GAS_UPDATE_META);
      if (result.success) {
        actions.push(`update_meta:epoch=${meta.epoch}:${result.txHash ?? "ok"}`);
      } else {
        errors.push(`update_meta failed: ${result.error}`);
      }
    }

    // (d) expired floors + enrage visibility
    for (const floor of floors) {
      const deadline = toBigInt(floor.deadline_ns ?? 0);
      const alive = (floor.boss_hp ?? 1) > 0;
      if (deadline > 0n && blockTimeNs >= deadline && alive) {
        const result = await this.callChangeMethod(
          "resolve_expired",
          { floor: floor.floor },
          GAS_RESOLVE_EXPIRED
        );
        if (result.success) {
          actions.push(`resolve_expired:${floor.floor}:${result.txHash ?? "ok"}`);
        } else {
          errors.push(`resolve_expired(${floor.floor}) failed: ${result.error}`);
        }
      }

      const enrageTicks = evaluateEnrageTick(floor, blockTimeNs);
      if (enrageTicks !== null) {
        actions.push(`tick_enrage:${floor.floor}:${enrageTicks.toString()}`);
      }
    }

    // (c) one proposal per (floor, epoch); never for defeated floors (tower
    // complete on that floor - e.g. floor 3 tumbang - means no economy to steer).
    const bossHpByFloor = new Map(floors.map((f) => [f.floor, f.boss_hp]));
    for (let floor = 1; floor <= MAX_FLOOR; floor++) {
      try {
        const bossHp = bossHpByFloor.get(floor);
        if (bossHp !== undefined && bossHp <= 0) {
          actions.push(`ai_proposal_skipped:${floor}:floor_defeated`);
          continue;
        }
        await this.submitProposalForFloor(floor, meta, actions, proposals, errors);
      } catch (err: any) {
        errors.push(`floor ${floor} proposal error: ${err?.message || String(err)}`);
      }
    }

    return {
      blockTimestampNs: blockTimeNs.toString(),
      epoch: meta.epoch,
      floors,
      actions,
      proposals,
      errors,
    };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const loop = async () => {
      if (!this.isRunning) return;
      try {
        const result = await this.tickOnce();
        for (const action of result.actions) console.log(`[Keeper] ${action}`);
        for (const error of result.errors) console.error(`[Keeper] ${error}`);
      } catch (err) {
        console.error("[Keeper] tick failed:", err);
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(loop, this.pollIntervalMs);
        }
      }
    };

    void loop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
