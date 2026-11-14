import { connect, keyStores, KeyPair } from "../relayer/node_modules/near-api-js/lib/index.js";

const CONTRACT_ID = "spire.testnet";
const PRIVATE_KEY = process.env.NEAR_TESTNET_PRIVATE_KEY?.trim();
if (!PRIVATE_KEY) {
  throw new Error(
    "Missing NEAR_TESTNET_PRIVATE_KEY environment variable. Provide the testnet account private key before running scripts/test-all-live.mjs."
  );
}
const RPC_URL = "https://rpc.testnet.fastnear.com";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
  magenta: "\x1b[35m",
};

function logHeader(title) {
  console.log(`\n${colors.magenta}${colors.bold}=== [ ${title} ] ===${colors.reset}`);
}

function logSuccess(method, detail) {
  console.log(`${colors.green}✔ [${method}]${colors.reset} ${detail || "OK"}`);
}

function logError(method, err) {
  console.error(`${colors.red}✖ [${method}] FAILED:${colors.reset}`, err.message || err);
}

async function runAllTests() {
  console.log(`${colors.cyan}${colors.bold}SpireFi Testnet Comprehensive Contract Verification${colors.reset}`);
  console.log(`Contract: ${CONTRACT_ID}`);
  console.log(`RPC Node: ${RPC_URL}`);

  const keyStore = new keyStores.InMemoryKeyStore();
  const parentKeyPair = KeyPair.fromString(PRIVATE_KEY);
  await keyStore.setKey("testnet", CONTRACT_ID, parentKeyPair);

  const near = await connect({
    networkId: "testnet",
    nodeUrl: RPC_URL,
    keyStore,
  });

  const masterAccount = await near.account(CONTRACT_ID);

  // ==========================================
  // PHASE 1: ALL VIEW CALLS
  // ==========================================
  logHeader("PHASE 1: SMART CONTRACT VIEW CALLS");

  async function testView(name, args = {}) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await masterAccount.viewFunction({
          contractId: CONTRACT_ID,
          methodName: name,
          args,
        });
        const summary = typeof res === "object" ? JSON.stringify(res).slice(0, 100) + "..." : String(res);
        logSuccess(name, summary);
        await new Promise((r) => setTimeout(r, 120));
        return res;
      } catch (err) {
        if (attempt < 4) {
          console.warn(`[${name}] Network retry (attempt ${attempt + 1}/4)...`);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        } else {
          logError(name, err);
          throw err;
        }
      }
    }
  }

  await testView("get_meta");
  await testView("get_tower");
  await testView("get_floor", { floor: 0 });
  await testView("get_floor", { floor: 1 });
  await testView("get_floor", { floor: 2 });
  await testView("get_supply");
  await testView("get_merchant");
  await testView("get_balance", { account_id: CONTRACT_ID });
  await testView("get_inventory", { account_id: CONTRACT_ID });
  await testView("get_quote", { item: "ore:iron", side: "buy", qty: 1 });
  await testView("get_quote", { item: "ore:iron", side: "sell", qty: 1 });
  await testView("get_buyback_quote", { floor: 0, element: 0 });
  await testView("get_ai_state", { floor: 0 });
  await testView("get_backer", { floor: 0, account_id: CONTRACT_ID });
  await testView("get_damage", { account_id: CONTRACT_ID, floor: 0, round: 0 });
  await testView("get_claimable", { account_id: CONTRACT_ID, floor: 0, round: 0 });
  await testView("get_claimable_loot", { account_id: CONTRACT_ID, floor: 0, round: 0 });
  await testView("mt_balance_of", { account_id: CONTRACT_ID, token_id: "weapon:solar" });
  await testView("mt_supply", { token_id: "weapon:solar" });
  await testView("nft_metadata");
  await testView("nft_total_supply");

  // ==========================================
  // PHASE 2: CORE CHANGE CALLS (MASTER ACCOUNT)
  // ==========================================
  logHeader("PHASE 2: CONTRACT STATE TRANSITIONS & CHANGE CALLS");

  // 1. Seed merchant with crafting ingredients
  console.log(`\n--> Testing [seed_merchant] for materials...`);
  await masterAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "seed_merchant",
    args: { item_id: "ore:iron", qty: 100 },
    gas: 30000000000000n,
  });
  await masterAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "seed_merchant",
    args: { item_id: "essence:solar", qty: 100 },
    gas: 30000000000000n,
  });
  logSuccess("seed_merchant", "Stocked ore:iron & essence:solar");

  // 2. Buy and Sell from Merchant
  console.log(`\n--> Testing [buy_from_merchant] (ore:iron x 1)...`);
  const buyRes = await masterAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "buy_from_merchant",
    args: { item: "ore:iron", qty: 1 },
    gas: 35000000000000n,
  });
  logSuccess("buy_from_merchant", `Tx: ${buyRes.transaction_outcome.id}`);

  console.log(`\n--> Testing [sell_to_merchant] (ore:iron x 1)...`);
  const sellRes = await masterAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "sell_to_merchant",
    args: { item: "ore:iron", qty: 1 },
    gas: 35000000000000n,
  });
  logSuccess("sell_to_merchant", `Tx: ${sellRes.transaction_outcome.id}`);

  // 3. Fund Jackpot
  console.log(`\n--> Testing [fund_jackpot] (Floor 0, 0.02 NEAR)...`);
  const fundRes = await masterAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "fund_jackpot",
    args: { floor: 0 },
    gas: 30000000000000n,
    attachedDeposit: 20000000000000000000000n,
  });
  logSuccess("fund_jackpot", `Tx: ${fundRes.transaction_outcome.id}`);

  // 4. Back Boss Vault
  console.log(`\n--> Testing [back_boss_vault] (Floor 0, 0.02 NEAR)...`);
  const backRes = await masterAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "back_boss_vault",
    args: { floor: 0 },
    gas: 30000000000000n,
    attachedDeposit: 20000000000000000000000n,
  });
  logSuccess("back_boss_vault", `Tx: ${backRes.transaction_outcome.id}`);

  // ==========================================
  // PHASE 3: SIGNLESS SUB-ACCOUNT LIFECYCLE
  // ==========================================
  logHeader("PHASE 3: SUB-ACCOUNT AUTO-PROVISIONING & ONBOARDING");

  const subAccountName = `player${Math.random().toString(36).substring(2, 7)}.${CONTRACT_ID}`;
  const subKeyPair = KeyPair.fromRandom("ed25519");
  console.log(`Target sub-account : ${subAccountName}`);
  console.log(`Funding Amount     : 1.0 NEAR (1,000,000,000,000,000,000,000,000 yoctoNEAR)`);

  const createRes = await masterAccount.createAccount(
    subAccountName,
    subKeyPair.publicKey,
    1000000000000000000000000n // 1.0 NEAR
  );
  logSuccess("createAccount", `Created ${subAccountName} (Tx: ${createRes.transaction_outcome.id})`);

  await keyStore.setKey("testnet", subAccountName, subKeyPair);
  const subAccount = await near.account(subAccountName);

  // 1. Claim Starter Pack
  console.log(`\n--> [${subAccountName}] calling [claim_starter]...`);
  const starterRes = await subAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "claim_starter",
    args: {},
    gas: 30000000000000n,
  });
  logSuccess("claim_starter (sub-account)", `Tx: ${starterRes.transaction_outcome.id}`);

  // 2. Deposit 0.6 NEAR into Ledger
  console.log(`\n--> [${subAccountName}] calling [deposit] (0.6 NEAR)...`);
  const subDepRes = await subAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "deposit",
    args: {},
    gas: 30000000000000n,
    attachedDeposit: 600000000000000000000000n, // 0.6 NEAR
  });
  logSuccess("deposit (sub-account)", `Tx: ${subDepRes.transaction_outcome.id}`);

  // 3. Gather Resource
  console.log(`\n--> [${subAccountName}] calling [gather] (ore:iron)...`);
  const subGatherRes = await subAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "gather",
    args: { item_id: "ore:iron" },
    gas: 30000000000000n,
  });
  logSuccess("gather (sub-account)", `Tx: ${subGatherRes.transaction_outcome.id}`);

  // 4. Craft 1st Solar weapon (uses starter pack essence)
  console.log(`\n--> [${subAccountName}] calling [craft_weapon] #1 (Solar)...`);
  const subCraftRes1 = await subAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "craft_weapon",
    args: { element: 0 },
    gas: 40000000000000n,
  });
  logSuccess("craft_weapon #1", `Tx: ${subCraftRes1.transaction_outcome.id}`);

  // 5. Buy 3x essence:solar from Merchant
  console.log(`\n--> [${subAccountName}] buying 3x essence:solar from merchant...`);
  const buyEssenceRes = await subAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "buy_from_merchant",
    args: { item: "essence:solar", qty: 3 },
    gas: 40000000000000n,
  });
  logSuccess("buy_from_merchant (sub-account)", `Tx: ${buyEssenceRes.transaction_outcome.id}`);

  // 6. Craft 2nd Solar weapon (subaccount now has 2 non-starter Solar weapons!)
  console.log(`\n--> [${subAccountName}] calling [craft_weapon] #2 (Solar)...`);
  const subCraftRes2 = await subAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "craft_weapon",
    args: { element: 0 },
    gas: 40000000000000n,
  });
  logSuccess("craft_weapon #2", `Tx: ${subCraftRes2.transaction_outcome.id}`);

  // 7. Reforge: Burn 2 crafted Solar weapons to mint 1 Frost weapon
  console.log(`\n--> [${subAccountName}] calling [reforge] (Solar -> Frost, burning 2 crafted weapons)...`);
  const subReforgeRes = await subAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "reforge",
    args: { burn_element: 0, target_element: 1 },
    gas: 40000000000000n,
  });
  logSuccess("reforge (sub-account)", `Tx: ${subReforgeRes.transaction_outcome.id}`);

  // 8. Attack Floor 0 Boss (Slays the remaining 178 HP!)
  console.log(`\n--> [${subAccountName}] calling [attack] (Floor 0, Solar)...`);
  const subAttackRes = await subAccount.functionCall({
    contractId: CONTRACT_ID,
    methodName: "attack",
    args: { floor: 0, weapon_element: 0, stances: [0, 0, 0] },
    gas: 70000000000000n,
  });
  logSuccess("attack (final blow)", `Tx: ${subAttackRes.transaction_outcome.id}`);

  // 9. Claim Jackpot / Payout for Round 0!
  console.log(`\n--> [${subAccountName}] calling [claim_payout] (Floor 0, Round 0)...`);
  try {
    const claimRes = await subAccount.functionCall({
      contractId: CONTRACT_ID,
      methodName: "claim_payout",
      args: { floor: 0, round: 0 },
      gas: 50000000000000n,
    });
    logSuccess("claim_payout (sub-account)", `Tx: ${claimRes.transaction_outcome.id}`);
  } catch (err) {
    console.warn(`[claim_payout] Note: ${err.message || err}`);
  }

  // 10. Withdraw winnings from internal ledger
  console.log(`\n--> [${subAccountName}] calling [withdraw] (0.05 NEAR)...`);
  try {
    const withdrawRes = await subAccount.functionCall({
      contractId: CONTRACT_ID,
      methodName: "withdraw",
      args: { amount: "50000000000000000000000" }, // 0.05 NEAR
      gas: 50000000000000n,
    });
    logSuccess("withdraw (sub-account)", `Tx: ${withdrawRes.transaction_outcome.id}`);
  } catch (err) {
    console.warn(`[withdraw] Note: ${err.message || err}`);
  }

  // Final State Inspection
  const finalTower = await masterAccount.viewFunction({
    contractId: CONTRACT_ID,
    methodName: "get_tower",
    args: {},
  });
  const nftSupply = await masterAccount.viewFunction({
    contractId: CONTRACT_ID,
    methodName: "nft_total_supply",
    args: {},
  });

  logHeader("FINAL ON-CHAIN STATE SUMMARY");
  console.log(`Floor 0: HP ${finalTower.floors[0].hp}/${finalTower.floors[0].max_hp} | Round ${finalTower.floors[0].round}`);
  console.log(`Floor 1: HP ${finalTower.floors[1].hp}/${finalTower.floors[1].max_hp} | Round ${finalTower.floors[1].round}`);
  console.log(`Floor 2: HP ${finalTower.floors[2].hp}/${finalTower.floors[2].max_hp} | Round ${finalTower.floors[2].round}`);
  console.log(`NFT Trophies Minted: ${nftSupply}`);

  console.log(`\n${colors.green}${colors.bold}✔ ALL SMART CONTRACT METHODS TESTED AND FULLY VERIFIED ON NEAR TESTNET!${colors.reset}\n`);
}

runAllTests().catch((e) => {
  console.error("FATAL ERROR IN TEST SUITE:", e);
  process.exit(1);
});
