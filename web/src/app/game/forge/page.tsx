"use client";

import React, { useState } from "react";
import { CraftingForge } from "@/components/left/CraftingForge";
import { GatheringAltar } from "@/components/left/GatheringAltar";
import { LiveInventory, StarterKitButton } from "@/components/left/LiveInventory";
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
import { ALTAR_RECIPE_2_TO_1, ALTAR_RECIPE_3_TO_2, CRAFT_ORE_COST, CRAFT_ESSENCE_COST } from "@/lib/spire/constants";
import { getExplorerTxUrl } from "@/lib/utils/cn";
import { CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

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

  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error";
    txHash?: string;
  } | null>(null);

  const showStatus = (text: string, type: "success" | "error", txHash?: string) => {
    setStatusMessage({ text, type, txHash });
    setTimeout(() => {
      setStatusMessage((curr) => (curr?.text === text ? null : curr));
    }, 7000);
  };

  const handleCraft = async (
    weapon: Extract<ItemId, "weapon:solar" | "weapon:frost" | "weapon:void">
  ) => {
    try {
      const res = await craft_weapon(WEAPON_ELEMENT[weapon]);
      showStatus(
        `Forged 1x ${weapon.replace("weapon:", "").toUpperCase()} weapon.`,
        "success",
        res.txHash
      );
      inventory.reload();
      supply.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("E_INSUFFICIENT_ITEM")) {
        showStatus(
          `Insufficient materials: forging requires ${CRAFT_ORE_COST} Iron Ore and ${CRAFT_ESSENCE_COST} matching Essence.`,
          "error"
        );
      } else {
        showStatus(`Crafting failed: ${msg}`, "error");
      }
    }
  };

  const handleReforge = async (
    _recipe: typeof ALTAR_RECIPE_2_TO_1 | typeof ALTAR_RECIPE_3_TO_2,
    burnIn: number,
    receiveOut: number
  ) => {
    try {
      const res = await reforge(burnIn as ElementIndex, receiveOut as ElementIndex);
      showStatus("Altar transmutation complete. Weapons reforged.", "success", res.txHash);
      inventory.reload();
      supply.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("E_INSUFFICIENT_ITEM")) {
        showStatus(
          "Insufficient tradeable weapons. Starter-locked weapons cannot be burned at the altar.",
          "error"
        );
      } else {
        showStatus(`Reforging failed: ${msg}`, "error");
      }
    }
  };

  const handleGather = async (material?: ItemId) => {
    if (!material) return;
    try {
      const res = await gather(material);
      showStatus(`Gathered +2 ${material}.`, "success", res.txHash);
      inventory.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showStatus(`Gathering blocked (30s cooldown or 20/epoch cap): ${msg}`, "error");
      throw err;
    }
  };

  const handleClaimStarter = async () => {
    try {
      const res = await claim_starter();
      showStatus(
        "Starter bundle claimed: 4x Solar Blade, 1x Frost Spear, Iron Ore, and Essence.",
        "success",
        res.txHash
      );
      inventory.reload();
      supply.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("E_ALREADY_CLAIMED") || msg.includes("already")) {
        showStatus("This account has already claimed the starter bundle.", "error");
      } else if (msg.includes("AccessKeyNotFound") || msg.includes("does not have access key")) {
        showStatus("Account session key not recognized on-chain. Re-enter from Session Key setup.", "error");
      } else if (msg.includes("NotEnoughBalance")) {
        showStatus("Insufficient gas balance on your subaccount.", "error");
      } else {
        showStatus(`Starter claim failed: ${msg}`, "error");
      }
    }
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <EmptyState
          title="No active session"
          hint="Provision your signless account on the Session Key screen to gather materials and forge weapons."
          actionHref="/game/start"
          actionLabel="Go to Session Key"
        />
      </div>
    );
  }

  const activeRecipe = aiState.data?.altar_recipe_id ?? "";
  const recipeKnown = aiState.data !== null;
  const txUrl = getExplorerTxUrl(statusMessage?.txHash);

  return (
    <div className="flex flex-col gap-5">
      {/* Masthead with Contextual Starter Kit CTA */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-brass/15">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-parchment tracking-wide">
            Crafting Forge &amp; Altar
          </h1>
          <p className="text-sm text-ash mt-1">
            Gather materials (+2 per node), craft elemental NEP-245 weapons ({CRAFT_ORE_COST} Ore + {CRAFT_ESSENCE_COST} Essence), and adapt to realm supply.
          </p>
        </div>
        {inventory.data && (
          <StarterKitButton inventory={inventory.data} onClaimStarter={handleClaimStarter} />
        )}
      </div>

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`px-4 py-3 rounded-lg border font-mono text-xs flex flex-wrap items-center justify-between gap-2 ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-hp/15 border-hp/40 text-hp"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-hp" aria-hidden="true" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-frost hover:underline inline-flex items-center gap-1 font-bold"
            >
              NearBlocks <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {!inventory.data ? (
        <EmptyState
          title="Inventory unavailable"
          hint="Unable to load inventory data from the network. Please verify your connection and reload."
          onReload={inventory.reload}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Band 1: Structured 5/7 Inventory Ledger */}
          <LiveInventory inventory={inventory.data} />

          {/* Band 2: Action-First 7/5 Workbench (Forge left dominant, Altar right paired) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-7">
              <CraftingForge
                inventory={inventory.data}
                supplies={supply.data ?? undefined}
                onCraft={handleCraft}
                onReforge={handleReforge}
                activeRecipe={recipeKnown ? activeRecipe : undefined}
              />
            </div>
            <div className="lg:col-span-5">
              <GatheringAltar onHarvest={handleGather} />
            </div>
          </div>

          {/* Band 3: Full-Width Realm Circulating Supply & Boss Adaptation */}
          {supply.data ? (
            <ServerSupplyBar supplies={supply.data} />
          ) : (
            <EmptyState
              title="Global supply unavailable"
              hint="Unable to retrieve realm weapon supply from the network."
              onReload={supply.reload}
            />
          )}
        </div>
      )}
    </div>
  );
}
