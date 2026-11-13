"use client";

import React, { useState } from "react";
import { Hammer, Flame, Snowflake, Sparkles, RefreshCw, Check, Lock, LockOpen } from "lucide-react";
import { PlayerInventory } from "@/lib/contract";
import {
  ALTAR_RECIPE_2_TO_1,
  ALTAR_RECIPE_3_TO_2,
  CRAFT_ORE_COST,
  CRAFT_ESSENCE_COST,
} from "@/lib/spire/constants";

interface CraftingForgeProps {
  inventory: PlayerInventory;
  supplies?: [number, number, number];
  onCraft: (weaponType: "weapon:solar" | "weapon:frost" | "weapon:void") => Promise<void>;
  onReforge: (
    recipe: typeof ALTAR_RECIPE_2_TO_1 | typeof ALTAR_RECIPE_3_TO_2,
    burnElement: number,
    receiveElement: number
  ) => Promise<void>;
  activeRecipe?: string;
  disabled?: boolean;
}

export const CraftingForge: React.FC<CraftingForgeProps> = ({
  inventory,
  supplies,
  onCraft,
  onReforge,
  activeRecipe = "",
  disabled = false,
}) => {
  const [selectedWeapon, setSelectedWeapon] = useState<"weapon:solar" | "weapon:frost" | "weapon:void">("weapon:solar");
  const [isReforgeMode, setIsReforgeMode] = useState(false);
  const [recipe, setRecipe] = useState<typeof ALTAR_RECIPE_2_TO_1 | typeof ALTAR_RECIPE_3_TO_2>(ALTAR_RECIPE_2_TO_1);
  const [reforgeBurn, setReforgeBurn] = useState<number>(0);
  const [reforgeTarget, setReforgeTarget] = useState<number>(1);
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const recipes = {
    "weapon:solar": {
      name: "Solar Blade",
      element: "Solar (Amber)",
      elementColor: "text-solar",
      bgBorder: "border-solar/40 bg-solar/5",
      icon: Flame,
      req: { iron: CRAFT_ORE_COST, essence: CRAFT_ESSENCE_COST, essenceType: "essence:solar" as const },
    },
    "weapon:frost": {
      name: "Frost Spear",
      element: "Frost (Cyan)",
      elementColor: "text-frost",
      bgBorder: "border-frost/40 bg-frost/5",
      icon: Snowflake,
      req: { iron: CRAFT_ORE_COST, essence: CRAFT_ESSENCE_COST, essenceType: "essence:frost" as const },
    },
    "weapon:void": {
      name: "Void Scythe",
      element: "Void (Purple)",
      elementColor: "text-void",
      bgBorder: "border-void/40 bg-void/5",
      icon: Sparkles,
      req: { iron: CRAFT_ORE_COST, essence: CRAFT_ESSENCE_COST, essenceType: "essence:void" as const },
    },
  };

  const selectedRecipe = recipes[selectedWeapon];
  const hasIron = inventory.materials["ore:iron"] >= selectedRecipe.req.iron;
  const hasEssence = inventory.materials[selectedRecipe.req.essenceType] >= selectedRecipe.req.essence;
  const canCraft = hasIron && hasEssence && !isBusy && !disabled;

  const handleCraft = async () => {
    if (!canCraft) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      await onCraft(selectedWeapon);
      setFeedback(`Forged 1x ${selectedRecipe.name}`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Crafting failed");
    } finally {
      setIsBusy(false);
    }
  };

  const burnRequired = recipe === ALTAR_RECIPE_2_TO_1 ? 2 : 3;
  const recipeActive =
    recipe === ALTAR_RECIPE_2_TO_1
      ? activeRecipe === "" || activeRecipe === ALTAR_RECIPE_2_TO_1
      : activeRecipe === ALTAR_RECIPE_3_TO_2;
  const burnableCount = Math.max(
    0,
    (inventory.weapons[reforgeBurn] || 0) - (inventory.starter_locked[reforgeBurn] || 0)
  );
  const totalSupply = supplies ? supplies[0] + supplies[1] + supplies[2] : 0;
  const sourceSupplyPct = supplies && totalSupply > 0 ? (supplies[reforgeBurn] / totalSupply) * 100 : null;
  const shareEligible = sourceSupplyPct === null || sourceSupplyPct >= 50;

  const canReforge =
    recipeActive &&
    shareEligible &&
    burnableCount >= burnRequired &&
    reforgeBurn !== reforgeTarget &&
    !isBusy &&
    !disabled;

  const handleReforge = async () => {
    if (!canReforge) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      await onReforge(recipe, reforgeBurn, reforgeTarget);
      setFeedback("Reforge transmutation complete");
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Reforge failed");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="citadel-stage p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Hammer className="w-4 h-4 text-solar" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
            Crafting Forge
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setIsReforgeMode(!isReforgeMode)}
          className={`min-h-[38px] flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-md border transition-colors ${
            isReforgeMode
              ? "bg-void/20 border-void/50 text-purple-200 font-bold"
              : "bg-panel-dark border-brass/25 text-ash hover:text-parchment"
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isReforgeMode ? "Switch to Forge" : "Altar Reforge"}</span>
        </button>
      </div>

      {!isReforgeMode ? (
        <div className="space-y-3">
          {/* Weapon Selector Tabs (segmented strip, no card-in-card borders) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-panel-dark">
            {Object.entries(recipes).map(([key, item]) => {
              const Icon = item.icon;
              const isSelected = selectedWeapon === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedWeapon(key as "weapon:solar" | "weapon:frost" | "weapon:void")}
                  aria-pressed={isSelected}
                  className={`min-h-[54px] flex flex-col items-center justify-center py-2 px-1 rounded-md text-xs font-mono transition-colors border ${
                    isSelected
                      ? `${item.bgBorder} ${item.elementColor} font-bold`
                      : "border-transparent text-ash hover:text-parchment hover:bg-panel-elevated/60"
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" aria-hidden="true" />
                  <span className="truncate text-[11px]">{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* Recipe Breakdown */}
          <div className={`p-3.5 rounded-lg border ${selectedRecipe.bgBorder}`}>
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="font-bold text-parchment">{selectedRecipe.name}</span>
              <span className={`text-[11px] font-mono font-semibold ${selectedRecipe.elementColor}`}>
                {selectedRecipe.element}
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-ash">Iron Ore</span>
                <span className={`font-mono-numbers font-bold ${hasIron ? "text-emerald-400" : "text-hp"}`}>
                  {inventory.materials["ore:iron"]} / {selectedRecipe.req.iron} required
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ash">Elemental Essence</span>
                <span className={`font-mono-numbers font-bold ${hasEssence ? "text-emerald-400" : "text-hp"}`}>
                  {inventory.materials[selectedRecipe.req.essenceType]} / {selectedRecipe.req.essence} required
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCraft}
            disabled={!canCraft}
            className={`rpg-sheen min-h-[44px] w-full py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              canCraft
                ? "bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-oled border border-amber-300/60"
                : "bg-panel-dark text-pewter cursor-not-allowed border border-brass/15"
            }`}
          >
            {isBusy ? (
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Hammer className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{isBusy ? "Forging Weapon..." : `Forge ${selectedRecipe.name}`}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-ash font-mono leading-relaxed">
            Burn non-starter weapons of an oversupplied (&ge;50% share) element into a rarer element.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {([
              { id: ALTAR_RECIPE_2_TO_1, label: "Reforge 2 to 1", req: "burn 2" },
              { id: ALTAR_RECIPE_3_TO_2, label: "Reforge 3 to 2", req: "burn 3" },
            ] as { id: typeof ALTAR_RECIPE_2_TO_1 | typeof ALTAR_RECIPE_3_TO_2; label: string; req: string }[]).map((r) => {
              const isActive = recipe === r.id;
              const aiActive =
                r.id === ALTAR_RECIPE_2_TO_1
                  ? activeRecipe === "" || activeRecipe === ALTAR_RECIPE_2_TO_1
                  : activeRecipe === ALTAR_RECIPE_3_TO_2;
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setRecipe(r.id)}
                  aria-pressed={isActive}
                  className={`min-h-[52px] p-2.5 rounded-lg border text-left transition-colors ${
                    isActive
                      ? "border-void/60 bg-void/15"
                      : "border-white/10 bg-panel-dark hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-white">
                    <span>{r.label}</span>
                    {aiActive ? (
                      <LockOpen className="w-3.5 h-3.5 text-jackpot" aria-hidden="true" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    )}
                  </div>
                  <div className={`text-[11px] font-mono mt-0.5 ${aiActive ? "text-jackpot" : "text-slate-400"}`}>
                    {aiActive ? `Active · ${r.req}` : `Locked by AI · ${r.req}`}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <label htmlFor="reforge-burn-select" className="text-[11px] text-slate-300 uppercase block mb-1">
                Burn ({burnRequired} free req)
              </label>
              <select
                id="reforge-burn-select"
                value={reforgeBurn}
                onChange={(e) => setReforgeBurn(Number(e.target.value))}
                className="w-full min-h-[44px] p-2 rounded-lg bg-panel-dark border border-white/15 text-white text-xs focus:outline-none focus:border-void"
              >
                <option value={0}>Solar ({Math.max(0, inventory.weapons[0] - inventory.starter_locked[0])} free)</option>
                <option value={1}>Frost ({Math.max(0, inventory.weapons[1] - inventory.starter_locked[1])} free)</option>
                <option value={2}>Void ({Math.max(0, inventory.weapons[2] - inventory.starter_locked[2])} free)</option>
              </select>
            </div>
            <div>
              <label htmlFor="reforge-target-select" className="text-[11px] text-slate-300 uppercase block mb-1">
                Receive ({recipe === ALTAR_RECIPE_3_TO_2 ? 2 : 1})
              </label>
              <select
                id="reforge-target-select"
                value={reforgeTarget}
                onChange={(e) => setReforgeTarget(Number(e.target.value))}
                className="w-full min-h-[44px] p-2 rounded-lg bg-panel-dark border border-white/15 text-white text-xs focus:outline-none focus:border-void"
              >
                <option value={0}>Solar Blade</option>
                <option value={1}>Frost Spear</option>
                <option value={2}>Void Scythe</option>
              </select>
            </div>
          </div>

          {sourceSupplyPct !== null && !shareEligible && (
            <p className="text-[11px] font-mono text-amber-300 bg-solar/10 border border-solar/30 rounded px-2.5 py-1.5">
              Source element holds {sourceSupplyPct.toFixed(1)}% of realm supply (requires &ge;50% to burn).
            </p>
          )}

          <button
            type="button"
            onClick={handleReforge}
            disabled={!canReforge}
            className={`min-h-[44px] w-full py-2.5 px-3 rounded-lg font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
              canReforge
                ? "bg-void hover:bg-void-dark text-white"
                : "bg-white/5 text-slate-500 cursor-not-allowed border border-white/10"
            }`}
          >
            {isBusy ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Transmute Weapons</span>
          </button>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="text-xs font-mono text-center text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg py-1.5 px-2 flex items-center justify-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
};
