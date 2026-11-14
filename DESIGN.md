---
name: The Spire v3.1
description: Autonomous Dark-Fantasy GameFi on NEAR Protocol with Dynamic Volumetric Lighting (see web/DESIGN.md for active tokens)
colors:
  primary: "#F2A63B"
  solar: "#F2A63B"
  brass: "#E5A93B"
  frost: "#38BDF8"
  void: "#A855F7"
  void-text: "#D8B4FE"
  jackpot: "#00EC97"
  neutral-bg: "#06060A"
  panel-dark: "#0C0D14"
  panel-card: "#12131D"
  panel-elevated: "#181A28"
  hp-red: "#EF4444"
  hp-text: "#FCA5A5"
typography:
  display:
    fontFamily: "var(--font-serif), Georgia, Cambria, 'Times New Roman', serif"
    fontSize: "4rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.08em"
  lore:
    fontFamily: "var(--font-lore), Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.45
  headline:
    fontFamily: "var(--font-serif), Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, monospace"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "var(--font-sans), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "14px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.solar}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
---

# Design System: The Spire v3.1

> **[STATUS / AUTHORITATIVE REFERENCE]** [`web/DESIGN.md`](web/DESIGN.md) ("The Ember-Lit Obsidian Spire") is the authoritative active design specification used by `web/tailwind.config.ts` and `web/src/app/globals.css`. Earlier v3 draft choices (`#080B11`/`#0F1424`/`#13192B` cool slate, `#F59E0B` amber, and `11px` type floor) are superseded by warm obsidian `#06060A`/`#0C0D14`/`#12131D`/`#181A28`, Solar Amber `#F2A63B`, parchment/ash/pewter inks (`#F3EAD8`, `#CEC4B3`, `#9A9184`), contrast-safe semantic text tokens (`#D8B4FE` Void text, `#FCA5A5` HP text), and a strict `12px` (`text-xs`) minimum font-size floor.

## Overview

**Creative North Star: "The Ember-Lit Obsidian Spire"**

The Spire v3.1 is an immersive, dark-fantasy on-chain GameFi citadel on NEAR Protocol. It fuses gothic architectural filigree with mathematical adaptive resistance. The aesthetic is warm dark obsidian (`#06060A`), illuminated by authentic Three.js / WebGL lighting and dynamic elemental particle spores.

**Key Characteristics:**
- Warm obsidian ground (`#06060A`) with high-contrast parchment/ash text (`#F3EAD8`, `#CEC4B3`).
- Elemental Triad: Solar Amber (`#F2A63B`), Frost Cyan (`#38BDF8`), Void Violet (`#A855F7` accents, `#D8B4FE` body/badge text).
- Flat unnested container architecture using crisp engraved dividers (`rgba(229, 169, 59, 0.16)`) and directional bevels.
- Authentic canvas ambient lighting without artificial CSS zero-offset glows.

## Colors

The palette is anchored on warm obsidian with three elemental forces, gilded brass, and jackpot emerald.

### Primary
- **Solar Amber** (#F2A63B): Luminescent kinetic essence, primary CTA actions, and fire affinity.
- **Gilded Brass** (#E5A93B): Engraved rules, subtle bevel borders (`rgba(229, 169, 59, 0.16)`), and citadel trim.

### Secondary
- **Frost Cyan** (#38BDF8): Cryo-crystalline ether, secondary actions, and cold affinity.
- **Void Violet** (#A855F7 accent / #D8B4FE accessible text): Sub-atomic vacuum matter, esoteric relic energy, and shadow affinity.
- **Jackpot Emerald** (#00EC97): Protocol treasury, floor payouts, and victory rewards.
- **HP Crimson** (#EF4444 bar fills / #FCA5A5 accessible text): Boss health gauges and danger states.

### Neutral
- **OLED Obsidian** (#06060A): Primary ground surface canvas.
- **Panel Dark** (#0C0D14): Base level containers and scene wrappers.
- **Panel Card** (#12131D): Elevated interactive slots.
- **Panel Elevated** (#181A28): Hover states and stepped HUD tiers.
- **Warm Ink Ramp** (#F3EAD8 Parchment, #CEC4B3 Ash, #9A9184 Pewter, #94A3B8 Placeholder): High-contrast typographic ramp.

### Named Rules
**The Elemental Triad Rule.** Solar, Frost, and Void represent the game's core weapon elements and adaptive boss resistances. Void Violet is specifically approved as an elemental combat token, never an arbitrary decorative gradient.

## Typography

**Display Font:** Cinzel (`--font-serif`)
**Editorial Accent Font:** Cormorant Garamond (`--font-lore`)
**Body Font:** Plus Jakarta Sans (`--font-sans`)
**Label/Mono Font:** JetBrains Mono (`--font-mono`) with Tabular Figures

### Hierarchy
- **Display** (Bold 700, 4rem / 64px, line-height 1.05, tracking 0.08em): Citadel hero headers (`Cinzel`).
- **Lore** (Medium 500, 1.25rem / 20px, line-height 1.45): Chronicle passages, merchant quotes, and boss taunts (`Cormorant Garamond`).
- **Headline** (Bold 700, 1.875rem / 30px, line-height 1.2): Section titles and boss titan names (`Cinzel`).
- **Title** (Bold 700, 1.125rem / 18px, line-height 1.3): Slot labels and card categories (`JetBrains Mono`).
- **Body** (Regular 400, 0.875rem / 14px, line-height 1.55): Descriptive prose and interactive explanations (`Plus Jakarta Sans`).
- **Label** (Semibold 600, 0.75rem / 12px, tracking 0.05em): Badges, telemetry, and stance hotkeys (`JetBrains Mono`).

## Layout

Multi-route dark citadel coordinated by sticky sanctuary/citadel navigation (`web/src/app/`):
1. **Sanctuary Landing (`/`)**: Full-bleed HDR WebGL Spire Panorama, live boss intelligence telemetry (`BossBrainPreview`), and onboarding entry.
2. **Citadel Workspaces (`/game/*`)**: Shared `AtmosphericBackdrop` shell hosting dedicated focused screens for `/game/start` (Session & Starter), `/game/raid` (Boss Arena, Meta Radar, 3-Turn Stances & Damage Log), `/game/forge` (Crafting Forge & Altar), `/game/merchant` (Bonding Curve Bazaar & Fast-Forward Sim), `/game/vault` (Backer Vault), and `/game/ai` (AI Relayer Inspector).

## Elevation & Depth

Surfaces are flat at rest, employing subtle bronze bevel highlights (`rgba(229, 169, 59, 0.14)`) and directional ambient shadows. Zero-offset colored halos are strictly avoided; depth and mood are supplied dynamically by the 3D WebGL citadel canvas and selective HDR optical bloom (`UnrealBloomPass`, threshold `0.88`).

## Shapes

Container corners follow `web/DESIGN.md` tokens (`sm: 4px`, `md: 8px`, `lg: 12px`, `xl: 14px`, e.g., `rounded-lg` = `12px`, `rounded-xl` = `14px`). Buttons and interactive slots use `8px` (`rounded-md` / Tailwind `rounded-lg` utility overridden or `rounded-lg` per component).

## Components

### Buttons
- **Shape:** Rounded rectangle (`8px` radius token / `rounded-lg`), minimum `44px` interactive height (`min-h-[44px]`).
- **Primary:** Solar Amber background with dark obsidian (`#06060A`) text.
- **Secondary:** Frost Cyan or Panel Card with 1px bronze border.

### Cards / Containers
- **Corner Style:** `12px` (`lg`) or `14px` (`xl`) radius
- **Architecture:** Flat unnested containers. Cards are never nested inside bordered rounded cards.
- **Padding:** Minimum 8px padding (`p-3` to `p-6`).

## Do's and Don'ts

### Do:
- **Do** maintain a strict `12px` (`text-xs`) minimum font-size floor for all interactive, badge, and content text (superseding the early 11px draft rule).
- **Do** keep contrast ratios >= 4.5:1 on dark backgrounds using `#F3EAD8`, `#CEC4B3`, `--color-void-text` (`#D8B4FE`), and `--color-hp-text` (`#FCA5A5`).
- **Do** use tabular figures (`font-mono-numbers`) for NEAR balances and countdowns.
- **Do** synchronize canvas ambient lighting with active boss resistance.
- **Do** enforce `>= 44x44px` tap targets on interactive controls, keyboard focus indicators (`:focus-visible`), and selective `prefers-reduced-motion` handling.

### Don't:
- **Don't** use fake CSS zero-offset dark glows (`box-shadow: 0 0 15px ...`) or gradient-clipped text.
- **Don't** place kickers/eyebrows directly above display/section headings or nest bordered rounded cards inside bordered rounded containers.
- **Don't** use `animate-bounce` or `animate-ping`.
- **Don't** allow duplicate starter pack claims on the same account.
