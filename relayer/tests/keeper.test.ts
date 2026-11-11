import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SpireKeeper,
  normalizeTower,
  evaluateEnrageTick,
  FLOOR3_ENRAGE_INTERVAL_NS,
} from "../dist/keeper.js";
import { buildCanonicalMessage, verifyProposalSignature, NearAiTeeClient } from "../dist/tee.js";
import type { FloorResponse, KeeperMockState } from "../dist/keeper.js";
import type { MetaResponse } from "../dist/types.js";

// Mock signing is strictly opt-in and seedless-free: the local keeper client in
// mock mode derives its key from this env seed (never a hardcoded value).
process.env.MOCK_TEE = "true";
process.env.MOCK_TEE_SEED = "keeper-test-mock-seed-0123456789abcdef";

const EPOCH_NS = 1_700_000_000n * 1_000_000_000n;

function meta(overrides: Partial<MetaResponse> = {}): MetaResponse {
  return {
    epoch: 5,
    resistance: [4500, 4500, 4500],
    next_epoch_in_ns: (EPOCH_NS + 3_600n * 1_000_000_000n).toString(),
    shifted_by: 0,
    supply: [80, 20, 10],
    weak_element: 2,
    ...overrides,
  };
}

function floors(overrides: Partial<FloorResponse> = {}): FloorResponse[] {
  return [1, 2, 3].map((floor) => ({
    floor,
    boss_hp: 1000,
    max_hp: 1000,
    round: 1,
    deadline_ns: "0",
    ...overrides,
  }));
}

function state(overrides: Partial<KeeperMockState> = {}): KeeperMockState {
  return { meta: meta(), floors: floors(), ...overrides };
}

describe("Keeper Module - tower normalization", () => {
  it("accepts array and object shapes and drops malformed entries", () => {
    assert.deepStrictEqual(normalizeTower([{ floor: 1 }]), [{ floor: 1 }]);
    assert.deepStrictEqual(normalizeTower({ floors: [{ floor: 2 }] }), [{ floor: 2 }]);
    assert.deepStrictEqual(normalizeTower(undefined), []);
    assert.deepStrictEqual(normalizeTower([{ floor: 0 }, { boss_hp: 1 }, { floor: 3 }]), [{ floor: 3 }]);
  });
});

describe("Keeper Module - epoch rollover", () => {
  it("calls update_meta when the block timestamp passed next_epoch_in_ns", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(state());

    const result = await keeper.tickOnce(EPOCH_NS + 4_000n * 1_000_000_000n);
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.actions.some((a) => a.startsWith("update_meta")));
  });

  it("does not call update_meta before the epoch deadline", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(state());

    const result = await keeper.tickOnce(EPOCH_NS + 10n * 1_000_000_000n);
    assert.ok(!result.actions.some((a) => a.startsWith("update_meta")));
    assert.ok(result.actions.some((a) => a.startsWith("apply_ai_proposal:1:5")));
  });
});

describe("Keeper Module - AI proposals", () => {
  it("submits one signed proposal per floor and epoch", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(state());

    const result = await keeper.tickOnce(EPOCH_NS);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.proposals.length, 3);

    for (const [index, signed] of result.proposals.entries()) {
      const floor = index + 1;
      assert.strictEqual(signed.proposal.floor, floor);
      assert.strictEqual(signed.proposal.epoch, 5);
      assert.strictEqual(signed.message, buildCanonicalMessage(signed.proposal));
      assert.strictEqual(verifyProposalSignature(signed.proposal, signed.signature, signed.publicKey), true);

      // multipliers stay inside contract bounds and the 2500 bps shift cap vs neutral state
      for (const multiplier of signed.proposal.buyback_multiplier_bps) {
        assert.ok(multiplier >= 10000 && multiplier <= 12500);
      }
      assert.ok(signed.proposal.taunt !== null && signed.proposal.taunt.length <= 200);
    }
  });

  it("raises buyback only for elements below their fair supply share", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(state());

    const result = await keeper.tickOnce(EPOCH_NS);
    const multipliers = result.proposals[0].proposal.buyback_multiplier_bps;
    assert.strictEqual(multipliers[0], 10000); // abundant solar supply: no stimulus
    assert.strictEqual(multipliers[1], 12500); // under-supplied, capped at +2500 bps
    assert.strictEqual(multipliers[2], 12500); // thinnest supply, same cap
  });

  it("never re-submits the same (floor, epoch)", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(state());

    const first = await keeper.tickOnce(EPOCH_NS);
    assert.strictEqual(first.proposals.length, 3);

    const second = await keeper.tickOnce(EPOCH_NS + 5n * 1_000_000_000n);
    assert.strictEqual(second.proposals.length, 0);
    assert.ok(!second.actions.some((a) => a.startsWith("apply_ai_proposal")));
  });

  it("surfaces a failed live proposal instead of submitting a mock", async () => {
    // Live TEE client with credentials but an unreachable endpoint: the keeper
    // must record the error and submit nothing.
    const keeper = new SpireKeeper({
      mockMode: true,
      teeClient: new NearAiTeeClient({
        mockMode: false,
        apiKey: "test-key",
        baseUrl: "http://127.0.0.1:1/v1",
      }),
    });
    keeper.setMockTelemetry(state());

    const result = await keeper.tickOnce(EPOCH_NS);
    assert.strictEqual(result.proposals.length, 0);
    assert.ok(result.errors.some((e) => e.includes("proposal(floor")));
  });

  it("fails fast when a live client has no API key", () => {
    assert.throws(() => new NearAiTeeClient({ mockMode: false, apiKey: "" }), /NEAR_AI_API_KEY/);
  });

  it("skips floors whose AI state already reflects the current epoch (E_SAME_EPOCH)", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(
      state({
        aiStates: {
          1: { floor: 1, epoch: 5, buyback_multiplier_bps: [10000, 10000, 10000], nonce: 1 },
        },
      })
    );

    const result = await keeper.tickOnce(EPOCH_NS);
    assert.deepStrictEqual(result.errors, []);
    assert.ok(
      result.actions.some((a) => a.startsWith("ai_proposal_skipped:1:epoch_5_already_applied"))
    );
    // Floors 2 and 3 have no AI state yet (epoch 0) and still get proposals.
    assert.deepStrictEqual(
      result.proposals.map((p) => p.proposal.floor).sort(),
      [2, 3]
    );
  });

  it("skips proposals for defeated floors (boss tumbang)", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(
      state({
        floors: [
          { floor: 1, boss_hp: 0, deadline_ns: "0" },
          { floor: 2, boss_hp: 500, deadline_ns: "0" },
          { floor: 3, boss_hp: 1600, deadline_ns: "0" },
        ],
      })
    );

    const result = await keeper.tickOnce(EPOCH_NS);
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.actions.some((a) => a.startsWith("ai_proposal_skipped:1:floor_defeated")));
    assert.deepStrictEqual(
      result.proposals.map((p) => p.proposal.floor).sort(),
      [2, 3]
    );
  });
});

describe("Keeper Module - floor expiry & enrage", () => {
  it("calls resolve_expired only for expired, still-alive floors", async () => {
    const deadline = EPOCH_NS + 100n * 1_000_000_000n;
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(
      state({
        floors: [
          { floor: 1, boss_hp: 1000, deadline_ns: "0" },
          { floor: 2, boss_hp: 500, deadline_ns: deadline.toString() },
          { floor: 3, boss_hp: 0, deadline_ns: deadline.toString() },
        ],
      })
    );

    const before = await keeper.tickOnce(EPOCH_NS);
    assert.ok(!before.actions.some((a) => a.startsWith("resolve_expired")));

    const after = await keeper.tickOnce(deadline + 1n);
    assert.ok(after.actions.some((a) => a.startsWith("resolve_expired:2:")));
    assert.ok(!after.actions.some((a) => a.startsWith("resolve_expired:3")));
  });

  it("surfaces Floor 3 enrage ticks once per interval", () => {
    const start = EPOCH_NS;
    const floor: FloorResponse = {
      floor: 3,
      boss_hp: 3000,
      max_hp: 5000,
      floor_start_ns: start.toString(),
      enrage_ticks: 1,
      deadline_ns: "0",
    };
    assert.strictEqual(evaluateEnrageTick(floor, start + FLOOR3_ENRAGE_INTERVAL_NS), null);
    assert.strictEqual(evaluateEnrageTick(floor, start + 2n * FLOOR3_ENRAGE_INTERVAL_NS), 2n);
    assert.strictEqual(evaluateEnrageTick({ ...floor, floor: 2 }, start + 3n * FLOOR3_ENRAGE_INTERVAL_NS), null);
  });
});
