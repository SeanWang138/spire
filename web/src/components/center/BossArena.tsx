"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, ShieldAlert, Zap, Flame, Snowflake, Sparkles } from "lucide-react";
import { useMotionControl } from "@/lib/spire/motion";

interface BossArenaProps {
  floor: number;
  dominantElement: number; // 0: Solar, 1: Frost, 2: Void
  expired?: boolean;
  enrage?: boolean;
  wardElement?: number | null;
  locked?: boolean;
  lastDamage?: number | null;
  strikeSeq?: number;
}

const BOSS_PROFILES: Record<number, { title: string; subtitle: string }> = {
  1: { title: "Malakor, Solar Sentinel", subtitle: "Floor 1 Foundation Warden" },
  2: { title: "Valkyr, Glacial Warden", subtitle: "Floor 2 Frost-Warded Bastion" },
  3: { title: "Kaelen, Void Sovereign", subtitle: "Floor 3 Enraging Apex" },
};

function BossSigilSvg({ floor, strokeColor }: { floor: number; strokeColor: string }) {
  if (floor === 2) {
    return (
      <svg className="w-24 h-24 text-slate-200" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <polygon points="50,10 78,34 72,76 50,92 28,76 22,34" fill="#10182C" stroke={strokeColor} strokeWidth="2.5" />
        <polygon points="50,18 66,36 50,52 34,36" fill="#0A1020" stroke="#38BDF8" strokeWidth="1.5" />
        <line x1="22" y1="34" x2="10" y2="20" stroke="#38BDF8" strokeWidth="2" />
        <line x1="78" y1="34" x2="90" y2="20" stroke="#38BDF8" strokeWidth="2" />
        <polygon points="37,54 47,54 44,61 39,61" fill={strokeColor} />
        <polygon points="53,54 63,54 61,61 56,61" fill={strokeColor} />
        <polygon points="50,66 56,76 50,84 44,76" fill="#38BDF8" />
      </svg>
    );
  }
  if (floor === 3) {
    return (
      <svg className="w-24 h-24 text-slate-200" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <polygon points="50,14 82,36 74,78 50,92 26,78 18,36" fill="#10182C" stroke={strokeColor} strokeWidth="2.5" />
        <polygon points="28,30 10,8 36,18" fill="#0A1020" stroke="#EF4444" strokeWidth="2" />
        <polygon points="72,30 90,8 64,18" fill="#0A1020" stroke="#EF4444" strokeWidth="2" />
        <polygon points="34,44 66,44 58,53 42,53" fill="#EF4444" />
        <polygon points="50,58 58,72 50,84 42,72" fill={strokeColor} />
      </svg>
    );
  }
  return (
    <svg className="w-24 h-24 text-slate-200" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <polygon points="50,16 74,30 78,64 50,88 22,64 26,30" fill="#10182C" stroke={strokeColor} strokeWidth="2.5" />
      <polygon points="32,26 18,12 38,20" fill="#0A1020" stroke="#64748B" strokeWidth="1.5" />
      <polygon points="68,26 82,12 62,20" fill="#0A1020" stroke="#64748B" strokeWidth="1.5" />
      <rect x="35" y="45" width="30" height="8" rx="1" fill={strokeColor} />
      <circle cx="50" cy="70" r="4.5" fill="#EF4444" />
    </svg>
  );
}

export const BossArena: React.FC<BossArenaProps> = ({
  floor,
  dominantElement,
  expired = false,
  enrage = false,
  wardElement = null,
  locked = false,
  lastDamage = null,
  strikeSeq = 0,
}) => {
  const { paused, reducedMotion } = useMotionControl();
  const freeze = paused || reducedMotion;

  const elementStyles = [
    {
      name: "Solar Resonant",
      aura: "from-solar/20 via-solar/5 to-transparent",
      borderColor: "border-solar/45",
      textColor: "text-amber-200",
      strokeHex: "#F59E0B",
      icon: Flame,
    },
    {
      name: "Frost Crystalline",
      aura: "from-frost/20 via-frost/5 to-transparent",
      borderColor: "border-frost/45",
      textColor: "text-sky-200",
      strokeHex: "#38BDF8",
      icon: Snowflake,
    },
    {
      name: "Void Entropic",
      aura: "from-void/20 via-void/5 to-transparent",
      borderColor: "border-void/45",
      textColor: "text-purple-200",
      strokeHex: "#A855F7",
      icon: Sparkles,
    },
  ][dominantElement] || {
    name: "Adaptive",
    aura: "from-slate-500/15 to-transparent",
    borderColor: "border-white/20",
    textColor: "text-slate-300",
    strokeHex: "#94A3B8",
    icon: Zap,
  };

  const DominantIcon = elementStyles.icon;
  const profile = BOSS_PROFILES[floor] ?? BOSS_PROFILES[1];

  return (
    <div className="relative p-5 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-b ${elementStyles.aura} pointer-events-none`} />

      {/* Boss Header Plate */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#090A10] border border-brass/25 flex items-center justify-center shrink-0">
            <Skull className="w-4 h-4 text-hp" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-ash block">
              {profile.subtitle}
            </span>
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-parchment tracking-wide">
              {profile.title}
            </h1>
          </div>
        </div>

        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#090A10] border ${elementStyles.borderColor} text-xs font-mono ${elementStyles.textColor}`}
        >
          <DominantIcon className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="font-bold">{elementStyles.name}</span>
        </div>
      </div>

      {/* Boss Monolith Medallion Stage with Rotating Arcane Seal & Floating Damage Burst */}
      <div className="relative z-10 my-2 flex flex-col items-center justify-center py-5">
        <div className="relative flex items-center justify-center">
          {/* Outer Rotating Arcane Sigil Halo */}
          <motion.svg
            viewBox="0 0 180 180"
            aria-hidden="true"
            animate={freeze ? undefined : { rotate: 360 }}
            transition={freeze ? undefined : { duration: 28, repeat: Infinity, ease: "linear" }}
            className="pointer-events-none absolute w-44 h-44 sm:w-48 sm:h-48 opacity-75"
          >
            <circle
              cx="90"
              cy="90"
              r="84"
              fill="none"
              stroke={elementStyles.strokeHex}
              strokeOpacity="0.35"
              strokeWidth="1.2"
              strokeDasharray="10 6"
            />
            <polygon
              points="90,8 161,130 19,130"
              fill="none"
              stroke={elementStyles.strokeHex}
              strokeOpacity="0.22"
              strokeWidth="1"
            />
            <polygon
              points="90,172 19,50 161,50"
              fill="none"
              stroke={elementStyles.strokeHex}
              strokeOpacity="0.22"
              strokeWidth="1"
            />
          </motion.svg>

          <motion.div
            whileHover={freeze ? undefined : { scale: 1.05 }}
            className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#060914] border-2 ${elementStyles.borderColor} flex items-center justify-center shadow-[0_0_28px_rgba(0,0,0,0.8)] transition-all duration-300`}
          >
            <BossSigilSvg floor={floor} strokeColor={elementStyles.strokeHex} />
          </motion.div>

          {/* Floating Critical Damage Popup on Attack Dispatch */}
          <AnimatePresence>
            {strikeSeq > 0 && lastDamage !== null && (
              <motion.div
                key={strikeSeq}
                initial={freeze ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.7 }}
                animate={{ opacity: 1, y: -34, scale: 1.12 }}
                exit={{ opacity: 0, y: -56 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none absolute -top-2 z-20 px-3 py-1 rounded-full bg-solar text-slate-950 font-mono-numbers text-sm font-extrabold border border-amber-200 shadow-lg"
              >
                -{lastDamage.toLocaleString("en-US")} DMG
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {locked && (
          <p className="mt-5 text-xs font-mono text-amber-200 bg-solar/15 border border-solar/40 rounded-lg px-3.5 py-1.5">
            Floor {floor} opens after Floor {floor - 1} falls
          </p>
        )}
      </div>

      {/* Active Floor Modifiers */}
      <div className="relative z-10 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-slate-300">
          <ShieldAlert className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
          <span>Encounter Modifiers</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {floor === 1 && (
            <span className="px-2.5 py-0.5 rounded bg-emerald-500/15 text-emerald-200 border border-emerald-500/35">
              Foundation: No Deadline
            </span>
          )}
          {(floor === 2 || wardElement !== null) && (
            <span className="px-2.5 py-0.5 rounded bg-frost/15 text-sky-200 border border-frost/35">
              Frost Ward: +1500 bps vs Frost · 30m Deadline
            </span>
          )}
          {(floor === 3 || enrage) && (
            <span className="px-2.5 py-0.5 rounded bg-hp/15 text-rose-200 border border-hp/35 font-semibold">
              Enrage: +10% HP regen / 5m · 20m Deadline
            </span>
          )}
          {expired && (
            <span className="px-2.5 py-0.5 rounded bg-white/10 text-slate-200 border border-white/20">
              Round Expired
            </span>
          )}
          <span className="px-2.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
            Tribute Seizure &ge; 7000 bps
          </span>
        </div>
      </div>
    </div>
  );
};
