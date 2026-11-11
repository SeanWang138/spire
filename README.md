# SpireFi Protocol

Autonomous On-Chain Boss Battler, Adaptive Resistance Market, and Predictive GameFi Engine on NEAR Protocol.

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. The 5W+1H Framework](#2-the-5w1h-framework)
  - [2.1 What is SpireFi?](#21-what-is-spirefi)
  - [2.2 Why was SpireFi Created?](#22-why-was-spirefi-created)
  - [2.3 Who are the Participants?](#23-who-are-the-participants)
  - [2.4 When do Protocol Cycles Occur?](#24-when-do-protocol-cycles-occur)
  - [2.5 Where is SpireFi Deployed?](#25-where-is-spirefi-deployed)
  - [2.6 How does the Protocol Operate?](#26-how-does-the-protocol-operate)
- [3. System Architecture](#3-system-architecture)
  - [3.1 Layer 1: Smart Contract Engine](#31-layer-1-smart-contract-engine)
  - [3.2 Layer 2: Relayer and Autonomous Keeper](#32-layer-2-relayer-and-autonomous-keeper)
  - [3.3 Layer 3: Real-Time Indexer and Telemetry](#33-layer-3-real-time-indexer-and-telemetry)
  - [3.4 Layer 4: Client Web Application](#34-layer-4-client-web-application)
  - [3.5 Layer 5: Comprehensive Verification Harness](#35-layer-5-comprehensive-verification-harness)
- [4. Mathematical and Economic Formulations](#4-mathematical-and-economic-formulations)
  - [4.1 Deterministic Adaptive Resistance](#41-deterministic-adaptive-resistance)
  - [4.2 Combat Resolution and Damage Calculation](#42-combat-resolution-and-damage-calculation)
  - [4.3 NPC Merchant Bonding Curve](#43-npc-merchant-bonding-curve)
  - [4.4 Proportional Jackpot Distribution](#44-proportional-jackpot-distribution)
  - [4.5 Backer Vault and Dividend Accumulation](#45-backer-vault-and-dividend-accumulation)
  - [4.6 Trusted Execution Environment (TEE) Gate](#46-trusted-execution-environment-tee-gate)
- [5. Smart Contract Interface](#5-smart-contract-interface)
  - [5.1 Public View Methods](#51-public-view-methods)
  - [5.2 Public Change Methods](#52-public-change-methods)
  - [5.3 Event Standard (NEP-297)](#53-event-standard-nep-297)
- [6. Step-by-Step User Lifecycle](#6-step-by-step-user-lifecycle)
- [7. Local Development and Verification Guide](#7-local-development-and-verification-guide)
  - [7.1 Prerequisites](#71-prerequisites)
  - [7.2 Compiling the Smart Contract](#72-compiling-the-smart-contract)
  - [7.3 Executing Unit and Integration Tests](#73-executing-unit-and-integration-tests)
  - [7.4 Running the Web Dashboard](#74-running-the-web-dashboard)
  - [7.5 Running the Master Verification Pipeline](#75-running-the-master-verification-pipeline)
  - [7.6 Live Network End-to-End Testing](#76-live-network-end-to-end-testing)
- [8. Production Deployment Guide](#8-production-deployment-guide)
  - [8.1 Environment Variables](#81-environment-variables)
  - [8.2 Vercel Deployment Procedure](#82-vercel-deployment-procedure)
- [9. Repository Structure](#9-repository-structure)
- [10. License and Security Considerations](#10-license-and-security-considerations)

---

## 1. Executive Summary

SpireFi is a decentralized GameFi protocol deployed on NEAR Protocol. It combines collaborative raid boss battles, automated bonding curves, dynamic elemental resistance shifts, and zero-friction signless transactions with a self-balancing tokenomic ecosystem.

By leveraging NEAR Protocol's native account model, sub-accounts (`<name>.spire.testnet`), and Function Call Access Keys, SpireFi eliminates continuous wallet confirmation popups. All gameplay actions (gathering, crafting, reforging, attacking, and trading) execute seamlessly against an on-chain ledger, while rewards and payouts remain fully verifiable and trustless on-chain.

---

## 2. The 5W+1H Framework

### 2.1 What is SpireFi?

SpireFi is an on-chain gaming protocol composed of five core subsystems:
1. **Three-Floor Parallel Tower:** An escalation gauntlet featuring distinct boss encounters: Floor 0 (The Crypt), Floor 1 (The Frost Vault with elemental Frost Ward), and Floor 2 (The Void Apex with periodic Enrage healing).
2. **Adaptive Resistance Engine:** A closed-loop pricing mechanism that dynamically adjusts boss elemental defenses based on player weapon supply to penalize monoculture strategies and incentivize diversification.
3. **Internal Signless Vault Ledger:** A gas-optimized ledger allowing users to deposit NEAR once and execute hundreds of in-game actions with zero confirmation delays using browser-held Function Call Keys.
4. **NPC Merchant Bazaar:** An automated market maker implementing stock and demand curves with a fixed 10% spread, ensuring fair item exchange without external oracle dependencies.
5. **Decentralized Backer Vaults:** Staking pools allowing passive investors to underwrite tower floors and earn recurring dividend yields proportional to raid ticket sales.
6. **Hardware-Enforced TEE AI Gate:** An oracle mechanism where AI proposals for macro-economic adjustments are validated on-chain through Ed25519 cryptographic signatures originating from Trusted Execution Environments.

### 2.2 Why was SpireFi Created?

Web3 gaming frequently suffers from three structural flaws:
1. **User Experience Friction:** Traditional dApps require explicit wallet signatures for every single micro-action, destroying real-time immersion and causing high user drop-off.
2. **Economic Fragility and Hyperinflation:** Most GameFi economies rely on static minting rates with no continuous sink or adaptive resistance, leading to rapid asset devaluation.
3. **Centralized or Vulnerable Oracles:** Game parameters are typically adjusted either through centralized admin keys or through manipulable off-chain bots.

SpireFi addresses these challenges by:
- Employing NEAR sub-accounts and Function Call Keys for a smooth, single-click web2-like user experience.
- Implementing closed-loop conservation equations where elemental resistance and merchant pricing automatically counteract player imbalances.
- Restricting macro parameter governance to verifiable AI proposals signed within hardware-isolated TEE enclaves.

### 2.3 Who are the Participants?

The protocol supports four primary user profiles:
- **Raiders (Active Players):** Gather raw materials, craft and reforge weapons, optimize stance selections, and coordinate with the community to take down floor bosses and claim jackpot bounties.
- **Backers (Liquidity Providers):** Stake NEAR into Floor Boss Vaults to underwrite boss operations, absorbing ticket proceeds and earning continuous dividend distributions.
- **Arbitrageurs and Merchants:** Balance supply discrepancies between player inventories, the NPC Merchant Bazaar, and Boss Buyback contracts.
- **Autonomous Keepers and Oracles:** Run automated background daemons that evaluate epoch rollover triggers, monitor floor timeout resolutions, and relay signed TEE recommendations.

### 2.4 When do Protocol Cycles Occur?

Protocol activities are organized around three temporal cycles:
- **Real-Time Combat Rounds:** Attacks are processed asynchronously on-chain. When a boss reaches 0 HP, the round closes instantly, distributing rewards, resetting floor HP, and advancing the round counter.
- **Timed Floor Deadlines:** Floor 1 enforces a 30-minute raid timer; Floor 2 enforces a 20-minute timer with an Enrage trigger evaluating every 5 minutes.
- **Epoch Meta Transitions:** Periodic epochs recalculate global elemental supply shares, calibrate resistance distributions, and update merchant demand averages.

### 2.5 Where is SpireFi Deployed?

- **Blockchain Network:** NEAR Protocol Testnet.
- **Master Contract Account:** `spire.testnet`
- **Primary RPC Gateway:** FastNEAR High-Performance RPC (`https://rpc.testnet.fastnear.com`) with secondary fallback to `https://rpc.testnet.near.org`.
- **Sub-Account Domain:** All player accounts are provisioned as direct sub-accounts under the master namespace (e.g., `alice.spire.testnet`).
- **Web Application:** Next.js 14 responsive dApp client compatible with modern browsers across desktop and mobile devices.

### 2.6 How does the Protocol Operate?

The end-to-end player lifecycle proceeds through eight connected steps:
1. **Onboarding:** The user submits a desired username. The backend provisions `<name>.spire.testnet` on-chain and registers an ephemeral Function Call Key in the user's browser.
2. **Starter Bundle Claim:** The account executes `claim_starter`, receiving initial weapons and materials without incurring gas friction.
3. **Vault Funding:** The user deposits a balance (e.g., 0.5 NEAR) into the internal ledger via `deposit()`.
4. **Gathering & Crafting:** The user calls `gather` for raw ores and `craft_weapon` to mint NEP-245 elemental weapons.
5. **Reforging:** If a player holds excess weapons of an oversupplied element, they utilize `reforge` at the Altar to burn 2 weapons and mint 1 weapon of a scarcer element.
6. **Tower Assault:** The player selects Floor, Weapon, and a 3-turn tactical stance combination (`[Aggressive, Feint, Pierce]`), executing `attack()`. Ticket costs are deducted from the internal ledger.
7. **Victory & Settlement:** Upon landing the final blow, the contract emits `boss_defeated`, unlocks the subsequent floor, mints an on-chain dynamic SVG Trophy, and allocates 90% of the jackpot proportionally to damage dealt and 10% to the killer.
8. **Withdrawal:** Payouts credited to the internal ledger can be withdrawn directly to the player's native NEAR wallet at any time via `withdraw()`.

---

## 3. System Architecture

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|   Next.js 14 App Router | Tailwind Cyber-Fantasy UI | Signless Session Key Store  |
+-----------------------------------------------------------------------------------+
         |                                                 ^               ^
         | JSON-RPC (Read)                                 | Fast-Forward  | SSE / Logs
         v                                                 v               |
+---------------------+     +----------------------------------+     +--------------+
|   FASTNEAR RPC      |     | RELAYER & AUTONOMOUS KEEPER      |     | REAL-TIME    |
| (testnet.fastnear)  |     | TypeScript Engine & TEE Gate     |     | EVENT        |
+---------------------+     +----------------------------------+     | INDEXER      |
         |                                 |                         +--------------+
         |                                 | Signed Proposals               ^
         v                                 v                                |
+---------------------------------------------------------------------------+-------+
|                       SMART CONTRACT LAYER (Rust near-sdk)                        |
|                                                                                   |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |  Tower & Combat    |  | Adaptive Resistance|  |  NPC Merchant Bazaar        |  |
|  |  (3 Parallel Flrs) |  | (13,500 bps Total) |  |  (Bonding Curve & Spread)   |  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |  Internal Ledger   |  | Backer Vault Pool  |  |  Dynamic SVG NFT Engine     |  |
|  |  (Signless Vault)  |  | (DPS Accumulator)  |  |  (NEP-171/177 On-Chain)     |  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |  NEP-245 Tokens    |  | TEE Signature Gate |  |  NEP-297 EVENT_JSON Logger |  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 3.1 Layer 1: Smart Contract Engine (`contract/`)
Implemented in Rust using `near-sdk` v5.30.1. It acts as the single source of truth for all balances, token registries, floor configurations, damage logs, and economic settlement formulas. It compiles to a standalone WebAssembly binary (`spire.wasm`).

### 3.2 Layer 2: Relayer and Autonomous Keeper (`relayer/`)
A high-throughput TypeScript runtime responsible for:
- Maintaining telemetry synchronization across contract epochs.
- Monitoring floor expirations, enrage deadlines, and epoch maintenance windows.
- Ingesting telemetry into NEAR AI Cloud TEE (`z-ai/glm-5.3-flash`) and receiving cryptographic signatures over `/v1/signature/{chat_id}`.
- Providing deterministic offline mock signing for hermetic test execution.

### 3.3 Layer 3: Real-Time Indexer and Telemetry (`relayer/src/indexer.ts`)
Parses standard NEP-297 `EVENT_JSON` structures emitted by contract calls, transforming low-level receipt outcomes into structured streams for UI feeds, leaderboard calculations, and historical analytics.

### 3.4 Layer 4: Client Web Application (`web/`)
A responsive Next.js 14 dashboard built with React 18 and Tailwind CSS:
- **Left Column:** Crafting Forge, Resource Gathering Altar, Player Inventory, Realm Supply Bar.
- **Center Column:** Boss Arena, Real-Time HP Indicator, Jackpot Counter, Elemental Meta Radar, 3-Turn Tactical Combat Stance Selector, Combat Logs.
- **Right Column:** NPC Merchant Bazaar, Floor Selection Drawer, Live On-Chain Activity Stream, TEE Proof Inspector.
- **Account Engine:** Serverless sub-account creation via `/api/accounts`, with signless session management stored in `localStorage`.

### 3.5 Layer 5: Comprehensive Verification Harness (`scripts/`, `tests/`)
An opaque-box end-to-end test suite containing 111 deterministic verification gates:
- **Tier 1:** Category-partition feature coverage.
- **Tier 2:** Boundary values, overflow limits, and edge conditions.
- **Tier 3:** Cross-feature interactions (e.g., trade -> supply shift -> resistance update -> attack).
- **Tier 4:** Full real-world multi-floor assault simulation.
- **Tier 5:** Adversarial hardening and fuzzing.

---

## 4. Mathematical and Economic Formulations

### 4.1 Deterministic Adaptive Resistance

The protocol defines three combat elements: Solar ($e_0$), Frost ($e_1$), and Void ($e_2$).

To prevent over-reliance on a single weapon type, the contract enforces a total elemental resistance invariant:
$$\sum_{i=0}^{2} R_i = 13{,}500\text{ bps}\quad (135\%)$$

Each element's resistance is bounded within strict safety limits:
$$R_{\min} = 1{,}000\text{ bps}\quad(10\%),\quad R_{\max} = 8{,}500\text{ bps}\quad(85\%)$$

When total weapon supply $S = s_0 + s_1 + s_2 > 0$, the baseline target resistance is proportional to weapon prevalence:
$$\hat{R}_i = 13{,}500 \times \frac{s_i}{S}$$

Clamping and iterative surplus redistribution ensure conservation of the 13,500 bps sum while respecting bounds:
- Test Vector Verification: Given weapon supply distribution $[80, 20, 10]$ ($S = 110$), the algorithm yields exactly $[8500, 3114, 1886]\text{ bps}$.

### 4.2 Combat Resolution and Damage Calculation

A player's attack on a floor boss is evaluated deterministically:

1. **Base Weapon Damage:**
   $$D_{\text{base}} = 300\text{ HP}$$

2. **Elemental Resistance Mitigation:**
   $$D_{\text{res}} = D_{\text{base}} \times \left(1 - \frac{R_{\text{element}}}{10{,}000}\right)$$

3. **Floor 1 Frost Ward Modifier:**
   If attacking Floor 1 with Frost ($e_1$), damage is halved. If attacking with Solar ($e_0$), damage receives a 25% vulnerability bonus:
   $$M_{\text{floor}} = \begin{cases} 0.50 & \text{if Floor 1 and Frost} \\ 1.25 & \text{if Floor 1 and Solar} \\ 1.00 & \text{otherwise} \end{cases}$$

4. **Tactical Stance Multiplier:**
   Players choose three successive combat stances $S \in \{\text{Aggressive}, \text{Feint}, \text{Pierce}\}$. The boss deploys a stance sequence derived from block height and entropy:
   $$M_{\text{stance}} = \prod_{k=1}^{3} \text{StanceOutcome}(S_k, B_k)$$
   where a win yields $1.15\times$, a tie yields $1.00\times$, and a loss yields $0.85\times$.

5. **Boss Tribute Weapon Confiscation:**
   If the attacking element's resistance $R_{\text{element}} \ge 7{,}000\text{ bps}$, the boss confiscates 1 attacking weapon as tribute, unless the weapon is starter-locked or the player's last remaining weapon.

### 4.3 NPC Merchant Bonding Curve

The NPC Merchant executes trades against internal inventory using a deterministic bonding curve without external price feeds:

1. **Stock Pressure:**
   $$P_{\text{stock}} = \text{clamp}\left(\frac{\text{TargetStock} - \text{CurrentStock}}{\text{TargetStock}}, -1.0, +1.0\right)$$

2. **Demand Pressure:**
   $$P_{\text{demand}} = \frac{\text{AverageBuysLast5Epochs}}{\text{TargetStock}}$$

3. **Mid Price:**
   $$\text{MidPrice} = \text{BasePrice} \times \left(1 + 0.50 \cdot P_{\text{stock}} + 0.30 \cdot P_{\text{demand}}\right)$$
   $$\text{MidPrice} \in [0.50 \times \text{BasePrice}, 2.00 \times \text{BasePrice}]$$

4. **Bid-Ask Spread (10%):**
   - **Player Buy Price (Merchant Sells):** $\text{Price}_{\text{buy}} = \text{MidPrice} \times 1.10$
   - **Player Sell Price (Merchant Buys):** $\text{Price}_{\text{sell}} = \text{MidPrice} \times 0.90$
   - **Treasury Solvency Rule:** The merchant automatically closes if its native cash reserves fall below $1.0\text{ NEAR}$.

### 4.4 Proportional Jackpot Distribution

When a boss's remaining HP reaches zero:
- **Proportional Bounty Pool (90%):** Distributed strictly proportional to total damage contributed throughout the round:
  $$\text{Payout}_u = 0.90 \times \text{Jackpot} \times \frac{\text{Damage}_u}{\text{TotalDamage}}$$
- **Final Strike Bonus (10%):** Awarded entirely to the player who executed the fatal attack:
  $$\text{Bonus}_{\text{killer}} = 0.10 \times \text{Jackpot}$$

### 4.5 Backer Vault and Dividend Accumulation

Investors stake NEAR to support a specific floor's liquidity via `back_boss_vault(floor)`:
- Each deposit mints shares at a 1:1 ratio with attached yoctoNEAR.
- When raiders purchase combat tickets, ticket fees are split: a configured fraction is routed directly to the floor's dividend pool.
- Dividends accrue via a global Dividend-Per-Share ($\text{DPS}$) accumulator scaled by $10^{24}$:
  $$\Delta \text{DPS} = \frac{\text{FeeIncome} \times 10^{24}}{\text{TotalShares}}$$
- Outstanding dividends for shareholder $u$ are calculated without loops:
  $$\text{Claimable}_u = \frac{\text{Shares}_u \times (\text{DPS}_{\text{current}} - \text{DPS}_{\text{base}, u})}{10^{24}}$$

### 4.6 Trusted Execution Environment (TEE) Gate

Macro parameters (epoch meta shifts and buyback multipliers) are proposed through autonomous AI workers running inside confidential computing enclaves:
- The contract stores a pinned Ed25519 public key set during initialization.
- Submissions via `apply_ai_proposal(proposal, signature)` verify the payload's Ed25519 signature on-chain.
- The contract rejects any proposal where:
  - The signature is invalid.
  - The proposal epoch does not match the active epoch.
  - Elemental resistance adjustment $|\Delta R_i| > 2{,}500\text{ bps}$.
  - Buyback multiplier is outside $[10{,}000, 40{,}000]\text{ bps}$ ($1.0\times$ to $4.0\times$).

---

## 5. Smart Contract Interface

### 5.1 Public View Methods

| Method | Parameters | Return Type | Description |
|---|---|---|---|
| `get_meta` | None | `MetaResponse` | Active epoch, current resistances, supply shares, and next rollover timestamp. |
| `get_tower` | None | `TowerResponse` | Complete 3-floor state: HP, round, active flag, and time limits. |
| `get_floor` | `floor: u8` | `FloorResponse` | Detailed configuration and state for a specific floor index (0, 1, or 2). |
| `get_balance` | `account_id: AccountId` | `U128` | Internal vault ledger balance for the designated account in yoctoNEAR. |
| `get_inventory` | `account_id: AccountId` | `PlayerInventoryResponse` | Elemental weapons, starter-locked status, and raw crafting materials. |
| `get_supply` | None | `[u64; 3]` | Realm-wide circulating supply of Solar, Frost, and Void weapons. |
| `get_merchant` | None | `MerchantResponse` | Merchant status (`is_open`), cash reserve, and itemized stock levels. |
| `get_quote` | `item: String, side: String, qty: u64` | `MerchantQuote` | Authoritative quote for buying or selling items against the merchant. |
| `get_buyback_quote` | `floor: u8, element: u8` | `BuybackQuote` | Payout quote for selling weapons to the floor boss buyback fund. |
| `get_ai_state` | `floor: u8` | `Option<AiState>` | Active AI proposal state and parameters for the designated floor. |
| `get_backer` | `floor: u8, account_id: AccountId` | `BackerResponse` | Staked share balance, accumulator checkpoint, and unclaimed dividends. |
| `get_damage` | `account_id: AccountId, floor: u8, round: u32` | `U128` | Recorded combat damage dealt by player in a designated floor and round. |
| `get_claimable` | `account_id: AccountId, floor: u8, round: u32` | `U128` | Unclaimed jackpot payout amount for a completed raid round. |
| `get_claimable_loot` | `account_id: AccountId, floor: u8, round: u32` | `[u64; 3]` | Unclaimed material drop quantities for a completed raid round. |
| `mt_balance_of` | `account_id: AccountId, token_id: String` | `U128` | NEP-245 multi-token balance for a specified asset ID. |
| `mt_supply` | `token_id: String` | `U128` | Circulating token supply for a specified asset ID. |
| `nft_metadata` | None | `NFTContractMetadata` | NEP-177 contract metadata for on-chain dynamic trophies. |
| `nft_total_supply` | None | `U128` | Total count of dynamic SVG trophy NFTs minted to date. |

### 5.2 Public Change Methods

| Method | Access / Key | Attached Deposit | Gas Attached | Description |
|---|---|---|---|---|
| `claim_starter` | Function Call | None | 30 TGas | Mints initial starter bundle (4 Solar, 1 Frost, 4 Ore, 3 Essence). One-time per account. |
| `deposit` | Full Access | $> 0\text{ NEAR}$ | 30 TGas | Credits attached NEAR deposit into the player's internal signless ledger. |
| `withdraw` | Function Call | None | 50 TGas | Debits internal ledger and transfers native NEAR back to the user's account. |
| `gather` | Function Call | None | 30 TGas | Mines raw materials (`ore:iron`) subject to per-epoch cooldowns. |
| `craft_weapon` | Function Call | None | 40 TGas | Consumes 2 Ore and 3 Elemental Essence to forge a weapon. |
| `reforge` | Function Call | None | 40 TGas | Burns 2 crafted weapons of one element to forge 1 weapon of another element. |
| `attack` | Function Call | None | 70 TGas | Executes a 3-turn raid against a floor boss. Deducts ticket from internal ledger. |
| `claim_payout` | Function Call | None | 50 TGas | Claims proportional jackpot and bonus rewards for a completed raid round. |
| `claim_jackpot` | Function Call | None | 50 TGas | Batch-claims all historical unclaimed raid bounties for caller. |
| `buy_from_merchant`| Function Call | None | 40 TGas | Purchases materials from the NPC Bazaar using internal ledger balance. |
| `sell_to_merchant` | Function Call | None | 40 TGas | Sells materials to the NPC Bazaar, crediting the internal ledger. |
| `fund_jackpot` | Full Access | $> 0\text{ NEAR}$ | 30 TGas | Donates liquidity directly into a floor's active jackpot bounty pool. |
| `back_boss_vault` | Full Access | $> 0\text{ NEAR}$ | 30 TGas | Stakes NEAR into a floor vault to underwrite the boss and receive dividend shares. |
| `claim_backer_dividend` | Function Call | None | 40 TGas | Withdraws accrued ticket sales dividends for a backer position. |
| `update_meta` | Function Call | None | 50 TGas | Advances the macro epoch when the block timestamp crosses the epoch deadline. |
| `apply_ai_proposal`| Function Call | None | 60 TGas | Submits an Ed25519-signed macro proposal from the authorized TEE enclave. |

### 5.3 Event Standard (NEP-297)

All state-modifying actions emit structured, machine-readable logs prefixed with `EVENT_JSON:`:

```json
{
  "standard": "spire",
  "version": "3.1.0",
  "event": "raid",
  "data": [
    {
      "account_id": "player.spire.testnet",
      "floor": 0,
      "round": 1,
      "weapon": "weapon:solar",
      "damage": 289,
      "boss_remaining_hp": 711,
      "ticket_paid": "100000000000000000000000",
      "tribute_taken": false
    }
  ]
}
```

Supported event types:
- `starter_claimed`
- `deposit`
- `withdraw`
- `gather`
- `craft`
- `reforge`
- `raid`
- `floor_unlocked`
- `boss_defeated`
- `payout_claimed`
- `merchant_trade`
- `merchant_opened`
- `backer_staked`
- `dividend_claimed`
- `ai_proposal_applied`

---

## 6. Step-by-Step User Lifecycle

### Phase 1: Onboarding and Sub-Account Creation
When navigating to the dApp interface, the user enters an account handle (e.g., `alex`). The system invokes `/api/accounts`, which uses the master parent account (`spire.testnet`) to execute:
```typescript
await parentAccount.createAccount(
  "alex.spire.testnet",
  browserSessionPublicKey,
  100000000000000000000000n // 0.1 NEAR initial gas funding
);
```
The browser stores the corresponding private key in `localStorage` under `spire_session_v3`. All subsequent gameplay is fully signless.

### Phase 2: Claiming the Starter Pack
The client executes `claim_starter`:
- Allocates 4 Solar weapons and 1 Frost weapon (starter-locked).
- Allocates 4 Iron Ore and 3 Solar Essence.

### Phase 3: Funding the Vault Ledger
The player makes a one-time deposit to cover combat tickets and merchant shopping:
- Calls `deposit()` with an attached deposit (e.g., `0.5 NEAR`).
- Funds are recorded in `contract.ledger` and available immediately for signless execution.

### Phase 4: Crafting and Upgrades
- Call `gather("ore:iron")` to harvest ore from on-chain veins.
- Call `craft_weapon(0)` to forge a Solar Blade (consumes 2 Ore + 3 Essence).
- Access the NPC Merchant to acquire missing elemental essences.

### Phase 5: Reforging at the Altar
If community coordination shifts elemental resistance (e.g., Solar resistance exceeds 7,000 bps), players can reforge:
- Call `reforge(0, 1)`: Burns 2 non-starter Solar weapons to forge 1 Frost weapon, realigning the realm's circulating supply.

### Phase 6: Raid Combat and Final Strike
- Select target floor (Floor 0, Floor 1, or Floor 2).
- Select weapon element and 3-turn stance sequence.
- Execute `attack()`. The contract calculates damage, applies resistance mitigation, deducts the ticket from the ledger, and decrements boss HP.
- When boss HP reaches 0:
  - The floor unlocks the next tier.
  - The killer receives the 10% final-strike bounty.
  - Participants receive proportional jackpot allocations.
  - The round advances and boss HP resets.

### Phase 7: Bounty Claim and Withdrawal
- Call `claim_payout(floor, round)` to transfer jackpot winnings into the internal ledger balance.
- Call `withdraw()` to transfer funds from the internal ledger back to the player's native NEAR account.

---

## 7. Local Development and Verification Guide

### 7.1 Prerequisites

Ensure the following runtimes and toolchains are installed:
- **Rust:** `v1.80+` with target `wasm32-unknown-unknown`
- **Node.js:** `v20.0.0+` (or `v26.x`) and `npm v10+`
- **NEAR CLI RS:** Installed via `cargo install near-cli-rs`

### 7.2 Compiling the Smart Contract

To compile the smart contract WebAssembly binary:

```bash
cd contract
cargo check --target wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown --release
```

The optimized WebAssembly binary will be generated at:
`contract/target/wasm32-unknown-unknown/release/spire.wasm`

### 7.3 Executing Unit and Integration Tests

Run the full Rust smart contract test suite:

```bash
cd contract
cargo test -- --nocapture
```

Run the Relayer, Keeper, and Pricing Engine tests:

```bash
cd relayer
npm install
npm test
```

### 7.4 Running the Web Dashboard

To launch the Next.js frontend in development mode:

```bash
cd web
npm install
npm run dev
```

The interface will be available at `http://localhost:3000`.

To create an optimized production build:

```bash
cd web
npm run build
```

### 7.5 Running the Master Verification Pipeline

To execute the automated end-to-end verification pipeline across all layers:

```bash
./scripts/verify-all.sh
```

This master script verifies:
1. Rust Smart Contract compilation and 40+ unit tests.
2. Relayer TypeScript build and pricing test vectors.
3. Next.js 14 production compilation.
4. Comprehensive 111-gate E2E test suite (Tiers 1 through 4).

### 7.6 Live Network End-to-End Testing

To run the live testnet verification suite directly against `spire.testnet`:

```bash
node scripts/test-all-live.mjs
```

This script exercises all 21 view calls, executes live state modifications (merchant seeding, trading, jackpot funding, backer staking), creates a real sub-account, claims starter packs, crafts weapons, reforges at the altar, delivers a fatal raid blow, and claims jackpot payouts.

---

## 8. Production Deployment Guide

### 8.1 Environment Variables

Configure the following variables in production (e.g., Vercel Project Settings):

| Variable Name | Required | Default / Recommended Value | Description |
|---|---|---|---|
| `NEXT_PUBLIC_CONTRACT_ID` | Yes | `spire.testnet` | Master smart contract account identifier. |
| `NEXT_PUBLIC_PROJECT_NAME` | Yes | `SpireFi` | Display name of the application. |
| `NEAR_RPC_URL` | Yes | `https://rpc.testnet.fastnear.com` | High-performance JSON-RPC gateway endpoint. |
| `NEAR_PARENT_ACCOUNT_ID` | Yes | `spire.testnet` | Master account authorizing sub-account provisioning. |
| `NEAR_PARENT_PRIVATE_KEY` | Yes | `ed25519:...` | Full Access private key of the parent account. |
| `SUBACCOUNT_FUNDING_YOCTO`| Yes | `100000000000000000000000` | Micro-funding amount per sub-account (0.1 NEAR). |
| `NEXT_PUBLIC_RELAYER_URL` | No | *(leave empty)* | Defaults to internal serverless route `/api/accounts`. |

### 8.2 Vercel Deployment Procedure

1. Push your repository to GitHub.
2. Connect your GitHub repository to Vercel.
3. Set the **Root Directory** to `web`.
4. Select the **Next.js** framework preset.
5. Populate the Environment Variables listed in Section 8.1.
6. Trigger the deployment.

---

## 9. Repository Structure

```
spirefi/
├── .gitignore                      # Monorepo gitignore excluding secrets and build outputs
├── README.md                       # Master technical protocol documentation
├── DESIGN.md                       # Comprehensive design specifications
├── PROJECT.md                      # Architecture and milestone tracker
├── TEST_INFRA.md                   # E2E test infrastructure specification
├── TEST_READY.md                   # Verification and test readiness log
│
├── contract/                       # Layer 1: Rust Smart Contract
│   ├── Cargo.toml                  # near-sdk dependencies and profile flags
│   ├── src/
│   │   ├── lib.rs                  # Contract entry points, views, and change calls
│   │   ├── types.rs                # Domain data types, errors, and constants
│   │   ├── tower.rs                # 3-floor tower mechanics and combat logic
│   │   ├── resistance.rs           # Adaptive resistance bonding curves
│   │   ├── merchant.rs             # NPC bazaar pricing algorithms
│   │   ├── ledger.rs               # Signless internal balance ledger
│   │   ├── backer.rs               # Boss vault liquidity and dividend math
│   │   ├── nft.rs                  # Procedural on-chain SVG trophy generation
│   │   ├── tee.rs                  # AI proposal parsing and Ed25519 signature gate
│   │   └── events.rs               # NEP-297 EVENT_JSON emission utilities
│   └── target/                     # Compiled WebAssembly artifacts (git ignored)
│
├── relayer/                        # Layer 2 & 3: Relayer, Keeper, and Indexer
│   ├── package.json                # TypeScript dependencies
│   ├── tsconfig.json               # Compiler settings
│   ├── src/
│   │   ├── indexer.ts              # Real-time NEP-297 log ingestion engine
│   │   ├── keeper.ts               # Autonomous floor deadline and epoch monitor
│   │   ├── pricing.ts              # Mirror pricing engine for off-chain calculation
│   │   └── tee.ts                  # Hardware enclave integration and mock signer
│   └── tests/                      # Relayer integration and vector tests
│
├── web/                            # Layer 4: Next.js 14 Frontend Application
│   ├── package.json                # Dependencies (Next.js 14, Tailwind, near-api-js)
│   ├── tsconfig.json               # TypeScript configuration
│   ├── tailwind.config.ts          # Cyber-Fantasy color palette and token configuration
│   ├── .env.example                # Template for environment variables
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Main 3-column dashboard page
│       │   ├── layout.tsx          # Root HTML layout and metadata
│       │   └── api/accounts/       # Serverless sub-account auto-provisioning route
│       └── lib/
│           ├── contract.ts         # Strongly-typed smart contract interface adapter
│           ├── near.ts             # Signless SessionManager (Function Call Keys)
│           └── spire/              # Game constants and calculation helpers
│
├── scripts/                        # Automation & Deployment Scripts
│   ├── verify-all.sh               # Master verification pipeline script
│   ├── deploy.sh                   # Automated contract build and deploy utility
│   ├── harvest-faucet.mjs          # Autonomous testnet faucet harvester
│   └── test-all-live.mjs           # Complete live testnet verification suite
│
├── test-vectors/                   # Canonical Test Vector Fixtures
│   ├── resistance_vectors.json     # Mathematical resistance calibration vectors
│   ├── merchant_vectors.json       # Merchant bonding curve test cases
│   └── event_vectors.json          # Standard event parsing fixtures
│
└── tests/                          # Layer 5: E2E Test Suite (Tiers 1-4)
    ├── run_all.ts                  # Master E2E test runner
    ├── tier1_coverage.ts           # Tier 1 feature coverage suite
    ├── tier2_boundaries.ts         # Tier 2 boundary and corner case suite
    ├── tier3_interactions.ts       # Tier 3 pairwise cross-feature suite
    └── tier4_simulation.ts         # Tier 4 full tower assault simulation suite
```

---

## 10. License and Security Considerations

### License
This project is licensed under the Apache 2.0 License. See `LICENSE` for details.

### Security and Responsible Disclosure
- **Cryptographic Enclaves:** AI proposals must carry an Ed25519 signature verifiable against the on-chain pinned key. Never deploy testnet mock keys to production.
- **Credential Storage:** Never commit `.env.local` or raw secret keys to source control. The repository's `.gitignore` is pre-configured to strictly exclude all credential files.
- **Reentrancy Protection:** All financial withdrawals follow the checks-effects-interactions pattern with dedicated transaction receipt callbacks.
