---
name: The Spire v3.1
description: Autonomous Dark-Fantasy GameFi on NEAR Protocol with Dynamic Volumetric Lighting
colors:
  primary: "#F2A63B"
  brass: "#E5A93B"
  solar: "#F2A63B"
  frost: "#38BDF8"
  void: "#A855F7"
  jackpot: "#00EC97"
  neutral-bg: "#06060A"
  panel-dark: "#0C0D14"
  panel-card: "#12131D"
  panel-elevated: "#181A28"
  parchment: "#F3EAD8"
  ash: "#CEC4B3"
  pewter: "#9A9184"
  hp-red: "#EF4444"
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

## Overview

**Creative North Star: "The Ember-Lit Obsidian Spire"**

The Spire v3.1 is a volcanic dark-fantasy GameFi citadel forged on NEAR Protocol. Every screen unifies warm bone-parchment typography (`#F3EAD8`), carved basalt surfaces (`#0C0D14`, `#12131D`), antique brass hairlines, and opaque Three.js HDR selective optical bloom (`UnrealBloomPass`) that washes sky clouds, stone viaducts, and craggy basalt valleys in elemental bounce light.

**Key Characteristics:**
- Volcanic obsidian ground (`#06060A`) paired with bone-parchment (`#F3EAD8`) and warm ash (`#CEC4B3`) inks.
- Elemental Triad strictly reserved for gameplay states: Solar Amber (`#F2A63B`), Frost Cyan (`#38BDF8`), Void Amethyst (`#A855F7`), plus Jackpot Emerald (`#00EC97`) and Enrage Crimson (`#EF4444`).
- Full-bleed WebGL Hero Panorama fusing 3D Gothic Spire architecture, stone causeway, volumetric mist planes, mountain ridges, and GLSL twilight sky into a single HDR buffer (zero transparent-alpha bloom smears).
- Warm volumetric dusk backdrop (`AtmosphericBackdrop`) across `/game/*` sanctum workspaces.

## Typography

- **Display Crest (`Cinzel`)**: Carved monumental headers, citadel tier titles, boss sovereign names.
- **Chronicle Lore (`Cormorant Garamond`)**: Italic dark-fantasy lore lines, merchant reasoning quotes, boss taunts, and chronicle passages.
- **UI Body (`Plus Jakarta Sans`)**: Crisp readable actions and explanations.
- **Telemetry (`JetBrains Mono`)**: Tabular figures (`font-mono-numbers`) for NEAR payouts, bps resistances, hashes, and clocks.

## Do's and Don'ts

- **Do** keep body contrast >= 4.5:1 using warm ash (`#CEC4B3`) or bone parchment (`#F3EAD8`) on dark basalt.
- **Do** preserve calibrated HDR selective bloom (matte basalt below threshold; slim gothic lancets, runes, crystals, and beacon cores above threshold `0.88`).
- **Do** keep `prefers-reduced-motion` scenes fully lit with bloom while calming spin/shake/particle speed.
- **Don't** place kickers/eyebrows above headings or use gradient-clipped text.
- **Don't** use `animate-bounce` or `animate-ping`.
- **Don't** render fake zero-offset blur cards or nest rounded bordered cards inside bordered cards.
