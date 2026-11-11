"use client";

import React from "react";
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

  const handleCraft = async (
    weapon: Extract<ItemId, "weapon:solar" | "weapon:frost" | "weapon:void">
  ) => {
    await craft_weapon(WEAPON_ELEMENT[weapon]);
    inventory.reload();
    supply.reload();
  };

  const handleReforge = async (
    recipe: typeof ALTAR_RECIPE_2_TO_1 | typeof ALTAR_RECIPE_3_TO_2,
    burnIn: number,
    receiveOut: number
  ) => {
    await reforge(burnIn as ElementIndex, receiveOut as ElementIndex);
    inventory.reload();
    supply.reload();
  };

  const handleGather = async (material?: ItemId) => {
    if (!material) return;
    await gather(material);
    inventory.reload();
  };

  const handleClaimStarter = async () => {
    await claim_starter();
    inventory.reload();
    supply.reload();
  };

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <EmptyState title="No session yet" hint="Enter from /game/start to get your signless inventory." />
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
          Harvest materials at the altar, forge elemental weapons, and watch the global
          supply — boss resistance follows the circulating stock. Altar recipes {ALTAR_RECIPE_2_TO_1} /
          {ALTAR_RECIPE_3_TO_2} only activate when the Boss Brain unlocks them.
        </p>
      </div>

      {!inventory.data ? (
        <EmptyState
          title="Inventory unavailable"
          hint="get_inventory view call failed from the public RPC. The contract may not be deployed yet. Showing an empty panel — no fake data."
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
              <EmptyState title="Global supply unavailable" hint="get_supply view call failed from the public RPC." onReload={supply.reload} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
