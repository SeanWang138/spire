"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, Clock, AlertTriangle, Shield, Timer } from "lucide-react";
import { ENRAGE_FLOOR, FROST_WARD_FLOOR } from "@/lib/spire/constants";

interface LiveHpBarProps {
  currentHp: number;
  maxHp: number;
  floor: number;
  /** Remaining time before the round expires, in nanoseconds (0 = no deadline). */
  timeLeftNs?: number;
  expired?: boolean;
  enrage?: boolean;
  wardElement?: number | null;
}

export const LiveHpBar: React.FC<LiveHpBarProps> = ({
  currentHp,
  maxHp,
  floor,
  timeLeftNs,
  expired = false,
  enrage = false,
  wardElement = null,
}) => {
  const reduced = useReducedMotion();
  const hasDeadline = typeof timeLeftNs === "number" && timeLeftNs > 0;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    hasDeadline ? Math.floor((timeLeftNs as number) / 1e9) : 0
  );

  useEffect(() => {
    if (!hasDeadline) return;
    setSecondsRemaining(Math.floor((timeLeftNs as number) / 1e9));
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeftNs, hasDeadline]);

  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
  const isEnraged = enrage || floor === ENRAGE_FLOOR;

  const barColor = expired
    ? "bg-slate-600"
    : isEnraged
    ? "bg-gradient-to-r from-hp to-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
    : hpPercent < 66
    ? "bg-gradient-to-r from-solar to-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
    : "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]";

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5 font-bold text-white">
          <Heart className={`w-4 h-4 ${isEnraged ? "text-hp animate-pulse" : "text-emerald-400"}`} />
          <span>Boss Health</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Deadline countdown from the contract's time_left_ns */}
          {hasDeadline && !expired && (
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-frost" />
              <span className="font-mono-numbers">{formatTime(secondsRemaining)}</span>
            </div>
          )}
          <span className="font-mono-numbers text-white font-bold text-sm">
            {currentHp} <span className="text-slate-500 text-xs">/ {maxHp}</span> ({hpPercent.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Main HP bar — spring transition, reduced-motion aware */}
      <div className="h-4 w-full rounded-full bg-panel-dark border border-white/10 p-0.5 overflow-hidden">
        <motion.div
          animate={{ width: `${hpPercent}%` }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 22 }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>

      {/* Floor modifier strip — driven by contract state, not guesswork */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        {wardElement !== null && (
          <span className="flex items-center gap-1 text-frost bg-frost/10 px-2 py-1 rounded border border-frost/20">
            <Shield className="w-3 h-3" />
            Frost Ward active (floor {FROST_WARD_FLOOR}: +1500 bps vs Frost)
          </span>
        )}
        {isEnraged && !expired && (
          <span className="flex items-center gap-1 text-hp bg-hp/10 px-2 py-1 rounded border border-hp/20">
            <AlertTriangle className="w-3 h-3" />
            ENRAGE (floor {ENRAGE_FLOOR}): regenerates 10% max HP / 5 min
          </span>
        )}
        {expired && (
          <span className="flex items-center gap-1 text-slate-400 bg-white/5 px-2 py-1 rounded border border-white/10">
            <Timer className="w-3 h-3" />
            Round expired — resolve to settle the pot
          </span>
        )}
      </div>
    </div>
  );
};
