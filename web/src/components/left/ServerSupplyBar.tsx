"use client";

import React from "react";
import { BarChart3, AlertTriangle } from "lucide-react";

interface ServerSupplyBarProps {
  supplies: [number, number, number];
}

export const ServerSupplyBar: React.FC<ServerSupplyBarProps> = ({ supplies }) => {
  const total = supplies[0] + supplies[1] + supplies[2];
  const p0 = total > 0 ? (supplies[0] / total) * 100 : 33.33;
  const p1 = total > 0 ? (supplies[1] / total) * 100 : 33.33;
  const p2 = total > 0 ? (supplies[2] / total) * 100 : 33.34;

  const isDominant0 = p0 >= 50;
  const isDominant1 = p1 >= 50;
  const isDominant2 = p2 >= 50;

  return (
    <div className="rounded-xl bg-panel-card border border-white/10 elevation-panel p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-frost" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            Circulating Weapon Supply
          </h2>
        </div>
        <span className="text-xs font-mono text-slate-300">
          Total: <span className="font-mono-numbers text-white font-bold">{total}</span>
        </span>
      </div>

      <p className="text-xs text-slate-300 font-mono">
        Boss elemental resistance shifts from global crafted stock each epoch. Elements above 50% unlock Altar Reforge.
      </p>

      {/* Segmented Stacked Bar with 50% marker */}
      <div className="relative h-5 rounded-full overflow-hidden bg-panel-dark flex border border-white/10">
        <div
          style={{ width: `${p0}%` }}
          className="h-full bg-solar transition-all duration-500"
          title={`Solar: ${supplies[0]} (${p0.toFixed(1)}%)`}
        />
        <div
          style={{ width: `${p1}%` }}
          className="h-full bg-frost transition-all duration-500"
          title={`Frost: ${supplies[1]} (${p1.toFixed(1)}%)`}
        />
        <div
          style={{ width: `${p2}%` }}
          className="h-full bg-void transition-all duration-500"
          title={`Void: ${supplies[2]} (${p2.toFixed(1)}%)`}
        />
        <div
          className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/60 pointer-events-none"
          title="50% Altar Reforge threshold"
        />
      </div>

      {/* Flat Ledger Breakdown */}
      <dl className="grid grid-cols-3 gap-2 pt-1 text-xs font-mono">
        <div className="flex items-center justify-between gap-1">
          <dt className="text-solar flex items-center gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-solar inline-block" aria-hidden="true" />
            Solar
          </dt>
          <dd className="font-mono-numbers text-white font-bold">
            {supplies[0]} ({p0.toFixed(1)}%)
          </dd>
        </div>
        <div className="flex items-center justify-between gap-1">
          <dt className="text-frost flex items-center gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-frost inline-block" aria-hidden="true" />
            Frost
          </dt>
          <dd className="font-mono-numbers text-white font-bold">
            {supplies[1]} ({p1.toFixed(1)}%)
          </dd>
        </div>
        <div className="flex items-center justify-between gap-1">
          <dt className="text-void flex items-center gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-void inline-block" aria-hidden="true" />
            Void
          </dt>
          <dd className="font-mono-numbers text-white font-bold">
            {supplies[2]} ({p2.toFixed(1)}%)
          </dd>
        </div>
      </dl>

      {/* Saturation Alert */}
      {(isDominant0 || isDominant1 || isDominant2) && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {isDominant0 && "Solar exceeds 50% supply: Altar Reforge accepts Solar as burn source, and Boss resistance shifts heavily toward Solar."}
            {isDominant1 && "Frost exceeds 50% supply: Altar Reforge accepts Frost as burn source, and Boss resistance shifts heavily toward Frost."}
            {isDominant2 && "Void exceeds 50% supply: Altar Reforge accepts Void as burn source, and Boss resistance shifts heavily toward Void."}
          </span>
        </div>
      )}
    </div>
  );
};
