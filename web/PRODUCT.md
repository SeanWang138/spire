# Product

<!-- impeccable:product-schema 1 -->

> **[STATUS / AUTHORITATIVE REFERENCE]** Active frontend product & visual identity spec aligned with [`web/DESIGN.md`](web/DESIGN.md) ("The Ember-Lit Obsidian Spire") and the live `spire.testnet` contract ([`contract/src/types.rs`](../contract/src/types.rs), [`contract/src/lib.rs`](../contract/src/lib.rs)). Earlier v3 notes referencing Function Call Access Keys (FCAKs) and blue-slate `#080B11` / `#F59E0B` palettes are superseded below by Ephemeral Testnet Guest Sessions (`FullAccess` subaccount funded `0.60 NEAR`) and warm obsidian `#06060A` / Solar Amber `#F2A63B`.

## Platform

web

## Stack

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion, Three.js, near-api-js.

## Users

Web3 GameFi players, DeFi/NEAR raiders, on-chain gaming enthusiasts, and backer yield seekers engaging with real NEAR smart contracts.

## Product Purpose

SpireFi is an autonomous Dark-Fantasy Tactical GameFi protocol on NEAR Protocol. It delivers high-stakes, zero-popup combat against escalating boss floors with automatic supply-driven adaptive elemental resistance, a circular tokenless ticket/bounty economy, and Ed25519-verified AI economy proposals.

## Positioning

Low-friction, deterministic on-chain combat with 3D citadel spatial immersion, mathematical resistance shifting, and Ed25519-gated boss AI proposals, distinct from generic clicker web3 apps and flat DeFi dashboards.

## Operating Context

Desktop and mobile browsers accessing NEAR testnet (`spire.testnet`). Players can either connect a wallet or launch an Ephemeral Testnet Guest Session (`FullAccess` browser-stored subaccount under the demo parent, funded `0.60 NEAR` via `/api/accounts`) for popup-free turns, or play against real signed wallet transactions. Players review live boss telemetry, execute 3-turn combat combos, gather materials, forge weapons, trade materials on a bonding-curve merchant, and back floor vaults.

## Capabilities and Constraints

- Three 0-indexed boss floors (`0..2`, UI Floors 1..3) with unique mechanics: Floor 1 (`1,000 HP`, `0.10 NEAR` ticket, no deadline), Floor 2 (`1,600 HP`, `0.15 NEAR` ticket, Frost Ward `+1,500 bps` Frost resistance, 30-minute deadline), Floor 3 (`2,500 HP`, `0.25 NEAR` ticket, Enrage `+10% max HP / 5m`, 20-minute deadline, NEP-171 Conqueror Trophy SVG mint `spirefi-trophy-r{round}-f3`).
- Three combat elements (Solar, Frost, Void) with strict `7,000 bps` Tribute confiscation (`> 1` total weapons owned and non-starter balance `> 0`) and partial NEP-245 multi-token views/transfers (`mt_balance_of`, `mt_supply`, `mt_transfer`).
- Deterministic ticket splits (70% jackpot, 15% backer dividend, 10% buyback reserve, 5% merchant cash + rounding dust) and defeat splits (10% drip to next floor on Floors 1-2, then 10% killer bonus + 90% damage-proportional pool).
- AI Relayer automation via Ed25519 signature over `"spire/..."` domain string + optional NEAR AI Cloud `chat_id` off-chain audit (`Full on-chain hardware TEE attestation: roadmap §13`); elemental resistance shifts automatically in `lazy_epoch()` (hourly), not by AI proposal.
- Real WebGL 3D citadel visualization with full keyboard, mouse, and touch accessibility (`>= 44x44px` interactive targets, `prefers-reduced-motion` support).
- Zero fabricated telemetry; full dark mode obsidian aesthetic.

## Brand Commitments

- Primary palette: Solar Amber (`#F2A63B`), Gilded Brass (`#E5A93B`), Frost Cyan (`#38BDF8`), Void Violet (`#A855F7` accents / `#D8B4FE` accessible text), Jackpot Emerald (`#00EC97`), HP Crimson (`#EF4444` fills / `#FCA5A5` accessible text).
- Material: Warm carved obsidian basalt (`#06060A`, `#0C0D14`, `#12131D`, `#181A28`) with parchment/ash/pewter inks (`#F3EAD8`, `#CEC4B3`, `#9A9184`) and bronze bevel borders (`rgba(229, 169, 59, 0.16)`).
- Typography: Serif display (Cinzel + Cormorant Garamond), Clean Sans (Plus Jakarta Sans), UI Monospace with Tabular Figures (JetBrains Mono), strict `>= 12px` (`text-xs`) text floor.

## Evidence on Hand

- Live NEAR testnet smart contract (`spire.testnet`) with Rust source in `contract/src/`.
- Canonical mathematical models, cross-layer parity vectors, and tests in `tests/`, `relayer/src/`, and `web/src/lib/spire/`.
- Authoritative UI/design specification in `web/DESIGN.md` and protocol docs in `PROJECT.md` and `09-games.md`.

## Product Principles

1. **Obsidian Depth Over Flat Cards:** Surfaces feel carved and dimensional, not generic SaaS cards.
2. **Deterministic Mechanical Honesty:** Visuals directly reflect live contract state (HP, resistance, tickets, pools) and honest scope boundaries.
3. **Immersive Yet Accessible:** 3D graphics enhance immersion while guaranteeing touch, keyboard, and reduced-motion parity.
4. **Popup-Free Testnet Velocity:** Ephemeral `0.60 NEAR` guest subaccounts remove wallet confirmation prompts during tactical combat turns on testnet.

