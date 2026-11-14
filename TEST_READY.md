# Milestone Notice: M-TEST (E2E Reference Simulation Track)
**The Spire v3.1 / BossVault Protocol**  
**Author:** Test Writer / QA (`worker_test`)  
**Snapshot Date:** 2026-11-09 (Updated for v3.1 Contract Parity Notes)  
**Scope:** Historical M-TEST Opaque-Box Reference Suite (`tests/protocol_models.ts`)  

> **[STATUS / AUTHORITATIVE REFERENCE]** The 111-test matrix recorded below captures the historical **2026-11-09 M-TEST** snapshot executed against the **offline TypeScript reference simulation** ([`tests/protocol_models.ts`](tests/protocol_models.ts)), NOT directly against the deployed `spire.testnet` Rust contract or current `web/` / `relayer/` parity suites. Live contract behavior in [`contract/src/types.rs`](contract/src/types.rs), [`contract/src/merchant.rs`](contract/src/merchant.rs), and [`contract/src/lib.rs`](contract/src/lib.rs) supersedes early v3 reference constants used inside `protocol_models.ts`:
> - **Floor HP & Tickets:** Live `[1,000, 1,600, 2,500] HP` & `[0.10, 0.15, 0.25] NEAR` tickets; Floor 2 Frost Ward `+1,500 bps` Frost resistance; Floor 3 Enrage `+10% max HP = 250 HP / 5m` (vs `[1,000, 2,500, 5,000] HP`, `0.10 NEAR` flat, `-50%/+25%`, `+500 HP` in `protocol_models.ts`).
> - **Crafting & Starter:** Live `2 ore:iron + 3 essence:* -> 1 weapon` (`vs 2 ore + 1 essence` in `protocol_models.ts`); `claim_starter` grants `[4 Solar, 1 Frost, 0 Void]` starter-locked weapons + `4` Iron Ore + `3` Solar/Frost/Void essence.
> - **Merchant Curve:** Live `MERCHANT_BASE_PRICE = 0.05 NEAR`, `target = 100`, `k1 = 0.50`, `k2 = 0.30`, `0.50x..2.00x` (`0.025..0.10 NEAR` mid), `±10%` spread (vs `P0 = 0.1 NEAR` / `2x = 0.2 NEAR` in `protocol_models.ts`).
> - **Session Key & AI Gate:** Live testnet frontend uses an **Ephemeral Testnet Guest Session** (`FullAccess` subaccount funded `0.60 NEAR` via `/api/accounts`, not Function Call Access Keys). Live `apply_ai_proposal` takes 4 args `(floor, proposal, chat_id, signature)` and only sets `buyback_multiplier_bps`, `altar_recipe_id`, and `taunt`; resistance shifts automatically on `lazy_epoch()`. NEP-297 `"standard"` is `"spire"` and NEP-171 trophy IDs are `spirefi-trophy-r{round}-f{floor}`. Cross-layer Rust/Relayer/Web parity is tracked in [`tests/cross_layer_math_parity.ts`](tests/cross_layer_math_parity.ts) and [`test-vectors/merchant_vectors.json`](test-vectors/merchant_vectors.json).

---

## 1. Executive Summary

Milestone **M-TEST (E2E Testing Track)** for The Spire v3.1 / BossVault Protocol implemented an offline TypeScript reference suite covering four testing tiers (category-partition feature coverage, boundary value analysis, pairwise cross-feature interactions, and full 3-floor campaign workload simulation) against `tests/protocol_models.ts`.

In the **2026-11-09 historical snapshot**, all four simulation tiers passed (**111 passed, 0 failed** against `tests/protocol_models.ts`). Separate active verification covers Rust (`cargo test`), Relayer (`npm test`), Web (`npm test` + `tsc --noEmit`), and live cross-layer parity (`tests/cross_layer_math_parity.ts` and `scripts/test-all-live.mjs`).

---

## 2. Test Artifacts & Deliverables

| Artifact | Path | Status | Description |
|---|---|---|---|
| **E2E Test Infrastructure** | `TEST_INFRA.md` | COMPLETE | Formal methodology covering 4-tier testing hierarchy, invariants, and traceability matrix |
| **Test Harness & Matchers** | `tests/test_harness.ts` | COMPLETE | Zero-dependency, high-performance test framework with BigInt-safe assertions |
| **Protocol Reference Models** | `tests/protocol_models.ts` | COMPLETE | Opaque-box reference logic, deterministic math, NEP-297 parsing, and SVG generation |
| **Tier 1: Feature Coverage** | `tests/tier1_feature_tests.ts` | **58 / 58 PASS** | Category-partitioning covering all 11 core features in `PROJECT.md § Feature Inventory` |
| **Tier 2: Boundary & Corner** | `tests/tier2_boundary_tests.ts` | **40 / 40 PASS** | BVA testing clamp limits [1000, 8500], zero supplies, tribute thresholds, timeouts |
| **Tier 3: Pairwise Cross-Feature** | `tests/tier3_pairwise_tests.ts` | **7 / 7 PASS** | Combinatorial interaction cascades across economy, combat, TEE, and floor rules |
| **Tier 4: Real-World Workload** | `tests/tier4_workload_tests.ts` | **6 / 6 PASS** | Full 3-floor tower assault campaign, dynamic SVG trophy, and jackpot settlement |
| **Master E2E Runner** | `tests/run_all.ts` | COMPLETE | Sequential execution runner generating ASCII test matrix report |
| **Master Verification Script** | `scripts/verify-all.sh` | COMPLETE | End-to-end multi-layer pipeline: contract, relayer, web, and E2E runner |

---

## 3. Verification Results Summary

### Execution Matrix

```
================================================================================
   THE SPIRE v3.1 / BOSSVAULT PROTOCOL - E2E TEST VERIFICATION SUITE
================================================================================
 Tier    | Suite Description                         | Test Count | Status
---------+-------------------------------------------+------------+--------------------------
 Tier 1  | Feature Coverage (Category-Partition)     | 58 tests   | ✔ PASSED (100%)
 Tier 2  | Boundary Value Analysis & Corner Cases    | 40 tests   | ✔ PASSED (100%)
 Tier 3  | Pairwise Cross-Feature Interactions       | 7 tests    | ✔ PASSED (100%)
 Tier 4  | Real-World Tower Assault Simulation       | 6 tests    | ✔ PASSED (100%)
---------+-------------------------------------------+------------+--------------------------
 TOTAL   | Master Verification Track                 | 111 tests  | ✔ ALL PASSED (0 FAILURES)
================================================================================
```

### Master Verification Pipeline Result (`./scripts/verify-all.sh`)
```
================================================================================
   THE SPIRE v3.1 / BOSSVAULT PROTOCOL - MASTER VERIFICATION PIPELINE           
================================================================================
>>> [STEP 1/4] Verifying Smart Contract Core (contract/)...
  --> Running: cargo check...
  ✔ cargo check passed cleanly
  --> Running: cargo test...
  ✔ cargo test passed cleanly

>>> [STEP 2/4] Verifying Relayer, Keeper & Pricing Engine (relayer/)...
  --> Running: npm test in relayer/...
  ✔ relayer tests passed (28/28 passed)

>>> [STEP 3/4] Validating Frontend Web App Build (web/)...
  --> Running: npm run build in web/...
  ✔ web build succeeded (Next.js 14 production build, 4/4 static pages)

>>> [STEP 4/4] Executing Comprehensive E2E Test Suite (Tiers 1-4)...
  --> Running: node --experimental-strip-types tests/run_all.ts...
  ✔ All E2E test tiers passed perfectly (100% pass rate, 111/111 tests)

================================================================================
                    MASTER VERIFICATION PIPELINE RESULT                         
================================================================================
✔ ALL VERIFICATION GATES PASSED CLEANLY (EXIT CODE 0)
  - Smart Contract: Checked & Tested
  - Relayer Engine: Checked
  - Web Application: Validated
  - E2E Test Harness: 111/111 Tests Passed (Tiers 1-4)
================================================================================
```

### Key Mathematical & Invariant Verifications Passed:
1. **Adaptive Resistance Canonical Test Vector**:
   - Input `[80, 20, 10]` circulating weapon supplies $\to$ Output `[8500, 3114, 1886]` bps.
   - Exact sum invariant $\sum R_i = 13500\text{ bps}$ strictly preserved across all tested supply distributions.
   - Individual clamps $R_i \in [1000, 8500]\text{ bps}$ strictly enforced.
2. **NPC Merchant Bonding Curve & Spread**:
   - Equilibrium mid-price at stock = 100: $P_0 = 0.1\text{ NEAR}$.
   - Scarcity price doubling at stock = 0: $2.0 \times P_0 = 0.2\text{ NEAR}$.
   - 10% spread verified: $P_{sell} = 0.90 \times P_{buy}$ at baseline buyback multiplier.
   - Treasury guard: Merchant trading closed when contract reserve drops below $1.0\text{ NEAR}$.
3. **Boss Tribute Weapon Confiscation**:
   - $R < 7000\text{ bps}$ (e.g. 6999 bps) $\to$ Safe, weapon retained.
   - $R \ge 7000\text{ bps}$ $\to$ Confiscation triggered for unprotected weapons.
   - Starter-locked weapon immunity verified at $\ge 7000\text{ bps}$.
   - Last-weapon immunity (inventory count $\le 1$) verified at $\ge 7000\text{ bps}$.
4. **Tower Floor Dynamics**:
   - Floor 1: 1,000 HP, baseline elemental mechanics.
   - Floor 2: 2,500 HP, Frost Ward (-50% Frost damage penalty, +25% Solar damage bonus), 30-minute deadline enforced.
   - Floor 3: 5,000 HP, Enrage HP regeneration (+10% / 500 HP per 5-minute interval) capped at 5,000 HP, 20-minute deadline enforced.
5. **Jackpot Conservation & Zero-Leakage**:
   - 10% killer executioner bounty + 90% proportional damage pool.
   - Single attacker captures 100% of jackpot pool.
   - Multi-attacker non-divisible pools guarantee $\sum \text{payouts} \le \text{jackpot}$ with residual yocto safely retained in reserve.
6. **AI TEE Signature Gate**:
   - Buyback multiplier in $[10000, 40000]\text{ bps}$ accepted; $<10000$ or $>40000$ rejected.
   - Element resistance shift $\le 2500\text{ bps}$ accepted; $>2500\text{ bps}$ rejected.
   - Nonce replay strictly rejected.
7. **NEP-297 `EVENT_JSON` Logging**:
   - Schema validation verified for all 7 event types: `deposit`, `craft`, `reforge`, `raid`, `boss_defeated`, `ai_proposal_applied`, `merchant_trade`.
8. **Dynamic SVG Trophy (NEP-171/177)**:
   - Dynamic SVG document generated with embedded winner account, round, floor, damage, jackpot, and dominant element color themes.

---

## 4. How to Execute Tests

### Running the Entire E2E Test Harness
```bash
export PATH="$HOME/.nvm/versions/node/v26.13.0/bin:$HOME/.cargo/bin:$PATH"
node --experimental-strip-types tests/run_all.ts
```

### Running Individual Tiers
```bash
# Tier 1: Feature Coverage (Category-Partition)
node --experimental-strip-types tests/tier1_feature_tests.ts

# Tier 2: Boundary Value Analysis & Corner Cases
node --experimental-strip-types tests/tier2_boundary_tests.ts

# Tier 3: Pairwise Cross-Feature Interactions
node --experimental-strip-types tests/tier3_pairwise_tests.ts

# Tier 4: Real-World Workload Simulation
node --experimental-strip-types tests/tier4_workload_tests.ts
```

### Running the Full Verification Pipeline
```bash
./scripts/verify-all.sh
```

---

## 5. Conclusion
Milestone M-TEST is complete and ready. All opaque-box verification gates are in place to validate autonomous GameFi gameplay for The Spire v3.1 / BossVault Protocol.
