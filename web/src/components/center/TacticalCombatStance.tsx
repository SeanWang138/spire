"use client";

import React, { useState } from "react";
import { Swords, RefreshCw, Flame, Snowflake, Sparkles, Shield, Feather, ArrowUp, AlertTriangle } from "lucide-react";
import { TacticalStance, STANCE_PROFILES, STANCE_IDS, calculateRaidDamage } from "@/lib/simulation/pricing";
import { PlayerInventory, ElementIndex, StanceIndex } from "@/lib/contract";
import { FLOOR_TICKET_COST_NEAR } from "@/lib/spire/constants";

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
    <div className="rounded-xl bg-panel-card border border-white/10 elevation-panel p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-solar" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            Raid Planner (1 Weapon x 3 Stances)
          </h2>
        </div>
        <span className="text-xs font-mono text-slate-300">
          Ticket{" "}
          <span className="text-frost font-bold font-mono-numbers">
            {FLOOR_TICKET_COST_NEAR[Math.min(floor, 3) - 1]?.toFixed(2) ?? "0.10"} NEAR
          </span>
        </span>
      </div>

      {/* Weapon selector */}
      <div>
        <span className="text-xs font-mono uppercase text-slate-300 block mb-2">
          Armament: pick one element for all 3 strikes
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {elements.map((el) => {
            const isSelected = weaponElement === el.index;
            const owned = el.count + el.locked > 0;
            return (
              <button
                type="button"
                key={el.index}
                onClick={() => setWeaponElement(el.index)}
                disabled={!owned}
                aria-pressed={isSelected}
                className={`min-h-[48px] p-2.5 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? `${el.color} border-current bg-white/[0.06]`
                    : "border-white/10 text-slate-300 hover:text-white hover:border-white/25"
                } ${!owned ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  {el.icon}
                  <span className="truncate">{el.name}</span>
                </div>
                <div className="text-[11px] font-mono mt-0.5 text-slate-300">
                  {el.count} free{el.locked > 0 ? ` · ${el.locked} starter-locked` : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stance per turn (flat divider ledger rows inside panel) */}
      <div>
        <span className="text-xs font-mono uppercase text-slate-300 block mb-2">
          Stance Sequence (3 Turns)
        </span>
        <div className="rounded-lg bg-panel-dark divide-y divide-white/10">
          {([0, 1, 2] as const).map((turn) => {
            const projected = projectedTurns[turn];
            return (
              <div
                key={turn}
                className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-xs font-mono uppercase text-slate-300 font-semibold w-16 shrink-0">
                  Turn {turn + 1}
                </span>
                <div className="flex flex-wrap gap-1.5 flex-1 sm:justify-end">
                  {STANCE_ORDER.map((st) => {
                    const profile = STANCE_PROFILES[st];
                    const isSelected = turnStances[turn] === st;
                    return (
                      <button
                        type="button"
                        key={st}
                        onClick={() => setTurnStance(turn, st)}
                        aria-pressed={isSelected}
                        className={`min-h-[38px] px-2.5 py-1 rounded font-mono text-[11px] inline-flex items-center gap-1.5 transition-colors ${
                          isSelected
                            ? "bg-white/15 text-white font-bold border border-white/30"
                            : "text-slate-300 hover:text-white border border-transparent hover:bg-white/5"
                        }`}
                        title={profile.description}
                      >
                        {STANCE_ICON[st]}
                        <span>{profile.name}</span>
                      </button>
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

      {/* Summary + Attack CTA */}
      <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/10">
        <div className="text-xs font-mono space-y-1">
          <div>
            <span className="text-slate-300">Projected damage: </span>
            <span className="font-bold text-white font-mono-numbers">~{totalProjected} DMG</span>
          </div>
          {anyConfiscated && (
            <span className="text-hp text-[11px] flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Tribute risk at &ge;7000 bps: non-starter weapon will be seized!
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAttack}
          disabled={disabled || isRaiding || !ownsAnyWeapon}
          className={`min-h-[44px] w-full sm:w-auto px-8 py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${
            disabled || isRaiding || !ownsAnyWeapon
              ? "bg-white/5 text-slate-500 cursor-not-allowed border border-white/10"
              : "bg-solar hover:bg-solar-dark text-oled elevation-panel"
          }`}
        >
          {isRaiding ? (
            <RefreshCw className="w-4 h-4 animate-spin text-oled" aria-hidden="true" />
          ) : (
            <Swords className="w-4 h-4 text-oled" aria-hidden="true" />
          )}
          <span>{isRaiding ? "Executing..." : "Launch Attack"}</span>
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
