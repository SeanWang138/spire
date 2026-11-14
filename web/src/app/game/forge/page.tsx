"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, ExternalLink, Swords, Vault } from "lucide-react";
import { CraftingForge } from "@/components/left/CraftingForge";
import { GatheringAltar } from "@/components/left/GatheringAltar";
import { LiveInventory, StarterKitButton } from "@/components/left/LiveInventory";
import { ServerSupplyBar } from "@/components/left/ServerSupplyBar";
import { MetaRadar } from "@/components/center/MetaRadar";
import { NpcMerchantBazaar, FloorBuybackDesk } from "@/components/right/NpcMerchantBazaar";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  emptyInventory,
  get_inventory,
  get_supply,
  get_ai_state,
  get_merchant,
  get_tower,
  craft_weapon,
  reforge,
  gather,
  claim_starter,
  buy_from_merchant,
  sell_to_merchant,
  fund_merchant,
  sell_to_boss_buyback,
  deposit,
  type ItemId,
  type ElementIndex,
} from "@/lib/contract";
import { useContractView } from "@/lib/spire/hooks";
import { useSpireTelemetry } from "@/lib/spire/telemetry";
import { formatContractErrorMessage } from "@/lib/errors";
import {
  ALTAR_RECIPE_2_TO_1,
  ALTAR_RECIPE_3_TO_2,
  CRAFT_ORE_COST,
  CRAFT_ESSENCE_COST,
  ELEMENT_NAMES,
  nearToYocto,
} from "@/lib/spire/constants";
import { getEffectiveResistances } from "@/lib/combat-rules";
import { getExplorerTxUrl, parseYoctoSafe } from "@/lib/utils/cn";

const WEAPON_ELEMENT: Record<Extract<ItemId, "weapon:solar" | "weapon:frost" | "weapon:void">, ElementIndex> = {
  "weapon:solar": 0,
  "weapon:frost": 1,
  "weapon:void": 2,
};

const MIN_RAID_POUCH_YOCTO = 100_000_000_000_000_000_000_000n; // 0.10 NEAR
const AUTO_POUCH_DEPOSIT_YOCTO = "350000000000000000000000"; // 0.35 NEAR
const MIN_GAS_TANK_FOR_SETUP_YOCTO = 380_000_000_000_000_000_000_000n; // leave >= 0.03 NEAR gas

export default function ForgePage() {
  const {
    session,
    meta: sharedMeta,
    metaLoading,
    metaError,
    pouchYocto,
    gasTankYocto,
    reloadMeta,
    reloadBalance,
    reloadAll,
  } = useSpireTelemetry();
  const accountId = session?.accountId ?? "";

  const inventory = useContractView(
    async () => (accountId ? await get_inventory(accountId) : null),
    [accountId]
  );
  const supply = useContractView(get_supply, []);
  const merchant = useContractView(get_merchant, []);
  const tower = useContractView(get_tower, []);
  const aiRecipeState = useContractView(async () => {
    const states = await Promise.all([
      get_ai_state(1).catch(() => null),
      get_ai_state(2).catch(() => null),
      get_ai_state(3).catch(() => null),
    ]);
    const bonus = states.find((s) => s?.altar_recipe_id === ALTAR_RECIPE_3_TO_2);
    if (bonus) return bonus;
    return states.find((s) => Boolean(s)) ?? null;
  }, []);

  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error";
    txHash?: string;
  } | null>(null);
  const [completingSetup, setCompletingSetup] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const showStatus = (text: string, type: "success" | "error", txHash?: string) => {
    setStatusMessage({ text, type, txHash });
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
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
      showStatus(formatContractErrorMessage(err), "error");
      throw err;
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
      showStatus(formatContractErrorMessage(err), "error");
      throw err;
    }
  };

  const handleGather = async (material?: ItemId) => {
    if (!material) return;
    try {
      const res = await gather(material);
      showStatus(`Gathered +2 ${material}.`, "success", res.txHash);
      inventory.reload();
    } catch (err: unknown) {
      showStatus(formatContractErrorMessage(err), "error");
      throw err;
    }
  };

  const handleClaimStarter = async () => {
    try {
      const res = await claim_starter();
      showStatus(
        "Starter Kit claimed: 4x Solar Blade, 1x Frost Spear, 4 Iron Ore, and 3 each Essence.",
        "success",
        res.txHash
      );
      inventory.reload();
      supply.reload();
    } catch (err: unknown) {
      showStatus(formatContractErrorMessage(err), "error");
    }
  };

  const handleCompleteGuestSetup = async (claimStarter: boolean, depositPouch: boolean) => {
    if (completingSetup) return;
    setCompletingSetup(true);
    let lastHash: string | undefined;
    try {
      if (claimStarter) {
        try {
          const res = await claim_starter();
          lastHash = res.txHash;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes("E_ALREADY_CLAIMED")) throw err;
        }
      }
      if (depositPouch) {
        const res = await deposit(AUTO_POUCH_DEPOSIT_YOCTO);
        lastHash = res.txHash;
      }
      showStatus(
        "Guest setup completed on-chain: Starter Relics & 0.35 NEAR Citadel Pouch active.",
        "success",
        lastHash
      );
      inventory.reload();
      supply.reload();
      reloadAll();
    } catch (err: unknown) {
      showStatus(formatContractErrorMessage(err), "error");
    } finally {
      setCompletingSetup(false);
    }
  };

  const handleTrade = async (action: "buy" | "sell", item: ItemId, amount: number) => {
    try {
      const res =
        action === "buy"
          ? await buy_from_merchant(item, amount)
          : await sell_to_merchant(item, amount);
      showStatus(
        `${action === "buy" ? "Bought" : "Sold"} ${amount}x ${item} via NPC Material Desk.`,
        "success",
        res.txHash
      );
      merchant.reload();
      inventory.reload();
      reloadBalance();
    } catch (err: unknown) {
      showStatus(formatContractErrorMessage(err), "error");
      throw err;
    }
  };

  const handleFundMerchant = async (amountNear: number) => {
    try {
      const res = await fund_merchant(nearToYocto(amountNear));
      showStatus(
        `Refilled merchant liquidity reserve with ${amountNear.toFixed(2)} NEAR.`,
        "success",
        res.txHash
      );
      merchant.reload();
      reloadBalance();
    } catch (err: unknown) {
      showStatus(formatContractErrorMessage(err), "error");
      throw err;
    }
  };

  const handleBuyback = async (floor: number, element: ElementIndex, qty: number) => {
    try {
      const res = await sell_to_boss_buyback(floor, element, qty);
      showStatus(
        `Sold ${qty}x ${ELEMENT_NAMES[element]} weapon to Floor ${floor} Buyback Reserve. Payout credited to Citadel Pouch.`,
        "success",
        res.txHash
      );
      inventory.reload();
      supply.reload();
      tower.reload();
      reloadBalance();
    } catch (err: unknown) {
      showStatus(formatContractErrorMessage(err), "error");
      throw err;
    }
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <EmptyState
          headingAs="h1"
          title="No active testnet session"
          hint="Launch your 1-Click Walletless Testnet Subaccount to gather materials, forge weapons, and trade at the Bazaar."
          actionHref="/game/start"
          actionLabel="Go to 1-Click Start"
        />
      </div>
    );
  }

  const activeRecipe = aiRecipeState.data?.altar_recipe_id ?? "";
  const txUrl = getExplorerTxUrl(statusMessage?.txHash);
  const effectiveResistances = sharedMeta
    ? getEffectiveResistances(sharedMeta.resistance, 1)
    : null;
  const pouchNeedTopUp = pouchYocto !== null && parseYoctoSafe(pouchYocto) < MIN_RAID_POUCH_YOCTO;
  const gasTankBalance = gasTankYocto !== null ? parseYoctoSafe(gasTankYocto) : 0n;
  const needsStarter = Boolean(
    inventory.data && inventory.data.starter_locked.reduce((a, b) => a + b, 0) === 0
  );
  const canAutoDeposit = pouchNeedTopUp && gasTankBalance >= MIN_GAS_TANK_FOR_SETUP_YOCTO;
  const canAutoStarter = needsStarter && gasTankBalance >= 50_000_000_000_000_000_000_000n;
  const showRecoveryBanner = canAutoStarter || canAutoDeposit;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-brass/15">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-parchment tracking-wide">
            Town &amp; Forge
          </h1>
          <p className="text-sm text-ash mt-1 max-w-2xl">
            Gather materials (+2 units, 30s cooldown, 20/epoch cap), forge elemental NEP-245 weapons ({CRAFT_ORE_COST} Ore + {CRAFT_ESSENCE_COST} Essence), transmute blades, and trade at the Bazaar.
          </p>
        </div>
        {inventory.data && (
          <StarterKitButton inventory={inventory.data} onClaimStarter={handleClaimStarter} />
        )}
      </div>

      {showRecoveryBanner && (
        <div
          role="status"
          className="px-4 py-3.5 rounded-lg bg-solar/10 border border-solar/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="text-xs font-mono text-parchment leading-relaxed">
            <span className="font-bold text-solar">Incomplete Guest Setup Detected:</span>{" "}
            {canAutoStarter && canAutoDeposit
              ? "Claim your free Starter Relics & transfer 0.35 NEAR from your gas tank into your playable Citadel Pouch."
              : canAutoStarter
                ? "Claim your free Starter Relics (4x Solar, 1x Frost, Ore & Essence)."
                : "Transfer 0.35 NEAR from your guest gas tank into your playable Citadel Pouch."}
          </div>
          <button
            type="button"
            disabled={completingSetup}
            onClick={() => handleCompleteGuestSetup(canAutoStarter, canAutoDeposit)}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono font-bold text-xs uppercase tracking-wider shrink-0 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
          >
            {completingSetup
              ? "Completing Setup..."
              : canAutoStarter && canAutoDeposit
                ? "1-Click Complete Starter & Deposit 0.35 NEAR"
                : canAutoStarter
                  ? "1-Click Claim Starter Kit"
                  : "1-Click Deposit 0.35 NEAR to Pouch"}
          </button>
        </div>
      )}

      {statusMessage && (
        <div
          role={statusMessage.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`px-4 py-3 rounded-lg border font-mono text-xs flex flex-wrap items-center justify-between gap-2 ${
            statusMessage.type === "success"
              ? "bg-jackpot/10 border-jackpot/35 text-jackpot"
              : "bg-hp/15 border-hp/40 text-hp-text"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-jackpot" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-hp-text" aria-hidden="true" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-frost hover:underline inline-flex items-center gap-1 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar rounded"
            >
              NearBlocks <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {inventory.loading && !inventory.data ? (
        <div className="obsidian-surface p-6 text-xs font-mono text-ash">
          Loading player inventory from NEAR testnet...
        </div>
      ) : !inventory.data ? (
        <EmptyState
          title="Inventory unavailable"
          hint={inventory.error ?? "Unable to load inventory data from the network."}
          onReload={inventory.reload}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Band 1: Structured Materials & Armaments (Free Crafted vs Starter) */}
          <LiveInventory inventory={inventory.data} />

          {/* Band 2: Forge Workbench + Gathering Altar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-7">
              <CraftingForge
                inventory={inventory.data}
                supplies={supply.data ?? undefined}
                onCraft={handleCraft}
                onReforge={handleReforge}
                activeRecipe={activeRecipe}
              />
            </div>
            <div className="lg:col-span-5">
              <GatheringAltar
                onHarvest={handleGather}
                accountId={accountId}
                epoch={sharedMeta?.epoch ?? 0}
              />
            </div>
          </div>

          {/* Band 3: Global Supply & Mini MetaRadar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7">
              {supply.loading && !supply.data ? (
                <div className="obsidian-surface p-6 text-xs font-mono text-ash">
                  Loading circulating weapon supply...
                </div>
              ) : supply.data ? (
                <ServerSupplyBar supplies={supply.data} />
              ) : (
                <EmptyState
                  title="Global supply unavailable"
                  hint={supply.error ?? "Unable to retrieve realm weapon supply from the network."}
                  onReload={supply.reload}
                />
              )}
            </div>

            <div className="lg:col-span-5 space-y-3">
              {metaLoading && !sharedMeta ? (
                <div className="obsidian-surface p-6 text-xs font-mono text-ash">
                  Loading live Meta Radar...
                </div>
              ) : effectiveResistances ? (
                <>
                  <MetaRadar
                    resistances={effectiveResistances}
                    epoch={sharedMeta?.epoch}
                    nextEpochInNs={sharedMeta?.next_epoch_in_ns}
                  />
                  {pouchNeedTopUp ? (
                    <Link
                      href="/game/vault?tab=pouch"
                      className="min-h-[44px] w-full px-4 py-2.5 rounded-lg border border-solar/45 bg-solar/15 hover:bg-solar/25 text-solar text-xs font-mono font-bold flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                    >
                      <span>Next Step: Top up Citadel Pouch in Vault (&lt; 0.10 NEAR)</span>
                      <Vault className="w-4 h-4 shrink-0" aria-hidden="true" />
                    </Link>
                  ) : (
                    <Link
                      href="/game/raid"
                      className="min-h-[44px] w-full px-4 py-2.5 rounded-lg border border-frost/35 bg-frost/10 hover:bg-frost/20 text-frost text-xs font-mono font-bold flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                    >
                      <span>Ready: Enter Spire Raid (Floor 2 adds +1500 bps Frost Ward)</span>
                      <Swords className="w-4 h-4 shrink-0" aria-hidden="true" />
                    </Link>
                  )}
                </>
              ) : (
                <EmptyState
                  title="Meta Radar unavailable"
                  hint={metaError ?? "Unable to load live adaptive resistance."}
                  onReload={reloadMeta}
                />
              )}
            </div>
          </div>

          {/* Band 4: Integrated NPC Material Desk + Separate Floor Buyback Desk */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-6">
              {merchant.loading && !merchant.data ? (
                <div className="obsidian-surface p-6 text-xs font-mono text-ash">
                  Loading NPC Material Desk...
                </div>
              ) : merchant.data ? (
                <NpcMerchantBazaar
                  cashYocto={merchant.data.cash}
                  isOpen={merchant.data.is_open}
                  stock={merchant.data.stock}
                  inventory={inventory.data ?? emptyInventory()}
                  pouchYocto={pouchYocto}
                  onTrade={handleTrade}
                  onFundMerchant={handleFundMerchant}
                />
              ) : (
                <EmptyState
                  title="NPC Material Desk unavailable"
                  hint={merchant.error ?? "Unable to retrieve merchant state from NEAR Testnet."}
                  onReload={merchant.reload}
                />
              )}
            </div>

            <div className="lg:col-span-6">
              {tower.loading && !tower.data ? (
                <div className="obsidian-surface p-6 text-xs font-mono text-ash">
                  Loading Floor Buyback Desk...
                </div>
              ) : tower.data ? (
                <FloorBuybackDesk
                  floors={tower.data.floors}
                  inventory={inventory.data}
                  onBuyback={handleBuyback}
                />
              ) : (
                <EmptyState
                  title="Floor Buyback Desk unavailable"
                  hint={tower.error ?? "Unable to load floor buyback reserves."}
                  onReload={tower.reload}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
