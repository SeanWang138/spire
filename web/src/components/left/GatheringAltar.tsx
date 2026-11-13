"use client";

import React, { useEffect, useState } from "react";
import { Pickaxe, Flame, Snowflake, Sparkles, Zap, Check, Clock } from "lucide-react";
import {
  GATHER_AMOUNT,
  GATHER_COOLDOWN_NS,
  GATHER_EPOCH_CAP,
} from "@/lib/spire/constants";

interface GatheringAltarProps {
  onHarvest: (materialKey: "ore:iron" | "essence:solar" | "essence:frost" | "essence:void") => Promise<void>;
  disabled?: boolean;
}

const COOLDOWN_SECONDS = Math.round(GATHER_COOLDOWN_NS / 1e9);

export const GatheringAltar: React.FC<GatheringAltarProps> = ({ onHarvest, disabled = false }) => {
  const [harvestingKey, setHarvestingKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setInterval(() => {
      setCooldownLeft((c) => (c > 1 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownLeft]);

  const shrines = [
    {
      key: "ore:iron" as const,
      name: "Iron Vein",
      element: "Raw Ore",
      icon: Pickaxe,
      color: "text-ash",
      border: "border-white/[0.07] hover:border-ash/45",
      bg: "bg-[#07080D]/85 hover:bg-[#131624]",
    },
    {
      key: "essence:solar" as const,
      name: "Solar Shrine",
      element: "Solar Essence",
      icon: Flame,
      color: "text-solar",
      border: "border-white/[0.07] hover:border-solar/45",
      bg: "bg-[#07080D]/85 hover:bg-solar/[0.08]",
    },
    {
      key: "essence:frost" as const,
      name: "Frost Well",
      element: "Frost Essence",
      icon: Snowflake,
      color: "text-frost",
      border: "border-white/[0.07] hover:border-frost/45",
      bg: "bg-[#07080D]/85 hover:bg-frost/[0.08]",
    },
    {
      key: "essence:void" as const,
      name: "Void Rift",
      element: "Void Essence",
      icon: Sparkles,
      color: "text-void",
      border: "border-white/[0.07] hover:border-void/45",
      bg: "bg-[#07080D]/85 hover:bg-void/[0.08]",
    },
  ];

  const handleHarvest = async (key: "ore:iron" | "essence:solar" | "essence:frost" | "essence:void") => {
    if (harvestingKey || disabled || cooldownLeft > 0) return;
    setHarvestingKey(key);
    try {
      await onHarvest(key);
      setSuccessKey(key);
      setCooldownLeft(COOLDOWN_SECONDS);
      setTimeout(() => setSuccessKey(null), 2000);
    } catch {
      // Upstream displays error banner
    } finally {
      setHarvestingKey(null);
    }
  };

  return (
    <section className="obsidian-surface p-5 sm:p-6 flex flex-col justify-between gap-4 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-frost" aria-hidden="true" />
          <h2 className="font-serif text-lg font-bold tracking-wide text-parchment">
            Gathering Altar
          </h2>
        </div>
        {cooldownLeft > 0 ? (
          <span className="text-xs font-mono text-amber-300 inline-flex items-center gap-1 font-mono-numbers">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {cooldownLeft}s cooldown
          </span>
        ) : (
          <span className="text-xs font-mono text-pewter">
            {COOLDOWN_SECONDS}s cooldown · {GATHER_EPOCH_CAP}/epoch
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3.5 flex-1">
        {shrines.map((shrine) => {
          const Icon = shrine.icon;
          const isCurrentHarvesting = harvestingKey === shrine.key;
          const isSuccess = successKey === shrine.key;
          const isBlocked = disabled || Boolean(harvestingKey) || cooldownLeft > 0;

          return (
            <button
              type="button"
              key={shrine.key}
              onClick={() => handleHarvest(shrine.key)}
              disabled={isBlocked}
              className={`min-h-[100px] p-4 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                shrine.border
              } ${shrine.bg} ${
                isBlocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className={`w-4 h-4 ${shrine.color}`} aria-hidden="true" />
                {isSuccess ? (
                  <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                ) : (
                  <span className="text-xs font-mono font-mono-numbers text-ash font-bold">
                    +{GATHER_AMOUNT} Units
                  </span>
                )}
              </div>
              <div className="pt-3">
                <div className="font-semibold text-sm text-parchment truncate">{shrine.name}</div>
                <div className={`text-xs font-mono ${shrine.color} truncate mt-0.5`}>
                  {isCurrentHarvesting ? "Channeling..." : shrine.element}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
