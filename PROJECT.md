# Project: The Spire v3.1 / BossVault Protocol

> **[STATUS / AUTHORITATIVE REFERENCE]** Live contract constants, ABI signatures, and behavior in [`contract/src/lib.rs`](contract/src/lib.rs), [`contract/src/types.rs`](contract/src/types.rs), and [`contract/src/merchant.rs`](contract/src/merchant.rs) deployed at `spire.testnet` supersede early v3 draft figures. For frontend visual & UI specifications, [`web/DESIGN.md`](web/DESIGN.md) ("The Ember-Lit Obsidian Spire") is authoritative.

## Architecture

The Spire v3.1 / BossVault Protocol is a 5-layer dark-fantasy GameFi protocol on NEAR Testnet (`spire.testnet`):

1. **Layer 1: Smart Contract Core (`contract/`)**: Deterministic GameFi engine in Rust (`near-sdk`). Implements partial NEP-245 (`mt_balance_of`, `mt_supply`, `mt_transfer`), dynamic SVG NFT (`nft_token`, `nft_metadata`, `nft_total_supply` for `spirefi-trophy-r{round}-f{floor}`), internal vault ledger, 3-floor boss tower (0-indexed `0..2`, HP `[1000, 1600, 2500]`, tickets `[0.10, 0.15, 0.25]` NEAR), automatic supply-driven adaptive resistance (`13,500 bps` total, clamped `[1000, 8500]`, `MAX_SHIFT_BPS = 2500` on `lazy_epoch`), NPC merchant curve (`MERCHANT_BASE_PRICE = 0.05 NEAR`, `target = 100`, `±10%` spread), boss tribute confiscation (`res_eff >= 7000 bps`), 10% next-floor drip + 90/10 jackpot payout, Backer Vault (`BACKER_SHARE_UNIT = 1e16` = `10^-8 NEAR` on deployed testnet build), Ed25519 AI proposal verification gate, and NEP-297 `EVENT_JSON` (`"standard": "spire"`, `"version": "3.1.0"`).
2. **Layer 2: Relayer & Autonomous Keeper (`relayer/`)**: TypeScript service (`relayer/src/`) that polls contract state (`keeper.ts`), triggers hourly `update_meta()` epoch rollovers (`KEEPER_AI_MODE=epoch-only` for pure-testnet deployments without external AI credits, keeping `1.00x` contract buyback baseline), or when configured with `KEEPER_AI_MODE=near-ai` + `NEAR_AI_API_KEY` requests tactical boss proposals from NEAR AI Cloud (`z-ai/glm-5.3-flash` via `POST /chat/completions` with off-chain `GET /signature/{chat_id}` audit hash), signs canonical `"spire/..."` messages with Ed25519 (`TEE_SIGNING_PRIVATE_KEY`, or opt-in `MOCK_TEE=true` + `MOCK_TEE_SEED` for local tests), and submits `apply_ai_proposal`. Full on-chain hardware TEE attestation is roadmap §13.
3. **Layer 3: Indexer & Telemetry (`relayer/src/indexer.ts`)**: Event extractor parsing NEP-297 `EVENT_JSON` (`"standard": "spire"`) receipts across protocol events.
4. **Layer 4: Frontend Web App (`web/`)**: Next.js 14 App Router application with landing sanctuary (`/`), multi-room game citadel (`/game/start`, `/game/raid`, `/game/forge`, `/game/merchant`, `/game/vault`, `/game/ai`), Three.js WebGL boss stage, and **Ephemeral Testnet Guest Sessions** (`FullAccess` browser-stored subaccount funded `0.60 NEAR` via `POST /api/accounts`, returning HTTP `503` when faucet env is unconfigured) alongside wallet sign-in. Client-side deterministic preview helpers mirror contract math.
5. **Layer 5: Verification & Parity Suite (`tests/`, `scripts/`)**: Hermetic Tiers 1-4 E2E suite against v3 reference simulation (`tests/protocol_models.ts`), cross-layer Rust/Relayer/Web parity checks (`tests/cross_layer_math_parity.ts`, `test-vectors/*.json`), master pipeline (`scripts/verify-all.sh`), and live testnet probe (`scripts/test-all-live.mjs` using `process.env.NEAR_TESTNET_PRIVATE_KEY`).

---

## Feature Inventory

| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| 1 | Partial NEP-245 Multi-Token | Materials (`ore:iron`, `essence:solar`, `essence:frost`, `essence:void`) & weapons (`weapon:solar`, `weapon:frost`, `weapon:void`); `mt_balance_of`, `mt_supply`, `mt_transfer` | M1-CONTRACT | Implemented |
| 2 | Dynamic SVG Trophy (NEP-171/177) | On-chain SVG trophy (`spirefi-trophy-r{round}-f{floor}`) minted upon Floor 3 defeat (`floor = 2`) | M1-CONTRACT | Implemented |
| 3 | Internal Vault & Guest Session | `deposit()` / `withdraw()` internal ledger (`0.60 NEAR` ephemeral `FullAccess` guest subaccount on testnet, not FCAK) | M1 / M3 | Implemented |
| 4 | 3-Floor Tower Mechanics | Floor 1 (`1000 HP`, `0.10 NEAR`), Floor 2 (`1600 HP`, `0.15 NEAR`, Frost Ward `+1500 bps`, 30m), Floor 3 (`2500 HP`, `0.25 NEAR`, Enrage `+10%/5m`, 20m) | M1-CONTRACT | Implemented |
| 5 | Deterministic Adaptive Resistance | 3 elements totaling `13,500 bps`, clamped `[1000, 8500]`, canonical vector `[80, 20, 10] -> [8500, 3114, 1886]` | M1-CONTRACT | Implemented |
| 6 | Automatic Epoch Meta Shift | Hourly `lazy_epoch()` shifts resistance up to `MAX_SHIFT_BPS = 2500` toward supply-derived targets; AI never shifts resistance | M1-CONTRACT | Implemented |
| 7 | NPC Merchant Bonding Curve | `MERCHANT_BASE_PRICE = 0.05 NEAR`, `target = 100`, `k1 = 0.50`, `k2 = 0.30`, `0.50x..2.00x`, `±10%` spread, closed if `cash < 1 NEAR`, materials only, 40/item/epoch cap | M1-CONTRACT | Implemented |
| 8 | Boss Tribute Confiscation | Confiscates 1 non-starter weapon when `res_eff >= 7000 bps` AND `total_weapons_owned > 1` (`starter_locked` immune) | M1-CONTRACT | Implemented |
| 9 | Proportional Jackpot & Drip | Ticket split `70% / 15% / 10% / 5%`; defeat drips `10%` to next floor (Floors 1-2), then `10%` killer + `90%` damage-proportional pull claims | M1-CONTRACT | Implemented |
| 10 | Backer Vault & Cycle Carry-Over | `back_boss_vault(floor)` adds to jackpot (`BACKER_SHARE_UNIT = 1e16` = `10^-8 NEAR` testnet build); earns `15%` ticket dividend until boss defeat | M1-CONTRACT | Implemented |
| 11 | AI Relayer Ed25519 Gate | `apply_ai_proposal(floor, proposal, chat_id, signature)` verifies Ed25519 over `"spire/..."` (`buyback_multiplier_bps ∈ [10000, 40000]`, `MAX_SHIFT_BPS = 2500`, `altar_recipe_id`) | M1 / M2 | Implemented |
| 12 | NEP-297 `EVENT_JSON` Logging | Standard `"spire"` (`3.1.0`) logs for all ledger, craft, reforge, raid, settlement, merchant, buyback, backer, tribute, and AI actions | M1-CONTRACT | Implemented |
| 13 | Cross-Layer Parity & Tests | `cargo test`, `relayer` unit tests, `web` tests, `tests/cross_layer_math_parity.ts`, and v3 `protocol_models.ts` Tiers 1-4 | M-TEST / M4 | Active |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| M1 | M1-CONTRACT: Smart Contract Core | Rust contract (`contract/src/`), deployed & live on `spire.testnet` | none | LIVE (`spire.testnet`) |
| M2 | M2-RELAYER: Relayer, Keeper & Indexer | Keeper, NEAR AI Cloud integration (`z-ai/glm-5.3-flash`), `"spire/..."` Ed25519 signer, `pricing.ts`, indexer | M1 | IMPLEMENTED |
| M3 | M3-FRONTEND: Next.js 14 Web App | Landing + multi-route `/game/*` citadel, WebGL 3D boss, Ephemeral Testnet Guest Session, accessible `web/DESIGN.md` tokens | M1, M2 | WAVE 1-2 HARDENING |
| M-TEST | E2E Reference & Cross-Layer Parity | Historical M-TEST (`tests/protocol_models.ts` Tiers 1-4) + `tests/cross_layer_math_parity.ts` + `test-vectors/*.json` | M1, M2 | IMPLEMENTED |
| M4 | M4-INTEGRATION: Security & Audit Gates | Wave 0 security fixes (`LICENSE`, key hygiene, `0.60 NEAR` session subaccount cap) + Wave 1-2 UI/a11y/docs sync | M1, M2, M3 | IN PROGRESS |

---

## Interface Contracts

### 1. Smart Contract (`contract/src/lib.rs`) ABI on `spire.testnet`

#### View Methods:
- `get_meta() -> MetaResponse`:
  `{ epoch: u64, resistance: [u32; 3], next_epoch_in_ns: u64, shifted_by: u64, supply: [u64; 3], weak_element: u8 }`
- `get_floor(floor: u8) -> FloorResponse`:
  `{ floor: u8, hp: u64, max_hp: u64, round: u32, first_attack_ns: u64, deadline_ns: u64, time_left_ns: u64, expired: bool, jackpot: u128, buyback_reserve: u128, dividend_pool: u128, backer_total_shares: u128, backer_cycle: u64, total_damage: u128, loot: [u64; 3], volume_buyback_epoch: u64, unlocked: bool, ward_element: Option<u8>, enrage: bool }`
- `get_tower() -> TowerResponse`:
  `{ floors: FloorResponse[] }` (0-indexed floors `0..2`)
- `get_supply() -> [u64; 3]`:
  Total weapon supply `[solar, frost, void]`
- `get_balance(account_id: AccountId) -> U128`:
  Player internal vault balance in yoctoNEAR
- `get_inventory(account_id: AccountId) -> PlayerInventoryResponse`:
  `{ weapons: [u64; 3], starter_locked: [u64; 3], materials: HashMap<String, u64> }`
- `get_merchant() -> MerchantResponse`:
  `{ cash: u128, stock: HashMap<String, u64>, is_open: bool }`
- `get_quote(item: String, side: String, qty: u64) -> MerchantQuote`:
  `{ item_id, side, qty, unit_price, total_price, is_open, reason }` (materials only)
- `get_buyback_quote(floor: u8, element: u8) -> BuybackQuote`:
  `{ floor, element, unit_price, multiplier_bps }`
- `get_ai_state(floor: u8) -> Option<AiState>`:
  Last applied AI state (`floor, epoch, nonce, buyback_multiplier_bps, altar_recipe_id, taunt, chat_id, signature_hex`)
- `get_backer(floor: u8, account_id: AccountId) -> BackerResponse`:
  `{ floor, account_id, shares, current_cycle, join_cycle, last_claimed_cycle }`
- `get_claimable(account_id: AccountId, floor: u8, round: u32) -> U128` and `get_claimable_loot(account_id: AccountId, floor: u8, round: u32) -> [u64; 3]`
- `get_damage(account_id: AccountId, floor: u8, round: u32) -> U128`
- **Partial NEP-245 Views:** `mt_balance_of(account_id: AccountId, token_id: String) -> U128`, `mt_supply(token_id: String) -> U128`
- **NEP-171 Views:** `nft_token(token_id: String) -> Option<Token>`, `nft_metadata() -> NFTContractMetadata`, `nft_total_supply() -> U128`

#### Player Change Methods (Ledger-Backed / Testnet Guest Session or Wallet):
- `claim_starter()`: One-time starter kit (`[4 Solar, 1 Frost, 0 Void]` starter-locked weapons + `4 ore:iron` + `3` each of `essence:solar`, `essence:frost`, `essence:void`)
- `gather(item_id: String)`: Grants `+2` of chosen material (`30s` cooldown, `20` gathers/epoch cap)
- `craft_weapon(element: u8)`: Consumes `2 ore:iron + 3 essence:<element>` -> mints `1` weapon (`0=Solar, 1=Frost, 2=Void`)
- `reforge(burn_element: u8, target_element: u8)`: Burns non-starter weapons (`2 -> 1` anytime; `3 -> 2` when `last_altar_recipe == "reforge_3_to_2"` AND `supply[burn] * 10000 / total_supply >= 5000`)
- `attack(floor: u8, weapon_element: u8, stances: [u8; 3]) -> u32`: Executes 3-turn combat combo (`0=Aggressive, 1=Feint, 2=Pierce`), unconditionally debits floor ticket from internal ledger (`deposit()` required beforehand; `attack` is not `#[payable]`)
- `buy_from_merchant(item: String, qty: u64)` / `sell_to_merchant(item: String, qty: u64)`: Trades materials (`40/item/epoch` buy cap, closed below `1.0 NEAR` cash)
- `sell_to_boss_buyback(floor: u8, element: u8, qty: u64)`: Sells non-starter weapons to floor buyback reserve (`5/floor/epoch`, `2/account/epoch`)
- `claim_payout(floor: u8, round: u32)` / `claim_jackpot()`: Pull-pattern payout & tribute loot recovery
- `claim_backer_dividend(floor: u8, cycle: u64)`: Claims cumulative `15%` ticket dividend share via `pos.shares * (acc - pos.dps_base) / DIVIDEND_SCALE - pos.claimed_amount` (`cycle <= floor.backer_cycle`)
- `mt_transfer(receiver_id: AccountId, token_id: String, amount: U128, memo: Option<String>)`: Transfers non-starter-locked NEP-245 balances
- `update_meta()`: Triggers `lazy_epoch()` if `epoch_start_ns + 1h` has elapsed

#### Payable / Keeper Change Methods:
- `deposit()` (payable): Credits caller's internal vault ledger
- `withdraw(amount: Option<U128>) -> Promise`: Withdraws from internal vault back to caller account
- `back_boss_vault(floor: u8)` (payable): Adds attached NEAR directly to `floor.jackpot` and issues `amount / BACKER_SHARE_UNIT` shares (`BACKER_SHARE_UNIT = 1e16` = `10^-8 NEAR` on deployed testnet build); jackpot stays in the floor across timeouts, and boss defeat increments `backer_cycle += 1` without resetting `backer_total_shares`
- `fund_jackpot(floor: u8)` (payable) / `fund_merchant()` (payable)
- **Relayer / AI Gate:** `apply_ai_proposal(floor: u8, proposal: AiProposal, chat_id: Option<String>, signature: Vec<u8>)`:
  Relayer-only. Verifies Ed25519 signature from pinned `tee_public_key` over:
  `"spire/floor={floor}/epoch={epoch}/buyback={m0}-{m1}-{m2}/recipe={recipe|none}/nonce={nonce}"`.
  Enforces `buyback_multiplier_bps[i] ∈ [10000, 40000]`, per-epoch `|delta| <= 2500`, whitelisted `altar_recipe_id ∈ {"reforge_2_to_1", "reforge_3_to_2"}`, `taunt <= 200` chars, strictly increasing `nonce`, and `<= 1` proposal/floor/epoch. AI proposals never modify elemental resistance.

#### NEP-297 Standard Events (`EVENT_JSON:`):
```json
{
  "standard": "spire",
  "version": "3.1.0",
  "event": "<event_name>",
  "data": { "...": "..." }
}
```
Implemented event names (`contract/src/events.rs`): `deposit`, `withdraw`, `withdraw_failed`, `starter_claimed`, `gather`, `craft`, `reforge`, `raid`, `boss_defeated`, `round_expired`, `floor_unlocked`, `payout_claimed`, `meta_updated`, `merchant_trade`, `merchant_closed`, `merchant_opened`, `buyback`, `backer_staked`, `dividend_claimed`, `ai_proposal_applied`, `ai_proposal_rejected`, `tribute_seized`.

### 2. Cross-Layer Mathematical Parity (`contract/` <-> `relayer/src/pricing.ts` <-> `web/src/lib/simulation/pricing.ts`)
- **Adaptive Resistance:** Total `13,500 bps`, clamp `[1000, 8500]`, max epoch shift `2,500 bps`, canonical `[80, 20, 10] -> [8500, 3114, 1886]`.
- **NPC Merchant Bonding Curve (`contract/src/merchant.rs`):**
  - `MERCHANT_BASE_PRICE = 0.05 NEAR` (`5e22` yocto), `MERCHANT_TARGET_STOCK = 100`, `k1 = 0.50`, `k2 = 0.30`, clamped `[0.50x, 2.00x]` (`0.025..0.10 NEAR` mid).
  - `buy_price = mid * 1.10`, `sell_price = mid * 0.90` (`±10%` spread). Closed if `cash < 1.0 NEAR`.
- **Combat Damage (`contract/src/tower.rs`):**
  - `ATTACK_BASE_POWER = 140` across 3 turns per `attack()`.
  - Effective resistance = `resistance[elem] + (1500 if floor == 1 && elem == 1 else 0) - (1500 if stance == 2 else 0)`, clamped `[0, 10000]`.
  - `STANCE_BPS = [12000 (Aggressive, rand 9000..11000), 10000 (Feint, rand 10000..11000), 9500 (Pierce, rand 9000..11000)]` on-chain (`simulation/pricing.ts` preview uses `10000` midpoint).
  - `turn_damage = floor(140 * (10000 - res_eff_after_pierce) / 10000) * STANCE_BPS * rand_bps / 100_000_000`.
- **Jackpot & Defeat Settlement (`contract/src/lib.rs`):**
  - Ticket split: `70%` Jackpot / `15%` Backer Dividend (or Jackpot if 0 shares) / `10%` Buyback Reserve / `5%` Merchant Cash (+ dust).
  - Defeat: `10%` (`FLOOR_DRIP_BPS = 1000`) drips to floor `i+1` (on Floors 1-2); of remainder, `10%` goes to killer and `90%` splits proportional to damage dealt.

---

## Code Layout

```text
spirefi/
├── contract/                       # Layer 1: Rust smart contract (spire.testnet)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs                  # Contract state, public methods, settlement & #[cfg(test)] tests
│       ├── types.rs                # Constants, structs, ABI response types
│       ├── ledger.rs               # Internal vault ledger accounting
│       ├── resistance.rs           # Deterministic adaptive resistance math
│       ├── merchant.rs             # NPC merchant bonding curve & spread
│       ├── tower.rs                # 3-floor mechanics, combat, enrage, tribute
│       ├── nft.rs                  # NEP-171/177 dynamic SVG trophy generator
│       ├── tee.rs                  # Ed25519 canonical `"spire/..."` verifier
│       └── events.rs               # NEP-297 EVENT_JSON ("standard": "spire")
├── relayer/                        # Layer 2 & 3: Autonomous Keeper, NEAR AI & Indexer
│   └── src/
│       ├── index.ts                # Service entrypoint
│       ├── keeper.ts               # Polling, epoch & round maintenance loop
│       ├── tee.ts                  # NEAR AI Cloud client + Ed25519 `"spire/..."` signer
│       ├── pricing.ts              # Mirror contract math
│       ├── indexer.ts              # NEP-297 receipt/event parser
│       └── types.ts                # Shared relayer interfaces & bounds
├── web/                            # Layer 4: Next.js 14 App Router Citadel UI
│   ├── DESIGN.md                   # Authoritative active visual/UI spec
│   ├── PRODUCT.md                  # Product identity & brand commitments
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Sanctuary overview & boss intelligence showcase
│       │   ├── api/accounts/       # Testnet ephemeral subaccount faucet (0.60 NEAR)
│       │   └── game/               # /start, /raid, /forge, /merchant, /vault, /ai
│       ├── components/             # 3D canvas, shared UI, left/center/right panels
│       └── lib/                    # RPC client, combat rules, simulation mirror, hooks
├── test-vectors/                   # Cross-layer deterministic JSON vectors
│   ├── resistance_vectors.json
│   ├── merchant_vectors.json
│   └── event_vectors.json
├── tests/                          # Layer 5: Reference E2E & parity verification
│   ├── protocol_models.ts          # Historical v3 TypeScript reference sim
│   ├── tier1_feature_tests.ts      # Tier 1 feature tests (vs protocol_models.ts)
│   ├── tier2_boundary_tests.ts     # Tier 2 boundary tests (vs protocol_models.ts)
│   ├── tier3_pairwise_tests.ts     # Tier 3 pairwise tests (vs protocol_models.ts)
│   ├── tier4_workload_tests.ts     # Tier 4 workload tests (vs protocol_models.ts)
│   ├── cross_layer_math_parity.ts  # Rust / Relayer / Web parity verification
│   └── run_all.ts
├── scripts/                        # Deployment & verification scripts
│   ├── verify-all.sh
│   └── test-all-live.mjs           # Live testnet runner (uses NEAR_TESTNET_PRIVATE_KEY)
├── PROJECT.md
├── DESIGN.md                       # Root v3.1 design note (defers to web/DESIGN.md)
├── TEST_INFRA.md
└── TEST_READY.md
```
