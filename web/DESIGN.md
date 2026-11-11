---
name: The Spire v3.1
description: Autonomous Dark-Fantasy GameFi on NEAR Protocol with Dynamic Volumetric Lighting
colors:
  primary: "#F59E0B"
  solar: "#F59E0B"
  frost: "#38BDF8"
  void: "#A855F7"
  jackpot: "#00EC97"
  neutral-bg: "#080B11"
  panel-dark: "#0F1424"
  panel-card: "#13192B"
  hp-red: "#EF4444"
typography:
  display:
    fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.2em"
  headline:
    fontFamily: "ui-serif, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
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

## Overview

**Creative North Star: "The Hollow Obsidian Citadel"**

The Spire v3.1 is an immersive, dark-fantasy on-chain GameFi citadel on NEAR Protocol. It fuses gothic architectural filigree with mathematical adaptive resistance. The aesthetic is strictly dark obsidian (`#080B11`), illuminated by authentic 60fps volumetric god-rays and dynamic elemental particle spores.

**Key Characteristics:**
- True black obsidian ground (`#080B11`) with high-contrast text (slate-100 to slate-300).
- Elemental Triad: Solar Amber (`#F59E0B`), Frost Cyan (`#38BDF8`), Void Violet (`#A855F7`).
- Flat unnested container architecture using crisp dividers and subtle directional elevation.
- Authentic canvas ambient lighting without artificial CSS zero-offset glows.

## Colors

The palette is anchored on dark obsidian with three elemental forces and jackpot emerald.

### Primary
- **Solar Amber** (#F59E0B): Luminescent kinetic essence, primary CTA actions, and fire affinity.

### Secondary
- **Frost Cyan** (#38BDF8): Cryo-crystalline ether, secondary actions, and cold affinity.
- **Void Violet** (#A855F7): Sub-atomic vacuum matter, esoteric relic energy, and shadow affinity.
- **Jackpot Emerald** (#00EC97): Protocol treasury, floor payouts, and victory rewards.

### Neutral
- **Obsidian Black** (#080B11): Ground surface canvas.
- **Panel Dark** (#0F1424): Base level containers and scene wrappers.
- **Panel Card** (#13192B): Elevated interactive slots.
- **Slate Text** (#E2E8F0, #CBD5E1, #94A3B8): High-contrast typographic ramp.

### Named Rules
**The Elemental Triad Rule.** Solar, Frost, and Void represent the game's core weapon elements and adaptive boss resistances. Void Violet is specifically approved as an elemental combat token, never an arbitrary decorative gradient.

## Typography

**Display Font:** Serif Display (Hollow Knight aesthetic)
**Body Font:** Clean Sans-serif
**Label/Mono Font:** UI Monospace with Tabular Figures

### Hierarchy
- **Display** (Bold 700, 3.75rem / 60px, 1.1): Title Screen and Citadel Hero headers.
- **Headline** (Bold 700, 1.875rem / 30px, 1.2): Section titles and boss titan name.
- **Title** (Semibold 600, 1.125rem / 18px, 1.3): Slot labels and card categories.
- **Body** (Regular 400, 0.875rem / 14px, 1.5): Descriptive prose and lore chronicles.
- **Label** (Semibold 600, 0.75rem / 12px, tracking-wider): Badges, telemetry, and stance hotkeys.

## Layout

A 4-scene spatial architecture coordinated by a sticky top HUD:
1. Title Screen: Full-viewport vertical menu with gothic filigree crest.
2. Landing Scroll: Clean horizontal visual blocks with equal edges and generous padding.
3. Equipment Screen: Symmetrical 4-material left column, 3-weapon + trophy right column, center pedestal, bottom action banner.
4. Boss Battle Screen: Top HP/Jackpot bar, 80% center Malakor silhouette with shield aura, bottom-left combat HUD, bottom-right Meta Radar.

## Elevation & Depth

Surfaces are flat at rest, employing subtle 1px border highlights (`rgba(255, 255, 255, 0.1)`) and directional ambient shadows (`0 4px 16px -2px rgba(0, 0, 0, 0.6)`). Zero-offset colored halos are strictly avoided; depth and mood are supplied dynamically by the 60fps HTML5 volumetric canvas.

## Shapes

Container corners use consistent 12px–16px radii (`rounded-xl` to `rounded-2xl`). Buttons and interactive slots use 8px radii (`rounded-lg`).

## Components

### Buttons
- **Shape:** Rounded rectangle (8px radius)
- **Primary:** Solar Amber background with dark obsidian text.
- **Secondary:** Frost Cyan or Panel Card with 1px border.

### Cards / Containers
- **Corner Style:** 12px or 16px radius
- **Architecture:** Flat unnested containers. Cards are never nested inside bordered rounded cards.
- **Padding:** Minimum 8px padding (`p-3` to `p-6`).

## Do's and Don'ts

### Do:
- **Do** maintain a strict 11px floor for all interactive and content text.
- **Do** keep contrast ratios >= 4.5:1 on dark backgrounds using slate-300 or lighter.
- **Do** use tabular figures (`font-mono-numbers`) for NEAR balances and countdowns.
- **Do** synchronize canvas ambient lighting with active boss resistance.

### Don't:
- **Don't** use fake CSS zero-offset dark glows (`box-shadow: 0 0 15px ...`).
- **Don't** nest bordered rounded cards inside bordered rounded containers.
- **Don't** use `animate-bounce` or `animate-ping`.
- **Don't** allow duplicate starter pack claims on the same account.
