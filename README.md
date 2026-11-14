# SpireFi Protocol

Autonomous On-Chain Boss Battler, Supply-Driven Adaptive Resistance Market, and Predictive GameFi Engine on NEAR Protocol (`spire.testnet`).

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Paper Game Loop (`30s / 5m / Session`)](#2-paper-game-loop-30s--5m--session)
- [3. Quick Judge Walkthrough (`do X - see Y`)](#3-quick-judge-walkthrough-do-x---see-y)
- [4. Honest Scope Disclosures](#4-honest-scope-disclosures)
- [5. System Architecture](#5-system-architecture)
  - [5.1 Layer 1: Smart Contract Engine (`contract/`)](#51-layer-1-smart-contract-engine-contract)
  - [5.2 Layer 2: Relayer, NEAR AI & Keeper (`relayer/`)](#52-layer-2-relayer-near-ai--keeper-relayer)
  - [5.3 Layer 3: Real-Time Indexer (`relayer/src/indexer.ts`)](#53-layer-3-real-time-indexer-relayersrcindexerts)
  - [5.4 Layer 4: Next.js 14 Citadel Web App (`web/`)](#54-layer-4-nextjs-14-citadel-web-app-web)
  - [5.5 Layer 5: Verification & Cross-Layer Parity (`tests/`, `scripts/`)](#55-layer-5-verification--cross-layer-parity-tests-scripts)
- [6. Mathematical and Economic Formulations](#6-mathematical-and-economic-formulations)
  - [6.1 Deterministic Adaptive Resistance](#61-deterministic-adaptive-resistance)
  - [6.2 Combat Resolution, Frost Ward, Enrage & Tribute](#62-combat-resolution-frost-ward-enrage--tribute)
  - [6.3 NPC Merchant Bonding Curve](#63-npc-merchant-bonding-curve)
  - [6.4 Ticket Splits, Floor Drip & Jackpot Settlement](#64-ticket-splits-floor-drip--jackpot-settlement)
  - [6.5 Backer Vault and Dividend Accumulation](#65-backer-vault-and-dividend-accumulation)
  - [6.6 AI Proposal Verification Gate](#66-ai-proposal-verification-gate)
- [7. Smart Contract Interface (`spire.testnet`)](#7-smart-contract-interface-spiretestnet)
  - [7.1 Public View Methods](#71-public-view-methods)
  - [7.2 Public Change Methods](#72-public-change-methods)
  - [7.3 Event Standard (NEP-297)](#73-event-standard-nep-297)
- [8. Step-by-Step User Lifecycle](#8-step-by-step-user-lifecycle)
- [9. Local Development, Parity & Deployment](#9-local-development-parity--deployment)
  - [9.1 Prerequisites & Building](#91-prerequisites--building)
  - [9.2 Running Unit, Parity & Simulation Tests](#92-running-unit-parity--simulation-tests)
  - [9.3 Live Network Verification](#93-live-network-verification)
  - [9.4 Environment Variables & Vercel Deployment](#94-environment-variables--vercel-deployment)
- [10. Repository Structure](#10-repository-structure)
- [11. License, Roadmap & Security](#11-license-roadmap--security)

---

## 1. Executive Summary

SpireFi is an autonomous dark-fantasy GameFi protocol deployed on NEAR Testnet (`spire.testnet`). Players gather crafting resources, trade with a deterministic NPC Merchant bonding curve, forge and reforge elemental weapons (`Solar`, `Frost`, `Void`), and raid a 3-floor boss tower where global weapon supply automatically recalibrates boss resistances every hour.

To eliminate wallet popup friction during rapid combat and market turns on testnet, onboarding creates an **Ephemeral Testnet Guest Session** subaccount (`<name>.spire.testnet`) funded with `0.60 NEAR` (`600000000000000000000000` yoctoNEAR) via `/api/accounts`, or lets players connect an external NEAR testnet wallet. Every core rule, payout, ticket split, tribute confiscation, and merchant quote is enforced deterministically on-chain in Rust ([`contract/src/lib.rs`](contract/src/lib.rs)).

---

## 2. Paper Game Loop (`30s / 5m / Session`)

Designed around the [09-games.md](09-games.md) economy-first loop:

| Cadence | Player Actions | On-Chain / Economic Consequence |
|---|---|---|
| **Every 30 seconds** | Gather raw resources (`gather`), inspect NPC Merchant bid/ask tooltip & Fast-Forward Economy Sim, or launch a 3-turn boss attack combo (`attack` using `Aggressive` / `Feint` / `Pierce`). | `gather` mints `+2` materials (30s cooldown, max `20`/epoch); merchant trades rebalance stock & demand curve; combat debits the floor ticket (`0.10 / 0.15 / 0.25 NEAR`), splits fees (`70% / 15% / 10% / 5%`), and deals deterministic turn damage. |
| **Every 5 minutes** | Track Floor 3 Enrage ticks (`+10% max HP = +250 HP` per 5m), floor deadlines (`30m` Floor 2, `20m` Floor 3), and server-wide weapon supply skew (`>= 7000 bps` Tribute zone). Craft (`craft_weapon`), reforge (`reforge`), or sell to Boss Buyback (`sell_to_boss_buyback`). | Players adapt away from congested elements to avoid `>= 7,000 bps` non-starter Tribute confiscation, burn oversupplied weapons (`2 -> 1`, or `3 -> 2` when AI unlocks it), and exploit Floor 2 Frost Ward (`+1,500 bps` Frost defense). |
| **Every session (1h Epoch / Boss Kill)** | Wait for or trigger hourly `lazy_epoch()` (`update_meta`), observe AI Relayer buyback multiplier & altar unlocks (`apply_ai_proposal`), finish boss HP, claim raid payouts (`claim_payout`) and backer dividends (`claim_backer_dividend`), mint Floor 3 SVG trophy (`spirefi-trophy-r{round}-f3`), and `withdraw()`. | Hourly epoch recalculates resistance automatically from weapon supply (`<= 2,500 bps` shift/epoch); defeating a boss drips `10%` of jackpot to the next floor, pays `10%` killer bonus + `90%` damage-proportional shares, and rotates `backer_cycle`. |

---

## 3. Quick Judge Walkthrough (`do X - see Y`)

Every feature maps directly to source files and live read-only RPC views on `spire.testnet`:

| Flow | Do X (UI or CLI / RPC) | See Y (Expected Observable Result) | Authoritative Code & Live RPC Check |
|---|---|---|---|
| **1. Onboarding & Session** | Open `/game/start`, enter a handle, create an Ephemeral Testnet Guest Session (or connect wallet), then call `claim_starter`. | Server route [`web/src/app/api/accounts/route.ts`](web/src/app/api/accounts/route.ts) provisions `<name>.spire.testnet` funded with `0.60 NEAR` (`keyMode: "ephemeral-full-access"`), or returns HTTP `503 TESTNET_FAUCET_NOT_CONFIGURED` if parent key env is unset. `claim_starter` grants `[4 Solar, 1 Frost, 0 Void]` starter-locked weapons + `4` Ore + `3` Solar/Frost/Void Essence each. | [`web/src/app/api/accounts/route.ts`](web/src/app/api/accounts/route.ts), [`contract/src/lib.rs`](contract/src/lib.rs) · RPC view: `get_inventory` (`{"account_id":"<id>"}`) |
| **2. Adaptive Resistance & Hourly Meta** | Inspect `/game/raid` Meta Radar & Server Supply bar, craft or reforge a weapon (`craft_weapon` / `reforge`), or query `get_meta` / `get_supply`. | Resistances sum strictly to `13,500 bps` (`[1000, 8500]` per element). Supply `[80, 20, 10]` maps deterministically to `[8500, 3114, 1886]`. Hourly `lazy_epoch()` shifts toward supply targets capped at `2,500 bps/epoch`. | [`contract/src/resistance.rs`](contract/src/resistance.rs), [`test-vectors/resistance_vectors.json`](test-vectors/resistance_vectors.json) · RPC view: `get_meta`, `get_supply` |
| **3. 3-Floor Combat & Tribute** | On `/game/raid`, pick Floor `0/1/2` (UI `1/2/3`), weapon element, and 3 stances (`[0,1,2]`), then execute `attack`. | Ticket debited (`0.10 / 0.15 / 0.25 NEAR`); 3 turns compute damage from `ATTACK_BASE_POWER = 140`. Floor 2 applies `+1,500 bps` Frost Ward; Floor 3 heals `+250 HP` per 5m Enrage; if `res_eff >= 7,000 bps` & `total_weapons > 1`, 1 non-starter weapon is confiscated. | [`contract/src/tower.rs`](contract/src/tower.rs), [`contract/src/lib.rs`](contract/src/lib.rs) · RPC view: `get_tower`, `get_floor` (`{"floor":0}`) |
| **4. NPC Merchant & Fast-Forward Sim** | Open `/game/merchant`, hover/focus the pricing reasoning tooltip, run Fast-Forward Economy Sim, or call `get_quote` / `buy_from_merchant` / `sell_to_merchant`. | Quotes reflect `MERCHANT_BASE_PRICE = 0.05 NEAR`, `target = 100`, `k1 = 0.50` stock pressure, `k2 = 0.30` demand (`0.50x..2.00x` mid), and `±10%` spread. Merchant trades materials only (`40/item/epoch` buy cap) and closes automatically if cash `< 1.0 NEAR`. | [`contract/src/merchant.rs`](contract/src/merchant.rs), [`web/src/lib/merchant-reasoning.ts`](web/src/lib/merchant-reasoning.ts), [`test-vectors/merchant_vectors.json`](test-vectors/merchant_vectors.json) · RPC view: `get_merchant`, `get_quote` |
| **5. Backer Vault & Dividends** | Open `/game/vault`, stake NEAR via `back_boss_vault(floor)` or inspect `get_backer` / `get_floor`. | Attached NEAR is added directly to `floor.jackpot`; backer receives `amount / 1e16` shares (`10^-8 NEAR` unit on live testnet build). Backers earn `15%` of ticket sales until boss defeat (`claim_backer_dividend`); on timeout, jackpot carries over. | [`contract/src/lib.rs`](contract/src/lib.rs), [`contract/src/types.rs`](contract/src/types.rs) · RPC view: `get_backer` (`{"floor":0,"account_id":"<id>"}`) |
| **6. AI Relayer Proof Inspector** | Open `/game/ai` or query `get_ai_state(floor)`. | Shows latest `epoch`, `nonce`, `buyback_multiplier_bps ∈ [10000, 40000]`, `altar_recipe_id`, `taunt`, NEAR AI `chat_id`, and Ed25519 `signature_hex` over `"spire/floor=.../epoch=.../buyback=.../recipe=.../nonce=..."`. | [`contract/src/tee.rs`](contract/src/tee.rs), [`relayer/src/tee.ts`](relayer/src/tee.ts) · RPC view: `get_ai_state` (`{"floor":0}`) |
| **7. Floor 3 SVG Trophy & Settlement** | Defeat Floor 3 (`floor = 2`), then query `nft_metadata`, `nft_total_supply`, `nft_token`, and `get_claimable`. | Mints on-chain NEP-171 dynamic SVG trophy `spirefi-trophy-r{round}-f3` with `media` `data:image/svg+xml;utf8,<svg...`; allocates `10%` killer bonus + `90%` proportional payouts. | [`contract/src/nft.rs`](contract/src/nft.rs), [`contract/src/lib.rs`](contract/src/lib.rs) · RPC view: `nft_metadata`, `nft_total_supply` |

Live RPC verification snippet (FastNEAR Testnet, zero setup required):

```bash
curl -sS https://rpc.testnet.fastnear.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"spire-meta","method":"query","params":{"request_type":"call_function","finality":"final","account_id":"spire.testnet","method_name":"get_meta","args_base64":"e30="}}'
```

---

## 4. Honest Scope Disclosures

To keep hackathon screening (`Q-017`) and security review completely transparent, these four implementation boundaries apply to the live `spire.testnet` deployment:

1. **Ephemeral Testnet Session Subaccount (Not FCAK / Social OAuth):** Browser testnet guest onboarding via [`web/src/app/api/accounts/route.ts`](web/src/app/api/accounts/route.ts) creates a new `<name>.spire.testnet` subaccount with a browser-generated `FullAccess` Ed25519 keypair and `0.60 NEAR` initial funding (`keyMode: "ephemeral-full-access"`). If `NEAR_PARENT_PRIVATE_KEY` (or `KEEPER_PRIVATE_KEY`) is absent, the route fails honestly with HTTP `503 TESTNET_FAUCET_NOT_CONFIGURED`. Function Call Access Keys (FCAKs) and social/email OAuth account abstraction are target mainnet improvements, alongside direct wallet connection already supported in the UI.
2. **Partial NEP-245 Multi-Token Implementation:** [`contract/src/lib.rs`](contract/src/lib.rs) implements core NEP-245 views and single-token transfers (`mt_balance_of`, `mt_supply`, `mt_transfer`) across `ore:iron`, `essence:solar`, `essence:frost`, `essence:void`, `weapon:solar`, `weapon:frost`, and `weapon:void` (enforcing `starter_locked` non-transferability), rather than batch transfer receivers (`mt_batch_transfer_call`) or storage-deposit standards.
3. **Relayer Ed25519 `"spire/..."` Signature + NEAR AI `chat_id` Audit (Hardware TEE Attestation on Roadmap §13):** In [`relayer/src/tee.ts`](relayer/src/tee.ts), live AI inference (`KEEPER_AI_MODE=near-ai`, requiring `NEAR_AI_API_KEY`) calls NEAR AI Cloud (`z-ai/glm-5.3-flash`) and fetches an off-chain chat audit hash via `GET /signature/{chat_id}` stored as metadata (`chat_id`), while the on-chain contract [`contract/src/tee.rs`](contract/src/tee.rs) verifies the Relayer's pinned Ed25519 signature (`TEE_SIGNING_PRIVATE_KEY`) over the canonical `"spire/..."` message (`MOCK_TEE=true` with explicit `MOCK_TEE_SEED` is strictly opt-in for local tests). In pure-testnet deployments without NEAR AI Cloud credits (`KEEPER_AI_MODE=epoch-only`), the keeper triggers hourly `update_meta()` epoch rollovers and runs the indexer while skipping `apply_ai_proposal`, keeping floor buyback multipliers at the deterministic `1.00x` contract baseline. Full on-chain hardware TEE remote attestation verification is scheduled on Roadmap §13.
4. **Automatic Supply-Driven Resistance on `lazy_epoch()`:** Elemental boss resistance updates automatically every 1-hour epoch inside `lazy_epoch()` in [`contract/src/lib.rs`](contract/src/lib.rs) solely from weapon supply (`compute_shifted_resistance`). AI proposals never alter combat resistance; `apply_ai_proposal` only controls `buyback_multiplier_bps`, `altar_recipe_id` (`"reforge_2_to_1"` or `"reforge_3_to_2"`), and `taunt`.

---

## 5. System Architecture

```text
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|   Next.js 14 App Router (/ & /game/*) | Three.js Citadel | Guest Session / Wallet |
+-----------------------------------------------------------------------------------+
         |                                                 ^               ^
         | JSON-RPC (Read/Write)                           | Math Mirror   | Event Stream
         v                                                 v               |
+---------------------+     +----------------------------------+     +--------------+
|   FASTNEAR RPC      |     | RELAYER & AUTONOMOUS KEEPER      |     | REAL-TIME    |
| (testnet.fastnear)  |     | TypeScript Engine & AI Signer    |     | EVENT        |
+---------------------+     +----------------------------------+     | INDEXER      |
         |                                 |                         +--------------+
         |                                 | apply_ai_proposal              ^
         v                                 v (4-arg Ed25519 Gate)           |
+---------------------------------------------------------------------------+-------+
|                       SMART CONTRACT LAYER (spire.testnet, Rust)                  |
|                                                                                   |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |  3-Floor Tower     |  | Adaptive Resistance|  |  NPC Merchant Bazaar        |  |
|  |  1000 / 1600 / 2500|  | (13,500 bps Total) |  |  (0.05 NEAR Base, +-10%)    |  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |  Internal Ledger   |  | Backer Vault Pool  |  |  Dynamic SVG NFT Engine     |  |
|  |  & Buyback Reserve |  | (1e16 Share Unit)  |  |  (NEP-171/177 On-Chain)     |  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |  Partial NEP-245   |  | Ed25519 AI Gate    |  |  NEP-297 "spire" Events     |  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 5.1 Layer 1: Smart Contract Engine (`contract/`)
Compiled from Rust (`near-sdk`) to WebAssembly (`spire.wasm`) and deployed at `spire.testnet`. Holds authoritative ledger balances, partial NEP-245 inventories, starter locks, floor states, backer cycles, adaptive resistance, bonding-curve merchant state, and dynamic SVG trophies.

### 5.2 Layer 2: Relayer, NEAR AI & Keeper (`relayer/`)
TypeScript runtime (`relayer/src/`):
- Polls `get_meta`, `get_tower`, `get_merchant`, and `get_ai_state` (`keeper.ts`).
- Queries NEAR AI Cloud (`z-ai/glm-5.3-flash`, `POST /chat/completions` + `GET /signature/{chat_id}`) and signs canonical `"spire/..."` proposals with `TEE_SIGNING_PRIVATE_KEY` (`tee.ts`).
- Mirrors exact Rust arithmetic (`pricing.ts`) validated against `test-vectors/*.json`.

### 5.3 Layer 3: Real-Time Indexer (`relayer/src/indexer.ts`)
Extracts NEP-297 `EVENT_JSON` logs (`"standard": "spire"`, `"version": "3.1.0"`) from NEAR transaction receipts across ledger, craft, combat, settlement, merchant, buyback, backer, tribute, and AI events.

### 5.4 Layer 4: Next.js 14 Citadel Web App (`web/`)
Built with Next.js 14 App Router, React 18, Tailwind CSS, Framer Motion, Three.js, and `web/DESIGN.md` ("The Ember-Lit Obsidian Spire") tokens:
- **Sanctuary Landing (`/`):** Citadel overview, Boss Brain live telemetry showcase, and onboarding links.
- **Game Citadel (`/game/*`):** Dedicated views for `/game/start`, `/game/raid`, `/game/forge`, `/game/merchant` (with tooltip reasoning + Fast-Forward Economy Sim), `/game/vault`, and `/game/ai`.
- **Account Engine (`/api/accounts`):** Serverless testnet subaccount creator provisioning `0.60 NEAR` ephemeral sessions alongside standard NEAR wallet connection.

### 5.5 Layer 5: Verification & Cross-Layer Parity (`tests/`, `scripts/`)
- **Rust Contract Tests:** `cargo test` in `contract/`.
- **Relayer Unit Suite:** `npm test` in `relayer/` (pricing, keeper, indexer, and TEE signing tests).
- **Web Unit & Math Mirror Suite:** `npm test` in `web/` (`simulation/pricing.ts` parity, yocto parsing, combat/tribute rules, and contract client guards).
- **Cross-Layer Math Parity & E2E Reference Suite:** `tests/cross_layer_math_parity.ts` checks Rust, Relayer, and Web parity; `tests/tier1_feature_tests.ts` through `tests/tier4_workload_tests.ts` exercise the historical offline v3 reference model (`tests/protocol_models.ts`).

---

## 6. Mathematical and Economic Formulations

### 6.1 Deterministic Adaptive Resistance

Three elements exist: Solar (`0`), Frost (`1`), and Void (`2`). Total resistance is conserved at `RESISTANCE_TOTAL_BPS = 13,500 bps` (`135%`), clamped to `[1000, 8500]` bps (`10%` to `85%`) per element (`contract/src/resistance.rs`, `types.rs`):

- When circulating weapon supply `S = s_0 + s_1 + s_2 == 0`, resistance defaults to `[4500, 4500, 4500]`.
- Otherwise raw share targets `R_hat[i] = 13500 * s_i / S` are clamped into `[1000, 8500]` and redistributed deterministically so `sum(R) == 13,500 bps`.
- **Canonical Test Vector:** Supply `[80, 20, 10]` yields `[8500, 3114, 1886]` bps.
- **Hourly Epoch Rollover (`EPOCH_DURATION_NS = 3,600s`):** `lazy_epoch()` calls `compute_shifted_resistance`, moving each element toward its target by at most `MAX_SHIFT_BPS = 2,500 bps` per epoch and renormalizing to `13,500 bps`.

### 6.2 Combat Resolution, Frost Ward, Enrage & Tribute

Each `attack(floor, weapon_element, [s0, s1, s2])` runs **3 turns** against one of three 0-indexed floors (`contract/src/types.rs`, `tower.rs`, `lib.rs`):

| Floor Index (UI Label) | Boss HP | Ticket Cost | Deadline | Floor Mechanic |
|---|---|---|---|---|
| `0` (Floor 1) | `1,000 HP` | `0.10 NEAR` | None (`0`) | Baseline encounter; unlocks Floor idx `1` (UI Floor 2) on defeat (`floor_unlocked(1)`) |
| `1` (Floor 2) | `1,600 HP` | `0.15 NEAR` | `30 minutes` (`1800s`) | **Frost Ward:** `+1,500 bps` (`+15%`) effective Frost resistance (`elem == 1`); unlocks Floor idx `2` (UI Floor 3) |
| `2` (Floor 3) | `2,500 HP` | `0.25 NEAR` | `20 minutes` (`1200s`) | **Enrage:** heals `+10% max HP` (`+250 HP`) per 5-minute interval; mints NEP-171 SVG Trophy `spirefi-trophy-r{round}-f3` |

For each turn `k ∈ {0, 1, 2}` (`contract/src/tower.rs:25-52`):
1. **Effective Resistance:**
   - Base: `res_eff = resistance[weapon_element] + (1500 if floor == 1 && weapon_element == 1 else 0)`.
   - Pierce Stance (`stance == 2`) reduces `res_eff` by `PIERCE_RES_CUT_BPS = 1,500 bps`, clamped to `[0, 10000]`.
2. **Stance Multipliers & Deterministic Variance:**
   - `0 = Aggressive`: `12000 bps` (`1.20x`), pseudo-random factor `rand_bps ∈ [9000, 11000]`.
   - `1 = Feint`: `10000 bps` (`1.00x`), `rand_bps ∈ [10000, 11000]`.
   - `2 = Pierce`: `9500 bps` (`0.95x`), `rand_bps ∈ [9000, 11000]` on-chain (`simulation/pricing.ts` web preview uses `10000` midpoint), plus `-1,500 bps` armor penetration.
3. **Turn Damage (`ATTACK_BASE_POWER = 140`):**
   ```text
   raw_dmg  = 140 * (10000 - clamp(res_eff_after_pierce, 0, 10000)) / 10000
   turn_dmg = raw_dmg * STANCE_BPS[stance] * rand_bps / 100_000_000
   ```
4. **Boss Tribute Confiscation:** Checked before damage turns using pre-Pierce `res_eff`. If `res_eff >= 7000 bps` AND player has `non_starter_balance > 0` AND `total_weapons_owned > 1`, `1` non-starter weapon of `weapon_element` is seized as tribute (returned as loot upon boss defeat). Starter-locked weapons and a player's sole remaining weapon (`total_weapons_owned <= 1`) are protected.

### 6.3 NPC Merchant Bonding Curve

Implemented identically in [`contract/src/merchant.rs`](contract/src/merchant.rs) and mirrored in `relayer/` and `web/`. Trades **materials only** (`ore:iron`, `essence:solar`, `essence:frost`, `essence:void`) and rejects weapons (`weapon:*`).

- **Constants:** `MERCHANT_BASE_PRICE = 0.05 NEAR` (`5e22` yocto), `MERCHANT_TARGET_STOCK = 100`, `k1 = 5000 bps` (`0.50`), `k2 = 3000 bps` (`0.30`), `MERCHANT_SPREAD_BPS = 1000` (`±10%`), `MERCHANT_MIN_CASH = 1.0 NEAR`, `MERCHANT_CAP_PER_ITEM_EPOCH = 40` buys per item per epoch.
- **Pricing Equations (`BPS_SQ = 100_000_000`):**
  ```text
  stock_pressure_bps  = clamp((100 - stock) * 10000 / 100, -10000, +10000)
  demand_pressure_bps = demand_avg_units * 10000 / 100    // unbounded in merchant.rs:45-47; naturally capped on-chain by 40/epoch buy limit
  adjustment          = clamp(5000 * stock_pressure_bps + 3000 * demand_pressure_bps, -9 * BPS_SQ, 3 * BPS_SQ)
  mid_price           = clamp(0.05 NEAR * (BPS_SQ + adjustment) / BPS_SQ, 0.025 NEAR, 0.10 NEAR)
  player_buy          = mid_price * 1.10                  // +10% spread
  player_sell         = mid_price * 0.90                  // -10% spread
  ```
  (Note: off-chain TS/Relayer simulation parity helpers also bound extreme synthetic `demand` inputs within `[0.50x, 2.00x]`.)
- **Solvency Gate:** `is_open = (merchant_cash >= 1.0 NEAR)`. When cash drops below `1.0 NEAR`, trading halts (`merchant_closed`) until ticket shares or `fund_merchant()` replenish cash above `1.0 NEAR` (`merchant_opened`).

### 6.4 Ticket Splits, Floor Drip & Jackpot Settlement

Every raid ticket paid into `attack()` is split deterministically (`contract/src/types.rs:157-168`):
- **70% (`7000 bps`)** -> Floor Jackpot (`floor.jackpot`).
- **15% (`1500 bps`)** -> Backer Dividend Pool (or added to `floor.jackpot` if `backer_total_shares == 0`).
- **10% (`1000 bps`)** -> Floor Buyback Reserve (`floor.buyback_reserve`, used by `sell_to_boss_buyback`).
- **5% (`500 bps`) + division dust** -> NPC Merchant Cash (`merchant_cash`).

When a boss reaches `0 HP` (`settle_defeat` in `contract/src/lib.rs`):
1. For Floors `0` and `1` (UI 1 and 2), **10% (`FLOOR_DRIP_BPS = 1000`)** of `floor.jackpot` drips upward into the next floor's jackpot.
2. Of the remaining distributable jackpot: **10% (`LAST_BONUS_BPS = 1000`)** goes to the final-blow killer (`killer`), and **90%** splits proportionally by `player_damage / total_damage` (pull-claimed via `claim_payout(floor, round)` or `claim_jackpot()`). Seized tribute weapons also distribute 90%/10%.
3. If a timed floor expires (`now >= first_attack_ns + deadline_ns`) before kill, the next `attack()` lazily resets HP (`round += 1`, emitting `round_expired`) and **carries 100% of `floor.jackpot` forward** into the new round.

### 6.5 Backer Vault and Dividend Accumulation

Players or LPs can underwrite any floor (`0..2`) by calling `back_boss_vault(floor)` with attached NEAR (`contract/src/lib.rs:1021-1075`):
- **Jackpot Backing & Share Unit:** Attached deposit adds directly to `floor.jackpot`, while the staker receives `shares = deposit / BACKER_SHARE_UNIT` shares and updates `pos.dps_base` via weighted average (`(pos.dps_base * pos.shares + acc * shares) / (pos.shares + shares)`). On the live `spire.testnet` contract build, `BACKER_SHARE_UNIT = 10_000_000_000_000_000` (`1e16` yocto = `10^-8 NEAR`; note the Rust source comment in `types.rs:75` mentions `0.01 NEAR` while the compiled constant is `1e16`).
- **Capital & Cycle Rules:** Backer capital cannot be withdrawn mid-cycle; if a timed round expires, `floor.jackpot` carries forward and the same `backer_cycle` continues accruing the `15%` ticket share into `backer_acc_dividend_per_share`. When the boss is defeated, `backer_cycle` increments (`+= 1`) without resetting `backer_total_shares`.
- **O(1) Cumulative Dividend Claim (`DIVIDEND_SCALE = 1_000_000`):** `claim_backer_dividend(floor, cycle)` checks `cycle <= floor.backer_cycle` and credits `pending = pos.shares * (floor.backer_acc_dividend_per_share - pos.dps_base) / DIVIDEND_SCALE - pos.claimed_amount` to the caller's internal ledger.

### 6.6 AI Proposal Verification Gate

`apply_ai_proposal(floor, proposal, chat_id, signature)` (`contract/src/lib.rs:1088-1155`, `tee.rs`) is callable only by the registered relayer (`assert_relayer`) and verifies an Ed25519 signature from the pinned `tee_public_key` over the canonical byte string:

```text
spire/floor={floor}/epoch={epoch}/buyback={m0}-{m1}-{m2}/recipe={recipe|none}/nonce={nonce}
```

On-chain guards reject if:
- Signature fails `env::ed25519_verify`.
- `proposal.floor != floor` or `floor > 2`.
- `nonce <= last_ai_nonce` (replay protection) or `proposal.epoch <= prev_ai_state.epoch` (`<= 1` proposal/floor/epoch).
- Any `buyback_multiplier_bps[i]` falls outside `[10000, 40000]` (`1.0x..4.0x`) or shifts by `> MAX_SHIFT_BPS` (`2,500 bps`) from the current epoch value.
- `altar_recipe_id` is not `None`, `"reforge_2_to_1"`, or `"reforge_3_to_2"`, or `taunt.len() > 200`.

---

## 7. Smart Contract Interface (`spire.testnet`)

### 7.1 Public View Methods

| Method | Parameters | Return Type | Description |
|---|---|---|---|
| `get_meta` | None | `MetaResponse` | Active epoch, `[u32; 3]` resistance bps, `next_epoch_in_ns`, `shifted_by`, weapon `supply`, `weak_element`. |
| `get_tower` | None | `TowerResponse` | Array of `FloorResponse` for all 3 floors (`0..2`). |
| `get_floor` | `floor: u8` | `FloorResponse` | HP, max HP, round, deadlines, expired flag, jackpot, buyback reserve, dividend pool, backer shares/cycle, ward, enrage. |
| `get_balance` | `account_id: AccountId` | `U128` | Internal ledger balance in yoctoNEAR. |
| `get_inventory` | `account_id: AccountId` | `PlayerInventoryResponse` | Weapon counts `[3]`, starter-locked counts `[3]`, material map. |
| `get_supply` | None | `[u64; 3]` | Global circulating Solar, Frost, Void weapon supply. |
| `get_merchant` | None | `MerchantResponse` | `{ cash, stock, is_open }` (`cash >= 1.0 NEAR`). |
| `get_quote` | `item: String, side: String, qty: u64` | `MerchantQuote` | Authoritative quote (`"buy"` or `"sell"`) for material items. |
| `get_buyback_quote` | `floor: u8, element: u8` | `BuybackQuote` | Boss buyback price (`0.10 NEAR * multiplier_bps / 10000`). |
| `get_ai_state` | `floor: u8` | `Option<AiState>` | Last applied AI state (`buyback_multiplier_bps`, `altar_recipe_id`, `taunt`, `chat_id`, `signature_hex`). |
| `get_backer` | `floor: u8, account_id: AccountId` | `BackerResponse` | `{ floor, account_id, shares, current_cycle, join_cycle, last_claimed_cycle }`. |
| `get_damage` | `account_id: AccountId, floor: u8, round: u32` | `U128` | Damage dealt by `account_id` in `(floor, round)`. |
| `get_claimable` | `account_id: AccountId, floor: u8, round: u32` | `U128` | Unclaimed yoctoNEAR payout for `(floor, round)`. |
| `get_claimable_loot` | `account_id: AccountId, floor: u8, round: u32` | `[u64; 3]` | Unclaimed seized tribute weapons `[solar, frost, void]` for `(floor, round)`. |
| `mt_balance_of` | `account_id: AccountId, token_id: String` | `U128` | Partial NEP-245 balance for `ore:iron`, `essence:*`, or `weapon:*`. |
| `mt_supply` | `token_id: String` | `U128` | Total circulating supply for `token_id`. |
| `nft_token` | `token_id: String` | `Option<Token>` | On-chain NEP-171 token with inline UTF-8 SVG `media` (`data:image/svg+xml;utf8,...`). |
| `nft_metadata` | None | `NFTContractMetadata` | NEP-177 collection metadata. |
| `nft_total_supply` | None | `U128` | Total conquered boss trophy NFTs minted. |

### 7.2 Public Change Methods

| Method | Payable / Caller | Description |
|---|---|---|
| `claim_starter` | No deposit (player) | One-time starter kit: `[4 Solar, 1 Frost, 0 Void]` starter-locked weapons, `4 ore:iron`, and `3` of each essence (`solar`, `frost`, `void`). |
| `deposit` | Payable `> 0` (player) | Credits attached NEAR to player's internal ledger. |
| `withdraw` | No deposit (player) | Transfers `amount` (or full ledger balance if `None`) back to caller via Promise with rollback safety. |
| `gather` | No deposit (player) | Grants `+2` of a valid material (`ore:iron`, `essence:*`); `30s` cooldown, `20` gathers/epoch cap. |
| `craft_weapon` | No deposit (player) | Burns `2 ore:iron + 3 essence:<element>` -> mints `1` weapon (`0=Solar, 1=Frost, 2=Void`). |
| `reforge` | No deposit (player) | Burns non-starter weapons: `2 -> 1` anytime, or `3 -> 2` when `last_altar_recipe == "reforge_3_to_2"` AND source weapon share `>= 50%`. |
| `attack` | No deposit (ledger debit) | Executes 3-turn raid (`floor`, `weapon_element`, `[s0, s1, s2]`); unconditionally debits floor ticket `[0.10, 0.15, 0.25]` NEAR from internal ledger (`deposit()` required beforehand; not `#[payable]`). Lazy round timeout runs here. |
| `claim_payout` / `claim_jackpot` | No deposit (player) | Pull-pattern jackpot & tribute loot claim (`claim_payout(floor, round)` or all rounds via `claim_jackpot`). |
| `buy_from_merchant` / `sell_to_merchant` | No deposit (player) | Buys or sells material tokens (`40/item/epoch` buy cap; merchant requires `cash >= 1.0 NEAR`). |
| `sell_to_boss_buyback` | No deposit (player) | Sells non-starter weapons to floor buyback reserve (`5/floor/epoch`, `2/account/epoch`). |
| `mt_transfer` | No deposit (player) | Transfers non-starter-locked NEP-245 asset (`receiver_id`, `token_id`, `amount`, `memo`). |
| `fund_jackpot` / `fund_merchant` | Payable `> 0` (anyone) | Directly adds NEAR to floor jackpot or merchant cash reserve. |
| `back_boss_vault` | Payable `> 0` (backer) | Adds NEAR directly to `floor.jackpot` and mints `deposit / 1e16` backer shares. |
| `claim_backer_dividend` | No deposit (backer) | Claims accrued cumulative `15%` ticket dividend share (`cycle <= floor.backer_cycle`). |
| `update_meta` | No deposit (anyone) | Triggers `lazy_epoch()` if `epoch_start_ns + 1h` has passed. |
| `apply_ai_proposal` | Relayer-only | Applies 4-arg Ed25519-verified `(floor, proposal, chat_id, signature)` for buyback multipliers & altar recipe. |

### 7.3 Event Standard (NEP-297)

State transitions emit `EVENT_JSON:` logs with `"standard": "spire"` and `"version": "3.1.0"` ([`contract/src/events.rs`](contract/src/events.rs)):

```json
{
  "standard": "spire",
  "version": "3.1.0",
  "event": "raid",
  "data": {
    "account_id": "player.spire.testnet",
    "floor": 0,
    "round": 1,
    "weapon": "weapon:solar",
    "damage": 289,
    "boss_remaining_hp": 711,
    "ticket_paid": "100000000000000000000000",
    "tribute_taken": false
  }
}
```

Emitted event names: `deposit`, `withdraw`, `withdraw_failed`, `starter_claimed`, `gather`, `craft`, `reforge`, `raid`, `boss_defeated`, `round_expired`, `floor_unlocked`, `payout_claimed`, `meta_updated`, `merchant_trade`, `merchant_closed`, `merchant_opened`, `buyback`, `backer_staked`, `dividend_claimed`, `ai_proposal_applied`, `ai_proposal_rejected`, `tribute_seized`.

---

## 8. Step-by-Step User Lifecycle

1. **Onboarding (`/game/start`):** Enter a handle to provision `<name>.spire.testnet` via `POST /api/accounts`, generating a browser-stored `FullAccess` Ed25519 keypair funded with `0.60 NEAR` (`600000000000000000000000n` default), or connect your own NEAR testnet wallet.
2. **Claim Starter Bundle:** Call `claim_starter()` for `[4 Solar, 1 Frost, 0 Void]` starter-locked weapons + `4 ore:iron` + `3` Solar, `3` Frost, and `3` Void essence.
3. **Fund Ledger (Required Before Raiding or Buying):** Call `deposit()` first with attached NEAR so raid tickets (`0.10 / 0.15 / 0.25 NEAR`) and merchant purchases debit cleanly from the internal ledger (`attack()` is not payable).
4. **Gather, Trade, Forge & Reforge (`/game/forge`, `/game/merchant`):** Mine materials (`gather`), trade materials (`buy_from_merchant` / `sell_to_merchant`), craft (`craft_weapon`, `2 ore + 3 essence`), or burn surplus non-starter weapons at the Altar (`reforge`: `2 -> 1`, or `3 -> 2` when AI activates `"reforge_3_to_2"` with `>= 50%` global share).
5. **Raid the Spire (`/game/raid`):** Pick Floor `0`, `1`, or `2`, weapon element, and 3 stances (`[Aggressive, Feint, Pierce]`), then submit `attack()`.
6. **Claim & Withdraw (`/game/raid`, `/game/vault`):** Claim proportional round winnings via `claim_payout(floor, round)` or `claim_jackpot()`, backer dividends via `claim_backer_dividend(floor, cycle)`, and withdraw NEAR to your wallet with `withdraw()`.

---

## 9. Local Development, Parity & Deployment

### 9.1 Prerequisites & Building
- **Rust:** toolchain supporting `wasm32-unknown-unknown`
- **Node.js:** `v20+` (with TypeScript/`tsx` or Node native strip-types)

Build contract WebAssembly:
```bash
cd contract
cargo check --target wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown --release
```

### 9.2 Running Unit, Parity & Simulation Tests
- **Smart Contract (`contract/`):**
  ```bash
  cd contract
  cargo test
  ```
- **Relayer & Pricing/TEE Suite (`relayer/`):**
  ```bash
  cd relayer
  npm install
  npm test
  ```
- **Web App (`web/`):**
  ```bash
  cd web
  npm install
  npm test
  ./node_modules/.bin/tsc --noEmit
  npm run dev
  ```
- **Cross-Layer Math Parity & Reference Simulation (`tests/`):**
  ```bash
  npx tsx tests/cross_layer_math_parity.ts
  npx tsx tests/run_all.ts
  ```
  Note: `tests/tier1_feature_tests.ts` through `tests/tier4_workload_tests.ts` run against the offline historical v3 reference model ([`tests/protocol_models.ts`](tests/protocol_models.ts)); live `spire.testnet` contract parity is checked by [`tests/cross_layer_math_parity.ts`](tests/cross_layer_math_parity.ts) and [`test-vectors/merchant_vectors.json`](test-vectors/merchant_vectors.json).
- **Master Pipeline:**
  ```bash
  ./scripts/verify-all.sh
  ```

### 9.3 Live Network Verification
Requires a funded testnet key supplied via environment variable (never hardcoded in source):

```bash
export NEAR_TESTNET_PRIVATE_KEY="ed25519:..."
export NEAR_TESTNET_ACCOUNT_ID="your-account.testnet"
node scripts/test-all-live.mjs
```

### 9.4 Environment Variables & Vercel Deployment

Web app (`web/`, see [`web/.env.example`](web/.env.example)) and Relayer ([`relayer/.env.example`](relayer/.env.example)):

| Variable | Component | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CONTRACT_ID` | Web | Target contract (`spire.testnet`). |
| `NEXT_PUBLIC_PROJECT_NAME` | Web | UI brand title (`SpireFi`). |
| `NEAR_RPC_URL` | Web / Relayer | NEAR testnet JSON-RPC (`https://rpc.testnet.fastnear.com`). |
| `NEAR_PARENT_ACCOUNT_ID` | Web | Parent account minting `<name>.spire.testnet` guest subaccounts (`spire.testnet`). |
| `NEAR_PARENT_PRIVATE_KEY` | Web | FullAccess private key for `/api/accounts` (if unset, `/api/accounts` returns HTTP `503`). |
| `SUBACCOUNT_FUNDING_YOCTO` | Web / Relayer | Initial subaccount funding (`600000000000000000000000` = `0.60 NEAR` default in `route.ts` & `relayer/.env.example`). |
| `CONTRACT_ID`, `KEEPER_ACCOUNT_ID`, `KEEPER_PRIVATE_KEY` | Relayer | Relayer transaction signer. |
| `KEEPER_AI_MODE` | Relayer | `"near-ai"` (default, uses `NEAR_AI_API_KEY`) or `"epoch-only"` (pure testnet: `update_meta()` + indexer without external AI API credits). |
| `NEAR_AI_API_KEY`, `NEAR_AI_MODEL` | Relayer | Optional NEAR AI Cloud inference (`z-ai/glm-5.3-flash`, required only when `KEEPER_AI_MODE=near-ai`). |
| `TEE_PUBLIC_KEY`, `TEE_SIGNING_PRIVATE_KEY` | Relayer | Pinned Ed25519 keypair signing `"spire/..."` proposals (`MOCK_TEE=true` + `MOCK_TEE_SEED` for local tests only). |

Vercel deployment: set Root Directory to `web`, choose Next.js preset, add the required environment variables above, and deploy.

---

## 10. Repository Structure

```text
spirefi/
├── LICENSE                         # MIT License
├── README.md                       # Authoritative protocol guide & judge walkthrough
├── PROJECT.md                      # Architecture, ABI schemas & parity index
├── DESIGN.md                       # Root v3.1 design index (defers to web/DESIGN.md)
├── TEST_INFRA.md                   # E2E reference test methodology & parity notes
├── TEST_READY.md                   # Historical M-TEST v3 snapshot & parity notes
│
├── contract/                       # Layer 1: Rust Smart Contract (spire.testnet)
│   ├── Cargo.toml
│   ├── rust-toolchain.toml
│   └── src/
│       ├── lib.rs                  # Public ABI, ledger actions, combat, backer, AI gate & #[cfg(test)] tests
│       ├── types.rs                # Live protocol constants, state & response structs
│       ├── tower.rs                # 3-floor mechanics, turn_damage, enrage, tribute
│       ├── resistance.rs           # Adaptive resistance clamp & 13,500 bps conservation
│       ├── merchant.rs             # Bonding curve (0.05 NEAR base, target 100, ±10%)
│       ├── ledger.rs               # Internal NEAR balance ledger
│       ├── nft.rs                  # On-chain NEP-171/177 dynamic SVG trophy generator
│       ├── tee.rs                  # Canonical `"spire/..."` Ed25519 signature verifier
│       └── events.rs               # NEP-297 EVENT_JSON ("standard": "spire") emitter
│
├── relayer/                        # Layer 2 & 3: Relayer, Keeper & Indexer
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── index.ts                # Service entrypoint
│       ├── keeper.ts               # Polling & epoch/round automation loop
│       ├── tee.ts                  # NEAR AI Cloud client + Ed25519 `"spire/..."` signer
│       ├── pricing.ts              # Deterministic contract math mirror
│       ├── indexer.ts              # NEP-297 EVENT_JSON log extractor
│       └── types.ts                # Relayer types & guardrails
│
├── web/                            # Layer 4: Next.js 14 Frontend Application
│   ├── DESIGN.md                   # Authoritative active design system
│   ├── PRODUCT.md                  # Product identity & brand commitments
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.ts
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Sanctuary landing & boss intelligence showcase
│       │   ├── layout.tsx          # Root layout, dark obsidian tokens & skip link
│       │   ├── globals.css         # Authoritative CSS tokens & accessibility utilities
│       │   ├── api/accounts/       # Ephemeral Testnet Guest Session creator (0.60 NEAR)
│       │   └── game/               # /start, /raid, /forge, /merchant, /vault, /ai
│       ├── components/             # 3D canvas, accessible SpireUi, arena panels
│       └── lib/                    # RPC contract client, combat rules, simulation mirror
│
├── test-vectors/                   # Deterministic cross-layer JSON vectors
│   ├── resistance_vectors.json
│   ├── merchant_vectors.json
│   └── event_vectors.json
│
├── tests/                          # Reference simulation & cross-layer parity
│   ├── run_all.ts                  # Test runner
│   ├── test_harness.ts             # Assertions & formatting
│   ├── protocol_models.ts          # Historical offline v3 reference model
│   ├── tier1_feature_tests.ts      # Tier 1 feature suite (vs protocol_models.ts)
│   ├── tier2_boundary_tests.ts     # Tier 2 boundary suite (vs protocol_models.ts)
│   ├── tier3_pairwise_tests.ts     # Tier 3 pairwise suite (vs protocol_models.ts)
│   ├── tier4_workload_tests.ts     # Tier 4 workload suite (vs protocol_models.ts)
│   ├── cross_layer_math_parity.ts  # Rust / Relayer / Web parity verification
│   └── adversarial_challenger2.ts  # Adversarial edge-case checks
│
└── scripts/                        # Automation & live verification utilities
    ├── verify-all.sh
    ├── deploy.sh
    ├── faucet.sh
    ├── harvest-faucet.mjs
    ├── run-keeper.sh
    ├── test-fe-bridge.mjs
    └── test-all-live.mjs           # Live testnet runner (uses NEAR_TESTNET_PRIVATE_KEY)
```

---

## 11. License, Roadmap & Security

### License
This project is licensed under the **MIT License**. See [`LICENSE`](LICENSE) for full text.

### Roadmap Highlights (Section 13)
- Full on-chain hardware TEE remote attestation verification replacing off-chain `chat_id` audit lookup + relayer Ed25519 key pinning.
- Production Function Call Access Keys (FCAKs) and social/passkey account abstraction replacing testnet `FullAccess` ephemeral guest subaccounts.
- Complete NEP-245 batch transfer extensions (`mt_batch_transfer_from`, storage deposits).

### Security Practices
- **Key Hygiene:** Never commit `.env`, `.env.local`, or private keys; live scripts read credentials from `process.env`.
- **On-Chain Bounds:** Relayer/AI proposals cannot alter elemental resistance, exceed `[10000, 40000]` bps buyback multipliers, exceed `2,500 bps` per-epoch shift, or replay past `nonce` / `epoch` values.
- **Pull Payouts & Reentrancy Guards:** Jackpot claims and vault withdrawals follow checks-effects-interactions with Promise rollback callbacks (`withdraw_callback`).
