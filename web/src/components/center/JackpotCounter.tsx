"use client";

import React, { useState } from "react";
import { Coins, Trophy, Award, Gift, Swords } from "lucide-react";
import { formatNearAmount } from "@/lib/utils/cn";
import { calculateJackpotSplit } from "@/lib/simulation/pricing";

interface JackpotCounterProps {
  jackpotYocto: string;
  playerDamage: number;
  round?: number;
  /** Round total damage — straight from the floor state. */
  totalDamage?: number;
  loot?: [number, number, number];
  onClaimPayout?: () => Promise<void>;
  disabled?: boolean;
}

export const JackpotCounter: React.FC<JackpotCounterProps> = ({
  jackpotYocto,
  playerDamage,
  round,
  totalDamage = 0,
  loot = [0, 0, 0],
  onClaimPayout,
  disabled = false,
}) => {
  const [isClaiming, setIsClaiming] = useState(false);

  const rawYocto = BigInt(jackpotYocto || "0");
  const jackpotNear = Number(rawYocto / 10n ** 20n) / 10000;
  const split = calculateJackpotSplit(jackpotNear, playerDamage, totalDamage, false);
  const totalLootWeapons = loot[0] + loot[1] + loot[2];

  const handleClaim = async () => {
    if (!onClaimPayout || isClaiming || disabled) return;
    setIsClaiming(true);
    try {
      await onClaimPayout();
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="obsidian-surface border-t-jackpot/40 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-jackpot" aria-hidden="true" />
          <h2 className="text-xs uppercase font-bold tracking-widest font-mono text-slate-200">
            Floor Bounty Pool
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {typeof round === "number" && (
            <span className="text-slate-300">
              Your Round {round} DMG:{" "}
              <strong className="font-mono-numbers text-white">{playerDamage}</strong>
            </span>
          )}
          <span className="text-[11px] uppercase px-2 py-0.5 rounded bg-jackpot/10 text-jackpot border border-jackpot/30">
            90% Damage / 10% Kill
          </span>
        </div>
      </div>

      {/* Main Jackpot Counter */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <span className="text-2xl sm:text-3xl font-black font-mono-numbers text-white tracking-tight">
            {formatNearAmount(jackpotYocto, 4)}
          </span>
          <span className="ml-2 text-xs font-mono text-slate-300">Bounty</span>
        </div>

        {onClaimPayout && (
          <button
            type="button"
            onClick={handleClaim}
            disabled={disabled || isClaiming}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-jackpot hover:bg-jackpot/90 text-oled font-mono font-bold text-xs uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isClaiming ? "Claiming..." : "Claim Payout"}
          </button>
        )}
      </div>

      {/* Split Details Breakdown (flat table cells inside card) */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs font-mono">
        <div className="flex sm:flex-col justify-between gap-1">
          <dt className="flex items-center gap-1.5 text-slate-300">
            <Trophy className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>90% Raiders</span>
          </dt>
          <dd className="font-mono-numbers font-bold text-emerald-400">
            {split.proportionalPoolNear.toFixed(2)} NEAR
          </dd>
        </div>

        <div className="flex sm:flex-col justify-between gap-1">
          <dt className="flex items-center gap-1.5 text-slate-300">
            <Award className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
            <span>10% Last Strike</span>
          </dt>
          <dd className="font-mono-numbers font-bold text-solar">
            {split.lastAttackBountyNear.toFixed(2)} NEAR
          </dd>
        </div>

        <div className="flex sm:flex-col justify-between gap-1">
          <dt className="flex items-center gap-1.5 text-slate-300">
            <Gift className="w-3.5 h-3.5 text-jackpot" aria-hidden="true" />
            <span>Your Est. Share</span>
          </dt>
          <dd className="font-mono-numbers font-bold text-jackpot">
            {split.playerEstimatedPayoutNear.toFixed(2)} NEAR
          </dd>
        </div>
      </dl>

      {totalLootWeapons > 0 && (
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300">
          <span className="inline-flex items-center gap-1.5 text-hp font-semibold">
            <Swords className="w-3.5 h-3.5" aria-hidden="true" />
            Seized Tribute Loot
          </span>
          <span className="font-mono-numbers">
            {loot[0]} Solar · {loot[1]} Frost · {loot[2]} Void
          </span>
        </div>
      )}
    </div>
  );
};
