"use client";

import React from "react";
import { Radar, AlertOctagon, Flame, Snowflake, Sparkles, ArrowUpRight, RefreshCw } from "lucide-react";
import { bpsToPercent } from "@/lib/utils/cn";
import { analyzeResistance, TRIBUTE_THRESHOLD_BPS } from "@/lib/simulation/pricing";

interface MetaRadarProps {
  resistances: [number, number, number];
  epoch?: number;
  nextEpochInNs?: number;
  onUpdateMeta?: () => Promise<void>;
  updatingMeta?: boolean;
}

export const MetaRadar: React.FC<MetaRadarProps> = ({
  resistances,
  epoch,
  nextEpochInNs,
  onUpdateMeta,
  updatingMeta = false,
}) => {
  const analysis = analyzeResistance(resistances);
  const maxBps = 8500;
  const cx = 100;
  const cy = 100;
  const rMax = 65;

  const r0 = (resistances[0] / maxBps) * rMax;
  const r1 = (resistances[1] / maxBps) * rMax;
  const r2 = (resistances[2] / maxBps) * rMax;

  const p0x = cx;
  const p0y = cy - r0;

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

  const epochMins =
    typeof nextEpochInNs === "number" ? Math.max(0, Math.ceil(nextEpochInNs / 60_000_000_000)) : null;
  const canShiftMeta = epochMins === 0 && Boolean(onUpdateMeta);

  const bars = [
    {
      label: "Solar Blade",
      bps: resistances[0],
      textClass: "text-solar",
      barClass: "bg-solar",
      icon: <Flame className="w-3.5 h-3.5 text-solar" aria-hidden="true" />,
    },
    {
      label: "Frost Spear",
      bps: resistances[1],
      textClass: "text-frost",
      barClass: "bg-frost",
      icon: <Snowflake className="w-3.5 h-3.5 text-frost" aria-hidden="true" />,
    },
    {
      label: "Void Scythe",
      bps: resistances[2],
      textClass: "text-void",
      barClass: "bg-void",
      icon: <Sparkles className="w-3.5 h-3.5 text-void" aria-hidden="true" />,
    },
  ];

  return (
    <div className="obsidian-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-solar" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            3-Element Meta Radar
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
          <span>Pool</span>
          <span className="font-bold text-jackpot font-mono-numbers">
            {analysis.totalBps} bps
          </span>
        </div>
      </div>

      {/* SVG Radar + Flat Progress Strips (no card-in-card nesting) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 items-center">
        <div className="flex justify-center py-1">
          <svg
            className="w-44 h-44"
            viewBox="0 0 200 200"
            role="img"
            aria-label={`Resistance radar: Solar ${resistances[0]} bps, Frost ${resistances[1]} bps, Void ${resistances[2]} bps`}
          >
            <polygon
              points="100,35 43.7,132.5 156.3,132.5"
              fill="none"
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <polygon points="100,55 58.7,122.5 141.3,122.5" fill="none" stroke="#262421" strokeWidth="1" />
            <line x1="100" y1="100" x2="100" y2="30" stroke="#524B42" strokeWidth="1" />
            <line x1="100" y1="100" x2="39.4" y2="135" stroke="#524B42" strokeWidth="1" />
            <line x1="100" y1="100" x2="160.6" y2="135" stroke="#524B42" strokeWidth="1" />

            {/* Tribute Threshold Warning Ring (7000 bps) */}
            <circle
              cx="100"
              cy="100"
              r={(TRIBUTE_THRESHOLD_BPS / maxBps) * rMax}
              fill="none"
              stroke="#F43F5E"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.7"
            />

            <polygon
              points={radarPolygon}
              fill="rgba(245, 158, 11, 0.22)"
              stroke="#F59E0B"
              strokeWidth="2"
              className="transition-all duration-500"
            />

            <circle cx={p0x} cy={p0y} r="4" fill="#F59E0B" />
            <circle cx={p1x} cy={p1y} r="4" fill="#38BDF8" />
            <circle cx={p2x} cy={p2y} r="4" fill="#A855F7" />

            <text x="100" y="20" fill="#F59E0B" fontSize="11" fontWeight="bold" textAnchor="middle">
              SOLAR
            </text>
            <text x="26" y="150" fill="#38BDF8" fontSize="11" fontWeight="bold" textAnchor="middle">
              FROST
            </text>
            <text x="174" y="150" fill="#A855F7" fontSize="11" fontWeight="bold" textAnchor="middle">
              VOID
            </text>
          </svg>
        </div>

        <div className="divide-y divide-brass/15 font-mono text-xs">
          {bars.map((bar) => (
            <div key={bar.label} className="py-2 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`${bar.textClass} flex items-center gap-1.5 font-bold`}>
                  {bar.icon} {bar.label}
                </span>
                <span className="font-mono-numbers text-parchment font-bold">
                  {bar.bps} bps ({bpsToPercent(bar.bps)})
                </span>
              </div>
              <div className="h-2 rounded-full bg-oled overflow-hidden">
                <div
                  style={{ width: `${(bar.bps / maxBps) * 100}%` }}
                  className={`h-full ${bar.barClass} rounded-full transition-all duration-500`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Epoch Timing & Permissionless update_meta() trigger */}
      {typeof epoch === "number" && (
        <div className="pt-2 border-t border-brass/20 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <span className="text-ash">
            Epoch {epoch} · {epochMins === 0 ? "Rebalance Ready" : `Next shift in ~${epochMins}m`}
          </span>
          {canShiftMeta && onUpdateMeta && (
            <button
              type="button"
              onClick={onUpdateMeta}
              disabled={updatingMeta}
              className="min-h-[44px] px-3 py-1 rounded-lg bg-frost/15 hover:bg-frost/25 border border-frost/40 text-frost font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${updatingMeta ? "animate-spin" : ""}`} aria-hidden="true" />
              {updatingMeta ? "Shifting..." : "Trigger Epoch Shift"}
            </button>
          )}
        </div>
      )}

      {/* Boss Tribute Confiscation Alert (>=7000 bps) */}
      {analysis.tributeRisk && (
        <div className="p-2.5 rounded-lg bg-hp-alert/15 border border-hp-alert/40 text-hp-alert text-xs font-mono flex items-start gap-2">
          <AlertOctagon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-bold uppercase tracking-wider block">
              Boss Tribute Confiscation Hazard
            </span>
            <span className="text-slate-200 text-[11px] leading-relaxed block mt-0.5">
              Resistance reached {bpsToPercent(TRIBUTE_THRESHOLD_BPS)}. Striking with that element confiscates tradeable weapons (starter-locked weapons are immune).
            </span>
          </div>
        </div>
      )}

      {/* Counter-Affinity Tactical Recommendation */}
      <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs font-mono flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-emerald-300">
          <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>Best Counter</span>
        </div>
        <span className="font-bold text-white font-mono-numbers text-right">
          {weakestName} ({bpsToPercent(weakestBps)})
        </span>
      </div>
    </div>
  );
};
