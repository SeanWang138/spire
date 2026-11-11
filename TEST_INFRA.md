# The Spire v3.1 / BossVault Protocol - Test Infrastructure Specification
**Document Version:** 3.1.0-TEST  
**Author:** Test Writer / QA  
**Target:** End-to-End (E2E) Verification Harness & Tiers 1-4 Test Suites  
**Status:** Approved & Implemented  

---

## 1. Overview & Testing Philosophy

The Spire v3.1 / BossVault Protocol is an autonomous 5-layer GameFi system on NEAR Protocol. The testing infrastructure is designed with a strict **opaque-box, specification-derived, zero-facade** testing philosophy:
- **No Cheating / No Facade Tests**: Test suites never assume internal private state structures. All assertions evaluate observable interface contracts, deterministic mathematical properties, and NEP standards.
- **Authoritative Source Derivation**: Every expected output is directly derived from `ORIGINAL_REQUEST.md`, `PROJECT.md`, and deterministic mathematical proofs.
- **Progressive Testability**: Tests validate layer mechanics independently and end-to-end across unit, state transition, pairwise interaction, and real-world campaign lifecycles.
- **Hermetic & Independent Execution**: Every test case sets up its own state, executes without side-effects on other tests, and runs without requiring active external internet access or live NEAR mainnet/testnet RPCs.

---

## 2. 4-Tier Test Architecture & Methodologies

The test suite implements four formal software testing methodologies structured into distinct execution tiers:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: FEATURE COVERAGE & CATEGORY-PARTITION (tests/tier1_feature_tests.ts)  │
│ - Category-Partitioning of all 11 core features in PROJECT.md Inventory      │
│ - >= 5 exhaustive test cases per feature covering primary functional paths   │
│ - Covers NEP-245, dynamic SVG NFT, internal ledger, 3 floors, adaptive       │
│   resistance, epoch meta shift, merchant curve, tribute, jackpot, TEE gate,  │
│   and NEP-297 EVENT_JSON logging                                             │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│ TIER 2: BOUNDARY VALUE ANALYSIS & CORNER CASES (tests/tier2_boundary_tests.ts)│
│ - Boundary Value Analysis (BVA) at upper, lower, and off-by-one points       │
│ - >= 5 test cases per feature area                                           │
│ - Covers clamp bounds [1000, 8500], zero supplies, extreme supply skew       │
│   (100/0/0, 9999/1/1), merchant reserve floor (< 1 NEAR), zero-damage raider,│
│   single-attacker jackpot, weapon confiscation threshold (6999 safe vs 7000),│
│   starter-lock & last-weapon immunity, TEE limits, and floor timeouts        │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│ TIER 3: PAIRWISE COMBINATORIAL INTERACTIONS (tests/tier3_pairwise_tests.ts)   │
│ - Pairwise cross-feature interactions across protocol subsystems             │
│ - Tests state mutation cascades: deposit -> craft -> attack; trade -> supply │
│   shift -> raid; TEE proposal -> meta update -> merchant spread adjust;      │
│   multi-user concurrent raid -> jackpot split; Floor 2 Frost Ward damage     │
│   shifts; Floor 3 lazy enrage regen over time; tribute weapon burn cascade   │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│ TIER 4: REAL-WORLD WORKLOAD SIMULATION (tests/tier4_workload_tests.ts)       │
│ - End-to-end full 3-floor tower assault campaign simulation                  │
│ - Floor 1: The Crypt (multi-attacker normal raid)                            │
│ - Floor 2: The Frost Vault (Frost Ward mitigation & 30m countdown)           │
│ - Floor 3: The Void Apex (Enrage 10%/5m healing & 20m countdown defeat)      │
│ - Dynamic NEP-171/177 live SVG trophy generation & metadata inspection       │
│ - Proportional jackpot payout settlement & zero-loss yocto conservation     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tier Specifications

### 3.1 Tier 1: Category-Partition & Feature Coverage (`tests/tier1_feature_tests.ts`)
Partitioning input domains into equivalence classes and testing representative instances for all features in `PROJECT.md § Feature Inventory`:
1. **Multi-Token NEP-245**: Material token identifiers (`ore:iron`, `essence:solar`, `essence:frost`, `essence:void`), weapon identifiers (`weapon:solar`, `weapon:frost`, `weapon:void`), recipes (2 ore + 1 essence), and reforging burn/mint mechanics.
2. **Dynamic SVG NFT (NEP-171/177)**: Token ID schema `spire-trophy-r{round}-f{floor}`, valid XML/SVG structure, embedded killer ID, round/floor numbers, jackpot amount, and elemental background theme.
3. **Internal Ledger & Signless Key Vault**: 1-time payable deposit, signless Function Call key allowance, 0.1 NEAR attack ticket debit, insufficient balance rejection, and balance withdrawals.
4. **3-Floor Tower Mechanics**:
   - Floor 1: 1,000 HP, baseline elemental resistances.
   - Floor 2: 2,500 HP, Frost Ward (-50% Frost damage, +25% Solar damage), 30-minute deadline.
   - Floor 3: 5,000 HP, Enrage HP regeneration (+10% / 500 HP per 5 minutes), 20-minute deadline.
5. **Deterministic Adaptive Resistance**:
   - Total resistance invariant: $\sum R_i = 13500\text{ bps}$.
   - Individual bounds: $1000 \le R_i \le 8500\text{ bps}$.
   - Authoritative test vector: Input `[80, 20, 10]` $\to$ Output `[8500, 3114, 1886]`.
6. **Epoch Meta Shift**: Resistance change rate-limited to `MAX_SHIFT_BPS` = 2500 bps per element per epoch.
7. **NPC Merchant Bonding Curve**: Mid-price $P_{mid}(S) = P_0 \times (1 + \max(0, S_{target} - S) / S_{target})$, 10% spread ($P_{sell} = 0.90 \times P_{buy}$), closed if treasury reserve $< 1\text{ NEAR}$.
8. **Boss Tribute Weapon Confiscation**: Attacks confiscated if resistance $\ge 7000\text{ bps}$, with starter-lock and last-weapon protections.
9. **Proportional Jackpot Distribution**: 10% killer bonus + 90% proportional damage pool, pull-pattern claims.
10. **AI TEE Signature Gate**: Ed25519 signature validation against pinned public key, multiplier in $[10000, 40000]\text{ bps}$, resistance shift $\le 2500\text{ bps}$.
11. **NEP-297 `EVENT_JSON` Logging**: Standard schema validation for all 7 game events (`deposit`, `craft`, `reforge`, `raid`, `boss_defeated`, `ai_proposal_applied`, `merchant_trade`).

### 3.2 Tier 2: Boundary Value Analysis & Corner Cases (`tests/tier2_boundary_tests.ts`)
Testing off-by-one limits and extreme states:
- Clamp limits: 8500 bps (max), 8501 bps (clamped), 1000 bps (min), 999 bps (clamped).
- Double clamp scenarios: Two elements hitting 1000 bps forcing 3rd element to 8500 bps ceiling.
- Zero supplies: `[0, 0, 0]` $\to$ default `[4500, 4500, 4500]`.
- Extreme supplies: `[100, 0, 0]`, `[9999, 1, 1]`, `[50, 50, 0]`, `[1, 99, 0]`.
- Merchant treasury threshold: $1.0\text{ NEAR}$ ($10^{24}$ yocto) OPEN vs $1.0\text{ NEAR} - 1\text{ yocto}$ CLOSED.
- Merchant stock extremes: Stock = 0 (2x price) vs Stock = $10^6$ (1x price).
- Boss tribute boundary: 6999 bps SAFE vs 7000 bps CONFISCATED.
- Immunity exceptions: Starter weapon at 8500 bps PROTECTED; single inventory weapon at 8500 bps PROTECTED.
- Jackpot edge divisions: 1 yocto total pool, indivisible pools (10,001 yocto among 3 players), zero damage raider (0 payout).
- TEE proposal parameter limits: 9999 bps (rejected) vs 10000 bps (accepted); 40000 bps (accepted) vs 40001 bps (rejected); shift 2500 bps (accepted) vs 2501 bps (rejected).
- Raid timeouts: Floor 2 at 1799s (valid) vs 1800s (expired); Floor 3 at 1199s (valid) vs 1200s (expired).

### 3.3 Tier 3: Pairwise Combinatorial Interactions (`tests/tier3_pairwise_tests.ts`)
Testing multi-feature interaction matrices:
- **Interaction 1: Deposit $\to$ Craft $\to$ Attack**: Funds internal ledger, consumes materials to forge weapon, executes attack, debits ticket, and mitigates boss HP.
- **Interaction 2: Merchant Trade $\to$ Supply Shift $\to$ Resistance Recalibration**: Player buying/selling items modifies circulating supply, triggering adaptive resistance adjustment and altering combat damage.
- **Interaction 3: TEE Proposal $\to$ Meta Shift $\to$ Merchant Spread Adjustment**: TEE updates buyback multiplier to 15000 bps, boosting NPC sell price by 1.5x while clamping element shift.
- **Interaction 4: Multi-User Concurrent Raid $\to$ Jackpot Split**: Multiple players raid simultaneously with varying stances and weapons; boss defeated; 90% pool allocated strictly proportional to damage, 10% awarded to killer.
- **Interaction 5: Floor 2 Frost Ward Elemental Differentiation**: Simultaneous attacks with Solar Blade (+25% damage bonus) vs Frost Spear (-50% damage penalty) validating tactical weapon switching.
- **Interaction 6: Floor 3 Lazy Enrage Evaluation Over Time**: Simulating irregular combat turn intervals, testing discrete 5-minute ticks (+500 HP per interval) capped at 5000 HP max.
- **Interaction 7: Weapon Reforging Burn $\to$ Supply Disbalance $\to$ Tribute Confiscation Trigger**: Burning Frost weapons to create Solar weapons elevates Solar circulating share, pushing Solar resistance above 7000 bps and triggering Boss Tribute.

### 3.4 Tier 4: Real-World Workload Simulation (`tests/tier4_workload_tests.ts`)
Simulating complete multi-user game session from inception to victory:
- Three active participants: `alice.testnet`, `bob.testnet`, `charlie.testnet`.
- Comprehensive 3-floor tower assault:
  - Floor 1: Rapid clear of The Crypt (1000 HP).
  - Floor 2: Tactical adaptation to Frost Ward (2500 HP) within 30-minute window.
  - Floor 3: Coordinated assault overcoming Void Apex enrage recovery (5000 HP) within 20-minute window.
- On-chain dynamic SVG Trophy generation: validates valid XML document, dynamic SVG styling, killer recognition, and round/floor metadata.
- Jackpot payout distribution: mathematical conservation check confirming that the sum of all player claims equals exactly the total jackpot pool (zero leakage, zero inflation).

---

## 4. Test Execution & Verification

### 4.1 Prerequisites
- Node.js: `v26.13.0` (with native `--experimental-strip-types` support)
- Cargo & Rust: `cargo 1.99.1`
- NPM: `11.20.0`

### 4.2 Running Tests Individually
```bash
# Set environment
export PATH="$HOME/.nvm/versions/node/v26.13.0/bin:$HOME/.cargo/bin:$PATH"

# Tier 1: Feature Coverage Tests
node --experimental-strip-types tests/tier1_feature_tests.ts

# Tier 2: Boundary & Corner Cases
node --experimental-strip-types tests/tier2_boundary_tests.ts

# Tier 3: Pairwise Cross-Feature Interactions
node --experimental-strip-types tests/tier3_pairwise_tests.ts

# Tier 4: Real-World Workload Simulation
node --experimental-strip-types tests/tier4_workload_tests.ts

# Or run all tiers in sequence via master test runner
node --experimental-strip-types tests/run_all.ts
```

### 4.3 Running Master Verification Pipeline
```bash
./scripts/verify-all.sh
```
This runs contract tests (`cargo test`), relayer unit tests, web build (`npm run build`), and the full E2E test suite (Tiers 1–4), returning exit code `0` on success.

---

## 5. Traceability Matrix

| Feature | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Workload) |
|---|---|---|---|---|
| NEP-245 Multi-Token | Cases 1.1–1.6 | Cases 2.1–2.5 | Interaction 1, 2, 7 | Workload Step 1, 2 |
| Dynamic SVG Trophy | Cases 2.1–2.5 | Cases 5.1–5.5 | Interaction 4, 6 | Workload Step 4 |
| Internal Ledger Vault | Cases 3.1–3.5 | Cases 3.1–3.2 | Interaction 1, 3 | Workload Step 1, 5 |
| 3-Floor Tower Progression | Cases 4.1–4.5 | Cases 7.1–7.5 | Interaction 5, 6 | Workload Step 1, 2, 3 |
| Adaptive Resistance Math | Cases 5.1–5.5 | Cases 1.1–1.5 | Interaction 2, 4 | Workload Step 2, 3 |
| Epoch Meta Shift | Cases 6.1–6.5 | Cases 6.5 | Interaction 4 | Workload Step 3 |
| NPC Merchant Bonding Curve | Cases 7.1–7.5 | Cases 3.1–3.5 | Interaction 2, 3 | Workload Step 1 |
| Boss Tribute Confiscation | Cases 8.1–8.5 | Cases 4.1–4.5 | Interaction 7 | Workload Step 2 |
| Proportional Jackpot Payout | Cases 9.1–9.5 | Cases 5.1–5.5 | Interaction 4 | Workload Step 5 |
| AI TEE Signature Gate | Cases 10.1–10.5 | Cases 6.1–6.4 | Interaction 4 | Workload Step 3 |
| NEP-297 EVENT_JSON Logging | Cases 11.1–11.5 | Cases 5.2 | Interaction 1–7 | Workload Step 1–5 |
