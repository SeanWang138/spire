"use client";

import React from "react";
import { Radar, AlertOctagon, Flame, Snowflake, Sparkles, ArrowUpRight, RefreshCw, Shield } from "lucide-react";
import { bpsToPercent } from "@/lib/utils/cn";
import {
  analyzeResistance,
  FROST_WARD_BONUS_BPS,
  FROST_WARD_FLOOR,
  TOTAL_RESISTANCE_BPS,
  TRIBUTE_THRESHOLD_BPS,
} from "@/lib/simulation/pricing";

export interface MetaRadarProps {
  resistances: [number, number, number];
  epoch?: number;
  nextEpochInNs?: number;
  onUpdateMeta?: () => Promise<void>;
  updatingMeta?: boolean;
  /** Optional UI floor (1..3) so Floor 2 Frost Ward (+1,500 bps) is annotated clearly. */
  floor?: number;
  /** Optional base meta resistances before floor wards are applied. */
  baseResistances?: [number, number, number];
}

export const MetaRadar: React.FC<MetaRadarProps> = ({
  resistances,
  epoch,
  nextEpochInNs,
  onUpdateMeta,
  updatingMeta = false,
  floor,
  baseResistances,
}) => {
  const analysis = analyzeResistance(resistances);
  const maxBps = 8500;
  const cx = 100;
  const cy = 100;
  const rMax = 62;

  const r0 = Math.min(rMax, (resistances[0] / maxBps) * rMax);
  const r1 = Math.min(rMax, (resistances[1] / maxBps) * rMax);
  const r2 = Math.min(rMax, (resistances[2] / maxBps) * rMax);

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

  const hasFrostWard =
    floor === FROST_WARD_FLOOR ||
    Boolean(baseResistances && resistances[1] > baseResistances[1]);

  const epochMins =
    typeof nextEpochInNs === "number" ? Math.max(0, Math.ceil(nextEpochInNs / 60_000_000_000)) : null;
  const canShiftMeta = epochMins === 0 && Boolean(onUpdateMeta);

  const bars = [
    {
      label: "Solar Blade",
      bps: resistances[0],
      baseBps: baseResistances?.[0],
      wardBonus: 0,
      textClass: "text-solar",
      barClass: "bg-solar",
      icon: <Flame className="w-3.5 h-3.5 text-solar shrink-0" aria-hidden="true" />,
    },
    {
      label: "Frost Spear",
      bps: resistances[1],
      baseBps: baseResistances?.[1],
      wardBonus: hasFrostWard ? FROST_WARD_BONUS_BPS : 0,
      textClass: "text-frost",
      barClass: "bg-frost",
      icon: <Snowflake className="w-3.5 h-3.5 text-frost shrink-0" aria-hidden="true" />,
    },
    {
      label: "Void Scythe",
      bps: resistances[2],
      baseBps: baseResistances?.[2],
      wardBonus: 0,
      textClass: "text-void-text",
      barClass: "bg-void",
      icon: <Sparkles className="w-3.5 h-3.5 text-void-text shrink-0" aria-hidden="true" />,
    },
  ];

  return (
    <div className="obsidian-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-solar shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
            {hasFrostWard ? "Floor 2 Effective Meta Radar" : "3-Element Meta Radar"}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-ash">
          <span>Pool</span>
          <span className="font-bold text-jackpot font-mono-numbers">
            {analysis.totalBps.toLocaleString("en-US")} bps
          </span>
        </div>
      </div>

      {hasFrostWard && (
        <div className="px-3 py-2 rounded-lg bg-frost/15 text-frost text-xs font-mono flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 font-semibold">
            <Shield className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Floor 2 Frost Ward Active</span>
          </span>
          <span className="font-mono-numbers font-bold">+{FROST_WARD_BONUS_BPS.toLocaleString("en-US")} bps</span>
        </div>
      )}

      {/* SVG Radar + Flat Progress Strips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 items-center">
        <div className="flex justify-center py-1">
          <svg
            className="w-44 h-44"
            viewBox="0 0 200 200"
            role="img"
            aria-label={`Effective resistance radar: Solar ${resistances[0]} bps, Frost ${resistances[1]} bps, Void ${resistances[2]} bps`}
          >
            <polygon
              points="100,38 46.3,131 153.7,131"
              fill="none"
              stroke="#524B42"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <polygon points="100,56 61.9,122 138.1,122" fill="none" stroke="#36322C" strokeWidth="1" />
            <line x1="100" y1="100" x2="100" y2="33" stroke="#524B42" strokeWidth="1" />
            <line x1="100" y1="100" x2="42" y2="133.5" stroke="#524B42" strokeWidth="1" />
            <line x1="100" y1="100" x2="158" y2="133.5" stroke="#524B42" strokeWidth="1" />

            {/* Tribute Threshold Warning Ring (7000 bps) */}
            <circle
              cx="100"
              cy="100"
              r={(TRIBUTE_THRESHOLD_BPS / maxBps) * rMax}
              fill="none"
              stroke="#EF4444"
              strokeWidth="1.2"
              strokeDasharray="2,2"
              opacity="0.8"
            />

            <polygon
              points={radarPolygon}
              fill="rgba(242, 166, 59, 0.22)"
              stroke="#F2A63B"
              strokeWidth="2"
              className="transition-all duration-500"
            />

            <circle cx={p0x} cy={p0y} r="4" fill="#F2A63B" />
            <circle cx={p1x} cy={p1y} r="4" fill="#38BDF8" />
            <circle cx={p2x} cy={p2y} r="4" fill="#A855F7" />

            <text x="100" y="21" fill="#F2A63B" fontSize="12" fontWeight="bold" textAnchor="middle">
              SOLAR
            </text>
            <text x="27" y="152" fill="#38BDF8" fontSize="12" fontWeight="bold" textAnchor="middle">
              FROST
            </text>
            <text x="173" y="152" fill="#D8B4FE" fontSize="12" fontWeight="bold" textAnchor="middle">
              VOID
            </text>
          </svg>
        </div>

        <div className="divide-y divide-brass/15 font-mono text-xs">
          {bars.map((bar) => (
            <div key={bar.label} className="py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <span className={`${bar.textClass} flex items-center gap-1.5 font-bold`}>
                  {bar.icon}
                  <span>{bar.label}</span>
                  {bar.wardBonus > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-frost/15 text-frost font-semibold">
                      +{bar.wardBonus.toLocaleString("en-US")} Ward
                    </span>
                  )}
                </span>
                <span className="font-mono-numbers text-parchment font-bold">
                  {bar.bps.toLocaleString("en-US")} bps ({bpsToPercent(bar.bps)})
                </span>
              </div>
              <div className="h-2 rounded-full bg-oled overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, (bar.bps / maxBps) * 100)}%` }}
                  className={`h-full ${bar.barClass} rounded-full transition-all duration-500`}
                />
              </div>
              {bar.wardBonus > 0 && typeof bar.baseBps === "number" && (
                <div className="mt-1 text-xs text-ash font-mono-numbers">
                  Base {bar.baseBps.toLocaleString("en-US")} bps + {bar.wardBonus.toLocaleString("en-US")} bps Frost Ward
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Epoch Timing & Permissionless update_meta() trigger */}
      {typeof epoch === "number" && (
        <div className="pt-2.5 border-t border-brass/20 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="text-ash">
            Epoch {epoch} · {epochMins === 0 ? "Rebalance Ready" : `Next shift in ~${epochMins}m`}
            {analysis.totalBps !== TOTAL_RESISTANCE_BPS && " · Ward applied"}
          </span>
          {canShiftMeta && onUpdateMeta && (
            <button
              type="button"
              onClick={onUpdateMeta}
              disabled={updatingMeta}
              className="min-h-[44px] px-3 py-2 rounded-lg bg-frost/15 hover:bg-frost/25 border border-frost/45 text-frost font-bold inline-flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${updatingMeta ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>{updatingMeta ? "Shifting..." : "Trigger Epoch Shift"}</span>
            </button>
          )}
        </div>
      )}

      {/* Boss Tribute Confiscation Alert (>=7000 bps) */}
      {analysis.tributeRisk && (
        <div className="p-3 rounded-lg bg-hp/15 text-hp-text text-xs font-mono flex items-start gap-2">
          <AlertOctagon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-bold uppercase tracking-wider block">
              Boss Tribute Hazard (&ge; {bpsToPercent(TRIBUTE_THRESHOLD_BPS)})
            </span>
            <span className="text-ash text-xs leading-relaxed block mt-0.5">
              Effective resistance reached {TRIBUTE_THRESHOLD_BPS.toLocaleString("en-US")} bps. Striking with unlocked non-starter weapons confiscates 1 weapon into round loot (starter-locked and last remaining weapons are spared).
            </span>
          </div>
        </div>
      )}

      {/* Counter-Affinity Tactical Recommendation */}
      <div className="px-3 py-2 rounded-lg bg-jackpot/10 text-xs font-mono flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-jackpot font-semibold">
          <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Best Counter</span>
        </div>
        <span className="font-bold text-parchment font-mono-numbers text-right">
          {weakestName} ({bpsToPercent(weakestBps)})
        </span>
      </div>
    </div>
  );
};
