"use client";

import React, { useState } from "react";
import { Hammer, Flame, Snowflake, Sparkles, RefreshCw, Check, Lock, LockOpen } from "lucide-react";
import type { PlayerInventory } from "@/lib/contract";
import { getFreeWeaponCounts } from "@/lib/combat-rules";
import {
  ALTAR_RECIPE_2_TO_1,
  ALTAR_RECIPE_3_TO_2,
  CRAFT_ORE_COST,
  CRAFT_ESSENCE_COST,
  REFORGE_SHARE_MIN_BPS,
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
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const recipes = {
    "weapon:solar": {
      name: "Solar Blade",
      shortName: "Solar",
      element: "Solar (Amber)",
      elementColor: "text-solar",
      tabActive: "bg-solar/15 text-solar border-b-2 border-solar",
      icon: Flame,
      req: { iron: CRAFT_ORE_COST, essence: CRAFT_ESSENCE_COST, essenceType: "essence:solar" as const },
    },
    "weapon:frost": {
      name: "Frost Spear",
      shortName: "Frost",
      element: "Frost (Cyan)",
      elementColor: "text-frost",
      tabActive: "bg-frost/15 text-frost border-b-2 border-frost",
      icon: Snowflake,
      req: { iron: CRAFT_ORE_COST, essence: CRAFT_ESSENCE_COST, essenceType: "essence:frost" as const },
    },
    "weapon:void": {
      name: "Void Scythe",
      shortName: "Void",
      element: "Void (Amethyst)",
      elementColor: "text-void-text",
      tabActive: "bg-void/20 text-void-text border-b-2 border-void",
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
      setFeedback({ text: `Forged 1x ${selectedRecipe.name}` });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: unknown) {
      setFeedback({ text: err instanceof Error ? err.message : "Crafting failed", isError: true });
    } finally {
      setIsBusy(false);
    }
  };

  const freeCounts = getFreeWeaponCounts(inventory.weapons, inventory.starter_locked);
  const burnableCount = freeCounts[reforgeBurn] ?? 0;

  const totalSupply = supplies ? supplies[0] + supplies[1] + supplies[2] : 0;
  const supplyShareBps =
    supplies && totalSupply > 0 ? Math.floor((supplies[reforgeBurn] * 10000) / totalSupply) : 0;
  const sourceSupplyPct = supplies && totalSupply > 0 ? (supplies[reforgeBurn] / totalSupply) * 100 : null;

  // Default 2->1 is ALWAYS enabled on-chain whenever player has >=2 non-starter weapons of a different element.
  // Bonus 3->2 requires AI activation (altar_recipe_id === "reforge_3_to_2") AND >= 5000 bps supply share.
  const bonus3to2AiActive = activeRecipe === ALTAR_RECIPE_3_TO_2;
  const bonus3to2ShareMet = supplyShareBps >= REFORGE_SHARE_MIN_BPS;
  const bonus3to2Unlocked = bonus3to2AiActive && bonus3to2ShareMet;

  const isBonusRecipe = recipe === ALTAR_RECIPE_3_TO_2;
  const burnRequired = isBonusRecipe ? 3 : 2;
  const recipeEligible = isBonusRecipe ? bonus3to2Unlocked : true;

  const canReforge =
    recipeEligible &&
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
      setFeedback({ text: "Reforge transmutation complete" });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: unknown) {
      setFeedback({ text: err instanceof Error ? err.message : "Reforge failed", isError: true });
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
            className="inline-flex gap-2 rounded-lg bg-panel-dark p-1 font-mono text-xs"
            role="tablist"
            aria-label="Crafting bench mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isReforgeMode}
              onClick={() => {
                setIsReforgeMode(false);
                setFeedback(null);
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
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
              onClick={() => {
                setIsReforgeMode(true);
                setFeedback(null);
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-md inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
                isReforgeMode
                  ? "bg-void/25 text-void-text font-semibold"
                  : "text-ash hover:text-parchment"
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Altar Reforge</span>
            </button>
          </div>
        </div>

        {!isReforgeMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 p-1 rounded-lg bg-panel-dark">
              {Object.entries(recipes).map(([key, item]) => {
                const Icon = item.icon;
                const isSelected = selectedWeapon === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedWeapon(key as "weapon:solar" | "weapon:frost" | "weapon:void")}
                    aria-pressed={isSelected}
                    className={`min-h-[48px] flex items-center justify-center gap-2 py-2 px-2 rounded-md text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
                      isSelected
                        ? `${item.tabActive} font-bold`
                        : "text-ash hover:text-parchment hover:bg-panel-elevated/60"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="sm:hidden">{item.shortName}</span>
                    <span className="hidden sm:inline">{item.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg bg-panel-dark px-4 py-1 divide-y divide-brass/15">
              <div className="py-3 flex items-center justify-between text-xs">
                <span className="font-semibold text-sm text-parchment">{selectedRecipe.name}</span>
                <span className={`text-xs font-mono font-semibold ${selectedRecipe.elementColor}`}>
                  {selectedRecipe.element}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs font-mono">
                <span className="text-ash">Iron Ore</span>
                <span className={`font-mono-numbers font-bold ${hasIron ? "text-jackpot" : "text-hp-text"}`}>
                  {inventory.materials["ore:iron"]} / {selectedRecipe.req.iron} required
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs font-mono">
                <span className="text-ash">Elemental Essence</span>
                <span className={`font-mono-numbers font-bold ${hasEssence ? "text-jackpot" : "text-hp-text"}`}>
                  {inventory.materials[selectedRecipe.req.essenceType]} / {selectedRecipe.req.essence} required
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-ash leading-relaxed">
              Burns non-starter weapons (Starter Locked blades are safe). Default 2 to 1 transmutation is always open; Bonus 3 to 2 unlocks only when AI sets{" "}
              <code className="font-mono text-parchment">reforge_3_to_2</code> and the burned element holds &ge;50% realm supply.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-lg bg-panel-dark">
              {([
                {
                  id: ALTAR_RECIPE_2_TO_1,
                  label: "Reforge 2 to 1",
                  unlocked: true,
                  statusText: "Always Open · burn 2",
                },
                {
                  id: ALTAR_RECIPE_3_TO_2,
                  label: "Reforge 3 to 2",
                  unlocked: bonus3to2Unlocked,
                  statusText: bonus3to2Unlocked
                    ? "AI + >=50% Active · burn 3"
                    : !bonus3to2AiActive
                    ? "Needs AI activation · burn 3"
                    : "Needs >=50% supply · burn 3",
                },
              ] as const).map((r) => {
                const isActive = recipe === r.id;
                return (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => setRecipe(r.id)}
                    aria-pressed={isActive}
                    className={`min-h-[52px] px-3 py-2 rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
                      isActive
                        ? "bg-void/25 text-parchment border-b-2 border-void"
                        : "text-ash hover:text-parchment hover:bg-panel-elevated/60"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold">
                      <span>{r.label}</span>
                      {r.unlocked ? (
                        <LockOpen className="w-3.5 h-3.5 text-jackpot shrink-0" aria-hidden="true" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-pewter shrink-0" aria-hidden="true" />
                      )}
                    </div>
                    <div className={`text-xs font-mono mt-0.5 ${r.unlocked ? "text-jackpot" : "text-pewter"}`}>
                      {r.statusText}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <label htmlFor="reforge-burn-select" className="text-xs text-ash uppercase block mb-1.5">
                  Burn ({burnRequired} free crafted req)
                </label>
                <select
                  id="reforge-burn-select"
                  value={reforgeBurn}
                  onChange={(e) => {
                    const nextBurn = Number(e.target.value);
                    setReforgeBurn(nextBurn);
                    if (nextBurn === reforgeTarget) {
                      setReforgeTarget((nextBurn + 1) % 3);
                    }
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-brass/25 text-parchment text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                >
                  <option value={0}>Solar ({freeCounts[0]} free crafted)</option>
                  <option value={1}>Frost ({freeCounts[1]} free crafted)</option>
                  <option value={2}>Void ({freeCounts[2]} free crafted)</option>
                </select>
              </div>
              <div>
                <label htmlFor="reforge-target-select" className="text-xs text-ash uppercase block mb-1.5">
                  Receive ({isBonusRecipe ? 2 : 1})
                </label>
                <select
                  id="reforge-target-select"
                  value={reforgeTarget}
                  onChange={(e) => setReforgeTarget(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-brass/25 text-parchment text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                >
                  <option value={0}>Solar Blade</option>
                  <option value={1}>Frost Spear</option>
                  <option value={2}>Void Scythe</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-brass/15 text-xs font-mono space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-ash">
                <span>Free Crafted available:</span>
                <span className={`font-mono-numbers font-bold ${burnableCount >= burnRequired ? "text-jackpot" : "text-hp-text"}`}>
                  {burnableCount} / {burnRequired} required
                </span>
              </div>
              {reforgeBurn === reforgeTarget && (
                <p className="text-hp-text">Select a different receive element to transmute.</p>
              )}
              {!isBonusRecipe && bonus3to2Unlocked && (
                <p className="text-solar">
                  On-chain Bonus 3 to 2 is currently active for this &ge;50% supply element (3 free weapons will burn for 2 output).
                </p>
              )}
              {isBonusRecipe && !bonus3to2Unlocked && sourceSupplyPct !== null && (
                <p className="text-solar">
                  Bonus 3 to 2 locked: source element holds {sourceSupplyPct.toFixed(1)}% supply (requires &ge;50% and AI activation). Switch to Reforge 2 to 1 to transmute immediately.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {!isReforgeMode ? (
          <button
            type="button"
            onClick={handleCraft}
            disabled={!canCraft}
            className={`rpg-sheen min-h-[44px] w-full py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
              canCraft
                ? "bg-solar hover:bg-solar-dark text-oled border border-solar"
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
        ) : (
          <button
            type="button"
            onClick={handleReforge}
            disabled={!canReforge}
            className={`min-h-[44px] w-full py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
              canReforge
                ? "bg-void hover:bg-void-dark text-parchment border border-void/60"
                : "bg-panel-dark text-pewter cursor-not-allowed border border-brass/15"
            }`}
          >
            {isBusy ? (
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {isBusy
                ? "Transmuting..."
                : `Transmute ${burnRequired} to ${isBonusRecipe ? 2 : 1}`}
            </span>
          </button>
        )}

        {feedback && (
          <div
            role={feedback.isError ? "alert" : "status"}
            aria-live="polite"
            className={`text-xs font-mono text-center rounded-lg py-2 px-3 flex items-center justify-center gap-1.5 border ${
              feedback.isError
                ? "text-hp-text bg-hp/15 border-hp/40"
                : "text-jackpot bg-jackpot/10 border-jackpot/30"
            }`}
          >
            {!feedback.isError && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>
    </section>
  );
};
