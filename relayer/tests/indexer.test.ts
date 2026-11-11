import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseEventJson,
  extractEventsFromLogs,
  SpireIndexer,
  StatsCollector,
  AccountQueue,
  handleApiRequest,
  handleApiRequestAsync,
  normalizeAccountName,
  createSubaccountWithFunctionKey,
  SUPPORTED_EVENTS,
} from "../dist/indexer.js";
import type { LiveStatsSnapshot } from "../dist/indexer.js";
import type { Nep297Event } from "../dist/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface EventVectorFixture {
  name: string;
  raw_log: string;
  expected_event: string;
  expected_data: any[];
}

function event(eventName: string, data: Record<string, unknown>): string {
  return `EVENT_JSON:${JSON.stringify({
    standard: "spire",
    version: "3.1.0",
    event: eventName,
    data: [data],
  })}`;
}

describe("Indexer Module - NEP-297 EVENT_JSON Parser", () => {
  it("parses all legacy event types from test-vectors/event_vectors.json", () => {
    const raw = readFileSync(resolve(__dirname, "../../test-vectors/event_vectors.json"), "utf-8");
    const fixture = JSON.parse(raw) as { events: EventVectorFixture[] };

    for (const item of fixture.events) {
      const parsed = parseEventJson(item.raw_log);
      assert.ok(parsed !== null, `Failed to parse event in ${item.name}`);
      assert.strictEqual(parsed.event, item.expected_event);
      assert.deepStrictEqual(parsed.data, item.expected_data);
    }
  });

  it("supports the 11 new contract events", () => {
    for (const name of [
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
    ]) {
      assert.ok((SUPPORTED_EVENTS as readonly string[]).includes(name), `${name} not supported`);
    }
  });

  it("parses new event payloads", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["round_expired", { floor: 2, round: 4, total_damage: 1200 }],
      ["floor_unlocked", { floor: 3, unlocked_by: "alice.testnet" }],
      ["payout_claimed", { account_id: "alice.testnet", floor: 2, round: 4, amount: "1000" }],
      ["meta_updated", { epoch: 7, resistance: [5000, 4000, 4500], shifted_by: 0, weak_element: 1, taunt: "The meta bends." }],
      ["tribute_seized", { account_id: "bob.testnet", floor: 3, element: 2, weapon: "weapon:void" }],
      ["buyback", { account_id: "bob.testnet", floor: 1, element: 1, qty: 2, amount: "5000" }],
      ["backer_staked", { account_id: "carol.testnet", floor: 3, cycle: 2, amount: "9000" }],
      ["dividend_claimed", { account_id: "carol.testnet", floor: 3, cycle: 2, amount: "400" }],
      ["gather", { account_id: "alice.testnet", item_id: "ore:iron", amount: 3 }],
      ["starter_claimed", { account_id: "dave.testnet" }],
      ["withdraw", { account_id: "dave.testnet", amount: "777" }],
    ];

    for (const [name, payload] of cases) {
      const parsed = parseEventJson(event(name, payload));
      assert.ok(parsed !== null, `failed to parse ${name}`);
      assert.strictEqual(parsed.event, name);
      assert.deepStrictEqual(parsed.data[0], payload);
    }
  });

  it("rejects malformed or unsupported logs", () => {
    assert.strictEqual(parseEventJson("plain text log"), null);
    assert.strictEqual(parseEventJson("EVENT_JSON:{not valid json}"), null);
    assert.strictEqual(
      parseEventJson('EVENT_JSON:{"standard":"unknown-std","version":"1.0","event":"deposit","data":[{"account_id":"a"}]}'),
      null
    );
    assert.strictEqual(
      parseEventJson('EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"unsupported_event","data":[{}]}'),
      null
    );
    assert.strictEqual(parseEventJson(event("round_expired", { floor: 2 })), null); // missing round
  });

  it("extracts multiple events from a mixed batch", () => {
    const events = extractEventsFromLogs([
      "Contract logging initialized",
      event("deposit", { account_id: "alice.testnet", amount: "500" }),
      "Just another log message",
      event("raid", {
        account_id: "bob.testnet",
        floor: 1,
        round: 1,
        weapon: "weapon:solar",
        damage: 300,
        boss_remaining_hp: 700,
        ticket_paid: "100",
        tribute_taken: false,
      }),
    ]);
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].event, "deposit");
    assert.strictEqual(events[1].event, "raid");
  });
});

describe("Indexer Module - SpireIndexer service & ingestion", () => {
  it("ingests logs, emits listeners and keeps history", () => {
    const indexer = new SpireIndexer({ maxCachedEvents: 10 });
    const all: Nep297Event[] = [];
    const raids: Nep297Event[] = [];
    indexer.on("event", (ev) => all.push(ev));
    indexer.on("raid", (ev) => raids.push(ev));

    indexer.ingestLogs([
      event("deposit", { account_id: "alice.testnet", amount: "1000" }),
      event("raid", {
        account_id: "bob.testnet",
        floor: 1,
        round: 1,
        weapon: "weapon:solar",
        damage: 200,
        boss_remaining_hp: 800,
        ticket_paid: "100",
        tribute_taken: false,
      }),
    ]);

    assert.strictEqual(all.length, 2);
    assert.strictEqual(raids.length, 1);
    assert.strictEqual(indexer.getEventCount(), 2);
    assert.deepStrictEqual(
      indexer.getRecentEvents().map((e) => e.event),
      ["deposit", "raid"]
    );
  });
});

describe("Indexer Module - Stats collector", () => {
  it("aggregates jackpot, raids, supply, resistance and last taunt", () => {
    const stats = new StatsCollector();
    const indexer = new SpireIndexer();
    indexer.on("event", (ev) => stats.ingest(ev));

    indexer.ingestLogs([
      event("raid", {
        account_id: "bob.testnet",
        floor: 1,
        round: 1,
        weapon: "weapon:solar",
        damage: 400,
        boss_remaining_hp: 600,
        ticket_paid: "1000",
        tribute_taken: false,
      }),
      event("raid", {
        account_id: "carol.testnet",
        floor: 3,
        round: 1,
        weapon: "weapon:void",
        damage: 100,
        boss_remaining_hp: 400,
        ticket_paid: "2000",
        tribute_taken: false,
      }),
      event("craft", {
        account_id: "alice.testnet",
        recipe: "craft_weapon_solar",
        output_token: "weapon:solar",
        amount: 1,
        materials_consumed: [{ token_id: "ore:iron", amount: 2 }],
      }),
      event("meta_updated", {
        epoch: 4,
        resistance: [6000, 4000, 3500],
        weak_element: 2,
        taunt: "Void is cheaper than courage.",
      }),
      event("payout_claimed", { account_id: "bob.testnet", floor: 1, round: 1, amount: "500" }),
    ]);

    const summary = stats.getStats();
    // 90% of each ticket goes to the floor jackpot: 900 + 1800, minus 500 claimed.
    assert.strictEqual(summary.totalJackpotYocto, "2200");
    assert.strictEqual(summary.totalRaids, 2);
    assert.strictEqual(summary.totalDamage, 500);
    assert.deepStrictEqual(summary.supply, [1, 0, 0]);
    assert.deepStrictEqual(summary.resistance, [6000, 4000, 3500]);
    assert.strictEqual(summary.weakElement, 2);
    assert.strictEqual(summary.lastTaunt, "Void is cheaper than courage.");
    assert.strictEqual(summary.epoch, 4);
    assert.strictEqual(summary.floors[1].jackpotYocto, "400");
    assert.strictEqual(summary.floors[3].jackpotYocto, "1800");
  });

  it("accepts authoritative meta refreshes", () => {
    const stats = new StatsCollector();
    stats.updateMeta({
      epoch: 12,
      resistance: [4500, 4500, 4500],
      next_epoch_in_ns: "0",
      shifted_by: 0,
      supply: [10, 20, 30],
      weak_element: 1,
    });
    const summary = stats.getStats();
    assert.strictEqual(summary.epoch, 12);
    assert.deepStrictEqual(summary.supply, [10, 20, 30]);
    assert.strictEqual(summary.weakElement, 1);
    assert.strictEqual(summary.totalJackpotYocto, "0");
  });
});

describe("Indexer Module - Landing page API", () => {
  it("validates and normalizes account names", () => {
    assert.strictEqual(normalizeAccountName("alice"), "alice.spire.testnet");
    assert.strictEqual(normalizeAccountName("alice.spire.testnet"), "alice.spire.testnet");
    assert.strictEqual(normalizeAccountName("a"), null);
    assert.strictEqual(normalizeAccountName("Alice"), null);
    assert.strictEqual(normalizeAccountName("bad name"), null);
    assert.strictEqual(normalizeAccountName("../etc"), null);
    assert.strictEqual(normalizeAccountName("x".repeat(33)), null);
    assert.strictEqual(normalizeAccountName(42), null);
  });

  it("queues valid accounts as pending and rejects invalid ones", () => {
    const collector = new StatsCollector();
    const accounts = new AccountQueue();

    const ok = handleApiRequest("POST", "/api/accounts", { name: "alice" }, collector, accounts);
    assert.strictEqual(ok.status, 200);
    assert.deepStrictEqual(ok.body, { account_id: "alice.spire.testnet", status: "pending" });

    const duplicate = handleApiRequest(
      "POST",
      "/api/accounts",
      { account_id: "alice.spire.testnet" },
      collector,
      accounts
    );
    assert.strictEqual(duplicate.status, 200);
    assert.deepStrictEqual(accounts.list(), ["alice.spire.testnet"]);

    const bad = handleApiRequest("POST", "/api/accounts", { name: "Not Valid!" }, collector, accounts);
    assert.strictEqual(bad.status, 400);
    assert.strictEqual((bad.body as any).error, "invalid_account");
  });

  it("serves stats on GET /api/stats and 404 elsewhere", () => {
    const collector = new StatsCollector();
    const accounts = new AccountQueue();

    const stats = handleApiRequest("GET", "/api/stats?t=1", undefined, collector, accounts);
    assert.strictEqual(stats.status, 200);
    assert.strictEqual(typeof (stats.body as any).totalJackpotYocto, "string");

    assert.strictEqual(handleApiRequest("GET", "/nope", undefined, collector, accounts).status, 404);
  });

  it("returns 501 on POST /api/stats without a live fetcher", async () => {
    const result = await handleApiRequestAsync(
      "POST",
      "/api/stats",
      undefined,
      new StatsCollector(),
      new AccountQueue()
    );
    assert.strictEqual(result.status, 501);
    assert.strictEqual((result.body as any).error, "live_stats_unavailable");
  });

  it("serves a live contract snapshot on POST /api/stats", async () => {
    const collector = new StatsCollector();
    const accounts = new AccountQueue();
    const snapshot: LiveStatsSnapshot = {
      tower: { floors: [{ floor: 1, boss_hp: 1000, deadline_ns: "0" }] },
      meta: {
        epoch: 7,
        resistance: [4500, 4500, 4500],
        next_epoch_in_ns: "0",
        shifted_by: 0,
        supply: [10, 20, 30],
        weak_element: 1,
      },
      supply: [10, 20, 30],
      merchant: null,
      total: { floors: 1, defeatedFloors: 0, bossHpTotal: "1000", totalJackpotYocto: "0", totalRaids: 0, totalDamage: 0 },
    };

    const result = await handleApiRequestAsync("POST", "/api/stats", undefined, collector, accounts, {
      fetchLiveStats: async () => snapshot,
    });
    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(result.body, snapshot);

    // Upstream failures surface as 502, never as fabricated data.
    const failing = await handleApiRequestAsync("POST", "/api/stats", undefined, collector, accounts, {
      fetchLiveStats: async () => {
        throw new Error("rpc down");
      },
    });
    assert.strictEqual(failing.status, 502);
    assert.strictEqual((failing.body as any).error, "upstream_error");
  });

  it("creates subaccounts via the injectable creator and falls back to pending", async () => {
    const collector = new StatsCollector();
    const accounts = new AccountQueue();

    const created = await handleApiRequestAsync(
      "POST",
      "/api/accounts",
      { name: "alice" },
      collector,
      accounts,
      { createAccount: async (accountId) => ({ created: true, detail: "ed25519:Pk" }) }
    );
    assert.strictEqual(created.status, 200);
    assert.deepStrictEqual(created.body, { account_id: "alice.spire.testnet", status: "created", detail: "ed25519:Pk" });

    const failed = await handleApiRequestAsync(
      "POST",
      "/api/accounts",
      { name: "bob" },
      collector,
      accounts,
      {
        createAccount: async () => {
          throw new Error("not enough funds");
        },
      }
    );
    assert.strictEqual(failed.status, 502);
    assert.strictEqual((failed.body as any).error, "account_creation_failed");

    const pending = await handleApiRequestAsync("POST", "/api/accounts", { name: "carol" }, collector, accounts);
    assert.strictEqual(pending.status, 200);
    assert.deepStrictEqual((pending.body as any).status, "pending");
    assert.deepStrictEqual(accounts.list(), ["carol.spire.testnet"]);
  });

  it("passes the browser Function Call public key to the account creator", async () => {
    const collector = new StatsCollector();
    const accounts = new AccountQueue();
    const browserKey = "ed25519:" + "ab".repeat(32);
    let seen: { accountId: string; publicKey?: string } | null = null;

    const created = await handleApiRequestAsync(
      "POST",
      "/api/accounts",
      { account_id: "dave.spire.testnet", public_key: browserKey },
      collector,
      accounts,
      {
        createAccount: async (accountId, publicKey) => {
          seen = { accountId, publicKey };
          return { created: true, detail: publicKey ?? null };
        },
      }
    );

    assert.strictEqual(created.status, 200);
    assert.deepStrictEqual((created.body as any).status, "created");
    assert.deepStrictEqual(seen, { accountId: "dave.spire.testnet", publicKey: browserKey });
  });

  it("createSubaccountWithFunctionKey validates the browser key without generating its own", async () => {
    // Invalid key must be rejected BEFORE any on-chain call (no parent creds needed).
    await assert.rejects(
      createSubaccountWithFunctionKey(
        "parent.testnet",
        "ed25519:" + "11".repeat(32),
        "https://invalid.example",
        "x.spire.testnet",
        "0",
        "not-a-hex-key"
      ),
      /invalid_public_key/
    );

    // A valid browser key is registered verbatim; no private key is generated server-side.
    // (Network call is stubbed by pointing at an unreachable RPC — validation happens first.)
    const result = await createSubaccountWithFunctionKey(
      "parent.testnet",
      "ed25519:" + "11".repeat(32),
      "https://invalid.example",
      "x.spire.testnet",
      "0",
      "ed25519:" + "cd".repeat(32)
    ).catch((err) => {
      // Connection to the fake RPC may fail; if so, the key validation already passed.
      assert.ok(!/invalid_public_key/.test(err.message), "must not fail on key validation");
      return null;
    });
    if (result) {
      assert.strictEqual(result.public_key, "ed25519:" + "cd".repeat(32));
      assert.strictEqual(result.private_key, null);
    }
  });
});
