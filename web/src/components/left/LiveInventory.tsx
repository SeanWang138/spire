"use client";

import React, { useState } from "react";
import { Backpack, Gift, Sparkles, Flame, Snowflake, Pickaxe, ShieldCheck } from "lucide-react";
import type { PlayerInventory } from "@/lib/contract";
import { getFreeWeaponCounts } from "@/lib/combat-rules";

interface StarterKitButtonProps {
  inventory: PlayerInventory;
  onClaimStarter: () => Promise<void>;
  disabled?: boolean;
}

export const StarterKitButton: React.FC<StarterKitButtonProps> = ({
  inventory,
  onClaimStarter,
  disabled = false,
}) => {
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaim = async () => {
    if (isClaiming || disabled) return;
    setIsClaiming(true);
    try {
      await onClaimStarter();
    } catch {
      // Upstream status banner reports any claim failure
    } finally {
      setIsClaiming(false);
    }
  };

  const hasClaimed = inventory.starter_locked.reduce((a, b) => a + b, 0) > 0;

  return (
    <button
      type="button"
      onClick={handleClaim}
      disabled={disabled || isClaiming || hasClaimed}
      className={`min-h-[44px] py-2 px-4 rounded-lg border text-xs font-mono font-bold inline-flex items-center justify-center gap-2 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
        hasClaimed
          ? "border-jackpot/30 bg-jackpot/10 text-jackpot cursor-default"
          : "border-jackpot/45 bg-jackpot/15 hover:bg-jackpot/25 text-jackpot"
      }`}
    >
      {hasClaimed ? (
        <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : (
        <Gift className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
      <span>
        {isClaiming
          ? "Granting Starter Kit..."
          : hasClaimed
          ? "Starter Kit Active (4x Solar, 1x Frost)"
          : "Claim Starter Kit (4x Solar, 1x Frost)"}
      </span>
    </button>
  );
};

interface LiveInventoryProps {
  inventory: PlayerInventory;
  onClaimStarter?: () => Promise<void>;
  disabled?: boolean;
}

export const LiveInventory: React.FC<LiveInventoryProps> = ({
  inventory,
  onClaimStarter,
  disabled = false,
}) => {
  const freeCounts = getFreeWeaponCounts(inventory.weapons, inventory.starter_locked);

  const weaponRows = [
    {
      label: "Solar Blade",
      color: "text-solar",
      icon: <Flame className="w-3.5 h-3.5 text-solar shrink-0" aria-hidden="true" />,
      total: inventory.weapons[0],
      free: freeCounts[0],
      locked: inventory.starter_locked[0],
    },
    {
      label: "Frost Spear",
      color: "text-frost",
      icon: <Snowflake className="w-3.5 h-3.5 text-frost shrink-0" aria-hidden="true" />,
      total: inventory.weapons[1],
      free: freeCounts[1],
      locked: inventory.starter_locked[1],
    },
    {
      label: "Void Scythe",
      color: "text-void-text",
      icon: <Sparkles className="w-3.5 h-3.5 text-void-text shrink-0" aria-hidden="true" />,
      total: inventory.weapons[2],
      free: freeCounts[2],
      locked: inventory.starter_locked[2],
    },
  ];

  return (
    <section aria-label="Live Inventory" className="obsidian-surface overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-brass/15">
        <div className="lg:col-span-5 px-5 py-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-parchment inline-flex items-center gap-2">
              <Backpack className="w-4 h-4 text-jackpot" aria-hidden="true" />
              <span>Materials</span>
            </h2>
            <span className="text-xs font-mono text-pewter">4 Resource Tokens</span>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="flex flex-col gap-0.5">
              <dt className="text-ash flex items-center gap-1.5">
                <Pickaxe className="w-3.5 h-3.5 text-ash shrink-0" aria-hidden="true" />
                <span>Iron</span>
              </dt>
              <dd className="text-base font-bold font-mono-numbers text-parchment leading-tight">
                {inventory.materials["ore:iron"]}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-solar flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Solar</span>
              </dt>
              <dd className="text-base font-bold font-mono-numbers text-parchment leading-tight">
                {inventory.materials["essence:solar"]}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-frost flex items-center gap-1.5">
                <Snowflake className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Frost</span>
              </dt>
              <dd className="text-base font-bold font-mono-numbers text-parchment leading-tight">
                {inventory.materials["essence:frost"]}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-void-text flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Void</span>
              </dt>
              <dd className="text-base font-bold font-mono-numbers text-parchment leading-tight">
                {inventory.materials["essence:void"]}
              </dd>
            </div>
          </dl>
        </div>

        <div className="lg:col-span-7 px-5 py-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-parchment">
              Armaments (Free Crafted vs Starter)
            </h2>
            <span className="text-xs font-mono text-pewter">NEP-245</span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            {weaponRows.map((w) => (
              <div key={w.label} className="flex flex-col gap-1 min-w-0">
                <dt className={`flex items-center gap-1.5 font-semibold truncate ${w.color}`}>
                  {w.icon}
                  <span className="truncate">{w.label}</span>
                </dt>
                <dd className="font-mono-numbers flex flex-wrap items-baseline gap-1.5 leading-tight">
                  <span className="text-base font-bold text-parchment">{w.total}</span>
                  <span className="text-xs text-jackpot font-semibold">{w.free} Free Crafted</span>
                  {w.locked > 0 && (
                    <span className="text-xs text-pewter">· {w.locked} Starter</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {onClaimStarter && (
        <div className="px-5 py-3 border-t border-brass/15 flex justify-end">
          <StarterKitButton inventory={inventory} onClaimStarter={onClaimStarter} disabled={disabled} />
        </div>
      )}
    </section>
  );
};
