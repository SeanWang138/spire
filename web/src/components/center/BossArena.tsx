"use client";

import React from "react";
import { Skull, ShieldAlert, Zap, Flame, Snowflake, Sparkles } from "lucide-react";

interface BossArenaProps {
  floor: number;
  dominantElement: number; // 0: Solar, 1: Frost, 2: Void
  expired?: boolean;
  enrage?: boolean;
  wardElement?: number | null;
  locked?: boolean;
}

const BOSS_PROFILES: Record<number, { title: string; subtitle: string }> = {
  1: { title: "Malakor, Solar Sentinel", subtitle: "Floor 1 Foundation Warden" },
  2: { title: "Valkyr, Glacial Warden", subtitle: "Floor 2 Frost-Warded Bastion" },
  3: { title: "Kaelen, Void Sovereign", subtitle: "Floor 3 Enraging Apex" },
};

function BossSigilSvg({ floor, strokeColor }: { floor: number; strokeColor: string }) {
  if (floor === 2) {
    // Floor 2: Crystalline Frost-Warded Warden
    return (
      <svg className="w-24 h-24 text-slate-200" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <polygon points="50,10 78,34 72,76 50,92 28,76 22,34" fill="#13192B" stroke={strokeColor} strokeWidth="2.5" />
        <polygon points="50,18 66,36 50,52 34,36" fill="#0F1424" stroke="#38BDF8" strokeWidth="1.5" />
        <line x1="22" y1="34" x2="10" y2="20" stroke="#38BDF8" strokeWidth="2" />
        <line x1="78" y1="34" x2="90" y2="20" stroke="#38BDF8" strokeWidth="2" />
        <polygon points="37,54 47,54 44,61 39,61" fill={strokeColor} />
        <polygon points="53,54 63,54 61,61 56,61" fill={strokeColor} />
        <polygon points="50,66 56,76 50,84 44,76" fill="#38BDF8" />
      </svg>
    );
  }
  if (floor === 3) {
    // Floor 3: Horned Void Sovereign Monolith
    return (
      <svg className="w-24 h-24 text-slate-200" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <polygon points="50,14 82,36 74,78 50,92 26,78 18,36" fill="#13192B" stroke={strokeColor} strokeWidth="2.5" />
        <polygon points="28,30 10,8 36,18" fill="#0F1424" stroke="#EF4444" strokeWidth="2" />
        <polygon points="72,30 90,8 64,18" fill="#0F1424" stroke="#EF4444" strokeWidth="2" />
        <polygon points="34,44 66,44 58,53 42,53" fill="#EF4444" />
        <polygon points="50,58 58,72 50,84 42,72" fill={strokeColor} />
      </svg>
    );
  }
  // Floor 1: Angular Sentinel Mask
  return (
    <svg className="w-24 h-24 text-slate-200" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <polygon points="50,16 74,30 78,64 50,88 22,64 26,30" fill="#13192B" stroke={strokeColor} strokeWidth="2.5" />
      <polygon points="32,26 18,12 38,20" fill="#0F1424" stroke="#64748B" strokeWidth="1.5" />
      <polygon points="68,26 82,12 62,20" fill="#0F1424" stroke="#64748B" strokeWidth="1.5" />
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
}) => {
  const elementStyles = [
    {
      name: "Solar Resonant",
      aura: "from-solar/15 via-solar/5 to-transparent",
      borderColor: "border-solar/40",
      textColor: "text-solar",
      strokeHex: "#F59E0B",
      icon: Flame,
    },
    {
      name: "Frost Crystalline",
      aura: "from-frost/15 via-frost/5 to-transparent",
      borderColor: "border-frost/40",
      textColor: "text-frost",
      strokeHex: "#38BDF8",
      icon: Snowflake,
    },
    {
      name: "Void Entropic",
      aura: "from-void/15 via-void/5 to-transparent",
      borderColor: "border-void/40",
      textColor: "text-void",
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
    <div className={`relative rounded-xl bg-panel-card border ${elementStyles.borderColor} elevation-panel p-5 overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-b ${elementStyles.aura} pointer-events-none`} />

      {/* Header bar */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-panel-elevated flex items-center justify-center shrink-0">
            <Skull className="w-4 h-4 text-hp" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-300 block">
              {profile.subtitle}
            </span>
            <h1 className="font-serif text-lg sm:text-xl font-bold text-white tracking-wide">
              {profile.title}
            </h1>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-panel-dark border ${elementStyles.borderColor} text-xs font-mono ${elementStyles.textColor}`}>
          <DominantIcon className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="font-bold">{elementStyles.name}</span>
        </div>
      </div>

      {/* Central Boss Medallion */}
      <div className="relative z-10 my-3 flex flex-col items-center justify-center py-5">
        <div className="relative flex items-center justify-center">
          <div className={`absolute -inset-4 rounded-full border border-dashed ${elementStyles.borderColor} opacity-60`} />
          <div className="w-32 h-32 rounded-full bg-oled border-2 border-white/15 flex items-center justify-center elevation-float">
            <BossSigilSvg floor={floor} strokeColor={elementStyles.strokeHex} />
          </div>
        </div>
        {locked && (
          <p className="mt-4 text-xs font-mono text-amber-300 bg-solar/10 border border-solar/30 rounded px-3 py-1">
            Floor {floor} opens after Floor {floor - 1} falls
          </p>
        )}
      </div>

      {/* Active Floor Modifiers */}
      <div className="relative z-10 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-slate-300">
          <ShieldAlert className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
          <span>Active Rules</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {floor === 1 && (
            <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              Foundation: No Deadline
            </span>
          )}
          {(floor === 2 || wardElement !== null) && (
            <span className="px-2.5 py-0.5 rounded bg-frost/10 text-frost border border-frost/30">
              Frost Ward: +1500 bps vs Frost · 30m Deadline
            </span>
          )}
          {(floor === 3 || enrage) && (
            <span className="px-2.5 py-0.5 rounded bg-hp/10 text-hp border border-hp/30 font-semibold">
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
