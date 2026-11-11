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
      icon: <Flame className="w-3.5 h-3.5" />,
      color: "text-solar",
      count: inventory.weapons[0],
      locked: inventory.starter_locked[0],
    },
    {
      index: 1,
      name: "Frost Spear",
      icon: <Snowflake className="w-3.5 h-3.5" />,
      color: "text-frost",
      count: inventory.weapons[1],
      locked: inventory.starter_locked[1],
    },
    {
      index: 2,
      name: "Void Scythe",
      icon: <Sparkles className="w-3.5 h-3.5" />,
      color: "text-void",
      count: inventory.weapons[2],
      locked: inventory.starter_locked[2],
    },
  ];

  const selectedWeapon = elements[weaponElement];
  const ownsAnyWeapon = selectedWeapon.count + selectedWeapon.locked > 0;

  // Projected damage per turn (deterministic midpoint mirror of the contract math).
  const projectedTurns = turnStances.map((st) =>
    calculateRaidDamage(weaponElement, st, resistances[weaponElement], floor, selectedWeapon.locked > 0)
  );
  const totalProjected = projectedTurns.reduce((sum, d) => sum + d.effectiveDamage, 0);
  const anyConfiscated = projectedTurns.some((d) => d.isConfiscated);

  const setTurnStance = (turn: 0 | 1 | 2, stance: TacticalStance) => {
    const next = [...turnStances] as [TacticalStance, TacticalStance, TacticalStance];
    next[turn] = stance;
    setTurnStances(next);
  };

  const handleAttack = async () => {
    if (isRaiding || disabled || !ownsAnyWeapon) return;
    setIsRaiding(true);
    setError(null);
    try {
      const stances = turnStances.map((s) => STANCE_IDS[s]) as [StanceIndex, StanceIndex, StanceIndex];
      await onAttack(floor, weaponElement, stances);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Attack failed — check ledger balance & ticket.");
    } finally {
      setIsRaiding(false);
    }
  };

  return (
    <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-solar" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            Raid Planner — 1 Weapon × 3 Stances
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Ticket{" "}
          <span className="text-frost font-bold font-mono-numbers">
            {FLOOR_TICKET_COST_NEAR[Math.min(floor, 3) - 1]?.toFixed(2) ?? "0.10"} NEAR
          </span>
        </span>
      </div>

      {/* Weapon choice (single element for the whole raid) */}
      <div>
        <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1.5">
          Weapon — one element, three strikes
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {elements.map((el) => {
            const isSelected = weaponElement === el.index;
            const owned = el.count + el.locked > 0;
            return (
              <button
                key={el.index}
                onClick={() => setWeaponElement(el.index)}
                disabled={!owned}
                className={`p-2 rounded-lg border text-left transition-all ${
                  isSelected
                    ? `${el.color} border-current bg-white/5`
                    : "border-white/10 text-slate-400 hover:text-white hover:border-white/25"
                } ${!owned ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  {el.icon}
                  <span className="truncate">{el.name}</span>
                </div>
                <div className="text-[10px] font-mono mt-0.5">
                  {el.count} free{el.locked > 0 ? ` · ${el.locked} locked` : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stance per turn */}
      <div>
        <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1.5">
          Stance × 3 turns
        </span>
        <div className="space-y-1.5">
          {([0, 1, 2] as const).map((turn) => {
            const projected = projectedTurns[turn];
            return (
              <div
                key={turn}
                className="p-2 rounded-lg bg-panel-dark border border-white/10 flex items-center justify-between gap-2"
              >
                <span className="text-[10px] font-mono uppercase text-slate-400 w-14">
                  Turn {turn + 1}
                </span>
                <div className="flex gap-1 flex-1 justify-end">
                  {STANCE_ORDER.map((st) => {
                    const profile = STANCE_PROFILES[st];
                    const isSelected = turnStances[turn] === st;
                    return (
                      <button
                        key={st}
                        onClick={() => setTurnStance(turn, st)}
                        className={`px-2 py-1 rounded font-mono text-[10px] flex items-center gap-1 transition-all ${
                          isSelected
                            ? "bg-white/10 text-white font-bold border border-white/25"
                            : "text-slate-400 hover:text-slate-200 border border-transparent"
                        }`}
                        title={profile.description}
                      >
                        {STANCE_ICON[st]}
                        <span>{profile.name}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="font-mono-numbers text-[11px] font-bold text-solar w-16 text-right">
                  ~{projected.effectiveDamage}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] font-mono text-slate-500 mt-1.5 px-1">
          {STANCE_PROFILES[turnStances[0]].description}
        </p>
      </div>

      {/* Summary + ATTACK */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5">
        <div className="text-xs font-mono">
          <span className="text-slate-400">Projected total: </span>
          <span className="font-bold text-white font-mono-numbers">~{totalProjected} DMG</span>
          {anyConfiscated && (
            <span className="text-hp text-[10px] flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3" /> Tribute risk ≥ 7000 bps — weapon may be seized.
            </span>
          )}
        </div>

        <button
          onClick={handleAttack}
          disabled={disabled || isRaiding || !ownsAnyWeapon}
          className={`w-full sm:w-auto px-8 py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
            disabled || isRaiding || !ownsAnyWeapon
              ? "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
              : "bg-solar hover:bg-solar-dark text-oled shadow-lg shadow-solar/20 active:scale-95"
          }`}
        >
          {isRaiding ? (
            <RefreshCw className="w-4 h-4 animate-spin text-oled" />
          ) : (
            <Swords className="w-4 h-4 text-oled" />
          )}
          <span>{isRaiding ? "Executing…" : "Attack"}</span>
        </button>
      </div>

      {error && (
        <div className="text-[11px] font-mono text-hp bg-hp/10 border border-hp/30 rounded px-2 py-1.5">
          {error}
        </div>
      )}
    </div>
  );
};
