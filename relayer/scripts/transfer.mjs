#!/usr/bin/env node
// SpireFi non-interactive NEAR transfer between the user's local accounts.
// Usage:
//   node scripts/transfer.mjs --from alice.spire.testnet --to game.seanwang-spire.testnet --amount "1.5 NEAR"
import nearApiJs from "near-api-js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { connect, keyStores, KeyPair } = nearApiJs;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const from = arg("from");
const to = arg("to");
const amount = arg("amount");
if (!from || !to || !amount) {
  console.error("required: --from, --to, --amount");
  process.exit(1);
}

const m = /^\s*([0-9]*\.?[0-9]+)\s*(NEAR|yocto)?\s*$/i.exec(amount);
if (!m) { console.error(`bad amount: ${amount}`); process.exit(1); }
const [whole, frac = ""] = m[1].split(".");
const yocto = (m[2] ?? "NEAR").toUpperCase() === "YOCTO"
  ? BigInt(m[1])
  : BigInt(whole) * 10n ** 24n + (frac ? BigInt(frac.padEnd(24, "0").slice(0, 24)) : 0n);

const credPath = path.join(os.homedir(), ".near-credentials", "testnet", `${from}.json`);
const cred = JSON.parse(fs.readFileSync(credPath, "utf8"));
const keyStore = new keyStores.InMemoryKeyStore();
await keyStore.setKey("testnet", from, KeyPair.fromString(cred.private_key));
const near = await connect({ networkId: "testnet", nodeUrl: "https://test.rpc.fastnear.com", keyStore });
const account = await near.account(from);

console.log(`sending ${amount} (${yocto} yocto) ${from} -> ${to} ...`);
await account.sendMoney(to, yocto);
console.log("sent.");
