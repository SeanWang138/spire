import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SpireKeeper,
  normalizeTower,
  evaluateEnrageTick,
  resolveKeeperAiMode,
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
    // Relative countdown in ns (1 hour left -> not due yet; "0" = due now).
    next_epoch_in_ns: (3_600n * 1_000_000_000n).toString(),
    shifted_by: 0,
    supply: [80, 20, 10],
    weak_element: 2,
    ...overrides,
  };
}

function floors(overrides: Partial<FloorResponse> = {}): FloorResponse[] {
  return [0, 1, 2].map((floor) => ({
    floor,
    hp: floor === 0 ? 1000 : floor === 1 ? 1600 : 2500,
    max_hp: floor === 0 ? 1000 : floor === 1 ? 1600 : 2500,
    round: 1,
    first_attack_ns: "0",
    deadline_ns: floor === 0 ? "0" : floor === 1 ? "1800000000000" : "1200000000000",
    time_left_ns: floor === 0 ? "0" : floor === 1 ? "1800000000000" : "1200000000000",
    expired: false,
    jackpot: "2.3683e+24",
    buyback_reserve: "4e+22",
    dividend_pool: "5.7e+22",
    unlocked: floor === 0,
    ward_element: floor === 1 ? 1 : null,
    enrage: floor === 2,
    ...overrides,
  }));
}

function state(overrides: Partial<KeeperMockState> = {}): KeeperMockState {
  return { meta: meta(), floors: floors(), ...overrides };
}

describe("Keeper Module - tower normalization", () => {
  it("accepts array and object shapes for 0-indexed floors 0..2 and drops malformed entries", () => {
    assert.deepStrictEqual(normalizeTower([{ floor: 0 }]), [{ floor: 0 }]);
    assert.deepStrictEqual(normalizeTower({ floors: [{ floor: 2 }] }), [{ floor: 2 }]);
    assert.deepStrictEqual(normalizeTower(undefined), []);
    assert.deepStrictEqual(
      normalizeTower([{ floor: -1 }, { floor: 0 }, { boss_hp: 1 }, { floor: 3 }]),
      [{ floor: 0 }]
    );
  });
});

describe("Keeper Module - epoch rollover", () => {
  it("calls update_meta when next_epoch_in_ns is 0 (countdown elapsed)", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(state({ meta: meta({ next_epoch_in_ns: "0" }) }));

    const result = await keeper.tickOnce(EPOCH_NS);
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.actions.some((a) => a.startsWith("update_meta")));

    const keeperNumZero = new SpireKeeper({ mockMode: true });
    keeperNumZero.setMockTelemetry(state({ meta: meta({ next_epoch_in_ns: 0 }) }));
    const resNum = await keeperNumZero.tickOnce(EPOCH_NS);
    assert.ok(resNum.actions.some((a) => a.startsWith("update_meta")));
  });

  it("does not call update_meta while next_epoch_in_ns > 0", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(state());

    const result = await keeper.tickOnce(EPOCH_NS + 10n * 1_000_000_000n);
    assert.ok(!result.actions.some((a) => a.startsWith("update_meta")));
    assert.ok(result.actions.some((a) => a.startsWith("apply_ai_proposal:0:5")));
  });
});

describe("Keeper Module - AI proposals", () => {
  it("submits one signed proposal per floor (0..2) and epoch", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(state());

    const result = await keeper.tickOnce(EPOCH_NS);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.proposals.length, 3);

    for (const [index, signed] of result.proposals.entries()) {
      const floor = index;
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
          0: { floor: 0, epoch: 5, buyback_multiplier_bps: [10000, 10000, 10000], nonce: 1 },
        },
      })
    );

    const result = await keeper.tickOnce(EPOCH_NS);
    assert.deepStrictEqual(result.errors, []);
    assert.ok(
      result.actions.some((a) => a.startsWith("ai_proposal_skipped:0:epoch_5_already_applied"))
    );
    // Floors 1 and 2 have no AI state yet (epoch 0) and still get proposals.
    assert.deepStrictEqual(
      result.proposals.map((p) => p.proposal.floor).sort(),
      [1, 2]
    );
  });

  it("skips proposals for defeated floors (hp <= 0 or legacy boss_hp <= 0)", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(
      state({
        floors: [
          { floor: 0, hp: 0, deadline_ns: "0", time_left_ns: "0" },
          { floor: 1, hp: 500, deadline_ns: "1800000000000", time_left_ns: "1000" },
          { floor: 2, boss_hp: 0, deadline_ns: "1200000000000", time_left_ns: "1000" },
        ],
      })
    );

    const result = await keeper.tickOnce(EPOCH_NS);
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.actions.some((a) => a.startsWith("ai_proposal_skipped:0:floor_defeated")));
    assert.ok(result.actions.some((a) => a.startsWith("ai_proposal_skipped:2:floor_defeated")));
    assert.deepStrictEqual(
      result.proposals.map((p) => p.proposal.floor),
      [1]
    );
  });
});

describe("Keeper Module - floor expiry & enrage", () => {
  it("never calls resolve_expired and records settlement-due when time_left_ns === 0 on deadline floors", async () => {
    const keeper = new SpireKeeper({ mockMode: true });
    const calledMethods: string[] = [];
    const origCallChangeMethod = keeper.callChangeMethod.bind(keeper);
    keeper.callChangeMethod = async (methodName, args, gas, attachedDepositYocto) => {
      calledMethods.push(methodName);
      return origCallChangeMethod(methodName, args, gas, attachedDepositYocto);
    };

    keeper.setMockTelemetry(
      state({
        floors: [
          { floor: 0, hp: 1000, deadline_ns: "0", time_left_ns: "0", expired: false },
          { floor: 1, hp: 500, deadline_ns: "1800000000000", time_left_ns: "1000", expired: false },
          { floor: 2, hp: 0, deadline_ns: "1200000000000", time_left_ns: "0", expired: true },
        ],
      })
    );

    const before = await keeper.tickOnce(EPOCH_NS);
    assert.ok(!before.actions.some((a) => a.startsWith("settlement-due")));
    assert.ok(!calledMethods.includes("resolve_expired"));

    keeper.setMockTelemetry(
      state({
        floors: [
          { floor: 0, hp: 1000, deadline_ns: "0", time_left_ns: "0", expired: false },
          { floor: 1, hp: 500, deadline_ns: "1800000000000", time_left_ns: 0 },
          { floor: 2, hp: 0, deadline_ns: "1200000000000", time_left_ns: "0", expired: true },
        ],
      })
    );

    const after = await keeper.tickOnce(EPOCH_NS);
    assert.ok(!calledMethods.includes("resolve_expired"));
    assert.ok(after.actions.some((a) => a.startsWith("settlement-due:1:")));
    assert.ok(!after.actions.some((a) => a.startsWith("settlement-due:0:")));
    assert.ok(!after.actions.some((a) => a.startsWith("settlement-due:2:")));
  });

  it("surfaces Floor 3 (0-indexed floor 2) enrage ticks once per interval", () => {
    const start = EPOCH_NS;
    const floor: FloorResponse = {
      floor: 2,
      hp: 2000,
      max_hp: 2500,
      enrage: true,
      floor_start_ns: start.toString(),
      enrage_ticks: 1,
      deadline_ns: "1200000000000",
    };
    assert.strictEqual(evaluateEnrageTick(floor, start + FLOOR3_ENRAGE_INTERVAL_NS), null);
    assert.strictEqual(evaluateEnrageTick(floor, start + 2n * FLOOR3_ENRAGE_INTERVAL_NS), 2n);
    assert.strictEqual(
      evaluateEnrageTick({ ...floor, floor: 1, enrage: false }, start + 3n * FLOOR3_ENRAGE_INTERVAL_NS),
      null
    );
    assert.strictEqual(
      evaluateEnrageTick({ ...floor, floor: 0, enrage: undefined }, start + 3n * FLOOR3_ENRAGE_INTERVAL_NS),
      null
    );
    // Legacy floor === 3 compat
    assert.strictEqual(
      evaluateEnrageTick({ ...floor, floor: 3, enrage: undefined }, start + 2n * FLOOR3_ENRAGE_INTERVAL_NS),
      2n
    );
  });
});

describe("Keeper Module - epoch-only mode (testnet without NEAR AI key)", () => {
  it("resolves explicit KEEPER_AI_MODE values and rejects invalid values", () => {
    assert.strictEqual(resolveKeeperAiMode(undefined), "near-ai");
    assert.strictEqual(resolveKeeperAiMode(""), "near-ai");
    assert.strictEqual(resolveKeeperAiMode("epoch-only"), "epoch-only");
    assert.strictEqual(resolveKeeperAiMode("NEAR-AI"), "near-ai");
    assert.throws(() => resolveKeeperAiMode("bad-mode"), /KEEPER_AI_MODE/);
  });

  it("constructs in live epoch-only mode without NEAR_AI_API_KEY", () => {
    const prevKey = process.env.NEAR_AI_API_KEY;
    delete process.env.NEAR_AI_API_KEY;
    try {
      const keeper = new SpireKeeper({ mockMode: false, aiMode: "epoch-only" });
      assert.strictEqual(keeper.isMockMode(), false);
      assert.strictEqual(keeper.getAiMode(), "epoch-only");
    } finally {
      if (prevKey !== undefined) process.env.NEAR_AI_API_KEY = prevKey;
    }
  });

  it("runs update_meta and skips apply_ai_proposal cleanly in epoch-only mode", async () => {
    const keeper = new SpireKeeper({ mockMode: true, aiMode: "epoch-only" });
    const calledMethods: string[] = [];
    const origCallChangeMethod = keeper.callChangeMethod.bind(keeper);
    keeper.callChangeMethod = async (methodName, args, gas, attachedDepositYocto) => {
      calledMethods.push(methodName);
      return origCallChangeMethod(methodName, args, gas, attachedDepositYocto);
    };

    keeper.setMockTelemetry(state({ meta: meta({ next_epoch_in_ns: "0" }) }));
    const result = await keeper.tickOnce(EPOCH_NS);

    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.proposals, []);
    assert.deepStrictEqual(calledMethods, ["update_meta"]);
    assert.ok(result.actions.some((a) => a.startsWith("update_meta:epoch=5:")));
    assert.ok(result.actions.includes("ai_proposals_skipped:epoch_only_mode"));
  });

  it("evaluates live FloorResponse.first_attack_ns enrage ticks and seeds lastNonce above all floors", async () => {
    const start = EPOCH_NS;
    assert.strictEqual(
      evaluateEnrageTick({ floor: 2, hp: 2000, enrage: true, first_attack_ns: "0" }, start + 3n * FLOOR3_ENRAGE_INTERVAL_NS),
      null
    );
    assert.strictEqual(
      evaluateEnrageTick(
        { floor: 2, hp: 2000, enrage: true, first_attack_ns: start.toString() },
        start + 2n * FLOOR3_ENRAGE_INTERVAL_NS
      ),
      2n
    );

    const keeper = new SpireKeeper({ mockMode: true });
    keeper.setMockTelemetry(
      state({
        aiStates: {
          0: { floor: 0, epoch: 5, buyback_multiplier_bps: [10000, 10000, 10000], nonce: 3 },
          1: { floor: 1, epoch: 4, buyback_multiplier_bps: [10000, 10000, 10000], nonce: 11 },
          2: { floor: 2, epoch: 4, buyback_multiplier_bps: [10000, 10000, 10000], nonce: 4 },
        },
      })
    );
    const result = await keeper.tickOnce(EPOCH_NS);
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.proposals.length >= 2);
    assert.ok(result.proposals[0].proposal.nonce > 11);
  });
});
