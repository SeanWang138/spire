"use client";

import React, { useState } from "react";
import { Pickaxe, Flame, Snowflake, Sparkles, Zap, Check } from "lucide-react";

interface GatheringAltarProps {
  onHarvest: (materialKey: "ore:iron" | "essence:solar" | "essence:frost" | "essence:void") => Promise<void>;
  disabled?: boolean;
}

export const GatheringAltar: React.FC<GatheringAltarProps> = ({ onHarvest, disabled = false }) => {
  const [harvestingKey, setHarvestingKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);

  const shrines = [
    {
      key: "ore:iron" as const,
      name: "Iron Vein",
      element: "Raw Ore",
      icon: Pickaxe,
      color: "text-slate-300",
      border: "border-slate-500/30 hover:border-slate-400",
      bg: "bg-slate-500/10",
    },
    {
      key: "essence:solar" as const,
      name: "Solar Shrine",
      element: "Solar Essence",
      icon: Flame,
      color: "text-solar",
      border: "border-solar/30 hover:border-solar",
      bg: "bg-solar/10",
    },
    {
      key: "essence:frost" as const,
      name: "Frost Well",
      element: "Frost Essence",
      icon: Snowflake,
      color: "text-frost",
      border: "border-frost/30 hover:border-frost",
      bg: "bg-frost/10",
    },
    {
      key: "essence:void" as const,
      name: "Void Rift",
      element: "Void Essence",
      icon: Sparkles,
      color: "text-void",
      border: "border-void/30 hover:border-void",
      bg: "bg-void/10",
    },
  ];

  const handleHarvest = async (key: "ore:iron" | "essence:solar" | "essence:frost" | "essence:void") => {
    if (harvestingKey || disabled) return;
    setHarvestingKey(key);
    try {
      await onHarvest(key);
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(null), 2000);
    } catch {
      // error handled upstream
    } finally {
      setHarvestingKey(null);
    }
  };

  return (
    <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-frost" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            Gathering Altar
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-400">Harvest Nodes</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {shrines.map((shrine) => {
          const Icon = shrine.icon;
          const isCurrentHarvesting = harvestingKey === shrine.key;
          const isSuccess = successKey === shrine.key;

          return (
            <button
              key={shrine.key}
              onClick={() => handleHarvest(shrine.key)}
              disabled={disabled || !!harvestingKey}
              className={`p-2.5 rounded-lg border text-left transition-all relative overflow-hidden group ${
                shrine.border
              } ${shrine.bg} ${
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon className={`w-4 h-4 ${shrine.color} group-hover:scale-110 transition-transform`} />
                {isSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                ) : (
                  <span className="text-[10px] font-mono text-slate-500 uppercase">+1 Node</span>
                )}
              </div>
              <div className="font-bold text-xs text-white truncate">{shrine.name}</div>
              <div className={`text-[10px] font-mono ${shrine.color} truncate`}>
                {isCurrentHarvesting ? "Channeling..." : shrine.element}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
