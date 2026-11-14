"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, ShieldAlert, Zap, Flame, Snowflake, Sparkles, Timer, Trophy, Lock } from "lucide-react";
import { useMotionControl } from "@/lib/spire/motion";

export const BOSS_PROFILES: Record<number, { title: string; subtitle: string; floorRoman: string }> = {
  1: { title: "Malakor, Solar Sentinel", subtitle: "Floor 1 Foundation Warden", floorRoman: "Floor I" },
  2: { title: "Valkyr, Glacial Warden", subtitle: "Floor 2 Frost-Warded Bastion", floorRoman: "Floor II" },
  3: { title: "Kaelen, Void Sovereign", subtitle: "Floor 3 Enraging Apex", floorRoman: "Floor III" },
};

interface BossArenaProps {
  floor: number;
  dominantElement: number; // 0: Solar, 1: Frost, 2: Void
  expired?: boolean;
  enrage?: boolean;
  wardElement?: number | null;
  locked?: boolean;
  lastDamage?: number | null;
  strikeSeq?: number;
  round?: number;
  headingLevel?: "h1" | "h2";
}

function BossSigilSvg({ floor, strokeColor }: { floor: number; strokeColor: string }) {
  if (floor === 2) {
    return (
      <svg className="w-28 h-28" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <polygon points="60,8 96,34 88,88 60,112 32,88 24,34" fill="#0B1120" stroke={strokeColor} strokeWidth="2.2" />
        <polygon points="60,18 82,38 60,60 38,38" fill="#090D18" stroke="#38BDF8" strokeWidth="1.6" />
        <line x1="24" y1="34" x2="10" y2="18" stroke="#38BDF8" strokeWidth="2.2" />
        <line x1="96" y1="34" x2="110" y2="18" stroke="#38BDF8" strokeWidth="2.2" />
        <line x1="24" y1="74" x2="12" y2="88" stroke={strokeColor} strokeWidth="1.5" opacity="0.7" />
        <line x1="96" y1="74" x2="108" y2="88" stroke={strokeColor} strokeWidth="1.5" opacity="0.7" />
        <polygon points="42,60 56,60 52,69 45,69" fill={strokeColor} />
        <polygon points="64,60 78,60 75,69 68,69" fill={strokeColor} />
        <polygon points="60,76 68,90 60,102 52,90" fill="#38BDF8" />
        <circle cx="60" cy="38" r="4" fill="#F3EAD8" />
      </svg>
    );
  }
  if (floor === 3) {
    return (
      <svg className="w-28 h-28" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <polygon points="60,12 98,38 90,90 60,112 30,90 22,38" fill="#0E0B1A" stroke={strokeColor} strokeWidth="2.2" />
        <polygon points="32,32 10,6 42,18" fill="#090A10" stroke="#EF4444" strokeWidth="2" />
        <polygon points="88,32 110,6 78,18" fill="#090A10" stroke="#EF4444" strokeWidth="2" />
        <polygon points="48,18 60,4 72,18 60,28" fill="#181A28" stroke="#F2A63B" strokeWidth="1.4" />
        <polygon points="39,50 81,50 71,61 49,61" fill="#EF4444" />
        <polygon points="60,68 70,85 60,102 50,85" fill={strokeColor} />
        <circle cx="60" cy="55" r="3.5" fill="#F3EAD8" />
      </svg>
    );
  }
  return (
    <svg className="w-28 h-28" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <polygon points="60,14 92,32 96,76 60,108 24,76 28,32" fill="#111018" stroke={strokeColor} strokeWidth="2.2" />
      <polygon points="36,28 18,10 44,20" fill="#090A10" stroke="#E5A93B" strokeWidth="1.6" />
      <polygon points="84,28 102,10 76,20" fill="#090A10" stroke="#E5A93B" strokeWidth="1.6" />
      <polygon points="60,22 72,36 60,48 48,36" fill="none" stroke="#F2A63B" strokeWidth="1.4" />
      <rect x="40" y="54" width="40" height="9" rx="1.5" fill={strokeColor} />
      <circle cx="60" cy="82" r="5.5" fill="#EF4444" />
      <circle cx="60" cy="82" r="2.2" fill="#F3EAD8" />
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
  round,
  headingLevel = "h1",
}) => {
  const { paused, reducedMotion } = useMotionControl();
  const freeze = paused || reducedMotion;

  const elementStyles = [
    {
      name: "Solar Resonant",
      aura: "from-solar/20 via-solar/5 to-transparent",
      borderColor: "border-solar/50",
      textColor: "text-solar",
      strokeHex: "#F2A63B",
      icon: Flame,
    },
    {
      name: "Frost Crystalline",
      aura: "from-frost/20 via-frost/5 to-transparent",
      borderColor: "border-frost/50",
      textColor: "text-frost",
      strokeHex: "#38BDF8",
      icon: Snowflake,
    },
    {
      name: "Void Entropic",
      aura: "from-void/20 via-void/5 to-transparent",
      borderColor: "border-void/50",
      textColor: "text-void-text",
      strokeHex: "#A855F7",
      icon: Sparkles,
    },
  ][dominantElement] || {
    name: "Adaptive",
    aura: "from-brass/15 to-transparent",
    borderColor: "border-brass/35",
    textColor: "text-parchment",
    strokeHex: "#E5A93B",
    icon: Zap,
  };

  const DominantIcon = elementStyles.icon;
  const profile = BOSS_PROFILES[floor] ?? BOSS_PROFILES[1];
  const HeadingTag = headingLevel;
  const headingText =
    headingLevel === "h1"
      ? profile.title
      : typeof round === "number"
      ? `Sanctum Chamber · Round ${round}`
      : "Sanctum Chamber";

  return (
    <div className="relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-b ${elementStyles.aura} pointer-events-none`} />

      {/* Boss Header Plate (No kicker/eyebrow above heading per DESIGN.md:95) */}
      <div className="relative z-10 px-5 pt-5 pb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-[#090A10] border border-brass/30 flex items-center justify-center shrink-0 mt-0.5">
            <Skull className="w-5 h-5 text-hp-text" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <HeadingTag className="font-serif text-xl sm:text-2xl font-bold text-parchment tracking-wide leading-tight">
              {headingText}
            </HeadingTag>
            <p className="font-lore italic text-base text-ash mt-0.5">
              {profile.subtitle}
              {typeof round === "number" && headingLevel === "h1" ? ` · Round ${round}` : ""}
            </p>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#090A10] border ${elementStyles.borderColor} text-xs font-mono ${elementStyles.textColor}`}
        >
          <DominantIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="font-bold">{elementStyles.name}</span>
        </div>
      </div>

      {/* Composed 3-Plaque Gothic Encounter Stage */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-brass/20 border-t border-brass/20 bg-[#090A10]/70">
        {/* Left Plaque: Phase & Ward */}
        <div className="md:col-span-4 p-4 flex flex-col justify-between gap-3 font-mono text-xs">
          <div className="space-y-1">
            <span className="text-pewter uppercase tracking-wider font-semibold block">
              Encounter Phase
            </span>
            <div className="text-parchment font-bold font-mono-numbers">
              {profile.floorRoman} · Round {typeof round === "number" ? round : 0}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-pewter uppercase tracking-wider font-semibold block">
              Active Ward
            </span>
            {floor === 2 || wardElement !== null ? (
              <div className="text-frost font-semibold">
                Frost Ward: +1,500 bps vs Frost
              </div>
            ) : (
              <div className="text-ash">Meta-Driven Resistance Only</div>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-pewter uppercase tracking-wider font-semibold block">
              Tribute Rule
            </span>
            <div className="text-ash">Seizes 1 unlocked weapon at &ge;7,000 bps</div>
          </div>
        </div>

        {/* Centerpiece: Boss Crown / Sigil & Astrolabe Ring */}
        <div className="md:col-span-4 py-5 px-4 flex flex-col items-center justify-center relative">
          <div className="relative flex items-center justify-center">
            <motion.svg
              viewBox="0 0 200 200"
              aria-hidden="true"
              animate={freeze ? undefined : { rotate: 360 }}
              transition={freeze ? undefined : { duration: 32, repeat: Infinity, ease: "linear" }}
              className="pointer-events-none absolute w-44 h-44 opacity-80"
            >
              <circle
                cx="100"
                cy="100"
                r="92"
                fill="none"
                stroke={elementStyles.strokeHex}
                strokeOpacity="0.32"
                strokeWidth="1.2"
                strokeDasharray="10 6"
              />
              <circle
                cx="100"
                cy="100"
                r="76"
                fill="none"
                stroke="#E5A93B"
                strokeOpacity="0.22"
                strokeWidth="1"
              />
              <polygon
                points="100,12 176,144 24,144"
                fill="none"
                stroke={elementStyles.strokeHex}
                strokeOpacity="0.24"
                strokeWidth="1"
              />
              <polygon
                points="100,188 24,56 176,56"
                fill="none"
                stroke={elementStyles.strokeHex}
                strokeOpacity="0.24"
                strokeWidth="1"
              />
            </motion.svg>

            <motion.div
              whileHover={freeze ? undefined : { scale: 1.04 }}
              className={`relative z-10 w-32 h-32 rounded-full bg-[#06060A] border-2 ${elementStyles.borderColor} flex items-center justify-center transition-transform duration-300`}
            >
              <BossSigilSvg floor={floor} strokeColor={elementStyles.strokeHex} />
            </motion.div>

            {/* Floating Critical Damage Burst */}
            <AnimatePresence>
              {strikeSeq > 0 && lastDamage !== null && (
                <motion.div
                  key={strikeSeq}
                  initial={freeze ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.75 }}
                  animate={{ opacity: 1, y: -34, scale: 1.08 }}
                  exit={{ opacity: 0, y: -56 }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none absolute -top-2 z-20 px-3 py-1 rounded-full bg-solar text-oled font-mono-numbers text-sm font-extrabold border border-amber-200"
                >
                  -{lastDamage.toLocaleString("en-US")} DMG
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {locked && (
            <p className="mt-4 inline-flex items-center gap-2 text-xs font-mono text-solar bg-solar/15 rounded-lg px-3 py-1.5 text-center">
              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Opens after Floor {floor - 1} falls</span>
            </p>
          )}
        </div>

        {/* Right Plaque: Enrage, Timeout & Settlement */}
        <div className="md:col-span-4 p-4 flex flex-col justify-between gap-3 font-mono text-xs">
          <div className="space-y-1">
            <span className="text-pewter uppercase tracking-wider font-semibold block">
              Enrage Aura
            </span>
            {floor === 3 || enrage ? (
              <div className="text-hp-text font-semibold inline-flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>+10% HP regen / 5m</span>
              </div>
            ) : (
              <div className="text-ash">Steady Boss HP (No Enrage)</div>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-pewter uppercase tracking-wider font-semibold block">
              Round Clock
            </span>
            {expired ? (
              <div className="text-hp-text font-semibold inline-flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Round Expired · Settles Lazily on Next Strike</span>
              </div>
            ) : floor === 1 ? (
              <div className="text-jackpot font-semibold">Foundation · No Timeout</div>
            ) : floor === 2 ? (
              <div className="text-frost font-semibold">30m Deadline (Carries on Timeout)</div>
            ) : (
              <div className="text-hp-text font-semibold">20m Deadline (Carries on Timeout)</div>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-pewter uppercase tracking-wider font-semibold block">
              Defeat Settlement
            </span>
            {floor === 3 ? (
              <div className="text-void-text font-semibold inline-flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Mints NEP-171 SVG Trophy</span>
              </div>
            ) : (
              <div className="text-ash">10% Drip Upward · 90/10 Split</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
