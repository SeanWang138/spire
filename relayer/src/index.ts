/**
 * SpireFi - Relayer, Autonomous Keeper & Indexer entrypoint
 */

import { config as loadDotenv } from "dotenv";
loadDotenv(); // Load .env if present

export * from "./types.js";
export * from "./pricing.js";
export * from "./tee.js";
export * from "./indexer.js";
export * from "./keeper.js";

import { SpireKeeper, resolveKeeperAiMode } from "./keeper.js";
import {
  SpireIndexer,
  createPlayableSubaccount,
  DEFAULT_SUBACCOUNT_FUNDING_YOCTO,
} from "./indexer.js";
import {
  NearAiTeeClient,
  DEFAULT_NEAR_AI_MODEL,
  getMockTeeKeyPair,
  parseTeeSigningKeyPair,
  requireMockSeed,
  requireTeePublicKey,
} from "./tee.js";

async function main() {
  const args = process.argv.slice(2);
  let role = "all";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--role" && i + 1 < args.length) {
      role = args[i + 1];
    }
  }

  const rpcUrl = process.env.NEAR_RPC_URL || "https://test.rpc.fastnear.com";
  const contractId = process.env.CONTRACT_ID || "spire.testnet";
  const mockMode = process.env.MOCK_TEE === "true";
  const aiMode = resolveKeeperAiMode();
  const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS || 5000);
  const streamerPort = Number(process.env.STREAMER_PORT || 8080);

  console.log("=================================================");
  console.log("        SPIREFI RELAYER / KEEPER / INDEXER       ");
  console.log("=================================================");
  console.log(`Role: ${role}`);
  console.log(`RPC Endpoint: ${rpcUrl}`);
  console.log(`Contract ID: ${contractId}`);
  console.log(`Keeper AI mode: ${aiMode}`);
  if (aiMode === "epoch-only") {
    console.log("TEE signer: SKIPPED (KEEPER_AI_MODE=epoch-only; running update_meta & telemetry)");
  } else {
    console.log(
      `TEE signer: ${mockMode ? "MOCK (MOCK_TEE=true, local tests only)" : "LIVE NEAR AI Cloud"}`
    );
    console.log(`AI model: ${process.env.NEAR_AI_MODEL || DEFAULT_NEAR_AI_MODEL}`);
    // Fail fast here as well: no hardcoded keys, no defaults.
    if (mockMode) {
      const mockKeyPair = getMockTeeKeyPair(requireMockSeed());
      console.log(`Mock signer pubkey: ${Buffer.from(mockKeyPair.publicKey).toString("hex")}`);
    } else {
      const teePubkey = process.env.TEE_SIGNING_PRIVATE_KEY
        ? Buffer.from(parseTeeSigningKeyPair(process.env.TEE_SIGNING_PRIVATE_KEY).publicKey).toString("hex")
        : requireTeePublicKey();
      console.log(`TEE pubkey: ${teePubkey}`);
    }
  }
  console.log(`Poll Interval: ${pollIntervalMs}ms`);

  let keeper: SpireKeeper | null = null;
  let indexer: SpireIndexer | null = null;

  if (role === "keeper" || role === "all") {
    console.log("[Keeper] Initializing autonomous keeper...");
    const teeClient =
      aiMode === "epoch-only" ? null : new NearAiTeeClient({ mockMode });
    keeper = new SpireKeeper({
      rpcUrl,
      contractId,
      pollIntervalMs,
      mockMode,
      aiMode,
      teeClient,
    });
    keeper.start();
    console.log(
      aiMode === "epoch-only"
        ? "[Keeper] Started epoch rollover & floor telemetry loop (AI proposals disabled)."
        : "[Keeper] Started epoch, expiry and AI proposal loop."
    );
  }

  if (role === "indexer" || role === "all") {
    console.log(`[Indexer] NEP-297 scraper + stats API on :${streamerPort}...`);
    indexer = new SpireIndexer({ rpcUrl, contractId, pollIntervalMs });
    // POST /api/accounts: real subaccount creation (*.spire.testnet + fresh full-access
    // key) when explicitly enabled and keeper funding credentials exist; otherwise
    // accounts are validated and queued as pending.
    const autoCreate = process.env.AUTO_CREATE_ACCOUNTS === "true";
    const parentKey = process.env.KEEPER_PRIVATE_KEY ?? "";
    const parentAccount = process.env.KEEPER_ACCOUNT_ID ?? "";
    if (autoCreate && parentKey && parentAccount) {
      const fundingYocto = process.env.SUBACCOUNT_FUNDING_YOCTO || DEFAULT_SUBACCOUNT_FUNDING_YOCTO;
      indexer.accountCreator = async (accountId, publicKey) => {
        const created = await createPlayableSubaccount(
          parentAccount,
          parentKey,
          rpcUrl,
          accountId,
          fundingYocto,
          publicKey
        );
        console.log(
          `[Indexer] Created ${accountId} (full-access key ${created.public_key}${publicKey ? ", browser-provided" : ", operator-generated"})`
        );
        return { created: true, detail: created.public_key };
      };
      console.log(
        `[Indexer] Account creation: LIVE (funding ${BigInt(fundingYocto)} yocto per subaccount)`
      );
    } else {
      console.log("[Indexer] Account creation: queue-only (set AUTO_CREATE_ACCOUNTS=true to enable)");
    }
    indexer.start();
    indexer.startStreamer(streamerPort);
    console.log(
      `[Indexer] WS streamer ws://localhost:${streamerPort} | GET/POST /api/stats | POST /api/accounts`
    );

    indexer.on("event", (ev) => {
      console.log(`[Indexer Event] [${ev.event}] ->`, JSON.stringify(ev.data));
    });
  }

  const shutdown = () => {
    console.log("\n[Relayer] Shutdown signal received. Exiting...");
    if (keeper) keeper.stop();
    if (indexer) indexer.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && /index\.(ts|js)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error("[Relayer] Fatal error:", err);
    process.exit(1);
  });
}
