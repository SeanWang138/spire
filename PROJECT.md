# Project: The Spire v3.1 / BossVault Protocol

## Architecture
The Spire v3.1 / BossVault Protocol is an autonomous 5-layer GameFi protocol on NEAR Testnet:
1. **Layer 1: Smart Contract Core (`contract/`)**: Autonomous GameFi engine built in Rust (`near-sdk` 5.30.1). Contains multi-token NEP-245, dynamic SVG NFT (NEP-171/177), signless internal vault ledger, 3-floor tower with boss mechanics, 3-element deterministic adaptive resistance (total 13500 bps, clamp [1000, 8500]), NPC merchant bonding curve with 10% spread, boss tribute confiscation, 90/10 proportional jackpot, AI TEE signature verification gate, and NEP-297 `EVENT_JSON` standard logging.
2. **Layer 2: Relayer & Autonomous Keeper (`relayer/`)**: Autonomous keeper written in TypeScript that continuously polls contract telemetry, computes AI proposals, interfaces with NEAR AI Cloud TEE (`z-ai/glm-5.3-flash` and `/v1/signature/{chat_id}`), supports deterministic hermetic offline mock Ed25519 signing mode, and submits verified proposals to the contract.
3. **Layer 3: Indexer & Telemetry Streamer (`indexer/` or `relayer/src/indexer.ts`, `scripts/`)**: Real-time RPC scraper filtering and indexing NEP-297 `EVENT_JSON` logs across all 7 game events.
4. **Layer 4: Frontend Web App (`web/`)**: Next.js 14 App Router + Tailwind Cyber-Fantasy dashboard with Signless Session Key management (Function Call Keys in localStorage), 3-column layout (Left: Forge/Altar/Inventory; Center: Boss Arena/Radar/Stance/Log; Right: Bazaar/Floor/Feed/TEE Inspector), and Fast-Forward Simulation Engine (`pricing.ts` SIMULASI).
5. **Layer 5: Testing & Verification Suite (`scripts/`, `tests/`)**: Opaque-box E2E test harness and master verification script (`scripts/verify-all.sh`) covering Tiers 1-4, plus Tier 5 adversarial coverage hardening.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Multi-Token NEP-245 | Materials (`ore:iron`, `essence:solar`, `essence:frost`, `essence:void`) and Weapons (`weapon:solar`, `weapon:frost`, `weapon:void`) | M1-CONTRACT | Survey R1 |
| 2 | Dynamic SVG NFT (NEP-171/177) | On-chain live SVG Trophy minted to boss conquerors upon Floor 3 defeat | M1-CONTRACT | Survey R1 |
| 3 | Internal Ledger & Signless Key Vault | Single `deposit()` payable 1x, subsequent actions signless via Function Call Keys | M1-CONTRACT | Survey R1 |
| 4 | 3-Floor Tower Mechanics | Floor 1: Normal; Floor 2: Frost Ward + 30m deadline; Floor 3: Enrage 10%/5m + 20m deadline | M1-CONTRACT | Survey R1 |
| 5 | Deterministic Adaptive Resistance | 3 elements, total 13500 bps, clamp [1000, 8500], test vector `80/20/10` -> `8500/3114/1886` | M1-CONTRACT | Survey R1 |
| 6 | Epoch Meta Shift | Controlled shift mechanism with `MAX_SHIFT_BPS` = 2500 | M1-CONTRACT | Survey R1 |
| 7 | NPC Merchant Bonding Curve | Deterministic stock vs demand curve, 10% spread, closed if treasury reserve < 1 NEAR | M1-CONTRACT | Survey R1 |
| 8 | Boss Tribute Weapon Confiscation | Confiscate attacking weapon if resistance >= 7000 bps, protected if starter-locked or last weapon | M1-CONTRACT | Survey R1 |
| 9 | Proportional Jackpot Distribution | 90% pool distributed proportional to damage dealt, 10% bonus to last attacker | M1-CONTRACT | Survey R1 |
| 10 | AI TEE Signature Gate | `apply_ai_proposal` validates Ed25519 signature from pinned pubkey, multiplier [10000, 40000] bps, max shift 2500 bps | M1-CONTRACT | Survey R1 |
| 11 | NEP-297 `EVENT_JSON` Logging | Standard log format for `deposit`, `craft`, `reforge`, `raid`, `boss_defeated`, `ai_proposal_applied`, `merchant_trade` | M1-CONTRACT | Survey R1 |
| 12 | Relayer Telemetry Poller | Periodic RPC queries for `get_meta`, `get_supply`, `get_floor` | M2-RELAYER | Survey R2 |
| 13 | Autonomous Keeper Loop | Monitors floor timeouts, enrage heals, triggers epoch maintenance | M2-RELAYER | Survey R2 |
| 14 | NEAR AI Cloud TEE Integration | Interfacing with `z-ai/glm-5.3-flash` and `GET /v1/signature/{chat_id}` | M2-RELAYER | Survey R2 |
| 15 | Hermetic Offline Mock TEE Signer | Deterministic Ed25519 signing mode for offline/sandboxed test suites | M2-RELAYER | Survey R2 |
| 16 | Mirror Pricing Engine (`pricing.ts`) | TypeScript implementation mirroring exact contract math, passing deterministic test vectors | M2-RELAYER | Survey R2 |
| 17 | Real-Time Indexer & Scraper | RPC event log scraper extracting NEP-297 `EVENT_JSON` for all 7 event schemas | M2-RELAYER | Survey R3 |
| 18 | Next.js 14 Cyber-Fantasy Web App | Modern App Router + Tailwind responsive UI built with design skills | M3-FRONTEND | Survey R4 |
| 19 | Signless Session Manager | Function Call Access Key generated & stored in localStorage for zero-friction interaction | M3-FRONTEND | Survey R4 |
| 20 | Left Column Dashboard | Crafting Forge, Gathering Altar, Live Inventory, Server Supply Bar | M3-FRONTEND | Survey R4 |
| 21 | Center Column Dashboard | Boss Arena, Live HP Bar, Jackpot Counter, 3-Element Meta Radar, 3-Turn Tactical Combat Stance, Damage Log | M3-FRONTEND | Survey R4 |
| 22 | Right Column Dashboard | NPC Merchant Bazaar, Tower Floor Selector, Live NearBlocks Feed, TEE Proof Inspector | M3-FRONTEND | Survey R4 |
| 23 | Fast-Forward Simulation Engine | Client-side simulation of pricing curve, resistance shifts, and damage calculations (`pricing.ts` SIMULASI) | M3-FRONTEND | Survey R4 |
| 24 | E2E Test Harness & Runner | Opaque-box automated test runner verifying requirements independently of internal design | M-TEST | Survey R5 |
| 25 | Tier 1: Feature Coverage Tests | >=5 test cases per feature covering representative happy-path inputs | M-TEST | Survey R5 |
| 26 | Tier 2: Boundary & Corner Cases | >=5 test cases per feature covering limits, overflows, empty inputs, edge conditions | M-TEST | Survey R5 |
| 27 | Tier 3: Cross-Feature Interactions | Pairwise combinatorial tests covering multi-system workflows (e.g. deposit->craft->attack->tribute) | M-TEST | Survey R5 |
| 28 | Tier 4: Real-World Scenarios | End-to-end full raid lifecycles, boss defeat, NFT trophy mint, jackpot payout, and `scripts/verify-all.sh` | M-TEST | Survey R5 |
| 29 | Tier 5: Adversarial Hardening | White-box bug hunting, edge-case fuzzing, and coverage hardening | M4-INTEGRATION | Survey R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M-TEST | E2E Testing Track | Design & implement opaque-box E2E test harness and Tiers 1-4 test suite; publish `TEST_READY.md` | none | PLANNED |
| M1 | M1-CONTRACT: Smart Contract Core | Full Rust contract implementation in `contract/` (NEP-245, NEP-171/177, Ledger, Tower, Adaptive Resistance, NPC, TEE Gate, EVENT_JSON) | none | PLANNED |
| M2 | M2-RELAYER: Relayer, Keeper & Indexer | TypeScript relayer, autonomous keeper, TEE integration/mock, `pricing.ts`, indexer, and test fixtures in `relayer/` & `scripts/` | Interface contracts with M1 | PLANNED |
| M3 | M3-FRONTEND: Next.js 14 Web App | 3-column cyber-fantasy dashboard, Signless Session Manager, Fast-Forward Simulation in `web/` | Interface contracts with M1 & M2 | PLANNED |
| M4 | M4-INTEGRATION: Final Acceptance & Hardening | Phase 1: Pass 100% of Tiers 1-4 E2E tests -> Phase 2: Tier 5 Adversarial Coverage Hardening | M-TEST, M1, M2, M3 | PLANNED |

## Interface Contracts

### 1. Smart Contract (`contract/`) ↔ Relayer & Frontend

#### View Methods:
- `get_meta() -> MetaResponse`:
  Returns `{ epoch: u64, shift_count: u64, resistance: [u32; 3], max_shift_bps: u32 }`
- `get_supply() -> [u64; 3]`:
  Returns elemental weapon supplies `[solar_supply, frost_supply, void_supply]`
- `get_floor() -> FloorResponse`:
  Returns `{ floor: u8, boss_hp: u64, max_hp: u64, floor_start_time: u64, enrage_ticks: u64 }`
- `get_jackpot() -> U128`:
  Returns current total jackpot pool in yoctoNEAR
- `get_resistance() -> [u32; 3]`:
  Returns current 3-element resistance bps `[solar_bps, frost_bps, void_bps]` summing to 13500 bps
- `get_merchant_price(item_id: String) -> MerchantPriceResponse`:
  Returns `{ buy_price: U128, sell_price: U128, stock: u64, is_closed: bool }`
- `get_balance(account_id: AccountId) -> U128`:
  Returns player internal vault balance in yoctoNEAR
- `get_inventory(account_id: AccountId) -> PlayerInventoryResponse`:
  Returns materials and weapons owned by player
- `get_damage(account_id: AccountId) -> u64`:
  Returns accumulated damage by player in current boss raid

#### Change Methods (via Function Call Keys / Signless):
- `claim_starter()`: Grants starter bundle (materials/weapons) if eligible
- `craft(item_id: String)`: Consumes NEP-245 materials to craft weapon
- `reforge(element_in: u8, element_out: u8)`: Burns 2 of `element_in` weapon to forge 1 of `element_out`
- `attack(weapon_element: u8, stance: u8)`: Executes combat turn using 1 weapon and selected stance
- `merchant_buy(item_id: String, amount: u64)`: Buys item from NPC Merchant using internal ledger
- `merchant_sell(item_id: String, amount: u64)`: Sells item to NPC Merchant, crediting internal ledger
- `claim_jackpot()`: Claims proportional jackpot payout after boss defeat

#### Change Methods (Payable / Full Access Key):
- `deposit()`: Attached deposit credits player internal ledger
- `withdraw(amount: U128)`: Transfers yoctoNEAR from internal ledger back to player wallet

#### Governance / AI TEE Gate:
- `apply_ai_proposal(proposal: AiProposal, signature: Vec<u8>) -> bool`:
  Payload: `{ epoch: u64, resistance_shifts: [i32; 3], buyback_multiplier_bps: u32, nonce: u64 }`
  Enforces:
  * Signature verification against pinned Ed25519 public key
  * `buyback_multiplier_bps` in `[10000, 40000]`
  * `|resistance_shifts[i]| <= 2500`
  * Clamping and conservation of 13500 bps total resistance

#### NEP-297 Standard Events (`EVENT_JSON`):
Logs emitted with prefix `EVENT_JSON:` and schema:
```json
{
  "standard": "spire-gamefi",
  "version": "3.1.0",
  "event": "<event_name>",
  "data": [ { ... } ]
}
```
Event names: `deposit`, `craft`, `reforge`, `raid`, `boss_defeated`, `ai_proposal_applied`, `merchant_trade`.

### 2. Relayer ↔ Frontend Shared Logic (`pricing.ts`)
Both Relayer and Frontend implement an identical mirror pricing engine `pricing.ts`:
- Adaptive resistance renormalization:
  Input `[80, 20, 10]` -> Output `[8500, 3114, 1886]`, total 13500 bps, clamp [1000, 8500].
- NPC Merchant price curve with 10% spread:
  `P_mid(stock) = P0 * (1 + max(0, target_stock - stock) / target_stock)`
  `buy_price = P_mid`
  `sell_price = P_mid * 0.90 * (multiplier_bps / 10000)`
- Boss damage mitigation:
  `damage = base_damage * (10000 - resistance_bps) / 10000`
- Jackpot distribution:
  `last_attack_payout = jackpot * 0.10`
  `damage_payout = jackpot * 0.90 * player_damage / total_damage`

## Code Layout
```
/spire/
├── contract/                       # Layer 1: Rust near-sdk 5.30.1 smart contract
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs                  # Main contract state & public API
│   │   ├── types.rs                # Data structures, enums, events
│   │   ├── ledger.rs               # Signless internal vault accounting
│   │   ├── resistance.rs           # Deterministic adaptive resistance math
│   │   ├── merchant.rs             # NPC Merchant bonding curve
│   │   ├── tower.rs                # 3-Floor Tower rules, Boss Tribute & Enrage
│   │   ├── nft.rs                  # NEP-171/177 live dynamic SVG trophy
│   │   ├── tee.rs                  # Ed25519 signature verification gate
│   │   └── events.rs               # NEP-297 EVENT_JSON log emission
│   └── tests/
│       ├── raid_flow.rs            # Integration test suite
│       └── resistance_tests.rs     # Math unit test suite
├── relayer/                        # Layer 2 & 3: TypeScript Relayer, Keeper, Indexer
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── pricing.ts              # Mirror pricing engine (deterministic math)
│       ├── keeper.ts               # Autonomous keeper loop & telemetry poller
│       ├── tee.ts                  # NEAR AI Cloud TEE client & mock Ed25519 signer
│       ├── indexer.ts              # Real-time RPC scraper & EVENT_JSON parser
│       └── index.ts                # Main entry point
├── test-vectors/                   # Cross-layer mathematical test vectors
│   ├── resistance_vectors.json     # 80/20/10 -> 8500/3114/1886 and edge vectors
│   └── merchant_vectors.json       # NPC pricing and spread vectors
├── web/                            # Layer 4: Next.js 14 App Router Web App
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── src/
│       ├── app/                    # Next.js 14 App Router pages
│       ├── components/             # 3-column dashboard components
│       │   ├── left/               # Forge, Altar, Inventory, Supply Bar
│       │   ├── center/             # Arena, HP Bar, Jackpot, Radar, Stance, Damage Log
│       │   └── right/              # Bazaar, Tower Selector, Feed, TEE Inspector
│       ├── lib/
│       │   ├── near.ts             # Signless Session Key & RPC connection
│       │   └── simulation/
│       │       └── pricing.ts      # Fast-Forward Simulation Engine
│       └── styles/
├── tests/                          # Layer 5: E2E Testing Suite (Tiers 1-4)
│   ├── tier1_feature_tests.ts
│   ├── tier2_boundary_tests.ts
│   ├── tier3_pairwise_tests.ts
│   └── tier4_workload_tests.ts
├── scripts/                        # Automated runners & verification
│   ├── verify-all.sh               # Master automated verification script
│   └── run-keeper.sh               # Keeper startup script
├── PROJECT.md                      # Global index: architecture, milestones, contracts
├── TEST_INFRA.md                   # E2E test infra definition
└── TEST_READY.md                   # Signal that E2E test suite is complete
```
