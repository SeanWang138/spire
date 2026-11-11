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
    <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-frost" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            Server Supply Bar
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Total: <span className="font-mono-numbers text-white font-bold">{total}</span>
        </span>
      </div>

      <p className="text-[11px] text-slate-400 font-mono">
        Global weapon saturation shifts Boss elemental adaptation.
      </p>

      {/* Segmented Stacked Bar */}
      <div className="h-4 rounded-full overflow-hidden bg-panel-dark flex border border-white/10 p-0.5">
        <div
          style={{ width: `${p0}%` }}
          className="h-full bg-solar rounded-l-full transition-all duration-500 relative group"
          title={`Solar: ${supplies[0]} (${p0.toFixed(1)}%)`}
        />
        <div
          style={{ width: `${p1}%` }}
          className="h-full bg-frost transition-all duration-500 relative group"
          title={`Frost: ${supplies[1]} (${p1.toFixed(1)}%)`}
        />
        <div
          style={{ width: `${p2}%` }}
          className="h-full bg-void rounded-r-full transition-all duration-500 relative group"
          title={`Void: ${supplies[2]} (${p2.toFixed(1)}%)`}
        />
      </div>

      {/* Legend & Breakdown */}
      <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
        <div className="flex items-center justify-between p-1.5 rounded bg-panel-dark border border-solar/20">
          <span className="text-solar flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-solar inline-block" /> Solar
          </span>
          <span className="font-mono-numbers text-white font-bold">{p0.toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between p-1.5 rounded bg-panel-dark border border-frost/20">
          <span className="text-frost flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-frost inline-block" /> Frost
          </span>
          <span className="font-mono-numbers text-white font-bold">{p1.toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between p-1.5 rounded bg-panel-dark border border-void/20">
          <span className="text-void flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-void inline-block" /> Void
          </span>
          <span className="font-mono-numbers text-white font-bold">{p2.toFixed(1)}%</span>
        </div>
      </div>

      {/* Saturation Warning */}
      {(isDominant0 || isDominant1 || isDominant2) && (
        <div className="flex items-start gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {isDominant0 && "Solar weapon saturation detected (>50%). Boss is highly adapted to Solar!"}
            {isDominant1 && "Frost weapon saturation detected (>50%). Boss is highly adapted to Frost!"}
            {isDominant2 && "Void weapon saturation detected (>50%). Boss is highly adapted to Void!"}
          </span>
        </div>
      )}
    </div>
  );
};
