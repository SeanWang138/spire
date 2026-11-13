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
    <section className="obsidian-surface px-5 py-4 sm:px-6 sm:py-5 space-y-3.5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-frost shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
            Circulating Weapon Supply
          </h2>
        </div>

        {/* Inline Tabular Legend + Total */}
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <dt className="text-solar flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-solar inline-block" aria-hidden="true" />
              Solar
            </dt>
            <dd className="font-mono-numbers text-parchment font-bold">
              {supplies[0]} ({p0.toFixed(1)}%)
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-frost flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-frost inline-block" aria-hidden="true" />
              Frost
            </dt>
            <dd className="font-mono-numbers text-parchment font-bold">
              {supplies[1]} ({p1.toFixed(1)}%)
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-void flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-void inline-block" aria-hidden="true" />
              Void
            </dt>
            <dd className="font-mono-numbers text-parchment font-bold">
              {supplies[2]} ({p2.toFixed(1)}%)
            </dd>
          </div>
          <div className="flex items-center gap-1.5 pl-3 border-l border-white/10 text-pewter">
            <dt>Total</dt>
            <dd className="font-mono-numbers text-parchment font-bold">{total}</dd>
          </div>
        </dl>
      </div>

      {/* Segmented Stacked Bar with 50% marker */}
      <div className="relative h-3.5 rounded-full overflow-hidden bg-[#07080D] flex border border-white/[0.08]">
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

      <div className="pt-3 border-t border-white/[0.07] flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-xs">
        <p className="text-pewter">
          Boss resistance shifts each epoch from crafted stock; &ge;50% unlocks Altar Reforge.
        </p>

        {(isDominant0 || isDominant1 || isDominant2) && (
          <div className="flex items-center gap-1.5 font-mono text-amber-300 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              {isDominant0 && "Solar ≥50%: Reforge burn open · Boss favors Solar ward."}
              {isDominant1 && "Frost ≥50%: Reforge burn open · Boss favors Frost ward."}
              {isDominant2 && "Void ≥50%: Reforge burn open · Boss favors Void ward."}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
