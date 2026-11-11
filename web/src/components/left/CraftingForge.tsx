"use client";

import React, { useState } from "react";
import { Hammer, Flame, Snowflake, Sparkles, RefreshCw, Check, Lock, LockOpen } from "lucide-react";
import { PlayerInventory } from "@/lib/contract";
import { ALTAR_RECIPE_2_TO_1, ALTAR_RECIPE_3_TO_2 } from "@/lib/spire/constants";

interface CraftingForgeProps {
  inventory: PlayerInventory;
  onCraft: (weaponType: "weapon:solar" | "weapon:frost" | "weapon:void") => Promise<void>;
  /** recipe: which altar recipe is active (from the Boss Brain's signed proposal). */
  onReforge: (
    recipe: typeof ALTAR_RECIPE_2_TO_1 | typeof ALTAR_RECIPE_3_TO_2,
    burnElement: number,
    receiveElement: number
  ) => Promise<void>;
  /** Altar recipe id currently activated by the AI (empty = none yet). */
  activeRecipe?: string;
  disabled?: boolean;
}

export const CraftingForge: React.FC<CraftingForgeProps> = ({
  inventory,
  onCraft,
  onReforge,
  activeRecipe = "",
  disabled = false,
}) => {
  const [selectedWeapon, setSelectedWeapon] = useState<"weapon:solar" | "weapon:frost" | "weapon:void">("weapon:solar");
  const [isReforgeMode, setIsReforgeMode] = useState(false);
  const [recipe, setRecipe] = useState<typeof ALTAR_RECIPE_2_TO_1 | typeof ALTAR_RECIPE_3_TO_2>(ALTAR_RECIPE_2_TO_1);
  const [reforgeBurn, setReforgeBurn] = useState<number>(0); // Solar
  const [reforgeTarget, setReforgeTarget] = useState<number>(1); // Frost
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const recipes = {
    "weapon:solar": {
      name: "Solar Blade",
      element: "Solar (Amber)",
      elementColor: "text-solar",
      bgBorder: "border-solar/40 bg-solar/5",
      glowColor: "glow-solar",
      icon: Flame,
      req: { iron: 1, essence: 2, essenceType: "essence:solar" as const },
    },
    "weapon:frost": {
      name: "Frost Spear",
      element: "Frost (Cyan)",
      elementColor: "text-frost",
      bgBorder: "border-frost/40 bg-frost/5",
      glowColor: "glow-frost",
      icon: Snowflake,
      req: { iron: 1, essence: 2, essenceType: "essence:frost" as const },
    },
    "weapon:void": {
      name: "Void Scythe",
      element: "Void (Purple)",
      elementColor: "text-void",
      bgBorder: "border-void/40 bg-void/5",
      glowColor: "glow-void",
      icon: Sparkles,
      req: { iron: 1, essence: 2, essenceType: "essence:void" as const },
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
      setFeedback(`Forged 1x ${selectedRecipe.name}!`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Crafting failed");
    } finally {
      setIsBusy(false);
    }
  };

  const weaponKeys: ("weapon:solar" | "weapon:frost" | "weapon:void")[] = [
    "weapon:solar",
    "weapon:frost",
    "weapon:void",
  ];

  // Recipe gating: 2→1 is the default altar plan; 3→2 must be activated by the AI.
  const burnRequired = recipe === ALTAR_RECIPE_2_TO_1 ? 2 : 3;
  const recipeActive =
    recipe === ALTAR_RECIPE_2_TO_1
      ? activeRecipe === "" || activeRecipe === ALTAR_RECIPE_2_TO_1
      : activeRecipe === ALTAR_RECIPE_3_TO_2;
  const burnCount = inventory.weapons[reforgeBurn] || 0;
  const canReforge =
    recipeActive &&
    burnCount >= burnRequired &&
    reforgeBurn !== reforgeTarget &&
    !isBusy &&
    !disabled;

  const handleReforge = async () => {
    if (!canReforge) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      await onReforge(recipe, reforgeBurn, reforgeTarget);
      setFeedback("Reforge transmutation complete!");
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Reforge failed");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Hammer className="w-4 h-4 text-solar" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            Crafting Forge
          </h2>
        </div>
        <button
          onClick={() => setIsReforgeMode(!isReforgeMode)}
          className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
            isReforgeMode
              ? "bg-void/20 border-void/50 text-void font-bold"
              : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          <RefreshCw className="w-3 h-3" />
          <span>{isReforgeMode ? "Forge Mode" : "Reforge"}</span>
        </button>
      </div>

      {!isReforgeMode ? (
        /* Crafting Mode */
        <div className="space-y-3">
          {/* Weapon Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-panel-dark border border-white/5">
            {Object.entries(recipes).map(([key, item]) => {
              const Icon = item.icon;
              const isSelected = selectedWeapon === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedWeapon(key as "weapon:solar" | "weapon:frost" | "weapon:void")}
                  className={`flex flex-col items-center py-2 px-1 rounded-md text-xs font-mono transition-all ${
                    isSelected
                      ? `${item.bgBorder} ${item.elementColor} font-bold shadow-md`
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <span className="truncate text-[11px]">{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* Recipe Details */}
          <div className={`p-3 rounded-lg border ${selectedRecipe.bgBorder} transition-all`}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-white">{selectedRecipe.name}</span>
              <span className={`text-[11px] font-mono ${selectedRecipe.elementColor}`}>
                {selectedRecipe.element}
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Iron Ore:</span>
                <span className={hasIron ? "text-emerald-400" : "text-hp"}>
                  {inventory.materials["ore:iron"]} / {selectedRecipe.req.iron} req
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Elemental Essence:</span>
                <span className={hasEssence ? "text-emerald-400" : "text-hp"}>
                  {inventory.materials[selectedRecipe.req.essenceType]} / {selectedRecipe.req.essence} req
                </span>
              </div>
            </div>
          </div>

          {/* Craft Button */}
          <button
            onClick={handleCraft}
            disabled={!canCraft}
            className={`w-full py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              canCraft
                ? "bg-gradient-to-r from-solar/80 to-solar hover:from-solar hover:to-solar/90 text-oled shadow-lg shadow-solar/20 active:scale-[0.99]"
                : "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
            }`}
          >
            {isBusy ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Hammer className="w-4 h-4" />
            )}
            <span>{isBusy ? "Forging Weapon..." : `Forge ${selectedRecipe.name}`}</span>
          </button>
        </div>
      ) : (
        /* Reforge Chamber */
        <div className="space-y-3 p-3 rounded-lg bg-panel-dark border border-void/30">
          <div className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-void" />
            <span>Altar Reforge — burn weapons of one element, receive another</span>
          </div>

          {/* Recipe selector with AI activation state */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: ALTAR_RECIPE_2_TO_1, label: "Reforge 2 → 1", req: "burn 2" },
              { id: ALTAR_RECIPE_3_TO_2, label: "Reforge 3 → 2", req: "burn 3" },
            ] as { id: typeof ALTAR_RECIPE_2_TO_1 | typeof ALTAR_RECIPE_3_TO_2; label: string; req: string }[]).map((r) => {
              const isActive = recipe === r.id;
              const aiActive =
                r.id === ALTAR_RECIPE_2_TO_1
                  ? activeRecipe === "" || activeRecipe === ALTAR_RECIPE_2_TO_1
                  : activeRecipe === ALTAR_RECIPE_3_TO_2;
              return (
                <button
                  key={r.id}
                  onClick={() => setRecipe(r.id)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    isActive
                      ? "border-void/50 bg-void/10"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-white">
                    <span>{r.label}</span>
                    {aiActive ? (
                      <LockOpen className="w-3.5 h-3.5 text-jackpot" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${aiActive ? "text-jackpot" : "text-slate-500"}`}>
                    {aiActive ? `AI recipe active · ${r.req}` : `locked — needs AI activation · ${r.req}`}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <label className="text-[10px] text-slate-400 uppercase">
                  Burn ({burnRequired} required)
                </label>
              <select
                value={reforgeBurn}
                onChange={(e) => setReforgeBurn(Number(e.target.value))}
                className="w-full mt-1 p-1.5 rounded bg-panel-card border border-white/10 text-white text-xs focus:outline-none focus:border-void"
              >
                <option value={0}>Solar Blade ({inventory.weapons[0]})</option>
                <option value={1}>Frost Spear ({inventory.weapons[1]})</option>
                <option value={2}>Void Scythe ({inventory.weapons[2]})</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase">
                  Receive ({recipe === ALTAR_RECIPE_3_TO_2 ? 2 : 1})
                </label>
              <select
                value={reforgeTarget}
                onChange={(e) => setReforgeTarget(Number(e.target.value))}
                className="w-full mt-1 p-1.5 rounded bg-panel-card border border-white/10 text-white text-xs focus:outline-none focus:border-void"
              >
                <option value={0}>Solar Blade</option>
                <option value={1}>Frost Spear</option>
                <option value={2}>Void Scythe</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleReforge}
            disabled={!canReforge}
            className={`w-full py-2 px-3 rounded-lg font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              canReforge
                ? "bg-void hover:bg-void/90 text-white shadow-lg shadow-void/20"
                : "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
            }`}
          >
            {isBusy ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Transmute Weapons</span>
          </button>
        </div>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div className="mt-2 text-xs font-mono text-center text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 rounded py-1 flex items-center justify-center gap-1.5 animate-fadeIn">
          <Check className="w-3.5 h-3.5" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
};
