"use client";

import React, { useState } from "react";
import { Backpack, Gift, Sparkles, Flame, Snowflake, Pickaxe, Swords } from "lucide-react";
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

  return (
    <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Backpack className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            Live Inventory
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-400 uppercase">NEP-245 Multi-Token</span>
      </div>

      {/* Materials Grid */}
      <div>
        <div className="text-[10px] font-mono uppercase text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Raw Materials</span>
          <span className="text-slate-500 font-mono-numbers">4 tokens</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-xs">
          <div className="p-2 rounded bg-panel-dark border border-white/5 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Pickaxe className="w-3 h-3 text-slate-400" /> Iron
            </span>
            <span className="font-bold font-mono-numbers text-white">
              {inventory.materials["ore:iron"]}
            </span>
          </div>
          <div className="p-2 rounded bg-panel-dark border border-solar/20 flex items-center justify-between">
            <span className="text-solar flex items-center gap-1">
              <Flame className="w-3 h-3" /> Solar
            </span>
            <span className="font-bold font-mono-numbers text-white">
              {inventory.materials["essence:solar"]}
            </span>
          </div>
          <div className="p-2 rounded bg-panel-dark border border-frost/20 flex items-center justify-between">
            <span className="text-frost flex items-center gap-1">
              <Snowflake className="w-3 h-3" /> Frost
            </span>
            <span className="font-bold font-mono-numbers text-white">
              {inventory.materials["essence:frost"]}
            </span>
          </div>
          <div className="p-2 rounded bg-panel-dark border border-void/20 flex items-center justify-between">
            <span className="text-void flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Void
            </span>
            <span className="font-bold font-mono-numbers text-white">
              {inventory.materials["essence:void"]}
            </span>
          </div>
        </div>
      </div>

      {/* Weapons Grid */}
      <div>
        <div className="text-[10px] font-mono uppercase text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Elemental Weapons</span>
          <span className="text-slate-500 font-mono-numbers">3 tokens</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
          <div className="p-2 rounded bg-solar/10 border border-solar/30 flex flex-col items-center">
            <div className="flex items-center gap-1 text-[11px] text-solar font-bold mb-0.5">
              <Flame className="w-3 h-3" /> Solar Blade
            </div>
            <span className="text-base font-bold font-mono-numbers text-white">
              {inventory.weapons[0]}
            </span>
          </div>
          <div className="p-2 rounded bg-frost/10 border border-frost/30 flex flex-col items-center">
            <div className="flex items-center gap-1 text-[11px] text-frost font-bold mb-0.5">
              <Snowflake className="w-3 h-3" /> Frost Spear
            </div>
            <span className="text-base font-bold font-mono-numbers text-white">
              {inventory.weapons[1]}
            </span>
          </div>
          <div className="p-2 rounded bg-void/10 border border-void/30 flex flex-col items-center">
            <div className="flex items-center gap-1 text-[11px] text-void font-bold mb-0.5">
              <Sparkles className="w-3 h-3" /> Void Scythe
            </div>
            <span className="text-base font-bold font-mono-numbers text-white">
              {inventory.weapons[2]}
            </span>
          </div>
        </div>
      </div>

      {/* Claim Starter Bundle */}
      <button
        onClick={handleClaim}
        disabled={disabled || isClaiming}
        className="w-full py-2 px-3 rounded-lg border border-jackpot/40 bg-jackpot/10 hover:bg-jackpot/20 text-jackpot text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all"
      >
        <Gift className="w-3.5 h-3.5" />
        <span>{isClaiming ? "Granting Pack..." : "Claim Starter Pack (Free Starter Bundle)"}</span>
      </button>
    </div>
  );
};
