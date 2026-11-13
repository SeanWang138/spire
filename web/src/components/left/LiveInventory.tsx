"use client";

import React, { useState } from "react";
import { Backpack, Gift, Sparkles, Flame, Snowflake, Pickaxe, ShieldCheck } from "lucide-react";
import { PlayerInventory } from "@/lib/contract";

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
      className={`min-h-[44px] py-2 px-4 rounded-lg border text-xs font-mono font-bold inline-flex items-center justify-center gap-2 transition-colors shrink-0 ${
        hasClaimed
          ? "border-emerald-500/25 bg-emerald-950/25 text-emerald-300 cursor-default"
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
          ? "Starter Kit Active (4× Solar, 1× Frost)"
          : "Claim Starter Kit (4× Solar, 1× Frost)"}
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
  const weaponRows = [
    {
      label: "Solar Blade",
      short: "Solar",
      color: "text-solar",
      icon: <Flame className="w-3.5 h-3.5 text-solar" aria-hidden="true" />,
      total: inventory.weapons[0],
      locked: inventory.starter_locked[0],
    },
    {
      label: "Frost Spear",
      short: "Frost",
      color: "text-frost",
      icon: <Snowflake className="w-3.5 h-3.5 text-frost" aria-hidden="true" />,
      total: inventory.weapons[1],
      locked: inventory.starter_locked[1],
    },
    {
      label: "Void Scythe",
      short: "Void",
      color: "text-void",
      icon: <Sparkles className="w-3.5 h-3.5 text-void" aria-hidden="true" />,
      total: inventory.weapons[2],
      locked: inventory.starter_locked[2],
    },
  ];

  return (
    <section aria-label="Live Inventory" className="obsidian-surface overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
        {/* Left Zone: Raw Materials (5 cols) */}
        <div className="lg:col-span-5 px-5 py-3.5 space-y-2.5">
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
              <dt className="text-void flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Void</span>
              </dt>
              <dd className="text-base font-bold font-mono-numbers text-parchment leading-tight">
                {inventory.materials["essence:void"]}
              </dd>
            </div>
          </dl>
        </div>

        {/* Right Zone: Elemental Armaments (7 cols) */}
        <div className="lg:col-span-7 px-5 py-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-parchment">
              Armaments
            </span>
            <span className="text-xs font-mono text-pewter">NEP-245</span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            {weaponRows.map((w) => {
              const free = Math.max(0, w.total - w.locked);
              return (
                <div key={w.label} className="flex flex-col gap-0.5 min-w-0">
                  <dt className={`flex items-center gap-1.5 font-semibold truncate ${w.color}`}>
                    {w.icon}
                    <span className="truncate">{w.label}</span>
                  </dt>
                  <dd className="font-mono-numbers flex items-baseline gap-1.5 leading-tight">
                    <span className="text-base font-bold text-parchment">{w.total}</span>
                    <span className="text-xs text-pewter truncate">
                      ({free} free{w.locked > 0 ? ` · ${w.locked} locked` : ""})
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>

      {onClaimStarter && (
        <div className="px-5 py-2.5 border-t border-white/[0.06] flex justify-end">
          <StarterKitButton inventory={inventory} onClaimStarter={onClaimStarter} disabled={disabled} />
        </div>
      )}
    </section>
  );
};
