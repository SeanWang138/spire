"use client";

import React from "react";
import { Skull, ShieldAlert, Zap, Flame, Snowflake, Sparkles } from "lucide-react";

interface BossArenaProps {
  floor: number;
  dominantElement: number; // 0: Solar, 1: Frost, 2: Void
  /** Live contract floor state, when available. */
  expired?: boolean;
  enrage?: boolean;
  wardElement?: number | null;
}

export const BossArena: React.FC<BossArenaProps> = ({
  floor,
  dominantElement,
  expired = false,
  enrage = false,
  wardElement = null,
}) => {
  const elementStyles = [
    {
      name: "Solar Resonant",
      aura: "from-solar/20 via-solar/5 to-transparent",
      borderColor: "border-solar/40",
      textColor: "text-solar",
      icon: Flame,
      glow: "glow-solar",
    },
    {
      name: "Frost Crystalline",
      aura: "from-frost/20 via-frost/5 to-transparent",
      borderColor: "border-frost/40",
      textColor: "text-frost",
      icon: Snowflake,
      glow: "glow-frost",
    },
    {
      name: "Void Entropic",
      aura: "from-panel-card to-panel-dark",
      borderColor: "border-void/40",
      textColor: "text-void",
      icon: Sparkles,
      glow: "glow-void",
    },
  ][dominantElement] || {
    name: "Adaptive",
    aura: "from-slate-500/20 to-transparent",
    borderColor: "border-white/20",
    textColor: "text-slate-300",
    icon: Zap,
    glow: "",
  };

  const DominantIcon = elementStyles.icon;

  return (
    <div className={`relative rounded-2xl bg-panel-card border ${elementStyles.borderColor} p-5 shadow-2xl overflow-hidden transition-all duration-700`}>
      {/* Background Radial Glow */}
      <div className={`absolute inset-0 bg-gradient-to-b ${elementStyles.aura} pointer-events-none`} />

      {/* Header Info Bar */}
      <div className="relative z-10 flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-panel-dark border border-white/10">
            <Skull className="w-4 h-4 text-hp" />
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Tower Floor {floor}
            </span>
            <h1 className="text-base font-bold font-mono text-white flex items-center gap-2">
              Sol-Gorath, The Adaptive Colossus
            </h1>
          </div>
        </div>

        {/* Dynamic Elemental State Badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-panel-dark border ${elementStyles.borderColor} text-xs font-mono ${elementStyles.textColor}`}>
          <DominantIcon className="w-3.5 h-3.5 animate-pulse" />
          <span className="font-bold">{elementStyles.name}</span>
        </div>
      </div>

      {/* Animated Boss Card Graphic */}
      <div className="relative z-10 my-4 flex flex-col items-center justify-center py-6">
        <div className="relative">
          {/* Cybernetic Aura Rings */}
          <div className="absolute inset-0 rounded-full border border-dashed border-white/20 animate-[spin_20s_linear_infinite]" />
          <div className={`absolute -inset-4 rounded-full border ${elementStyles.borderColor} opacity-50 animate-[spin_12s_linear_infinite_reverse]`} />
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-panel-elevated to-panel-dark border-2 border-white/20 flex items-center justify-center shadow-2xl relative overflow-hidden group">
            {/* Dynamic Boss Avatar SVG */}
            <svg
              className="w-20 h-20 text-slate-300 group-hover:scale-105 transition-transform"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Armored Cyber Mask */}
              <polygon points="50,15 75,30 80,65 50,88 20,65 25,30" fill="#13192B" stroke={dominantElement === 0 ? "#F59E0B" : dominantElement === 1 ? "#06B6D4" : "#A855F7"} strokeWidth="3" />
              {/* Horns / Crest */}
              <polygon points="30,28 15,10 38,20" fill="#0F1424" stroke="#475569" strokeWidth="2" />
              <polygon points="70,28 85,10 62,20" fill="#0F1424" stroke="#475569" strokeWidth="2" />
              {/* Glowing Visor */}
              <polygon points="35,45 65,45 60,55 40,55" fill={dominantElement === 0 ? "#F59E0B" : dominantElement === 1 ? "#06B6D4" : "#A855F7"} className="animate-pulse" />
              {/* Energy Core */}
              <circle cx="50" cy="70" r="4" fill="#EF4444" />
            </svg>
          </div>
        </div>
      </div>

      {/* Active Floor Modifier Badges */}
      <div className="relative z-10 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-slate-300">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Active Rules:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {floor === 1 && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Foundation: Standard Encounter
            </span>
          )}
          {(floor === 2 || wardElement !== null) && (
            <span className="px-2 py-0.5 rounded bg-frost/10 text-frost border border-frost/30">
              Frost Ward: +1500 bps vs Frost | 30m Deadline
            </span>
          )}
          {(floor === 3 || enrage) && (
            <span className="px-2 py-0.5 rounded bg-hp/10 text-hp border border-hp/30 animate-pulse">
              Enrage: +10% HP regen/5m | 20m Deadline
            </span>
          )}
          {expired && (
            <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/20">
              Round expired
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
            Tribute Confiscation: ≥7000 bps
          </span>
        </div>
      </div>
    </div>
  );
};
