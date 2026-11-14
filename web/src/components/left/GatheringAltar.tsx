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
  accountId?: string;
  epoch?: number;
}

const COOLDOWN_SECONDS = Math.round(GATHER_COOLDOWN_NS / 1e9);

interface GatherTracker {
  cooldownUntilMs: number;
  epochUnits: number;
}

function readGatherTracker(storageKey: string): GatherTracker {
  if (typeof window === "undefined") return { cooldownUntilMs: 0, epochUnits: 0 };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { cooldownUntilMs: 0, epochUnits: 0 };
    const parsed = JSON.parse(raw) as Partial<GatherTracker>;
    return {
      cooldownUntilMs: typeof parsed.cooldownUntilMs === "number" ? parsed.cooldownUntilMs : 0,
      epochUnits: typeof parsed.epochUnits === "number" ? parsed.epochUnits : 0,
    };
  } catch {
    return { cooldownUntilMs: 0, epochUnits: 0 };
  }
}

function writeGatherTracker(storageKey: string, next: GatherTracker): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

export const GatheringAltar: React.FC<GatheringAltarProps> = ({
  onHarvest,
  disabled = false,
  accountId = "guest",
  epoch = 0,
}) => {
  const storageKey = `spire_gather:${accountId}:${epoch}`;
  const [harvestingKey, setHarvestingKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);
  const [epochGathered, setEpochGathered] = useState<number>(0);

  // Sync cooldown & epoch cap counter for current account + epoch
  useEffect(() => {
    const saved = readGatherTracker(storageKey);
    setEpochGathered(Math.min(GATHER_EPOCH_CAP, Math.max(0, saved.epochUnits)));
    const remaining = Math.max(0, Math.ceil((saved.cooldownUntilMs - Date.now()) / 1000));
    setCooldownLeft(remaining);
  }, [storageKey]);

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
      border: "border-brass/20 hover:border-ash/50",
      bg: "bg-panel-dark hover:bg-panel-elevated",
    },
    {
      key: "essence:solar" as const,
      name: "Solar Shrine",
      element: "Solar Essence",
      icon: Flame,
      color: "text-solar",
      border: "border-brass/20 hover:border-solar/50",
      bg: "bg-panel-dark hover:bg-solar/10",
    },
    {
      key: "essence:frost" as const,
      name: "Frost Well",
      element: "Frost Essence",
      icon: Snowflake,
      color: "text-frost",
      border: "border-brass/20 hover:border-frost/50",
      bg: "bg-panel-dark hover:bg-frost/10",
    },
    {
      key: "essence:void" as const,
      name: "Void Rift",
      element: "Void Essence",
      icon: Sparkles,
      color: "text-void-text",
      border: "border-brass/20 hover:border-void/50",
      bg: "bg-panel-dark hover:bg-void/15",
    },
  ];

  const capReached = epochGathered >= GATHER_EPOCH_CAP;

  const handleHarvest = async (key: "ore:iron" | "essence:solar" | "essence:frost" | "essence:void") => {
    if (harvestingKey || disabled || cooldownLeft > 0 || capReached) return;
    setHarvestingKey(key);
    try {
      await onHarvest(key);
      const nextUnits = Math.min(GATHER_EPOCH_CAP, epochGathered + GATHER_AMOUNT);
      const nextUntil = Date.now() + COOLDOWN_SECONDS * 1000;
      setEpochGathered(nextUnits);
      setCooldownLeft(COOLDOWN_SECONDS);
      writeGatherTracker(storageKey, { cooldownUntilMs: nextUntil, epochUnits: nextUnits });
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(null), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("E_EPOCH_CAP")) {
        setEpochGathered(GATHER_EPOCH_CAP);
        writeGatherTracker(storageKey, { cooldownUntilMs: 0, epochUnits: GATHER_EPOCH_CAP });
      } else if (msg.includes("E_COOLDOWN")) {
        const nextUntil = Date.now() + COOLDOWN_SECONDS * 1000;
        setCooldownLeft(COOLDOWN_SECONDS);
        writeGatherTracker(storageKey, { cooldownUntilMs: nextUntil, epochUnits: epochGathered });
      }
    } finally {
      setHarvestingKey(null);
    }
  };

  return (
    <section className="obsidian-surface p-5 sm:p-6 flex flex-col justify-between gap-4 h-full">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-frost" aria-hidden="true" />
            <h2 className="font-serif text-lg font-bold tracking-wide text-parchment">
              Gathering Altar
            </h2>
          </div>
          <span
            className={`text-xs font-mono font-mono-numbers font-bold px-2.5 py-1 rounded ${
              capReached
                ? "bg-hp/15 text-hp-text"
                : "bg-panel-dark text-frost"
            }`}
          >
            {epochGathered}/{GATHER_EPOCH_CAP} Epoch Cap
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          {cooldownLeft > 0 ? (
            <span className="text-solar inline-flex items-center gap-1.5 font-mono-numbers font-semibold">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Cooldown active: {cooldownLeft}s remaining
            </span>
          ) : (
            <span className="text-ash">
              +{GATHER_AMOUNT} units per channel · {COOLDOWN_SECONDS}s cooldown
            </span>
          )}
          <span className="text-pewter font-mono-numbers">
            {capReached ? "Cap reached until next epoch" : `${GATHER_EPOCH_CAP - epochGathered} left`}
          </span>
        </div>

        <div
          className="h-1.5 rounded-full bg-panel-dark overflow-hidden"
          role="progressbar"
          aria-label="Epoch gather cap progress"
          aria-valuenow={epochGathered}
          aria-valuemin={0}
          aria-valuemax={GATHER_EPOCH_CAP}
        >
          <div
            style={{ width: `${Math.min(100, (epochGathered / GATHER_EPOCH_CAP) * 100)}%` }}
            className={`h-full transition-all duration-300 ${capReached ? "bg-hp" : "bg-frost"}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {shrines.map((shrine) => {
          const Icon = shrine.icon;
          const isCurrentHarvesting = harvestingKey === shrine.key;
          const isSuccess = successKey === shrine.key;
          const isBlocked = disabled || Boolean(harvestingKey) || cooldownLeft > 0 || capReached;

          return (
            <button
              type="button"
              key={shrine.key}
              onClick={() => handleHarvest(shrine.key)}
              disabled={isBlocked}
              className={`min-h-[100px] p-4 rounded-lg border text-left flex flex-col justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
                shrine.border
              } ${shrine.bg} ${
                isBlocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className={`w-4 h-4 ${shrine.color}`} aria-hidden="true" />
                {isSuccess ? (
                  <Check className="w-4 h-4 text-jackpot" aria-hidden="true" />
                ) : (
                  <span className="text-xs font-mono font-mono-numbers text-parchment font-bold">
                    +{GATHER_AMOUNT} units
                  </span>
                )}
              </div>
              <div className="pt-3">
                <div className="font-semibold text-sm text-parchment truncate">{shrine.name}</div>
                <div className={`text-xs font-mono ${shrine.color} truncate mt-0.5`}>
                  {isCurrentHarvesting
                    ? "Channeling..."
                    : cooldownLeft > 0
                    ? `Wait ${cooldownLeft}s`
                    : shrine.element}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
