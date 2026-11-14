/**
 * Pure Boss Combat & Tribute confiscation rules (mirror of contract/src/tower.rs
 * and contract/src/lib.rs attack/floor_response). Used by Wave 2 UI components.
 */

import {
  FROST_ELEMENT,
  FROST_WARD_BONUS_BPS,
  FROST_WARD_FLOOR,
  TRIBUTE_THRESHOLD_BPS,
} from "./spire/constants";
import {
  getWeaponTributeTier,
  type TacticalStance,
  type WeaponTributeTier,
} from "./simulation/pricing";

export type { WeaponTributeTier };

export interface WeaponTributeStatusInput {
  total: number;
  free: number;
  isOnlyWeapon: boolean;
  effectiveResBps: number;
  stance?: TacticalStance | 0 | 1 | 2;
}

export interface WeaponTributeStatus {
  tier: WeaponTributeTier;
  atRisk: boolean;
  label: string;
  detail: string;
}

/**
 * Applies floor-specific elemental wards onto base meta resistances.
 * UI Floor 2 (on-chain floor 1) adds +1500 bps Frost Ward to Frost (index 1).
 */
export function getEffectiveResistances(
  base: [number, number, number],
  uiFloor: number
): [number, number, number] {
  const effective: [number, number, number] = [base[0], base[1], base[2]];
  if (uiFloor === FROST_WARD_FLOOR) {
    effective[FROST_ELEMENT] += FROST_WARD_BONUS_BPS;
  }
  return effective;
}

/**
 * Computes tradeable / non-starter weapon counts (`total - starter_locked`, clamped >= 0)
 * matching `contract/src/lib.rs` `weapons[e].saturating_sub(starter[e])`.
 */
export function getFreeWeaponCounts(
  total: [number, number, number],
  locked: [number, number, number]
): [number, number, number] {
  return [
    Math.max(0, (total[0] ?? 0) - (locked[0] ?? 0)),
    Math.max(0, (total[1] ?? 0) - (locked[1] ?? 0)),
    Math.max(0, (total[2] ?? 0) - (locked[2] ?? 0)),
  ];
}

/**
 * Classifies Boss Tribute confiscation exposure into 4 deterministic tiers
 * mirroring `contract/src/tower.rs::should_confiscate_tribute`:
 *   1. `safe-below-ward` — effective resistance < 7000 bps
 *   2. `starter-safe` — no unlocked (non-starter) weapons of this element
 *   3. `last-weapon-safe` — player's final weapon overall (`isOnlyWeapon`)
 *   4. `tribute-risk` — 1 unlocked weapon will be confiscated on attack
 */
export function getWeaponTributeStatus({
  total,
  free,
  isOnlyWeapon,
  effectiveResBps,
  stance,
}: WeaponTributeStatusInput): WeaponTributeStatus {
  const tier = getWeaponTributeTier(effectiveResBps, free, isOnlyWeapon);

  if (tier === "safe-below-ward") {
    return {
      tier,
      atRisk: false,
      label: "Safe · Below Ward",
      detail: `Effective resistance (${effectiveResBps} bps) is below the ${TRIBUTE_THRESHOLD_BPS} bps Boss Tribute threshold.`,
    };
  }

  if (tier === "starter-safe") {
    return {
      tier,
      atRisk: false,
      label: "Starter Safe",
      detail:
        total > 0
          ? "Only starter-locked weapons are held for this element; Boss Tribute never confiscates starter gear."
          : "No unlocked weapons of this element are held.",
    };
  }

  if (tier === "last-weapon-safe") {
    return {
      tier,
      atRisk: false,
      label: "Last Weapon Safe",
      detail:
        "This is your final remaining weapon in the arsenal; Boss Tribute never seizes a player's last weapon.",
    };
  }

  const isPierce = stance === "pierce" || stance === 2;
  const pierceNote = isPierce
    ? " Pierce reduces turn damage resistance by 1500 bps, but Boss Tribute still checks pre-stance effective resistance."
    : "";

  return {
    tier: "tribute-risk",
    atRisk: true,
    label: "Tribute Risk",
    detail: `Effective resistance (${effectiveResBps} bps) is at or above ${TRIBUTE_THRESHOLD_BPS} bps; 1 of ${free} unlocked weapon(s) will be seized on attack.${pierceNote}`,
  };
}
