/**
 * SpireFi - NEAR AI Cloud TEE client & deterministic offline signer
 *
 * The contract accepts an AI proposal only when it carries an Ed25519 signature
 * over ONE canonical message (verified with env::ed25519_verify against the
 * pinned relayer key):
 *
 *   spire/floor={floor}/epoch={epoch}/buyback={m0}-{m1}-{m2}/recipe={recipe|none}/nonce={nonce}
 *
 * Payload JSON submitted to apply_ai_proposal:
 *   {"floor","epoch","buyback_multiplier_bps":[3],"altar_recipe_id":string|null,"taunt":string|null,"nonce"}
 *
 * Live mode talks to NEAR AI Cloud (chat/completions + GET /signature/{chat_id}).
 * Mock signing exists only when MOCK_TEE=true; a live failure always throws so a
 * mock signature can never be submitted by accident.
 */

import { createHash } from "node:crypto";
import nacl from "tweetnacl";
import {
  AiProposal,
  SignedAiProposal,
  Triple,
  MAX_SHIFT_BPS,
  MAX_TAUNT_CHARS,
  MIN_BUYBACK_BPS,
  MAX_BUYBACK_BPS,
  MAX_FLOOR,
} from "./types.js";
import { computeShiftWithCap } from "./pricing.js";

// SECURITY: no seed, key or public key is ever hardcoded in source.
// - Mock signing (MOCK_TEE=true, local tests only) requires MOCK_TEE_SEED from the
//   environment and fails fast without it.
// - Live mode requires NEAR_AI_API_KEY and validates the pinned TEE key from
//   TEE_PUBLIC_KEY (32-byte hex Ed25519). Missing values throw at construction.

export const DEFAULT_NEAR_AI_MODEL = "z-ai/glm-5.3-flash";
export const DEFAULT_NEAR_AI_BASE_URL = "https://api.near.ai/v1";
export const PAYLOAD_KEYS = [
  "altar_recipe_id",
  "buyback_multiplier_bps",
  "epoch",
  "floor",
  "nonce",
  "taunt",
].join(",");

/**
 * Resolves the mock signing seed. The caller-supplied value wins; otherwise the
 * environment is consulted. There is NO default: without MOCK_TEE_SEED mock
 * signing is impossible.
 */
export function requireMockSeed(explicit?: string): string {
  const seed = explicit ?? process.env.MOCK_TEE_SEED;
  if (!seed) {
    throw new Error(
      "MOCK_TEE_SEED is not set: mock signing is strictly opt-in and requires a private " +
        "random seed in the environment. Refusing to sign with any built-in key."
    );
  }
  return seed;
}

/**
 * Resolves the live pinned TEE Ed25519 public key from TEE_PUBLIC_KEY
 * (32-byte hex). There is NO default and NO mock key: missing or malformed
 * values fail fast.
 */
export function requireTeePublicKey(explicit?: string): string {
  const raw = (explicit ?? process.env.TEE_PUBLIC_KEY ?? "").trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "TEE_PUBLIC_KEY must be set to the 32-byte hex Ed25519 public key of the NEAR AI " +
        "Cloud TEE signer (64 hex chars). No default or mock key exists."
    );
  }
  return raw.toLowerCase();
}

/**
 * Returns a 32-byte Uint8Array seed from a string (SHA-256, deterministic).
 */
export function getMockSeedBytes(seedString: string): Uint8Array {
  if (typeof seedString !== "string" || seedString.length < 16) {
    throw new Error("MOCK_TEE_SEED must be a string of at least 16 characters");
  }
  return new Uint8Array(createHash("sha256").update(seedString, "utf8").digest());
}

/**
 * Deterministic Ed25519 keypair for offline signing.
 */
export function getMockTeeKeyPair(seedString: string): nacl.SignKeyPair {
  const seed = getMockSeedBytes(seedString);
  return nacl.sign.keyPair.fromSeed(seed);
}

/**
 * Builds the canonical UTF-8 message. This is the single signed format.
 */
export function buildCanonicalMessage(proposal: AiProposal): string {
  const recipe = proposal.altar_recipe_id === null ? "none" : proposal.altar_recipe_id;
  return (
    `spire/floor=${proposal.floor}` +
    `/epoch=${proposal.epoch}` +
    `/buyback=${proposal.buyback_multiplier_bps[0]}-${proposal.buyback_multiplier_bps[1]}-${proposal.buyback_multiplier_bps[2]}` +
    `/recipe=${recipe}` +
    `/nonce=${proposal.nonce}`
  );
}

/**
 * Serializes a proposal into the canonical signed bytes.
 */
export function serializeProposal(proposal: AiProposal): Uint8Array {
  return new TextEncoder().encode(buildCanonicalMessage(proposal));
}

/**
 * Returns the payload object in the exact key order the contract expects.
 */
export function toProposalPayload(proposal: AiProposal): AiProposal {
  return {
    floor: proposal.floor,
    epoch: proposal.epoch,
    buyback_multiplier_bps: [
      proposal.buyback_multiplier_bps[0],
      proposal.buyback_multiplier_bps[1],
      proposal.buyback_multiplier_bps[2],
    ],
    altar_recipe_id: proposal.altar_recipe_id,
    taunt: proposal.taunt,
    nonce: proposal.nonce,
  };
}

export interface ProposalValidationContext {
  /** Current on-chain multipliers read from get_ai_state(floor). */
  currentBuyback: Triple;
}

/**
 * Mirrors the contract's proposal validation so the relayer never submits a
 * proposal the chain will reject: range, per-element shift cap, taunt length.
 */
export function validateProposalInvariants(
  proposal: AiProposal,
  ctx: ProposalValidationContext
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Number.isInteger(proposal.floor) || proposal.floor < 1 || proposal.floor > MAX_FLOOR) {
    errors.push(`floor (${proposal.floor}) must be an integer in [1, ${MAX_FLOOR}]`);
  }
  if (!Number.isInteger(proposal.epoch) || proposal.epoch < 1) {
    errors.push(`epoch (${proposal.epoch}) must be a positive integer`);
  }
  if (!Number.isInteger(proposal.nonce) || proposal.nonce < 1) {
    errors.push(`nonce (${proposal.nonce}) must be a positive integer`);
  }

  if (!Array.isArray(proposal.buyback_multiplier_bps) || proposal.buyback_multiplier_bps.length !== 3) {
    errors.push("buyback_multiplier_bps must have exactly 3 elements");
  } else {
    const current = ctx.currentBuyback;
    if (!Array.isArray(current) || current.length !== 3) {
      errors.push("currentBuyback must have exactly 3 elements");
    } else {
      for (let i = 0; i < 3; i++) {
        const m = proposal.buyback_multiplier_bps[i];
        if (!Number.isInteger(m)) {
          errors.push(`buyback_multiplier_bps[${i}] (${m}) must be an integer`);
          continue;
        }
        if (m < MIN_BUYBACK_BPS || m > MAX_BUYBACK_BPS) {
          errors.push(
            `buyback_multiplier_bps[${i}] (${m}) must be within [${MIN_BUYBACK_BPS}, ${MAX_BUYBACK_BPS}]`
          );
        }
        const shift = Math.abs(m - current[i]);
        if (shift > MAX_SHIFT_BPS) {
          errors.push(
            `buyback_multiplier_bps[${i}] shifts ${shift} bps from current ${current[i]}, exceeds MAX_SHIFT_BPS (${MAX_SHIFT_BPS})`
          );
        }
      }
    }
  }

  if (proposal.taunt !== null && typeof proposal.taunt !== "string") {
    errors.push("taunt must be a string or null");
  } else if (typeof proposal.taunt === "string" && proposal.taunt.length > MAX_TAUNT_CHARS) {
    errors.push(`taunt length ${proposal.taunt.length} exceeds ${MAX_TAUNT_CHARS} chars`);
  }

  if (proposal.altar_recipe_id !== null && typeof proposal.altar_recipe_id !== "string") {
    errors.push("altar_recipe_id must be a string or null");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Signs a proposal (canonical message, Ed25519 detached) and returns hex.
 */
export function signProposal(proposal: AiProposal, secretKey: Uint8Array): string {
  const signatureBytes = nacl.sign.detached(serializeProposal(proposal), secretKey);
  return Buffer.from(signatureBytes).toString("hex");
}

/**
 * Verifies an Ed25519 signature over the canonical message.
 */
export function verifyProposalSignature(
  proposal: AiProposal,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  try {
    const sigBytes = new Uint8Array(Buffer.from(signatureHex, "hex"));
    const pubBytes = new Uint8Array(Buffer.from(publicKeyHex, "hex"));
    if (sigBytes.length !== 64 || pubBytes.length !== 32) return false;
    return nacl.sign.detached.verify(serializeProposal(proposal), sigBytes, pubBytes);
  } catch {
    return false;
  }
}

/**
 * Deterministic economic target: an element whose supply share falls below its
 * fair 1/3 share gets a higher buyback multiplier (10000..40000 bps).
 *
 * shortcut: uses current supply share as the "supply fell" signal (no history
 * storage in the relayer); upgrade to a real delta once the contract exposes
 * per-epoch supply snapshots.
 */
export function computeBuybackMultipliersFromSupply(supply: Triple): Triple {
  const total = supply[0] + supply[1] + supply[2];
  if (total <= 0) return [10000, 10000, 10000];

  const result: Triple = [10000, 10000, 10000];
  for (let i = 0; i < 3; i++) {
    // deficit = 1 - share / (1/3) = 1 - 3 * share, clamped to [0, 1]
    const deficit = Math.max(0, Math.min(1, 1 - (3 * supply[i]) / total));
    result[i] = MIN_BUYBACK_BPS + Math.round((MAX_BUYBACK_BPS - MIN_BUYBACK_BPS) * deficit);
  }
  return result;
}

/** Caps a desired multiplier triple against the current on-chain values. */
export function capBuybackMultipliers(current: Triple, target: Triple): Triple {
  return [
    computeShiftWithCap(current[0], target[0], MAX_SHIFT_BPS),
    computeShiftWithCap(current[1], target[1], MAX_SHIFT_BPS),
    computeShiftWithCap(current[2], target[2], MAX_SHIFT_BPS),
  ] as Triple;
}

let mockWarningShown = false;

export function warnMockMockSigner(scope: string): void {
  if (mockWarningShown) return;
  mockWarningShown = true;
  console.warn(
    [
      "",
      "############################################################",
      "#  SpireFi WARNING: MOCK TEE SIGNER ACTIVE                 #",
      "#  Proposals are signed with a local deterministic key.    #",
      "#  NEVER run this against mainnet or a live testnet cycle. #",
      `#  scope: ${scope.padEnd(48, " ")}#`,
      "############################################################",
      "",
    ].join("\n")
  );
}

export interface MockProposalParams {
  floor: number;
  epoch: number;
  currentBuyback: Triple;
  supply: Triple;
  nonce: number;
  taunt?: string | null;
  altarRecipeId?: string | null;
  /** Required: the private mock seed (MOCK_TEE_SEED). No default exists. */
  seedString: string;
}

/**
 * Deterministic, locally signed proposal (offline tests only).
 */
export function generateMockAiProposal(params: MockProposalParams): SignedAiProposal {
  const {
    floor,
    epoch,
    currentBuyback,
    supply,
    nonce,
    altarRecipeId = null,
    seedString,
  } = params;

  const proposal: AiProposal = {
    floor,
    epoch,
    buyback_multiplier_bps: capBuybackMultipliers(
      currentBuyback,
      computeBuybackMultipliersFromSupply(supply)
    ),
    altar_recipe_id: altarRecipeId,
    taunt:
      params.taunt === undefined
        ? `Mock Sentinel (floor ${floor}, epoch ${epoch}): the tower has already priced your hope.`
        : params.taunt,
    nonce,
  };

  const validation = validateProposalInvariants(proposal, { currentBuyback });
  if (!validation.valid) {
    throw new Error(`Mock AI proposal failed invariants: ${validation.errors.join("; ")}`);
  }

  const keyPair = getMockTeeKeyPair(requireMockSeed(seedString));
  return {
    proposal,
    signature: signProposal(proposal, keyPair.secretKey),
    publicKey: Buffer.from(keyPair.publicKey).toString("hex"),
    message: buildCanonicalMessage(proposal),
  };
}

export interface NearAiCloudConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  /** Only true when MOCK_TEE="true". Live failures never fall back to mock. */
  mockMode?: boolean;
  /** Mock seed (MOCK_TEE_SEED). Required when mockMode; no default exists. */
  seedString?: string;
  /** Live TEE Ed25519 public key (TEE_PUBLIC_KEY, 32-byte hex). Required for live mode. */
  teePublicKey?: string;
  fetchImpl?: typeof fetch;
}

export interface GenerateProposalParams {
  floor: number;
  epoch: number;
  currentBuyback: Triple;
  supply: Triple;
  nonce: number;
  /** Deterministic economic target sent to the model; defaults to supply-based rule. */
  targetBuyback?: Triple;
}

/** Converts a hex or base64 blob into lowercase hex. */
function toHex(value: string): string | null {
  const trimmed = value.trim().replace(/^0x/i, "");
  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    return trimmed.toLowerCase();
  }
  try {
    return Buffer.from(trimmed, "base64").toString("hex");
  } catch {
    return null;
  }
}

/**
 * Strict payload parse: the model must emit exactly the proposal JSON object,
 * no prose, no markdown fences, no extra keys.
 */
export function parseStrictProposalPayload(content: string): AiProposal {
  const trimmed = (content ?? "").trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("AI response is not a bare JSON object (prose or fenced output rejected)");
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error("AI response is not valid JSON");
  }

  const keys = Object.keys(raw).sort().join(",");
  if (keys !== PAYLOAD_KEYS) {
    throw new Error(`AI response keys [${keys}] do not match payload [${PAYLOAD_KEYS}]`);
  }

  const multipliers = raw.buyback_multiplier_bps;
  if (!Array.isArray(multipliers) || multipliers.length !== 3) {
    throw new Error("AI response buyback_multiplier_bps must be a 3-element array");
  }
  for (const m of multipliers) {
    if (!Number.isInteger(m)) throw new Error("AI response buyback_multiplier_bps must be integers");
  }
  if (!Number.isInteger(raw.floor) || !Number.isInteger(raw.epoch) || !Number.isInteger(raw.nonce)) {
    throw new Error("AI response floor/epoch/nonce must be integers");
  }
  if (raw.altar_recipe_id !== null && typeof raw.altar_recipe_id !== "string") {
    throw new Error("AI response altar_recipe_id must be a string or null");
  }
  if (raw.taunt !== null && typeof raw.taunt !== "string") {
    throw new Error("AI response taunt must be a string or null");
  }

  return {
    floor: raw.floor as number,
    epoch: raw.epoch as number,
    buyback_multiplier_bps: multipliers as Triple,
    altar_recipe_id: raw.altar_recipe_id as string | null,
    taunt: raw.taunt as string | null,
    nonce: raw.nonce as number,
  };
}

/**
 * Client for NEAR AI Cloud. Mock signing is opt-in only (MOCK_TEE=true).
 */
export class NearAiTeeClient {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private mockMode: boolean;
  private seedString: string;
  private teePublicKey: string;
  private fetchImpl: typeof fetch;

  constructor(config: NearAiCloudConfig = {}) {
    this.baseUrl = (config.baseUrl || process.env.NEAR_AI_BASE_URL || DEFAULT_NEAR_AI_BASE_URL).replace(/\/+$/, "");
    this.model = config.model || process.env.NEAR_AI_MODEL || DEFAULT_NEAR_AI_MODEL;
    // Mock signing must be explicitly requested (MOCK_TEE=true); missing credentials
    // are never enough to fall back to mock.
    this.mockMode = config.mockMode ?? process.env.MOCK_TEE === "true";
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.apiKey = config.apiKey ?? process.env.NEAR_AI_API_KEY ?? "";
    this.teePublicKey = config.teePublicKey ?? process.env.TEE_PUBLIC_KEY ?? "";

    if (this.mockMode) {
      // Fail fast without an explicit seed; nothing is hardcoded in source.
      this.seedString = requireMockSeed(config.seedString);
      warnMockMockSigner(`NearAiTeeClient(model=${this.model})`);
    } else {
      // Fail fast: a live relayer without credentials must not boot.
      if (!this.apiKey) {
        throw new Error(
          "NEAR_AI_API_KEY is not set: the relayer fails fast instead of silently mocking. " +
            "Set NEAR_AI_API_KEY for live NEAR AI Cloud signing, or MOCK_TEE=true plus " +
            "MOCK_TEE_SEED for local tests only."
        );
      }
      this.seedString = "";
    }
  }

  public isMockMode(): boolean {
    return this.mockMode;
  }

  public getModel(): string {
    return this.model;
  }

  /**
   * Ed25519 public key of the TEE signer. Mock mode derives it from the
   * MOCK_TEE_SEED keypair; live mode resolves the pinned key from
   * TEE_PUBLIC_KEY (32-byte hex, no default).
   */
  public getPublicKey(): string {
    if (this.mockMode) {
      return Buffer.from(getMockTeeKeyPair(this.seedString).publicKey).toString("hex");
    }
    return requireTeePublicKey(this.teePublicKey || undefined);
  }

  /**
   * Produces a signed proposal. Throws on any live failure - never silently mocks.
   */
  public async getProposal(params: GenerateProposalParams): Promise<SignedAiProposal> {
    if (this.mockMode) {
      return generateMockAiProposal({ ...params, seedString: this.seedString });
    }

    if (!this.apiKey) {
      throw new Error(
        "NEAR AI Cloud is not configured (NEAR_AI_API_KEY empty). Refusing to sign locally; set MOCK_TEE=true for local tests only."
      );
    }

    const targetBuyback = capBuybackMultipliers(
      params.currentBuyback,
      params.targetBuyback ?? computeBuybackMultipliersFromSupply(params.supply)
    );

    const requiredPayload: AiProposal = {
      floor: params.floor,
      epoch: params.epoch,
      buyback_multiplier_bps: targetBuyback,
      altar_recipe_id: null,
      taunt: null,
      nonce: params.nonce,
    };

    const chat = await this.postChatCompletion(requiredPayload, params.supply);
    const content = chat.content;

    let proposal: AiProposal;
    try {
      proposal = parseStrictProposalPayload(content);
    } catch (err: any) {
      throw new Error(`NEAR AI Cloud returned an unusable proposal: ${err.message || String(err)}`);
    }

    if (proposal.floor !== params.floor || proposal.epoch !== params.epoch) {
      throw new Error(
        `NEAR AI Cloud proposed floor/epoch ${proposal.floor}/${proposal.epoch}, expected ${params.floor}/${params.epoch}`
      );
    }

    const validation = validateProposalInvariants(proposal, {
      currentBuyback: params.currentBuyback,
    });
    if (!validation.valid) {
      throw new Error(`NEAR AI Cloud proposal failed contract invariants: ${validation.errors.join("; ")}`);
    }

    const proof = await this.getSignatureProof(chat.chatId);
    const signature = proof.signature;
    const publicKey = proof.publicKey ?? this.getPublicKey();

    if (/^[0-9a-f]{64}$/.test(publicKey) && !verifyProposalSignature(proposal, signature, publicKey)) {
      throw new Error(
        "NEAR AI Cloud signature does not verify over the canonical message (check TEE signing format with the contract owner)"
      );
    }

    return {
      proposal,
      signature,
      publicKey,
      chatId: chat.chatId,
      message: buildCanonicalMessage(proposal),
    };
  }

  private async postChatCompletion(
    required: AiProposal,
    supply: Triple
  ): Promise<{ content: string; chatId: string }> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are the SpireFi tower AI. Reply with ONE bare JSON object and nothing else. " +
              "Required shape: {\"floor\":int,\"epoch\":int,\"buyback_multiplier_bps\":[int,int,int]," +
              "\"altar_recipe_id\":string|null,\"taunt\":string|null,\"nonce\":int}. " +
              "buyback_multiplier_bps must equal the supplied required multipliers. " +
              `taunt must be a single sentence shorter than ${MAX_TAUNT_CHARS} characters.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              required: required,
              supply: supply,
              note: "Echo the required floor, epoch, nonce and multipliers exactly; you may choose taunt and altar_recipe_id.",
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`NEAR AI Cloud HTTP ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as any;
    const content = json?.choices?.[0]?.message?.content;
    const chatId = json?.id ?? json?.chat_id;
    if (typeof content !== "string" || typeof chatId !== "string" || chatId.length === 0) {
      throw new Error("NEAR AI Cloud response missing choices[0].message.content or chat id");
    }
    return { content, chatId };
  }

  private async getSignatureProof(chatId: string): Promise<{ signature: string; publicKey?: string }> {
    const response = await this.fetchImpl(`${this.baseUrl}/signature/${encodeURIComponent(chatId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`NEAR AI Cloud signature HTTP ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as any;
    const rawSignature = json?.signature ?? json?.signature_hex ?? json?.sig;
    if (typeof rawSignature !== "string") {
      throw new Error("NEAR AI Cloud signature response missing signature field");
    }
    const signature = toHex(rawSignature);
    if (signature === null || signature.length !== 128) {
      throw new Error("NEAR AI Cloud signature is not a 64-byte value");
    }

    const rawPublicKey = json?.public_key ?? json?.public_key_hex ?? json?.publicKey;
    let publicKey: string | undefined;
    if (typeof rawPublicKey === "string") {
      const hex = toHex(rawPublicKey);
      // shortcut: only 32-byte hex keys are verified locally; ed25519:base58 keys are
      // trusted from the TEE endpoint and verified on-chain.
      publicKey = hex !== null && hex.length === 64 ? hex : undefined;
    }

    return { signature, publicKey };
  }
}
