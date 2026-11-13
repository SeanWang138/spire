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
      shortName: "Solar",
      element: "Solar (Amber)",
      elementColor: "text-solar",
      tabActive: "bg-solar/15 text-solar border-b border-solar",
      icon: Flame,
      req: { iron: CRAFT_ORE_COST, essence: CRAFT_ESSENCE_COST, essenceType: "essence:solar" as const },
    },
    "weapon:frost": {
      name: "Frost Spear",
      shortName: "Frost",
      element: "Frost (Cyan)",
      elementColor: "text-frost",
      tabActive: "bg-frost/15 text-frost border-b border-frost",
      icon: Snowflake,
      req: { iron: CRAFT_ORE_COST, essence: CRAFT_ESSENCE_COST, essenceType: "essence:frost" as const },
    },
    "weapon:void": {
      name: "Void Scythe",
      shortName: "Void",
      element: "Void (Amethyst)",
      elementColor: "text-void",
      tabActive: "bg-void/15 text-void border-b border-void",
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
    <section className="citadel-stage p-5 sm:p-6 flex flex-col justify-between gap-5 h-full">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hammer className="w-4 h-4 text-solar" aria-hidden="true" />
            <h2 className="font-serif text-lg font-bold tracking-wide text-parchment">
              Crafting Forge
            </h2>
          </div>

          <div
            className="inline-flex rounded-lg bg-[#07080D]/90 border border-white/[0.06] p-1 font-mono text-xs"
            role="tablist"
            aria-label="Crafting bench mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isReforgeMode}
              onClick={() => setIsReforgeMode(false)}
              className={`min-h-[38px] px-3 py-1 rounded-md transition-colors ${
                !isReforgeMode
                  ? "bg-panel-elevated text-parchment font-semibold"
                  : "text-ash hover:text-parchment"
              }`}
            >
              Forge
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isReforgeMode}
              onClick={() => setIsReforgeMode(true)}
              className={`min-h-[38px] px-3 py-1 rounded-md inline-flex items-center gap-1.5 transition-colors ${
                isReforgeMode
                  ? "bg-void/20 text-purple-200 font-semibold"
                  : "text-ash hover:text-parchment"
              }`}
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span>Altar Reforge</span>
            </button>
          </div>
        </div>

        {!isReforgeMode ? (
          <div className="space-y-4">
            {/* Weapon Selector Track (borderless tabs inside recessed track) */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#07080D]/90 border border-white/[0.06]">
              {Object.entries(recipes).map(([key, item]) => {
                const Icon = item.icon;
                const isSelected = selectedWeapon === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedWeapon(key as "weapon:solar" | "weapon:frost" | "weapon:void")}
                    aria-pressed={isSelected}
                    className={`min-h-[48px] flex items-center justify-center gap-2 py-2 px-2 rounded-md text-xs font-mono transition-colors ${
                      isSelected
                        ? `${item.tabActive} font-bold`
                        : "text-ash hover:text-parchment hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="sm:hidden">{item.shortName}</span>
                    <span className="hidden sm:inline">{item.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Flat Recessed Recipe Breakdown */}
            <div className="rounded-lg bg-[#07080D]/85 border border-white/[0.06] px-4 py-1 divide-y divide-white/[0.06]">
              <div className="py-3 flex items-center justify-between text-xs">
                <span className="font-semibold text-sm text-parchment">{selectedRecipe.name}</span>
                <span className={`text-xs font-mono font-semibold ${selectedRecipe.elementColor}`}>
                  {selectedRecipe.element}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs font-mono">
                <span className="text-ash">Iron Ore</span>
                <span className={`font-mono-numbers font-bold ${hasIron ? "text-emerald-400" : "text-hp"}`}>
                  {inventory.materials["ore:iron"]} / {selectedRecipe.req.iron} required
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs font-mono">
                <span className="text-ash">Elemental Essence</span>
                <span className={`font-mono-numbers font-bold ${hasEssence ? "text-emerald-400" : "text-hp"}`}>
                  {inventory.materials[selectedRecipe.req.essenceType]} / {selectedRecipe.req.essence} required
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-ash leading-relaxed">
              Burn non-starter weapons of an oversupplied (&ge;50% share) element into a rarer element.
            </p>

            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#07080D]/90 border border-white/[0.06]">
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
                    className={`min-h-[52px] px-3 py-2 rounded-md text-left transition-colors ${
                      isActive
                        ? "bg-void/20 text-parchment border-b border-void"
                        : "text-ash hover:text-parchment hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold">
                      <span>{r.label}</span>
                      {aiActive ? (
                        <LockOpen className="w-3.5 h-3.5 text-jackpot" aria-hidden="true" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-pewter" aria-hidden="true" />
                      )}
                    </div>
                    <div className={`text-xs font-mono mt-0.5 ${aiActive ? "text-jackpot" : "text-pewter"}`}>
                      {aiActive ? `Active · ${r.req}` : `Locked by AI · ${r.req}`}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <label htmlFor="reforge-burn-select" className="text-xs text-ash uppercase block mb-1.5">
                  Burn ({burnRequired} free req)
                </label>
                <select
                  id="reforge-burn-select"
                  value={reforgeBurn}
                  onChange={(e) => setReforgeBurn(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#07080D]/90 border border-white/15 text-parchment text-xs focus:outline-none focus:border-void"
                >
                  <option value={0}>Solar ({Math.max(0, inventory.weapons[0] - inventory.starter_locked[0])} free)</option>
                  <option value={1}>Frost ({Math.max(0, inventory.weapons[1] - inventory.starter_locked[1])} free)</option>
                  <option value={2}>Void ({Math.max(0, inventory.weapons[2] - inventory.starter_locked[2])} free)</option>
                </select>
              </div>
              <div>
                <label htmlFor="reforge-target-select" className="text-xs text-ash uppercase block mb-1.5">
                  Receive ({recipe === ALTAR_RECIPE_3_TO_2 ? 2 : 1})
                </label>
                <select
                  id="reforge-target-select"
                  value={reforgeTarget}
                  onChange={(e) => setReforgeTarget(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#07080D]/90 border border-white/15 text-parchment text-xs focus:outline-none focus:border-void"
                >
                  <option value={0}>Solar Blade</option>
                  <option value={1}>Frost Spear</option>
                  <option value={2}>Void Scythe</option>
                </select>
              </div>
            </div>

            {sourceSupplyPct !== null && !shareEligible && (
              <p className="pt-2 border-t border-solar/20 text-xs font-mono text-amber-300">
                Source element holds {sourceSupplyPct.toFixed(1)}% of realm supply (requires &ge;50% to burn).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {!isReforgeMode ? (
          <button
            type="button"
            onClick={handleCraft}
            disabled={!canCraft}
            className={`rpg-sheen min-h-[44px] w-full py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              canCraft
                ? "bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-oled border border-amber-300/60"
                : "bg-[#07080D]/80 text-pewter cursor-not-allowed border border-white/[0.08]"
            }`}
          >
            {isBusy ? (
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Hammer className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{isBusy ? "Forging Weapon..." : `Forge ${selectedRecipe.name}`}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReforge}
            disabled={!canReforge}
            className={`min-h-[44px] w-full py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
              canReforge
                ? "bg-void hover:bg-void-dark text-white"
                : "bg-[#07080D]/80 text-pewter cursor-not-allowed border border-white/[0.08]"
            }`}
          >
            {isBusy ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Transmute Weapons</span>
          </button>
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
    </section>
  );
};
