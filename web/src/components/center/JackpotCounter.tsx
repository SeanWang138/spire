"use client";

import React, { useState } from "react";
import { Coins, Trophy, Award, Gift, ArrowRight } from "lucide-react";
import { formatNearAmount } from "@/lib/utils/cn";
import { calculateJackpotSplit } from "@/lib/simulation/pricing";

interface JackpotCounterProps {
  jackpotYocto: string;
  playerDamage: number;
  /** Round total damage — straight from the floor state. */
  totalDamage?: number;
  onClaimPayout?: () => Promise<void>;
  disabled?: boolean;
}

export const JackpotCounter: React.FC<JackpotCounterProps> = ({
  jackpotYocto,
  playerDamage,
  totalDamage = 0,
  onClaimPayout,
  disabled = false,
}) => {
  const [isClaiming, setIsClaiming] = useState(false);

  // Parse yocto to numeric NEAR for split calculation
  const rawYocto = BigInt(jackpotYocto || "0");
  const jackpotNear = Number(rawYocto / 10n ** 20n) / 10000;

  const split = calculateJackpotSplit(jackpotNear, playerDamage, totalDamage, false);

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
    <div className="rounded-xl bg-panel-card border border-jackpot/30 p-4 shadow-xl relative overflow-hidden">
      {/* Decorative ambient glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-jackpot/10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-jackpot" />
          <h2 className="text-xs uppercase font-bold tracking-widest font-mono text-slate-300">
            Current Jackpot Pool
          </h2>
        </div>
        <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-jackpot/10 text-jackpot border border-jackpot/30">
          90% Damage / 10% Last Hit
        </span>
      </div>

      {/* Main Jackpot Counter */}
      <div className="relative z-10 my-2 flex items-baseline justify-between">
        <div>
          <span className="text-2xl sm:text-3xl font-black font-mono-numbers text-white tracking-tight">
            {formatNearAmount(jackpotYocto, 4)}
          </span>
          <span className="ml-2 text-xs font-mono text-slate-400">Total Bounty</span>
        </div>

        {onClaimPayout && (
          <button
            onClick={handleClaim}
            disabled={disabled || isClaiming}
            className="px-3 py-1.5 rounded-lg bg-jackpot hover:bg-jackpot/90 text-oled font-mono font-bold text-xs uppercase transition-all shadow-lg shadow-jackpot/20 active:scale-95 disabled:opacity-50"
          >
            {isClaiming ? "Claiming..." : "Claim Payout"}
          </button>
        )}
      </div>

      {/* Split Details Breakdown */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-xs font-mono">
        {/* 90% Proportional Pool */}
        <div className="p-2 rounded bg-panel-dark border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Trophy className="w-3.5 h-3.5 text-emerald-400" />
            <span>90% Raiders Pool:</span>
          </div>
          <span className="font-mono-numbers font-bold text-emerald-400">
            {split.proportionalPoolNear.toFixed(2)} N
          </span>
        </div>

        {/* 10% Last Attack Executioner Bounty */}
        <div className="p-2 rounded bg-panel-dark border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Award className="w-3.5 h-3.5 text-solar" />
            <span>10% Last Strike:</span>
          </div>
          <span className="font-mono-numbers font-bold text-solar">
            {split.lastAttackBountyNear.toFixed(2)} N
          </span>
        </div>

        {/* Estimated Player Share */}
        <div className="p-2 rounded bg-panel-dark border border-jackpot/20 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Gift className="w-3.5 h-3.5 text-jackpot" />
            <span>Your Est. Share:</span>
          </div>
          <span className="font-mono-numbers font-bold text-jackpot">
            {split.playerEstimatedPayoutNear.toFixed(2)} N
          </span>
        </div>
      </div>
    </div>
  );
};
