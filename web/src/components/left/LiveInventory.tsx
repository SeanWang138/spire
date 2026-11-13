"use client";

import React, { useState } from "react";
import { Backpack, Gift, Sparkles, Flame, Snowflake, Pickaxe, ShieldCheck } from "lucide-react";
import { PlayerInventory } from "@/lib/contract";

interface LiveInventoryProps {
  inventory: PlayerInventory;
  onClaimStarter: () => Promise<void>;
  disabled?: boolean;
}

export const LiveInventory: React.FC<LiveInventoryProps> = ({
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

  const weaponRows = [
    {
      label: "Solar Blade",
      color: "text-solar",
      icon: <Flame className="w-3.5 h-3.5 text-solar" aria-hidden="true" />,
      total: inventory.weapons[0],
      locked: inventory.starter_locked[0],
    },
    {
      label: "Frost Spear",
      color: "text-frost",
      icon: <Snowflake className="w-3.5 h-3.5 text-frost" aria-hidden="true" />,
      total: inventory.weapons[1],
      locked: inventory.starter_locked[1],
    },
    {
      label: "Void Scythe",
      color: "text-void",
      icon: <Sparkles className="w-3.5 h-3.5 text-void" aria-hidden="true" />,
      total: inventory.weapons[2],
      locked: inventory.starter_locked[2],
    },
  ];

  return (
    <div className="obsidian-surface p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Backpack className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            Live Inventory
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-300 uppercase">NEP-245 Multi-Token</span>
      </div>

      {/* Materials strip */}
      <div>
        <div className="text-[11px] font-mono uppercase text-slate-300 mb-2 flex items-center justify-between">
          <span>Raw Materials</span>
          <span className="text-slate-400">4 Resource Tokens</span>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 rounded-lg bg-panel-dark divide-y sm:divide-y-0 sm:divide-x divide-white/10 font-mono text-xs">
          <div className="px-3 py-2.5 flex items-center justify-between">
            <dt className="text-slate-300 flex items-center gap-1.5">
              <Pickaxe className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" /> Iron
            </dt>
            <dd className="font-bold font-mono-numbers text-white">
              {inventory.materials["ore:iron"]}
            </dd>
          </div>
          <div className="px-3 py-2.5 flex items-center justify-between">
            <dt className="text-solar flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" aria-hidden="true" /> Solar
            </dt>
            <dd className="font-bold font-mono-numbers text-white">
              {inventory.materials["essence:solar"]}
            </dd>
          </div>
          <div className="px-3 py-2.5 flex items-center justify-between">
            <dt className="text-frost flex items-center gap-1.5">
              <Snowflake className="w-3.5 h-3.5" aria-hidden="true" /> Frost
            </dt>
            <dd className="font-bold font-mono-numbers text-white">
              {inventory.materials["essence:frost"]}
            </dd>
          </div>
          <div className="px-3 py-2.5 flex items-center justify-between">
            <dt className="text-void flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Void
            </dt>
            <dd className="font-bold font-mono-numbers text-white">
              {inventory.materials["essence:void"]}
            </dd>
          </div>
        </dl>
      </div>

      {/* Weapons ledger (shows total vs free/tradeable vs starter-locked) */}
      <div>
        <div className="text-[11px] font-mono uppercase text-slate-300 mb-2 flex items-center justify-between">
          <span>Elemental Armaments</span>
          <span className="text-slate-400">Free vs Starter-Locked</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 rounded-lg bg-panel-dark divide-y sm:divide-y-0 sm:divide-x divide-white/10 font-mono text-xs">
          {weaponRows.map((w) => {
            const free = Math.max(0, w.total - w.locked);
            return (
              <div key={w.label} className="p-3 flex flex-col gap-1">
                <div className={`flex items-center gap-1.5 font-bold ${w.color}`}>
                  {w.icon}
                  <span>{w.label}</span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-black font-mono-numbers text-white">{w.total}</span>
                  <span className="text-[11px] text-slate-300 font-mono-numbers">
                    {free} free{w.locked > 0 ? ` · ${w.locked} locked` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Claim Starter Bundle */}
      <button
        type="button"
        onClick={handleClaim}
        disabled={disabled || isClaiming || hasClaimed}
        className={`min-h-[44px] w-full py-2.5 px-4 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors ${
          hasClaimed
            ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300 cursor-default"
            : "border-jackpot/40 bg-jackpot/10 hover:bg-jackpot/20 text-jackpot"
        }`}
      >
        {hasClaimed ? (
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Gift className="w-4 h-4" aria-hidden="true" />
        )}
        <span>
          {isClaiming
            ? "Granting Starter Kit..."
            : hasClaimed
            ? "Starter Kit Active (4x Solar, 1x Frost Protected)"
            : "Claim Free Starter Kit (4x Solar, 1x Frost + Materials)"}
        </span>
      </button>
    </div>
  );
};
