#!/usr/bin/env node
// SpireFi non-interactive deploy pipeline: create subaccount (if needed) →
// deploy wasm → init `new(...)` → smoke view call. Reads near-cli plaintext
// credentials from ~/.near-credentials. No prompts.
//
// Usage:
//   node scripts/deploy-nearapi.mjs \
//     --wasm ../contract/target/near/spire.wasm \
//     --account game.seanwang-spire.testnet \
//     --parent seanwang-spire.testnet \
//     --initial-balance "3.2 NEAR" \
//     --owner seanwang-spire.testnet \
//     --relayer seanwang-spire.testnet \
//     --tee-public-key ed25519:<64-hex-or-base58>
import nearApiJs from "near-api-js";
import { base58 } from "@scure/base";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";

const { connect, keyStores, KeyPair, transactions } = nearApiJs;
// PublicKey lives in @near-js/crypto whose ESM entry is broken in this install —
// load it through the CommonJS path instead.
const { PublicKey } = createRequire(import.meta.url)("@near-js/crypto");

const RPC = "https://test.rpc.fastnear.com";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function parseNearToYocto(input) {
  const m = /^\s*([0-9]*\.?[0-9]+)\s*(NEAR|yocto)?\s*$/i.exec(input ?? "");
  if (!m) throw new Error(`bad amount: ${input}`);
  const [whole, frac = ""] = m[1].split(".");
  if ((m[2] ?? "NEAR").toUpperCase() === "YOCTO") return BigInt(m[1]);
  const fracYocto = frac ? BigInt(frac.padEnd(24, "0").slice(0, 24)) : 0n;
  return BigInt(whole) * 10n ** 24n + fracYocto;
}

async function accountExists(accountId) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "1", method: "query",
      params: { request_type: "view_account", finality: "final", account_id: accountId },
    }),
  });
  const json = await res.json();
  return Boolean(json?.result?.amount);
}

const wasmPath = path.resolve(arg("wasm"));
const accountId = arg("account");
const owner = arg("owner", accountId);
const relayer = arg("relayer", accountId);
const teePublicKeyRaw = arg("tee-public-key");
const parent = arg("parent");
const initialBalance = parseNearToYocto(arg("initial-balance", "3.2 NEAR"));
const skipDeploy = process.argv.includes("--skip-deploy");

if (!wasmPath || !accountId || !teePublicKeyRaw) {
  console.error("required: --wasm, --account, --tee-public-key");
  process.exit(1);
}

const code = fs.readFileSync(wasmPath);

// near_sdk::PublicKey JSON expects "ed25519:<base58>" — accept hex too.
function normalizePublicKey(pk) {
  const raw = pk.startsWith("ed25519:") ? pk.slice("ed25519:".length) : pk;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return `ed25519:${base58.encode(Buffer.from(raw, "hex"))}`;
  }
  return pk.startsWith("ed25519:") ? pk : `ed25519:${raw}`;
}
const teePublicKey = normalizePublicKey(teePublicKeyRaw);

const credDir = path.join(os.homedir(), ".near-credentials", "testnet");
const credPath = path.join(credDir, `${accountId}.json`);

const keyStore = new keyStores.InMemoryKeyStore();

if (!(await accountExists(accountId))) {
  if (!parent) {
    console.error(`account ${accountId} does not exist and no --parent was given`);
    process.exit(1);
  }
  const parentCred = JSON.parse(fs.readFileSync(path.join(credDir, `${parent}.json`), "utf8"));
  await keyStore.setKey("testnet", parent, KeyPair.fromString(parentCred.private_key));
  const near = await connect({ networkId: "testnet", nodeUrl: RPC, keyStore });
  const parentAccount = await near.account(parent);

  console.log(`creating ${accountId} funded by ${parent} (${initialBalance}) ...`);
  const newKeyPair = KeyPair.fromRandom("ed25519");
  await parentAccount.signAndSendTransaction({
    receiverId: accountId,
    actions: [
      transactions.createAccount(),
      transactions.transfer(initialBalance),
      transactions.addKey(
        PublicKey.fromString(newKeyPair.getPublicKey().toString()),
        transactions.fullAccessKey(),
      ),
    ],
  });
  fs.mkdirSync(credDir, { recursive: true });
  fs.writeFileSync(
    credPath,
    JSON.stringify(
      {
        account_id: accountId,
        public_key: newKeyPair.getPublicKey().toString(),
        private_key: newKeyPair.toString(),
      },
      null,
      2,
    ),
  );
  console.log(`created; new account key saved to ${credPath}`);
}

const cred = JSON.parse(fs.readFileSync(credPath, "utf8"));
await keyStore.setKey("testnet", accountId, KeyPair.fromString(cred.private_key));

if (skipDeploy) {
  console.log("--skip-deploy: account ready, stopping here.");
  process.exit(0);
}

const near = await connect({ networkId: "testnet", nodeUrl: RPC, keyStore });
const account = await near.account(accountId);

console.log(`deploying ${code.length} bytes to ${accountId} ...`);
await account.deployContract(code);
console.log("code deployed, running init new(...) ...");

await account.functionCall({
  contractId: accountId,
  methodName: "new",
  args: { owner, relayer, tee_public_key: teePublicKey },
  gas: BigInt("300000000000000"),
});
console.log("init done.");

// Smoke: view get_tower
const res = await fetch(RPC, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0", id: "smoke", method: "query",
    params: {
      request_type: "call_function", finality: "final",
      account_id: accountId, method_name: "get_tower", args_base64: "e30=",
    },
  }),
});
const smoke = await res.json();
const result = smoke?.result?.result;
if (result) {
  const parsed = JSON.parse(Buffer.from(result).toString());
  const floors = parsed.floors ?? [];
  console.log(`SMOKE OK — get_tower: ${floors.length} floors, floor[0].hp=${floors[0]?.hp}`);
} else {
  console.error("smoke failed:", JSON.stringify(smoke).slice(0, 300));
  process.exit(1);
}
