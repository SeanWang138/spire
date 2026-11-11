"use client";

import React from "react";
import { Radar, AlertOctagon, Flame, Snowflake, Sparkles, ShieldAlert, ArrowUpRight } from "lucide-react";
import { bpsToPercent } from "@/lib/utils/cn";
import { analyzeResistance, TRIBUTE_THRESHOLD_BPS } from "@/lib/simulation/pricing";

interface MetaRadarProps {
  resistances: [number, number, number];
}

export const MetaRadar: React.FC<MetaRadarProps> = ({ resistances }) => {
  const analysis = analyzeResistance(resistances);

  // SVG Radar Geometry: Center (100, 100), Radius 70
  // Apexes:
  // Solar: top (100, 30)
  // Frost: bottom-left (39.38, 135)
  // Void: bottom-right (160.62, 135)
  const maxBps = 8500;
  const cx = 100;
  const cy = 100;
  const rMax = 65;

  // Normalized radii based on bps
  const r0 = (resistances[0] / maxBps) * rMax;
  const r1 = (resistances[1] / maxBps) * rMax;
  const r2 = (resistances[2] / maxBps) * rMax;

  // Coordinates
  const p0x = cx;
  const p0y = cy - r0;

  // Angles: Frost is at 210 deg (bottom left), Void is at 330 deg (bottom right)
  const a1 = (210 * Math.PI) / 180;
  const p1x = cx + r1 * Math.cos(a1);
  const p1y = cy - r1 * Math.sin(a1);

  const a2 = (330 * Math.PI) / 180;
  const p2x = cx + r2 * Math.cos(a2);
  const p2y = cy - r2 * Math.sin(a2);

  const radarPolygon = `${p0x},${p0y} ${p1x},${p1y} ${p2x},${p2y}`;

  const elementNames = ["Solar Blade", "Frost Spear", "Void Scythe"];
  const weakestName = elementNames[analysis.weakestElement];
  const weakestBps = resistances[analysis.weakestElement];

  return (
    <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-solar" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            3-Element Meta Radar
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <span>Total:</span>
          <span className="font-bold text-jackpot font-mono-numbers">
            {analysis.totalBps} bps (135.00%)
          </span>
        </div>
      </div>

      {/* SVG Radar + Tri-bar Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* Radar Graphic */}
        <div className="flex justify-center relative py-2">
          <svg className="w-48 h-48 drop-shadow-lg" viewBox="0 0 200 200">
            {/* Background Axis Triangles */}
            <polygon
              points="100,35 43.7,132.5 156.3,132.5"
              fill="none"
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <polygon
              points="100,55 58.7,122.5 141.3,122.5"
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
            />
            {/* Axes from Center */}
            <line x1="100" y1="100" x2="100" y2="30" stroke="#475569" strokeWidth="1" />
            <line x1="100" y1="100" x2="39.4" y2="135" stroke="#475569" strokeWidth="1" />
            <line x1="100" y1="100" x2="160.6" y2="135" stroke="#475569" strokeWidth="1" />

            {/* Tribute Threshold Warning Ring (7000 bps) */}
            <circle
              cx="100"
              cy="100"
              r={(TRIBUTE_THRESHOLD_BPS / maxBps) * rMax}
              fill="none"
              stroke="#F43F5E"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.6"
            />

            {/* Dynamic Resistance Polygon */}
            <polygon
              points={radarPolygon}
              fill="rgba(245, 158, 11, 0.25)"
              stroke="#F59E0B"
              strokeWidth="2"
              className="transition-all duration-700"
            />

            {/* Vertex Nodes */}
            <circle cx={p0x} cy={p0y} r="4" fill="#F59E0B" />
            <circle cx={p1x} cy={p1y} r="4" fill="#06B6D4" />
            <circle cx={p2x} cy={p2y} r="4" fill="#A855F7" />

            {/* Labels */}
            <text x="100" y="22" fill="#F59E0B" fontSize="10" fontWeight="bold" textAnchor="middle">
              SOLAR
            </text>
            <text x="25" y="148" fill="#06B6D4" fontSize="10" fontWeight="bold" textAnchor="middle">
              FROST
            </text>
            <text x="175" y="148" fill="#A855F7" fontSize="10" fontWeight="bold" textAnchor="middle">
              VOID
            </text>
          </svg>
        </div>

        {/* Resistance Bars & Exact BPS */}
        <div className="space-y-2.5 font-mono text-xs">
          {/* Solar */}
          <div className="p-2 rounded bg-panel-dark border border-solar/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-solar flex items-center gap-1 font-bold">
                <Flame className="w-3.5 h-3.5" /> Solar Blade
              </span>
              <span className="font-mono-numbers text-white font-bold">
                {resistances[0]} bps ({bpsToPercent(resistances[0])})
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                style={{ width: `${(resistances[0] / maxBps) * 100}%` }}
                className="h-full bg-solar rounded-full transition-all duration-500"
              />
            </div>
          </div>

          {/* Frost */}
          <div className="p-2 rounded bg-panel-dark border border-frost/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-frost flex items-center gap-1 font-bold">
                <Snowflake className="w-3.5 h-3.5" /> Frost Spear
              </span>
              <span className="font-mono-numbers text-white font-bold">
                {resistances[1]} bps ({bpsToPercent(resistances[1])})
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                style={{ width: `${(resistances[1] / maxBps) * 100}%` }}
                className="h-full bg-frost rounded-full transition-all duration-500"
              />
            </div>
          </div>

          {/* Void */}
          <div className="p-2 rounded bg-panel-dark border border-void/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-void flex items-center gap-1 font-bold">
                <Sparkles className="w-3.5 h-3.5" /> Void Scythe
              </span>
              <span className="font-mono-numbers text-white font-bold">
                {resistances[2]} bps ({bpsToPercent(resistances[2])})
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                style={{ width: `${(resistances[2] / maxBps) * 100}%` }}
                className="h-full bg-void rounded-full transition-all duration-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Boss Tribute Confiscation Alert (≥7000 bps) */}
      {analysis.tributeRisk && (
        <div className="p-2.5 rounded-lg bg-hp-alert/15 border border-hp-alert/40 text-hp-alert text-xs font-mono flex items-start gap-2 animate-pulse">
          <AlertOctagon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider block">
              ⚠️ Boss Tribute Confiscation Hazard Active!
            </span>
            <span className="text-slate-300 text-[11px]">
              Element resistance has reached or exceeded 7000 bps ({bpsToPercent(TRIBUTE_THRESHOLD_BPS)}).
              Attacking with this element will confiscate your weapon (unless protected by starter-lock or defensive stance).
            </span>
          </div>
        </div>
      )}

      {/* Counter-Affinity Tactical Recommendation */}
      <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-emerald-300">
          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          <span>Optimal Strike Counter:</span>
        </div>
        <span className="font-bold text-white">
          {weakestName} is lowest ({bpsToPercent(weakestBps)})
        </span>
      </div>
    </div>
  );
};
