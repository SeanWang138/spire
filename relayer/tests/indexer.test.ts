import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { KeyPair } from "near-api-js";
import {
  parseEventJson,
  extractEventsFromLogs,
  SpireIndexer,
  StatsCollector,
  AccountQueue,
  handleApiRequest,
  handleApiRequestAsync,
  normalizeAccountName,
  createPlayableSubaccount,
  createSubaccountWithFunctionKey,
  parseEd25519PublicKey,
  DEFAULT_SUBACCOUNT_FUNDING_YOCTO,
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
    // 70% of each ticket goes to the floor jackpot (v3.1 split_ticket): 700 + 1400, minus 500 claimed.
    assert.strictEqual(summary.totalJackpotYocto, "1600");
    assert.strictEqual(summary.totalRaids, 2);
    assert.strictEqual(summary.totalDamage, 500);
    assert.deepStrictEqual(summary.supply, [1, 0, 0]);
    assert.deepStrictEqual(summary.resistance, [6000, 4000, 3500]);
    assert.strictEqual(summary.weakElement, 2);
    assert.strictEqual(summary.lastTaunt, "Void is cheaper than courage.");
    assert.strictEqual(summary.epoch, 4);
    assert.strictEqual(summary.floors[1].jackpotYocto, "200");
    assert.strictEqual(summary.floors[3].jackpotYocto, "1400");
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
      assert.strictEqual(result.public_key.startsWith("ed25519:"), true);
      assert.strictEqual(result.private_key, null);
    }
  });

  it("parses both ed25519:<base58> and 64-hex public keys and enforces >= 0.60 NEAR default funding", async () => {
    assert.ok(BigInt(DEFAULT_SUBACCOUNT_FUNDING_YOCTO) >= 600_000_000_000_000_000_000_000n);
    assert.strictEqual(createSubaccountWithFunctionKey, createPlayableSubaccount);

    const browserKp = KeyPair.fromRandom("ed25519");
    const browserPubStr = browserKp.getPublicKey().toString();
    assert.ok(browserPubStr.startsWith("ed25519:"));

    const parsedBase58 = parseEd25519PublicKey(browserPubStr);
    assert.strictEqual(parsedBase58.toString(), browserPubStr);
    assert.strictEqual(parsedBase58.data.length, 32);

    const parsedHex = parseEd25519PublicKey("cd".repeat(32));
    assert.strictEqual(parsedHex.data.length, 32);
    assert.strictEqual(
      parseEd25519PublicKey("ed25519:" + "cd".repeat(32)).toString(),
      parsedHex.toString()
    );

    assert.throws(() => parseEd25519PublicKey(""), /invalid_public_key/);
    assert.throws(() => parseEd25519PublicKey("not-a-hex-key"), /invalid_public_key/);
    assert.throws(() => parseEd25519PublicKey("ed25519:1111"), /invalid_public_key/);
    assert.throws(() => parseEd25519PublicKey("secp256k1:abc"), /invalid_public_key/);

    // Browser ed25519:<base58> key passes validation cleanly in createPlayableSubaccount
    await createPlayableSubaccount(
      "parent.testnet",
      KeyPair.fromRandom("ed25519").toString(),
      "https://invalid.example",
      "player.spire.testnet",
      undefined,
      browserPubStr
    ).catch((err) => {
      assert.ok(!/invalid_public_key/.test(err.message), `unexpected key error: ${err.message}`);
    });
  });

  it("fetchLiveStats reads floor.hp (0-indexed 0..2) with fallback to boss_hp", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_input, init) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        params?: { method_name?: string };
      };
      const method = payload.params?.method_name;
      let resData: unknown = null;
      if (method === "get_tower") {
        resData = {
          floors: [
            { floor: 0, hp: 1000, max_hp: 1000, unlocked: true },
            { floor: 1, hp: 0, max_hp: 1600, unlocked: true },
            { floor: 2, boss_hp: 2500, max_hp: 2500, unlocked: false },
          ],
        };
      } else if (method === "get_meta") {
        resData = {
          epoch: 8,
          resistance: [4500, 4500, 4500],
          next_epoch_in_ns: 0,
          shifted_by: 1,
          supply: [10, 20, 30],
          weak_element: 0,
        };
      } else if (method === "get_supply") {
        resData = [10, 20, 30];
      } else if (method === "get_merchant") {
        resData = { cash: "2.3683e+24", stock: {}, is_open: true };
      }
      const bytes = Array.from(Buffer.from(JSON.stringify(resData), "utf-8"));
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", result: { result: bytes } }), {
        status: 200,
      });
    }) as typeof fetch;

    try {
      const indexer = new SpireIndexer({ rpcUrl: "https://mock-rpc.example", contractId: "spire.testnet" });
      const snap = await indexer.fetchLiveStats();
      assert.strictEqual(snap.total.floors, 3);
      assert.strictEqual(snap.total.defeatedFloors, 1);
      assert.strictEqual(snap.total.bossHpTotal, "3500");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("parses live events.rs v3.1 shapes, falls back to get_tower jackpot/damage, and scrapes blocks", async () => {
    const collector = new StatsCollector();
    const events = extractEventsFromLogs([
      event("craft", {
        account_id: "hero.spire.testnet",
        recipe: "craft_weapon",
        output_token: "weapon:frost",
        materials_consumed: [{ token_id: "ore:iron", amount: 2 }],
      }),
      event("merchant_trade", {
        account_id: "hero.spire.testnet",
        side: "buy",
        item_id: "ore:iron",
        qty: 2,
        total_price: "110000000000000000000000",
        current_stock: 98,
        merchant_cash: "5110000000000000000000000",
      }),
      event("buyback", {
        account_id: "hero.spire.testnet",
        floor: 0,
        element: 1,
        qty: 1,
        unit_price: "100000000000000000000000",
        total_price: "100000000000000000000000",
      }),
      event("ai_proposal_applied", {
        floor: 0,
        epoch: 3,
        nonce: 9,
        buyback_multiplier_bps: [10000, 12500, 10000],
        altar_recipe_id: "reforge_2_to_1",
      }),
    ]);
    assert.strictEqual(events.length, 4);
    for (const ev of events) collector.ingest(ev);
    assert.deepStrictEqual(collector.getStats().supply, [0, 0, 0]);

    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_input, init) => {
      const req = JSON.parse(String(init?.body ?? "{}")) as { method?: string; params?: any };
      if (req.method === "query") {
        const method = req.params?.method_name;
        const payload =
          method === "get_tower"
            ? {
                floors: [
                  { floor: 0, hp: 900, max_hp: 1000, jackpot: "70000000000000000000000", total_damage: "100" },
                  { floor: 1, hp: 1600, max_hp: 1600, jackpot: "105000000000000000000000", total_damage: "0" },
                ],
              }
            : method === "get_meta"
              ? { epoch: 94, resistance: [4500, 4500, 4500], next_epoch_in_ns: 0, shifted_by: 0, supply: [1, 1, 1], weak_element: 0 }
              : method === "get_supply"
                ? [1, 1, 1]
                : { cash: "2000000000000000000000000", stock: {}, is_open: true };
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: "1", result: { result: Array.from(Buffer.from(JSON.stringify(payload))) } }),
          { status: 200 }
        );
      }
      if (req.method === "block") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            result: { header: { height: 500 }, chunks: [{ chunk_hash: "chunk-500" }] },
          }),
          { status: 200 }
        );
      }
      if (req.method === "chunk") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            result: {
              transactions: [{ hash: "tx-raid-1", signer_id: "hero.spire.testnet", receiver_id: "spire.testnet" }],
            },
          }),
          { status: 200 }
        );
      }
      if (req.method === "EXPERIMENTAL_tx_status") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            result: {
              transaction_outcome: { outcome: { executor_id: "hero.spire.testnet", logs: [] } },
              receipts_outcome: [
                {
                  outcome: {
                    executor_id: "spire.testnet",
                    logs: [
                      event("raid", {
                        account_id: "hero.spire.testnet",
                        floor: 0,
                        round: 1,
                        weapon: "weapon:solar",
                        damage: 140,
                        boss_remaining_hp: 860,
                        ticket_paid: "100000000000000000000000",
                        tribute_taken: false,
                      }),
                    ],
                  },
                },
              ],
            },
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", result: null }), { status: 200 });
    }) as typeof fetch;

    try {
      const indexer = new SpireIndexer({ rpcUrl: "https://mock-rpc.example", contractId: "spire.testnet" });
      const snap = await indexer.fetchLiveStats();
      assert.strictEqual(snap.total.totalJackpotYocto, "175000000000000000000000");
      assert.strictEqual(snap.total.totalDamage, 100);

      await indexer.pollLatestBlocks();
      assert.strictEqual(indexer.getEventCount(), 1);
      assert.strictEqual(indexer.getStats().totalRaids, 1);
      assert.strictEqual(indexer.getStats().totalJackpotYocto, "70000000000000000000000");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("handles GET /api/events?limit=1 and maps AlreadyExists account creation errors to HTTP 409", async () => {
    const collector = new StatsCollector();
    const accounts = new AccountQueue();
    const fakeEvents = [
      { standard: "spire" as const, version: "3.1.0", event: "raid", data: [{ floor: 1, damage: 50 }] },
      { standard: "spire" as const, version: "3.1.0", event: "boss_defeated", data: [{ floor: 1, round: 2 }] },
    ];

    const evRes = await handleApiRequestAsync("GET", "/api/events?limit=1", undefined, collector, accounts, {
      getRecentEvents: (limit) => fakeEvents.slice(-limit),
    });
    assert.strictEqual(evRes.status, 200);
    assert.strictEqual((evRes.body as any).events.length, 1);
    assert.strictEqual((evRes.body as any).events[0].event, "boss_defeated");

    const dupRes = await handleApiRequestAsync(
      "POST",
      "/api/accounts",
      { account_id: "alice.spire.testnet", public_key: "ed25519:" + "ab".repeat(32) },
      collector,
      accounts,
      {
        createAccount: async () => {
          throw new Error("AccountAlreadyExists: alice.spire.testnet already exists");
        },
      }
    );
    assert.strictEqual(dupRes.status, 409);
    assert.strictEqual((dupRes.body as any).error, "account_exists");
  });

  it("serves CORS headers, OPTIONS 204 preflight, and /api/events on live SpireIndexer HTTP streamer", async () => {
    const net = await import("node:net");
    const port = await new Promise<number>((resolvePort, rejectPort) => {
      const probe = net.createServer();
      probe.once("error", rejectPort);
      probe.listen(0, "127.0.0.1", () => {
        const addr = probe.address();
        const freePort = typeof addr === "object" && addr ? addr.port : 0;
        probe.close(() => resolvePort(freePort));
      });
    });

    const indexer = new SpireIndexer({ rpcUrl: "https://mock-rpc.example", contractId: "spire.testnet" });
    indexer.ingestLogs([
      'EVENT_JSON:{"standard":"spire","version":"3.1.0","event":"raid","data":[{"account_id":"a.spire.testnet","floor":0,"round":1,"weapon":"weapon:solar","damage":77,"boss_remaining_hp":923,"ticket_paid":"100000000000000000000000","tribute_taken":false}]}',
    ]);
    indexer.startStreamer(port);

    try {
      let optsRes: Response | null = null;
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          optsRes = await fetch(`http://127.0.0.1:${port}/api/events`, { method: "OPTIONS" });
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 15));
        }
      }
      assert.ok(optsRes, "Expected HTTP streamer to become reachable");
      assert.strictEqual(optsRes.status, 204);
      assert.strictEqual(optsRes.headers.get("access-control-allow-origin"), "*");

      const evRes = await fetch(`http://127.0.0.1:${port}/api/events?limit=5`);
      assert.strictEqual(evRes.status, 200);
      assert.strictEqual(evRes.headers.get("access-control-allow-origin"), "*");
      const evJson = (await evRes.json()) as { events: Array<{ event: string }> };
      assert.strictEqual(evJson.events.length, 1);
      assert.strictEqual(evJson.events[0].event, "raid");
    } finally {
      indexer.stopStreamer();
    }
  });
});
