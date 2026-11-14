"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Swords,
  RefreshCw,
  Flame,
  Snowflake,
  Sparkles,
  Shield,
  Feather,
  ArrowUp,
  AlertTriangle,
  ShieldCheck,
  Coins,
} from "lucide-react";
import {
  TacticalStance,
  STANCE_PROFILES,
  STANCE_IDS,
  PIERCE_RES_CUT_BPS,
  FROST_WARD_FLOOR,
  FROST_ELEMENT,
  FROST_WARD_BONUS_BPS,
  calculateRaidDamage,
} from "@/lib/simulation/pricing";
import {
  getEffectiveResistances,
  getFreeWeaponCounts,
  getWeaponTributeStatus,
  type WeaponTributeTier,
} from "@/lib/combat-rules";
import { PlayerInventory, ElementIndex, StanceIndex } from "@/lib/contract";
import { FLOOR_TICKET_COST_NEAR, nearToYocto } from "@/lib/spire/constants";
import { bpsToPercent, formatNearAmount, parseYoctoSafe } from "@/lib/utils/cn";
import { SpireTooltip } from "@/components/ui/SpireUi";

const STANCE_ORDER: TacticalStance[] = ["aggressive", "feint", "pierce"];

const STANCE_ICON: Record<TacticalStance, React.ReactNode> = {
  aggressive: <ArrowUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  feint: <Feather className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  pierce: <Shield className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
};

const TIER_BADGE_MAP: Record<
  WeaponTributeTier,
  { label: string; className: string }
> = {
  "starter-safe": {
    label: "Starter Safe",
    className: "bg-jackpot/15 text-jackpot border-jackpot/35",
  },
  "last-weapon-safe": {
    label: "Last Weapon Safe",
    className: "bg-frost/15 text-frost border-frost/35",
  },
  "safe-below-ward": {
    label: "Safe (<70% Ward)",
    className: "bg-white/5 text-ash border-brass/25",
  },
  "tribute-risk": {
    label: "TRIBUTE RISK",
    className: "bg-hp/15 text-hp-text border-hp/45",
  },
};

interface TacticalCombatStanceProps {
  inventory: PlayerInventory;
  /** Base meta resistances [solar, frost, void] before floor-specific wards. */
  resistances: [number, number, number];
  floor: number;
  onAttack: (
    floor: number,
    weaponElement: ElementIndex,
    stances: [StanceIndex, StanceIndex, StanceIndex]
  ) => Promise<void>;
  disabled?: boolean;
  ledgerBalanceYocto?: string | null;
  ledgerLoading?: boolean;
  roundExpired?: boolean;
  floorLocked?: boolean;
  bossHp?: number;
}

/**
 * Raid planner (ABI v3.1): one weapon element + three stance turns
 * (Aggressive / Feint / Pierce), executed signless in a single attack() call.
 */
export const TacticalCombatStance: React.FC<TacticalCombatStanceProps> = ({
  inventory,
  resistances,
  floor,
  onAttack,
  disabled = false,
  ledgerBalanceYocto,
  ledgerLoading = false,
  roundExpired = false,
  floorLocked = false,
  bossHp,
}) => {
  const [weaponElement, setWeaponElement] = useState<ElementIndex>(0);
  const [turnStances, setTurnStances] = useState<[TacticalStance, TacticalStance, TacticalStance]>([
    "aggressive",
    "feint",
    "pierce",
  ]);
  const [isRaiding, setIsRaiding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProfileKey, setActiveProfileKey] = useState<TacticalStance>("aggressive");

  const freeCounts = getFreeWeaponCounts(inventory.weapons, inventory.starter_locked);
  const effectiveResistances = getEffectiveResistances(resistances, floor);
  const totalWeaponsOverall =
    (inventory.weapons[0] ?? 0) + (inventory.weapons[1] ?? 0) + (inventory.weapons[2] ?? 0);

  // Auto-select the first owned weapon if current slot has 0 weapons while another slot has >= 1
  useEffect(() => {
    if ((inventory.weapons[weaponElement] ?? 0) === 0 && totalWeaponsOverall > 0) {
      const firstOwned = ([0, 1, 2] as ElementIndex[]).find((idx) => (inventory.weapons[idx] ?? 0) > 0);
      if (firstOwned !== undefined) setWeaponElement(firstOwned);
    }
  }, [inventory.weapons, weaponElement, totalWeaponsOverall]);

  const elements: {
    index: ElementIndex;
    name: string;
    icon: React.ReactNode;
    color: string;
    total: number;
    free: number;
    locked: number;
    effectiveResBps: number;
  }[] = [
    {
      index: 0,
      name: "Solar Blade",
      icon: <Flame className="w-4 h-4 shrink-0" aria-hidden="true" />,
      color: "text-solar",
      total: inventory.weapons[0] ?? 0,
      free: freeCounts[0],
      locked: inventory.starter_locked[0] ?? 0,
      effectiveResBps: effectiveResistances[0],
    },
    {
      index: 1,
      name: "Frost Spear",
      icon: <Snowflake className="w-4 h-4 shrink-0" aria-hidden="true" />,
      color: "text-frost",
      total: inventory.weapons[1] ?? 0,
      free: freeCounts[1],
      locked: inventory.starter_locked[1] ?? 0,
      effectiveResBps: effectiveResistances[1],
    },
    {
      index: 2,
      name: "Void Scythe",
      icon: <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />,
      color: "text-void-text",
      total: inventory.weapons[2] ?? 0,
      free: freeCounts[2],
      locked: inventory.starter_locked[2] ?? 0,
      effectiveResBps: effectiveResistances[2],
    },
  ];

  const selectedWeapon = elements[weaponElement];
  const ownsAnyWeapon = selectedWeapon.total > 0;
  const selectedTribute = getWeaponTributeStatus({
    total: selectedWeapon.total,
    free: selectedWeapon.free,
    isOnlyWeapon: ownsAnyWeapon && totalWeaponsOverall <= 1,
    effectiveResBps: selectedWeapon.effectiveResBps,
    stance: turnStances.includes("pierce") ? "pierce" : turnStances[0],
  });

  // Note: calculateRaidDamage expects base meta resistance (it adds Floor 2 Frost Ward internally).
  const projectedTurns = turnStances.map((st) =>
    calculateRaidDamage(
      weaponElement,
      st,
      resistances[weaponElement],
      floor,
      !selectedTribute.atRisk
    )
  );
  const totalProjected = projectedTurns.reduce((sum, d) => sum + d.effectiveDamage, 0);

  const hasPierce = turnStances.includes("pierce");
  const pierceEffectiveResBps = Math.max(0, selectedWeapon.effectiveResBps - PIERCE_RES_CUT_BPS);
  const hasFrostWardBonus = floor === FROST_WARD_FLOOR && weaponElement === FROST_ELEMENT;

  const ticketCostNear = FLOOR_TICKET_COST_NEAR[Math.min(Math.max(floor, 1), 3) - 1] ?? 0.1;
  const ticketCostYocto = parseYoctoSafe(nearToYocto(ticketCostNear));
  const ledgerKnown = !ledgerLoading && ledgerBalanceYocto !== null && ledgerBalanceYocto !== undefined;
  const ledgerYocto = parseYoctoSafe(ledgerBalanceYocto);
  const insufficientLedger = ledgerKnown && ledgerYocto < ticketCostYocto;

  const setTurnStance = (turn: 0 | 1 | 2, stance: TacticalStance) => {
    const next = [...turnStances] as [TacticalStance, TacticalStance, TacticalStance];
    next[turn] = stance;
    setTurnStances(next);
    setActiveProfileKey(stance);
  };

  const handleAttack = async () => {
    if (isRaiding || disabled || floorLocked || !ownsAnyWeapon || insufficientLedger) return;
    setIsRaiding(true);
    setError(null);
    try {
      const stances = turnStances.map((s) => STANCE_IDS[s]) as [StanceIndex, StanceIndex, StanceIndex];
      await onAttack(floor, weaponElement, stances);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Strike failed: verify ledger balance and session key.");
    } finally {
      setIsRaiding(false);
    }
  };

  const selectedBadge = TIER_BADGE_MAP[selectedTribute.tier];
  const strikeDisabled = disabled || isRaiding || floorLocked || !ownsAnyWeapon || insufficientLedger;

  let disabledReason: string | null = null;
  if (floorLocked) {
    disabledReason = `Floor ${floor} is locked until Floor ${floor - 1} is defeated.`;
  } else if (!ownsAnyWeapon) {
    disabledReason = "You hold 0 weapons of this element. Claim your starter kit or forge a weapon first.";
  } else if (insufficientLedger) {
    disabledReason = `Internal ledger (${formatNearAmount(ledgerYocto, 2)}) is below the ${ticketCostNear.toFixed(2)} NEAR ticket.`;
  }

  return (
    <div className="citadel-stage p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-solar shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
            Command Deck · 3-Turn Strike Chain
          </h2>
        </div>
        <span className="text-xs font-mono text-ash">
          Entry Ticket{" "}
          <span className="text-solar font-bold font-mono-numbers">
            {ticketCostNear.toFixed(2)} NEAR
          </span>
        </span>
      </div>

      {/* 1. Weapon Socket Selector */}
      <div>
        <span className="text-xs font-mono uppercase text-ash block mb-2">
          1. Socket Elemental Armament
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {elements.map((el) => {
            const isSelected = weaponElement === el.index;
            const owned = el.total > 0;
            const status = getWeaponTributeStatus({
              total: el.total,
              free: el.free,
              isOnlyWeapon: owned && totalWeaponsOverall <= 1,
              effectiveResBps: el.effectiveResBps,
              stance: turnStances[0],
            });
            const badge = TIER_BADGE_MAP[status.tier];

            return (
              <button
                type="button"
                key={el.index}
                onClick={() => setWeaponElement(el.index)}
                disabled={!owned}
                aria-pressed={isSelected}
                className={`rpg-sheen min-h-[68px] p-3 rounded-lg border text-left flex flex-col justify-between gap-2 transition-all ${
                  isSelected
                    ? `${el.color} border-current bg-white/[0.08]`
                    : "border-brass/25 bg-[#090A10]/90 text-ash hover:text-parchment hover:border-brass/50"
                } ${!owned ? "opacity-45" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5 truncate">
                    {el.icon}
                    <span className="truncate">{el.name}</span>
                  </span>
                  <span className="font-mono-numbers text-parchment shrink-0">
                    {el.total} total
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-mono">
                  <span className="text-ash font-mono-numbers">
                    {el.free} free · {el.locked} starter
                  </span>
                  {owned ? (
                    <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  ) : (
                    <span className="text-xs text-pewter">None owned</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Linked 3-Turn Stance Chain */}
      <div>
        <span className="text-xs font-mono uppercase text-ash block mb-2">
          2. Configure Stance Sequence
        </span>
        <div className="bg-oled/90 border-t border-b border-brass/20 divide-y divide-brass/15">
          {([0, 1, 2] as const).map((turn) => {
            const projected = projectedTurns[turn];
            const stance = turnStances[turn];
            const turnWardBps =
              stance === "pierce"
                ? Math.max(0, selectedWeapon.effectiveResBps - PIERCE_RES_CUT_BPS)
                : selectedWeapon.effectiveResBps;
            return (
              <div
                key={turn}
                className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono uppercase text-parchment font-bold w-14">
                    Turn {turn + 1}
                  </span>
                  <span className="text-xs font-mono text-ash font-mono-numbers">
                    {bpsToPercent(turnWardBps)} ward
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 flex-1 sm:justify-end">
                  {STANCE_ORDER.map((st) => {
                    const profile = STANCE_PROFILES[st];
                    const isSelected = stance === st;
                    return (
                      <SpireTooltip key={st} content={profile.description}>
                        <button
                          type="button"
                          onClick={() => setTurnStance(turn, st)}
                          aria-pressed={isSelected}
                          className={`min-h-[44px] px-3 py-1.5 rounded-md font-mono text-xs inline-flex items-center gap-2 transition-all ${
                            isSelected
                              ? "bg-solar/20 text-solar font-bold border border-solar/55"
                              : "text-ash hover:text-parchment border border-transparent hover:bg-white/5"
                          }`}
                        >
                          {STANCE_ICON[st]}
                          <span>{profile.name}</span>
                        </button>
                      </SpireTooltip>
                    );
                  })}
                </div>
                <span className="font-mono-numbers text-xs font-bold text-solar w-20 text-right shrink-0">
                  ~{projected.effectiveDamage} DMG
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs font-mono text-ash mt-2 px-1">
          <strong className="text-parchment">{STANCE_PROFILES[activeProfileKey].name}:</strong>{" "}
          {STANCE_PROFILES[activeProfileKey].description}
        </p>
      </div>

      {/* 3. Pre-Strike Simulation Strip */}
      <div className="pt-3 border-t border-brass/25 space-y-3">
        <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs font-mono">
          <div className="space-y-1">
            <dt className="text-pewter uppercase tracking-wider">Est. Damage</dt>
            <dd className="text-sm font-bold text-parchment font-mono-numbers">
              ~{totalProjected} DMG
            </dd>
            <dd className="text-xs text-ash">
              {typeof bossHp === "number" && !roundExpired && totalProjected >= bossHp
                ? `Can fell boss (${bossHp} HP left)`
                : "3-turn midpoint estimate"}
            </dd>
          </div>

          <div className="space-y-1">
            <dt className="text-pewter uppercase tracking-wider">Effective Ward</dt>
            <dd className="text-sm font-bold text-parchment font-mono-numbers">
              {bpsToPercent(selectedWeapon.effectiveResBps)}
            </dd>
            <dd className="text-xs text-ash">
              {hasPierce
                ? `Pierce turns: ${bpsToPercent(pierceEffectiveResBps)} (-${PIERCE_RES_CUT_BPS} bps)`
                : hasFrostWardBonus
                ? `Includes +${FROST_WARD_BONUS_BPS} bps Frost Ward`
                : `${selectedWeapon.effectiveResBps.toLocaleString("en-US")} bps`}
            </dd>
          </div>

          <div className="space-y-1">
            <dt className="text-pewter uppercase tracking-wider">Ticket vs Ledger</dt>
            <dd className="text-sm font-bold font-mono-numbers text-parchment">
              {ticketCostNear.toFixed(2)} NEAR
            </dd>
            <dd className={`text-xs font-mono-numbers ${insufficientLedger ? "text-hp-text font-semibold" : "text-jackpot"}`}>
              {ledgerLoading
                ? "Checking ledger..."
                : ledgerKnown
                ? `Ledger ${formatNearAmount(ledgerYocto, 2)} · ${insufficientLedger ? "Low" : "Covered"}`
                : "Ledger balance unavailable"}
            </dd>
          </div>

          <div className="space-y-1">
            <dt className="text-pewter uppercase tracking-wider">Tribute Risk</dt>
            <dd>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-bold ${selectedBadge.className}`}>
                {selectedTribute.atRisk ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{selectedBadge.label}</span>
              </span>
            </dd>
            <dd className="text-xs text-ash leading-snug">
              {selectedTribute.atRisk
                ? `1 of ${selectedWeapon.free} unlocked seized`
                : "No weapon confiscated"}
            </dd>
          </div>
        </dl>

        {/* Detailed Tribute / Balance Guidance Banner */}
        <div
          className={`px-3 py-2.5 rounded-lg text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
            selectedTribute.atRisk
              ? "bg-hp/15 text-hp-text"
              : "bg-panel-dark/90 text-ash"
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {selectedTribute.atRisk ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-jackpot shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span className="leading-relaxed">{selectedTribute.detail}</span>
          </div>
          {insufficientLedger && (
            <Link
              href="/game/vault"
              className="min-h-[44px] px-3 py-2 rounded-lg bg-solar/15 hover:bg-solar/25 border border-solar/45 text-solar font-bold inline-flex items-center gap-2 shrink-0 transition-colors"
            >
              <Coins className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Deposit in Vault</span>
            </Link>
          )}
        </div>

        {/* Strike Execution Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-mono text-ash">
            {disabledReason ? (
              <span className="text-hp-text font-semibold">{disabledReason}</span>
            ) : roundExpired ? (
              <span className="text-solar font-semibold">
                Round timer expired: striking lazily settles the expired round and starts a fresh round.
              </span>
            ) : (
              <span>Signless execution debits {ticketCostNear.toFixed(2)} NEAR from your internal ledger.</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleAttack}
            disabled={strikeDisabled}
            className={`min-h-[44px] w-full sm:w-auto px-7 py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-colors shrink-0 ${
              strikeDisabled
                ? "bg-white/5 text-pewter border border-brass/20"
                : "bg-solar hover:bg-amber-400 text-oled"
            }`}
          >
            {isRaiding ? (
              <RefreshCw className="w-4 h-4 animate-spin text-oled shrink-0" aria-hidden="true" />
            ) : (
              <Swords className="w-4 h-4 text-oled shrink-0" aria-hidden="true" />
            )}
            <span>
              {isRaiding
                ? "Dispatching Strike..."
                : roundExpired
                ? "Settle & Strike Boss"
                : "Strike Boss"}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="text-xs font-mono text-hp-text bg-hp/15 border border-hp/40 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
};
