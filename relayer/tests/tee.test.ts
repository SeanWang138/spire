import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getMockTeeKeyPair,
  requireMockSeed,
  requireTeePublicKey,
  buildCanonicalMessage,
  serializeProposal,
  toProposalPayload,
  validateProposalInvariants,
  signProposal,
  verifyProposalSignature,
  generateMockAiProposal,
  parseStrictProposalPayload,
  computeBuybackMultipliersFromSupply,
  capBuybackMultipliers,
  NearAiTeeClient,
  DEFAULT_NEAR_AI_MODEL,
} from "../dist/tee.js";
import type { AiProposal } from "../dist/types.js";

// Test-only mock seed. Production never ships a seed in source: it must come
// from env MOCK_TEE_SEED (see requireMockSeed).
const TEST_SEED = "relayer-tee-test-seed-0123456789abcdef";

const baseProposal: AiProposal = {
  floor: 1,
  epoch: 5,
  buyback_multiplier_bps: [10000, 15000, 30000],
  altar_recipe_id: null,
  taunt: "The tower remembers every wasted swing.",
  nonce: 42,
};

describe("TEE Module - Canonical message", () => {
  it("matches the contract format exactly", () => {
    assert.strictEqual(
      buildCanonicalMessage(baseProposal),
      "spire/floor=1/epoch=5/buyback=10000-15000-30000/recipe=none/nonce=42"
    );
  });

  it("serializes to UTF-8 bytes of the canonical message", () => {
    const bytes = serializeProposal(baseProposal);
    assert.ok(bytes instanceof Uint8Array);
    assert.strictEqual(Buffer.from(bytes).toString("utf-8"), buildCanonicalMessage(baseProposal));
  });

  it("renders altar_recipe_id in the recipe slot", () => {
    const withRecipe: AiProposal = { ...baseProposal, altar_recipe_id: "altar:solar_reroll" };
    assert.strictEqual(
      buildCanonicalMessage(withRecipe),
      "spire/floor=1/epoch=5/buyback=10000-15000-30000/recipe=altar:solar_reroll/nonce=42"
    );
  });

  it("keeps the exact payload key order", () => {
    assert.deepStrictEqual(Object.keys(toProposalPayload(baseProposal)), [
      "floor",
      "epoch",
      "buyback_multiplier_bps",
      "altar_recipe_id",
      "taunt",
      "nonce",
    ]);
  });
});

describe("TEE Module - Key material policy (no hardcoded keys)", () => {
  it("derives a deterministic Ed25519 keypair from the supplied seed", () => {
    const kp1 = getMockTeeKeyPair(TEST_SEED);
    const kp2 = getMockTeeKeyPair(TEST_SEED);
    assert.strictEqual(Buffer.from(kp1.publicKey).toString("hex"), Buffer.from(kp2.publicKey).toString("hex"));
    assert.strictEqual(kp1.publicKey.length, 32);
    assert.strictEqual(kp1.secretKey.length, 64);
  });

  it("fails fast when MOCK_TEE_SEED is missing (no built-in seed)", () => {
    delete process.env.MOCK_TEE_SEED;
    assert.throws(() => requireMockSeed(), /MOCK_TEE_SEED/);
    assert.throws(() => new NearAiTeeClient({ mockMode: true }), /MOCK_TEE_SEED/);
  });

  it("accepts an explicit seed over the environment", () => {
    process.env.MOCK_TEE_SEED = "env-seed-that-should-be-overridden-xxxxx";
    assert.strictEqual(requireMockSeed(TEST_SEED), TEST_SEED);
    delete process.env.MOCK_TEE_SEED;
  });

  it("requires TEE_PUBLIC_KEY as 32-byte hex and has no default", () => {
    delete process.env.TEE_PUBLIC_KEY;
    assert.throws(() => requireTeePublicKey(), /TEE_PUBLIC_KEY/);
    assert.throws(() => requireTeePublicKey("1234"), /TEE_PUBLIC_KEY/);
    assert.throws(() => requireTeePublicKey("z".repeat(64)), /TEE_PUBLIC_KEY/);
    assert.strictEqual(requireTeePublicKey("AB".repeat(32)), "ab".repeat(32));
  });

  it("derives the mock public key from the seed only", () => {
    const client = new NearAiTeeClient({ mockMode: true, seedString: TEST_SEED });
    const expected = Buffer.from(getMockTeeKeyPair(TEST_SEED).publicKey).toString("hex");
    assert.strictEqual(client.getPublicKey(), expected);
  });

  it("resolves the live public key from TEE_PUBLIC_KEY", () => {
    const client = new NearAiTeeClient({
      mockMode: false,
      apiKey: "test-key",
      teePublicKey: "CD".repeat(32),
    });
    assert.strictEqual(client.getPublicKey(), "cd".repeat(32));
  });
});

describe("TEE Module - Signing", () => {
  it("signs and verifies the canonical message", () => {
    const keyPair = getMockTeeKeyPair(TEST_SEED);
    const signature = signProposal(baseProposal, keyPair.secretKey);
    assert.strictEqual(signature.length, 128);

    const pubKeyHex = Buffer.from(keyPair.publicKey).toString("hex");
    assert.strictEqual(verifyProposalSignature(baseProposal, signature, pubKeyHex), true);

    // Any change outside the canonical message (taunt) does not affect the signature.
    assert.strictEqual(
      verifyProposalSignature({ ...baseProposal, taunt: "other taunt" }, signature, pubKeyHex),
      true
    );

    // Economic fields are covered by the signature.
    assert.strictEqual(
      verifyProposalSignature({ ...baseProposal, buyback_multiplier_bps: [11000, 15000, 30000] }, signature, pubKeyHex),
      false
    );
    assert.strictEqual(verifyProposalSignature({ ...baseProposal, nonce: 43 }, signature, pubKeyHex), false);
    assert.strictEqual(verifyProposalSignature(baseProposal, signature.slice(0, 126) + "00", pubKeyHex), false);
  });
});

describe("TEE Module - Invariant Validation", () => {
  const current: [number, number, number] = [10000, 10000, 10000];

  it("accepts a compliant proposal", () => {
    const result = validateProposalInvariants(
      { ...baseProposal, buyback_multiplier_bps: [12000, 11000, 11000], epoch: 6 },
      { currentBuyback: current }
    );
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it("rejects multipliers outside [10000, 40000]", () => {
    const tooLow = validateProposalInvariants(
      { ...baseProposal, buyback_multiplier_bps: [9999, 10000, 10000] },
      { currentBuyback: [9999, 10000, 10000] }
    );
    assert.strictEqual(tooLow.valid, false);
    assert.ok(tooLow.errors.some((e) => e.includes("must be within")));

    const tooHigh = validateProposalInvariants(
      { ...baseProposal, buyback_multiplier_bps: [40001, 10000, 10000] },
      { currentBuyback: [40001, 10000, 10000] }
    );
    assert.strictEqual(tooHigh.valid, false);
  });

  it("rejects a shift larger than MAX_SHIFT_BPS against get_ai_state", () => {
    const result = validateProposalInvariants(
      { ...baseProposal, buyback_multiplier_bps: [13000, 10000, 10000] },
      { currentBuyback: current }
    );
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("exceeds MAX_SHIFT_BPS")));
  });

  it("rejects taunts over 200 chars", () => {
    const result = validateProposalInvariants(
      { ...baseProposal, taunt: "x".repeat(201) },
      { currentBuyback: current }
    );
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("taunt length")));
  });

  it("rejects a non-positive nonce and unknown floor", () => {
    const badNonce = validateProposalInvariants({ ...baseProposal, nonce: 0 }, { currentBuyback: current });
    assert.strictEqual(badNonce.valid, false);

    const badFloor = validateProposalInvariants({ ...baseProposal, floor: 4 }, { currentBuyback: current });
    assert.strictEqual(badFloor.valid, false);
  });
});

describe("TEE Module - Deterministic multiplier rule", () => {
  it("raises buyback for under-supplied elements", () => {
    const multipliers = computeBuybackMultipliersFromSupply([80, 20, 10]);
    assert.strictEqual(multipliers[0], 10000); // abundant supply: no stimulus
    assert.ok(multipliers[1] > multipliers[0]);
    assert.ok(multipliers[2] > multipliers[1]);
    for (const m of multipliers) {
      assert.ok(m >= 10000 && m <= 40000);
    }
  });

  it("returns the neutral multiplier for empty supply", () => {
    assert.deepStrictEqual(computeBuybackMultipliersFromSupply([0, 0, 0]), [10000, 10000, 10000]);
  });

  it("caps every element against the current on-chain value", () => {
    const capped = capBuybackMultipliers([10000, 10000, 10000], [40000, 40000, 40000]);
    assert.deepStrictEqual(capped, [12500, 12500, 12500]);
  });
});

describe("TEE Module - Mock proposal & client mode", () => {
  it("generates a valid signed proposal in mock mode", async () => {
    const client = new NearAiTeeClient({ mockMode: true, seedString: TEST_SEED });
    assert.strictEqual(client.isMockMode(), true);

    const signed = await client.getProposal({
      floor: 2,
      epoch: 7,
      currentBuyback: [10000, 10000, 10000],
      supply: [80, 20, 10],
      nonce: 10,
    });

    assert.strictEqual(signed.proposal.floor, 2);
    assert.strictEqual(signed.proposal.epoch, 7);
    assert.strictEqual(signed.message, buildCanonicalMessage(signed.proposal));
    assert.strictEqual(
      verifyProposalSignature(signed.proposal, signed.signature, signed.publicKey),
      true
    );

    for (const shift of signed.proposal.buyback_multiplier_bps) {
      assert.ok(shift >= 10000 && shift <= 12500); // capped by MAX_SHIFT_BPS
    }
  });

  it("fails fast at construction without an API key (no silent mock fallback)", () => {
    assert.throws(() => new NearAiTeeClient({ mockMode: false, apiKey: "" }), /NEAR_AI_API_KEY/);
    delete process.env.NEAR_AI_API_KEY;
    assert.throws(() => new NearAiTeeClient({ mockMode: false }), /NEAR_AI_API_KEY/);
  });

  it("never falls back to mock when live signing fails", async () => {
    const client = new NearAiTeeClient({
      mockMode: false,
      apiKey: "test-key",
      baseUrl: "http://127.0.0.1:1/v1",
    });
    assert.strictEqual(client.isMockMode(), false);

    await assert.rejects(
      () =>
        client.getProposal({
          floor: 1,
          epoch: 1,
          currentBuyback: [10000, 10000, 10000],
          supply: [1, 1, 1],
          nonce: 1,
        }),
      /fetch failed|ECONNREFUSED|NEAR AI Cloud/i
    );
  });

  it("defaults to the pinned AI model", () => {
    const client = new NearAiTeeClient({ mockMode: true, seedString: TEST_SEED });
    assert.strictEqual(client.getModel(), DEFAULT_NEAR_AI_MODEL);
    assert.strictEqual(DEFAULT_NEAR_AI_MODEL, "z-ai/glm-5.3-flash");
  });
});

describe("TEE Module - Strict AI payload parsing", () => {
  const valid =
    '{"floor":1,"epoch":5,"buyback_multiplier_bps":[10000,15000,30000],"altar_recipe_id":null,"taunt":"Burn.","nonce":42}';

  it("parses the exact payload shape", () => {
    assert.deepStrictEqual(parseStrictProposalPayload(valid), {
      floor: 1,
      epoch: 5,
      buyback_multiplier_bps: [10000, 15000, 30000],
      altar_recipe_id: null,
      taunt: "Burn.",
      nonce: 42,
    });
  });

  it("rejects prose, fenced output, extra keys and bad types", () => {
    assert.throws(() => parseStrictProposalPayload(`Here you go: ${valid}`), /bare JSON object/);
    assert.throws(() => parseStrictProposalPayload("```json\n" + valid + "\n```"), /bare JSON object/);
    assert.throws(
      () => parseStrictProposalPayload(valid.replace('"nonce":42', '"nonce":42,"extra":1')),
      /do not match payload/
    );
    assert.throws(
      () => parseStrictProposalPayload(valid.replace("[10000,15000,30000]", "[10000,15000]")),
      /3-element array/
    );
    assert.throws(
      () => parseStrictProposalPayload(valid.replace('"nonce":42', '"nonce":"42"')),
      /must be integers/
    );
  });
});

describe("TEE Module - Mock proposal invariants", () => {
  it("honours an explicit taunt and rejects invalid input", () => {
    const signed = generateMockAiProposal({
      floor: 3,
      epoch: 9,
      currentBuyback: [10000, 10000, 10000],
      supply: [1, 1, 1],
      nonce: 3,
      taunt: "Floor three eats optimists.",
      seedString: TEST_SEED,
    });
    assert.strictEqual(signed.proposal.taunt, "Floor three eats optimists.");

    assert.throws(
      () =>
        generateMockAiProposal({
          floor: 1,
          epoch: 1,
          currentBuyback: [10000, 10000, 10000],
          supply: [1, 1, 1],
          nonce: 1,
          taunt: "x".repeat(201),
          seedString: TEST_SEED,
        }),
      /failed invariants/
    );
  });
});
