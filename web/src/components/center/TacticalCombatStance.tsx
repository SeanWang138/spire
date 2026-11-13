"use client";

import React, { useState } from "react";
import { Swords, RefreshCw, Flame, Snowflake, Sparkles, Shield, Feather, ArrowUp, AlertTriangle } from "lucide-react";
import { TacticalStance, STANCE_PROFILES, STANCE_IDS, calculateRaidDamage } from "@/lib/simulation/pricing";
import { PlayerInventory, ElementIndex, StanceIndex } from "@/lib/contract";
import { FLOOR_TICKET_COST_NEAR } from "@/lib/spire/constants";
import { SpireTooltip } from "@/components/ui/SpireUi";

const STANCE_ORDER: TacticalStance[] = ["aggressive", "feint", "pierce"];

const STANCE_ICON: Record<TacticalStance, React.ReactNode> = {
  aggressive: <ArrowUp className="w-3 h-3" />,
  feint: <Feather className="w-3 h-3" />,
  pierce: <Shield className="w-3 h-3" />,
};

interface TacticalCombatStanceProps {
  inventory: PlayerInventory;
  resistances: [number, number, number];
  floor: number;
  onAttack: (
    floor: number,
    weaponElement: ElementIndex,
    stances: [StanceIndex, StanceIndex, StanceIndex]
  ) => Promise<void>;
  disabled?: boolean;
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

  const elements: {
    index: ElementIndex;
    name: string;
    icon: React.ReactNode;
    color: string;
    count: number;
    locked: number;
  }[] = [
    {
      index: 0,
      name: "Solar Blade",
      icon: <Flame className="w-3.5 h-3.5" aria-hidden="true" />,
      color: "text-solar",
      count: inventory.weapons[0],
      locked: inventory.starter_locked[0],
    },
    {
      index: 1,
      name: "Frost Spear",
      icon: <Snowflake className="w-3.5 h-3.5" aria-hidden="true" />,
      color: "text-frost",
      count: inventory.weapons[1],
      locked: inventory.starter_locked[1],
    },
    {
      index: 2,
      name: "Void Scythe",
      icon: <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />,
      color: "text-void",
      count: inventory.weapons[2],
      locked: inventory.starter_locked[2],
    },
  ];

  const selectedWeapon = elements[weaponElement];
  const ownsAnyWeapon = selectedWeapon.count + selectedWeapon.locked > 0;

  const projectedTurns = turnStances.map((st) =>
    calculateRaidDamage(weaponElement, st, resistances[weaponElement], floor, selectedWeapon.locked > 0)
  );
  const totalProjected = projectedTurns.reduce((sum, d) => sum + d.effectiveDamage, 0);
  const anyConfiscated = projectedTurns.some((d) => d.isConfiscated);

  const setTurnStance = (turn: 0 | 1 | 2, stance: TacticalStance) => {
    const next = [...turnStances] as [TacticalStance, TacticalStance, TacticalStance];
    next[turn] = stance;
    setTurnStances(next);
    setActiveProfileKey(stance);
  };

  const handleAttack = async () => {
    if (isRaiding || disabled || !ownsAnyWeapon) return;
    setIsRaiding(true);
    setError(null);
    try {
      const stances = turnStances.map((s) => STANCE_IDS[s]) as [StanceIndex, StanceIndex, StanceIndex];
      await onAttack(floor, weaponElement, stances);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Attack failed: check ledger balance and ticket.");
    } finally {
      setIsRaiding(false);
    }
  };

  return (
    <div className="citadel-stage p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-solar" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
            Command Deck · 3-Turn Strike Chain
          </h2>
        </div>
        <span className="text-xs font-mono text-ash">
          Entry Ticket{" "}
          <span className="text-solar font-bold font-mono-numbers">
            {FLOOR_TICKET_COST_NEAR[Math.min(floor, 3) - 1]?.toFixed(2) ?? "0.10"} NEAR
          </span>
        </span>
      </div>

      {/* Weapon Socket Selector */}
      <div>
        <span className="text-xs font-mono uppercase text-ash block mb-2">
          1. Socket Elemental Armament
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {elements.map((el) => {
            const isSelected = weaponElement === el.index;
            const owned = el.count + el.locked > 0;
            const riskWarning = resistances[el.index] >= 7000 && el.count > 0 && el.locked === 0;
            const starterProtected = resistances[el.index] >= 7000 && el.locked > 0;
            return (
              <button
                type="button"
                key={el.index}
                onClick={() => setWeaponElement(el.index)}
                disabled={!owned}
                aria-pressed={isSelected}
                className={`rpg-sheen min-h-[58px] p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? `${el.color} border-current bg-white/[0.09]`
                    : "border-brass/20 bg-[#090A10]/90 text-ash hover:text-parchment hover:border-brass/45"
                } ${!owned ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center justify-between gap-1.5 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5 truncate">
                    {el.icon}
                    <span className="truncate">{el.name}</span>
                  </span>
                  {riskWarning && (
                    <AlertTriangle className="w-3.5 h-3.5 text-hp shrink-0" aria-label="Tribute hazard" />
                  )}
                </div>
                <div className="text-xs font-mono mt-1 text-ash flex items-center justify-between gap-1">
                  <span>
                    {el.count} free{el.locked > 0 ? ` · ${el.locked} starter` : ""}
                  </span>
                  {starterProtected && (
                    <span className="text-[11px] font-bold text-jackpot">Tribute Safe</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Linked 3-Turn Stance Chain */}
      <div>
        <span className="text-xs font-mono uppercase text-ash block mb-2">
          2. Configure Stance Sequence
        </span>
        <div className="rounded-lg bg-oled/90 border border-brass/20 divide-y divide-brass/15">
          {([0, 1, 2] as const).map((turn) => {
            const projected = projectedTurns[turn];
            return (
              <div
                key={turn}
                className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-xs font-mono uppercase text-slate-300 font-bold w-16 shrink-0">
                  Turn {turn + 1}
                </span>
                <div className="flex flex-wrap gap-1.5 flex-1 sm:justify-end">
                  {STANCE_ORDER.map((st) => {
                    const profile = STANCE_PROFILES[st];
                    const isSelected = turnStances[turn] === st;
                    return (
                      <SpireTooltip key={st} content={profile.description}>
                        <button
                          type="button"
                          onClick={() => setTurnStance(turn, st)}
                          aria-pressed={isSelected}
                          className={`min-h-[44px] px-3 py-1 rounded-md font-mono text-xs inline-flex items-center gap-1.5 transition-all ${
                            isSelected
                              ? "bg-solar/20 text-amber-200 font-bold border border-solar/50"
                              : "text-slate-300 hover:text-white border border-transparent hover:bg-white/5"
                          }`}
                        >
                          {STANCE_ICON[st]}
                          <span>{profile.name}</span>
                        </button>
                      </SpireTooltip>
                    );
                  })}
                </div>
                <span className="font-mono-numbers text-xs font-bold text-solar w-16 text-right shrink-0">
                  ~{projected.effectiveDamage}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs font-mono text-slate-300 mt-2 px-1">
          <strong className="text-white">{STANCE_PROFILES[activeProfileKey].name}:</strong>{" "}
          {STANCE_PROFILES[activeProfileKey].description}
        </p>
      </div>

      {/* Execute Primary Strike */}
      <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/10">
        <div className="text-xs font-mono space-y-1">
          <div>
            <span className="text-slate-300">Total Projected Strike: </span>
            <span className="font-bold text-white font-mono-numbers">~{totalProjected} DMG</span>
          </div>
          {anyConfiscated && (
            <span className="text-hp text-xs flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Tribute risk at &ge;7000 bps: unlocked weapon will be seized!
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAttack}
          disabled={disabled || isRaiding || !ownsAnyWeapon}
          className={`min-h-[44px] w-full sm:w-auto px-7 py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${
            disabled || isRaiding || !ownsAnyWeapon
              ? "bg-white/5 text-slate-500 cursor-not-allowed border border-white/10"
              : "bg-solar hover:bg-solar-dark text-oled"
          }`}
        >
          {isRaiding ? (
            <RefreshCw className="w-4 h-4 animate-spin text-oled" aria-hidden="true" />
          ) : (
            <Swords className="w-4 h-4 text-oled" aria-hidden="true" />
          )}
          <span>{isRaiding ? "Dispatched..." : "Launch Signless Strike"}</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="text-xs font-mono text-hp bg-hp/10 border border-hp/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
};
