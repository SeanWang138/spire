"use client";

import React, { useState } from "react";
import { Coins, Trophy, Award, Gift, Swords, AlertCircle } from "lucide-react";
import { formatNearAmount, parseYoctoSafe } from "@/lib/utils/cn";
import { calculateJackpotSplit } from "@/lib/simulation/pricing";

interface JackpotCounterProps {
  jackpotYocto: string;
  playerDamage: number;
  round?: number;
  /** Round total damage straight from the floor state. */
  totalDamage?: number;
  loot?: [number, number, number];
  onClaimPayout?: () => Promise<void>;
  disabled?: boolean;
  claimLabel?: string;
}

export const JackpotCounter: React.FC<JackpotCounterProps> = ({
  jackpotYocto,
  playerDamage,
  round,
  totalDamage = 0,
  loot = [0, 0, 0],
  onClaimPayout,
  disabled = false,
  claimLabel = "Claim Payout",
}) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const rawYocto = parseYoctoSafe(jackpotYocto);
  const jackpotNear = Number(rawYocto / 10n ** 18n) / 1_000_000;
  const split = calculateJackpotSplit(jackpotNear, playerDamage, totalDamage, false);
  const totalLootWeapons = (loot[0] ?? 0) + (loot[1] ?? 0) + (loot[2] ?? 0);

  const handleClaim = async () => {
    if (!onClaimPayout || isClaiming || disabled) return;
    setIsClaiming(true);
    setClaimError(null);
    try {
      await onClaimPayout();
    } catch (err: unknown) {
      setClaimError(
        err instanceof Error ? err.message : "Failed to claim payout. Check session key and retry."
      );
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="obsidian-surface border-t-jackpot/40 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-jackpot shrink-0" aria-hidden="true" />
          <h2 className="text-sm uppercase font-bold tracking-wider font-mono text-parchment">
            Floor Bounty Pool
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {typeof round === "number" && (
            <span className="text-ash">
              Your Round {round} DMG:{" "}
              <strong className="font-mono-numbers text-parchment">{playerDamage}</strong>
            </span>
          )}
          <span className="text-xs uppercase px-2 py-0.5 rounded bg-jackpot/15 text-jackpot border border-jackpot/35 font-semibold">
            90% Damage / 10% Kill
          </span>
        </div>
      </div>

      {/* Main Jackpot Counter */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-black font-mono-numbers text-parchment tracking-tight">
            {formatNearAmount(rawYocto, 4)}
          </span>
          <span className="text-xs font-mono text-ash">Active Round Pool</span>
        </div>

        {onClaimPayout ? (
          <button
            type="button"
            onClick={handleClaim}
            disabled={disabled || isClaiming}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-jackpot hover:bg-jackpot/90 text-oled font-mono font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-45"
          >
            <Trophy className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isClaiming ? "Claiming..." : claimLabel}</span>
          </button>
        ) : (
          <span className="text-xs font-mono text-ash">
            Distributes automatically when boss HP hits 0
          </span>
        )}
      </div>

      {claimError && (
        <div
          role="alert"
          className="px-3 py-2 rounded-lg bg-hp/15 border border-hp/40 text-hp-text text-xs font-mono flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{claimError}</span>
        </div>
      )}

      {/* Split Details Breakdown */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-brass/20 text-xs font-mono">
        <div className="flex sm:flex-col justify-between gap-1">
          <dt className="flex items-center gap-1.5 text-ash">
            <Trophy className="w-3.5 h-3.5 text-jackpot shrink-0" aria-hidden="true" />
            <span>90% Raiders</span>
          </dt>
          <dd className="font-mono-numbers font-bold text-jackpot">
            {split.proportionalPoolNear.toFixed(4)} NEAR
          </dd>
        </div>

        <div className="flex sm:flex-col justify-between gap-1">
          <dt className="flex items-center gap-1.5 text-ash">
            <Award className="w-3.5 h-3.5 text-solar shrink-0" aria-hidden="true" />
            <span>10% Last Strike</span>
          </dt>
          <dd className="font-mono-numbers font-bold text-solar">
            {split.lastAttackBountyNear.toFixed(4)} NEAR
          </dd>
        </div>

        <div className="flex sm:flex-col justify-between gap-1">
          <dt className="flex items-center gap-1.5 text-ash">
            <Gift className="w-3.5 h-3.5 text-frost shrink-0" aria-hidden="true" />
            <span>Your Est. Share</span>
          </dt>
          <dd className="font-mono-numbers font-bold text-frost">
            {split.playerEstimatedPayoutNear.toFixed(4)} NEAR
          </dd>
        </div>
      </dl>

      {totalLootWeapons > 0 && (
        <div className="pt-2.5 border-t border-brass/20 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-ash">
          <span className="inline-flex items-center gap-1.5 text-hp-text font-semibold">
            <Swords className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Seized Tribute Loot in Round Pool</span>
          </span>
          <span className="font-mono-numbers text-parchment font-semibold">
            {loot[0]} Solar · {loot[1]} Frost · {loot[2]} Void
          </span>
        </div>
      )}
    </div>
  );
};
