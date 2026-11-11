"use client";

import React, { useState } from "react";
import { CraftingForge } from "@/components/left/CraftingForge";
import { GatheringAltar } from "@/components/left/GatheringAltar";
import { LiveInventory } from "@/components/left/LiveInventory";
import { ServerSupplyBar } from "@/components/left/ServerSupplyBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { emptyInventory } from "@/lib/contract";
import type { ItemId, ElementIndex } from "@/lib/contract";
import {
  get_inventory,
  get_supply,
  get_ai_state,
  craft_weapon,
  reforge,
  gather,
  claim_starter,
} from "@/lib/contract";
import { useContractView, useSessionAccount } from "@/lib/spire/hooks";
import { ALTAR_RECIPE_2_TO_1, ALTAR_RECIPE_3_TO_2 } from "@/lib/spire/constants";
import { CheckCircle2, AlertCircle } from "lucide-react";

const WEAPON_ELEMENT: Record<Extract<ItemId, "weapon:solar" | "weapon:frost" | "weapon:void">, ElementIndex> = {
  "weapon:solar": 0,
  "weapon:frost": 1,
  "weapon:void": 2,
};

export default function ForgePage() {
  const session = useSessionAccount();
  const accountId = session?.accountId ?? "";

  const inventory = useContractView(
    async () => (accountId ? await get_inventory(accountId) : null),
    [accountId]
  );
  const supply = useContractView(get_supply, []);
  const aiState = useContractView(async () => await get_ai_state(1), []);

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showStatus = (text: string, type: "success" | "error") => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage((curr) => (curr?.text === text ? null : curr));
    }, 6000);
  };

  const handleCraft = async (
    weapon: Extract<ItemId, "weapon:solar" | "weapon:frost" | "weapon:void">
  ) => {
    try {
      await craft_weapon(WEAPON_ELEMENT[weapon]);
      showStatus(`Successfully forged 1x ${weapon.replace("weapon:", "").toUpperCase()} weapon!`, "success");
      inventory.reload();
      supply.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("E_INSUFFICIENT_ITEM")) {
        showStatus("Insufficient crafting materials. Need 2x Iron Ore and 3x Elemental Essence.", "error");
      } else {
        showStatus(`Crafting failed: ${msg}`, "error");
      }
    }
  };

  const handleReforge = async (
    recipe: typeof ALTAR_RECIPE_2_TO_1 | typeof ALTAR_RECIPE_3_TO_2,
    burnIn: number,
    receiveOut: number
  ) => {
    try {
      await reforge(burnIn as ElementIndex, receiveOut as ElementIndex);
      showStatus("Altar transmutation successful! Weapons reforged.", "success");
      inventory.reload();
      supply.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("E_INSUFFICIENT_ITEM")) {
        showStatus("Starter weapons cannot be burned. You need 2 crafted weapons to reforge.", "error");
      } else {
        showStatus(`Reforging failed: ${msg}`, "error");
      }
    }
  };

  const handleGather = async (material?: ItemId) => {
    if (!material) return;
    try {
      await gather(material);
      showStatus(`Gathered +2x ${material.replace("ore:", "").toUpperCase()}!`, "success");
      inventory.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showStatus(`Gathering cooldown active: ${msg}`, "error");
    }
  };

  const handleClaimStarter = async () => {
    try {
      await claim_starter();
      showStatus("Starter bundle claimed! 4 Solar Weapons, 1 Frost Weapon, and crafting materials received.", "success");
      inventory.reload();
      supply.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("E_ALREADY_CLAIMED") || msg.includes("already")) {
        showStatus("This account has already claimed the starter pack.", "error");
      } else if (msg.includes("AccessKeyNotFound") || msg.includes("does not have access key")) {
        showStatus("Account session key not recognized on-chain. Please re-enter from Title Screen.", "error");
      } else if (msg.includes("NotEnoughBalance")) {
        showStatus("Account has insufficient balance for transaction gas. Please top up your account.", "error");
      } else {
        showStatus(`Starter claim failed: ${msg}`, "error");
      }
    }
  };

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <EmptyState title="No active session" hint="Enter your account name on the Title Screen to activate your signless session." />
      </div>
    );
  }

  const activeRecipe = aiState.data?.altar_recipe_id ?? "";
  const recipeKnown = aiState.data !== null;

  return (
    <div className="px-1 py-8 flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">Crafting Forge</h1>
        <p className="text-xs sm:text-sm font-mono text-slate-400 mt-1">
          Harvest materials at the altar, forge elemental weapons, and monitor the realm-wide
          supply — boss resistance adapts to the circulating stock. Altar recipes {ALTAR_RECIPE_2_TO_1} /
          {ALTAR_RECIPE_3_TO_2} activate when authorized by the Boss Brain.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg border font-mono text-xs flex items-center gap-2 ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-hp/15 border-hp/40 text-hp"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-hp" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {!inventory.data ? (
        <EmptyState
          title="Inventory unavailable"
          hint="Unable to load inventory data from the network. Please verify your connection and reload."
          onReload={inventory.reload}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-4 flex flex-col gap-3">
            <CraftingForge
              inventory={inventory.data}
              onCraft={handleCraft}
              onReforge={handleReforge}
              activeRecipe={recipeKnown ? activeRecipe : undefined}
            />
            <GatheringAltar onHarvest={handleGather} />
          </div>
          <div className="md:col-span-8 flex flex-col gap-3">
            <LiveInventory inventory={inventory.data} onClaimStarter={handleClaimStarter} />
            {supply.data ? (
              <ServerSupplyBar supplies={supply.data} />
            ) : (
              <EmptyState title="Global supply unavailable" hint="Unable to retrieve realm weapon supply from the network." onReload={supply.reload} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
