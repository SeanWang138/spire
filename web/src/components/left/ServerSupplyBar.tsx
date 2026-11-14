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
    <section className="obsidian-surface px-5 py-4 sm:px-6 sm:py-5 space-y-3.5 h-full flex flex-col justify-between">
      <div className="space-y-3.5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-frost shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
              Circulating Weapon Supply
            </h2>
          </div>

          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono">
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
              <dt className="text-void-text flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-void inline-block" aria-hidden="true" />
                Void
              </dt>
              <dd className="font-mono-numbers text-parchment font-bold">
                {supplies[2]} ({p2.toFixed(1)}%)
              </dd>
            </div>
            <div className="flex items-center gap-1.5 pl-3 border-l border-brass/20 text-pewter">
              <dt>Total</dt>
              <dd className="font-mono-numbers text-parchment font-bold">{total}</dd>
            </div>
          </dl>
        </div>

        <div className="relative h-3.5 rounded-full overflow-hidden bg-panel-dark flex">
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
            className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-parchment/70 pointer-events-none"
            title="50% Bonus 3 to 2 Altar Reforge threshold"
          />
        </div>
      </div>

      <div className="pt-3 border-t border-brass/15 flex flex-col gap-2 text-xs">
        <p className="text-ash leading-relaxed">
          Boss resistance shifts hourly from crafted supply; &ge;50% share unlocks Bonus 3 to 2 Reforge (when AI-enabled) while default 2 to 1 stays open.
        </p>

        {(isDominant0 || isDominant1 || isDominant2) && (
          <div className="flex items-center gap-1.5 font-mono text-solar">
            <AlertTriangle className="w-3.5 h-3.5 text-solar shrink-0" aria-hidden="true" />
            <span>
              {isDominant0 && "Solar >=50% share: eligible for Bonus 3 to 2 Reforge; Boss shifts ward toward Solar."}
              {isDominant1 && "Frost >=50% share: eligible for Bonus 3 to 2 Reforge; Boss shifts ward toward Frost."}
              {isDominant2 && "Void >=50% share: eligible for Bonus 3 to 2 Reforge; Boss shifts ward toward Void."}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
