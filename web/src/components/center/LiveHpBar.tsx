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

  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
  const [ghostPercent, setGhostPercent] = useState<number>(hpPercent);

  useEffect(() => {
    const t = setTimeout(() => setGhostPercent(hpPercent), 320);
    return () => clearTimeout(t);
  }, [hpPercent]);

  useEffect(() => {
    if (!hasDeadline) return;
    setSecondsRemaining(Math.floor((timeLeftNs as number) / 1e9));
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeftNs, hasDeadline]);

  const isEnraged = enrage || floor === ENRAGE_FLOOR;

  const barColor = expired
    ? "bg-slate-600"
    : isEnraged
    ? "bg-gradient-to-r from-red-600 to-rose-400"
    : hpPercent < 66
    ? "bg-gradient-to-r from-amber-600 to-amber-400"
    : "bg-gradient-to-r from-emerald-600 to-emerald-400";

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="px-5 pb-5 pt-4 border-t border-brass/20 space-y-3 bg-[#090A10]/85">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 font-bold text-parchment uppercase tracking-wider">
          <Heart className={`w-4 h-4 ${isEnraged ? "text-hp" : "text-emerald-400"}`} aria-hidden="true" />
          <span>Boss Vitality</span>
        </div>
        <div className="flex items-center gap-3">
          {hasDeadline && !expired && (
            <div className="flex items-center gap-1 text-ash">
              <Clock className="w-3.5 h-3.5 text-frost" aria-hidden="true" />
              <span className="font-mono-numbers">{formatTime(secondsRemaining)}</span>
            </div>
          )}
          <span className="font-mono-numbers text-parchment font-bold text-sm">
            {currentHp.toLocaleString("en-US")} <span className="text-pewter text-xs">/ {maxHp.toLocaleString("en-US")}</span> ({hpPercent.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Multi-Layered Segmented Boss Vitality Bar with Delayed Damage Ghost Trail */}
      <div className="relative h-6 w-full rounded-lg bg-oled border border-brass/20 p-0.5 overflow-hidden">
        <div
          className="absolute inset-y-0.5 left-0.5 rounded-md bg-rose-500/45 transition-all duration-700 ease-out"
          style={{ width: `calc(${ghostPercent}% - 4px)` }}
        />
        <motion.div
          animate={{ width: `${hpPercent}%` }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 24 }}
          className={`relative z-10 h-full rounded-md ${barColor}`}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 grid grid-cols-10 divide-x divide-[#04060D]/65"
        >
          {Array.from({ length: 10 }, (_, idx) => (
            <div key={idx} />
          ))}
        </div>
      </div>

      {(wardElement !== null || (isEnraged && !expired) || expired) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          {wardElement !== null && floor === FROST_WARD_FLOOR && (
            <span className="inline-flex items-center gap-1.5 text-sky-200 font-semibold">
              <Shield className="w-3.5 h-3.5 text-frost" aria-hidden="true" />
              Frost Ward active: Frost resistance boosted by +1,500 bps
            </span>
          )}
          {isEnraged && !expired && (
            <span className="inline-flex items-center gap-1.5 text-rose-200 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-hp" aria-hidden="true" />
              Enrage Active: regenerating +10% max HP every 5m
            </span>
          )}
          {expired && (
            <span className="inline-flex items-center gap-1.5 text-slate-300 font-semibold">
              <Timer className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
              Round timer expired
            </span>
          )}
        </div>
      )}
    </div>
  );
};
