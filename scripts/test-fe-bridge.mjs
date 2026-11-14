import { connect, keyStores, KeyPair, transactions, utils } from "../relayer/node_modules/near-api-js/lib/index.js";

const CONTRACT_ID = process.env.CONTRACT_ID || "spire.testnet";
const MASTER_KEY = process.env.MASTER_KEY || "";
const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.fastnear.com";

async function main() {
  if (!MASTER_KEY) {
    console.error("Please provide MASTER_KEY environment variable to run this verification test.");
    process.exit(1);
  }
  console.log("=== Testing Frontend-to-Contract Connection & Sub-Account Provisioning ===");

  // 1. Simulate browser session generation
  const playerPrefix = "raider" + Math.random().toString(36).substring(2, 6);
  const accountId = `${playerPrefix}.${CONTRACT_ID}`;
  const sessionKeyPair = KeyPair.fromRandom("ed25519");
  const browserPublicKey = sessionKeyPair.getPublicKey().toString();
  const browserSecretKey = sessionKeyPair.toString();

  console.log(`[1] Browser generated account: ${accountId}`);
  console.log(`[2] Browser public key: ${browserPublicKey}`);

  // 2. Simulate /api/accounts on-chain creation logic (using utils.PublicKey.from)
  const masterKeyStore = new keyStores.InMemoryKeyStore();
  await masterKeyStore.setKey("testnet", CONTRACT_ID, KeyPair.fromString(MASTER_KEY));
  const masterNear = await connect({ networkId: "testnet", nodeUrl: RPC_URL, keyStore: masterKeyStore });
  const masterAccount = await masterNear.account(CONTRACT_ID);

  console.log(`[3] Provisioning ${accountId} on-chain with 0.60 NEAR funding...`);
  const targetPublicKey = utils.PublicKey.from(browserPublicKey);
  const createTx = await masterAccount.createAccount(
    accountId,
    targetPublicKey,
    600000000000000000000000n // 0.60 NEAR
  );
  console.log(`[4] Account created! Tx: ${createTx.transaction_outcome?.id}`);

  // 3. Simulate browser signing transactions using sessionSecretKey
  const sessionKeyStore = new keyStores.InMemoryKeyStore();
  await sessionKeyStore.setKey("testnet", accountId, KeyPair.fromString(browserSecretKey));
  const sessionNear = await connect({ networkId: "testnet", nodeUrl: RPC_URL, keyStore: sessionKeyStore });
  const playerAccount = await sessionNear.account(accountId);

  console.log(`[5] Executing claim_starter with session key (gas: 30 TGas)...`);
  const claimRes = await playerAccount.signAndSendTransaction({
    receiverId: CONTRACT_ID,
    actions: [transactions.functionCall("claim_starter", {}, 30000000000000n, 0n)],
  });
  console.log(`[6] Starter claimed! Tx: ${claimRes.transaction_outcome?.id}`);

  // 4. Verify inventory on-chain
  const invRes = await masterAccount.viewFunction({
    contractId: CONTRACT_ID,
    methodName: "get_inventory",
    args: { account_id: accountId },
  });
  console.log(`[7] On-chain Inventory:`, JSON.stringify(invRes));

  if (invRes.weapons[0] >= 4 && invRes.weapons[1] >= 1) {
    console.log("\n>>> SUCCESS: Browser session successfully created, connected, and starter pack claimed on-chain! <<<\n");
  } else {
    throw new Error("Starter pack items not found in inventory!");
  }
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
