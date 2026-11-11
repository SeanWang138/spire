import { connect, keyStores, KeyPair } from "../web/node_modules/near-api-js/lib/index.js";

async function harvest() {
  const masterAccountId = "spire.testnet";
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const randomAccount = `spire-harvest-${randomSuffix}.testnet`;
  const keyPair = KeyPair.fromRandom("ed25519");

  console.log(`[1] Creating ${randomAccount} via official NEAR testnet faucet...`);
  const faucetRes = await fetch("https://helper.testnet.near.org/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      newAccountId: randomAccount,
      newAccountPublicKey: keyPair.publicKey.toString(),
    }),
  });

  const faucetJson = await faucetRes.json().catch(() => ({}));
  if (!faucetRes.ok) {
    console.error("Faucet response error:", faucetJson);
    throw new Error(`Faucet failed: ${faucetRes.status}`);
  }
  console.log(`[2] Successfully funded ${randomAccount} with 10 NEAR!`);

  console.log(`[3] Connecting and deleting ${randomAccount} to sweep funds to ${masterAccountId}...`);
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey("testnet", randomAccount, keyPair);
  const near = await connect({
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    keyStore,
  });

  const account = await near.account(randomAccount);
  const deleteRes = await account.deleteAccount(masterAccountId);
  console.log(`[4] Done! Funds swept to ${masterAccountId}. Tx:`, deleteRes.transaction_outcome?.id);
}

harvest().catch(console.error);
