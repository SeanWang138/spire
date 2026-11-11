"use client";

import React from "react";
import { Terminal, Flame, Snowflake, Sparkles, Skull, AlertCircle } from "lucide-react";
import { truncateAccountId } from "@/lib/utils/cn";

export interface LogEntry {
  id: string;
  timestamp: string;
  accountId: string;
  element: "solar" | "frost" | "void";
  damage: number;
  remainingHp: number;
  isCrit?: boolean;
  isConfiscated?: boolean;
}

interface DamageLogProps {
  logs: LogEntry[];
}

export const DamageLog: React.FC<DamageLogProps> = ({ logs }) => {
  const elementIcons = {
    solar: <Flame className="w-3 h-3 text-solar flex-shrink-0" />,
    frost: <Snowflake className="w-3 h-3 text-frost flex-shrink-0" />,
    void: <Sparkles className="w-3 h-3 text-void flex-shrink-0" />,
  };

  return (
    <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            Combat Telemetry &amp; Damage Feed
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Live RPC Stream</span>
      </div>

      <div className="h-40 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs">
            Awaiting combat strikes...
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-1.5 rounded flex items-center justify-between bg-panel-dark border ${
                log.isConfiscated
                  ? "border-hp/30 bg-hp/5"
                  : log.isCrit
                  ? "border-solar/30 bg-solar/5"
                  : "border-white/5"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-[11px] text-slate-400 font-mono-numbers">
                  {log.timestamp}
                </span>
                {elementIcons[log.element]}
                <span className="text-slate-300 font-medium truncate">
                  {truncateAccountId(log.accountId, 14)}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {log.isConfiscated && (
                  <span className="text-[11px] px-1 rounded bg-hp/20 text-hp font-bold">
                    TRIBUTE TIKET
                  </span>
                )}
                {log.isCrit && (
                  <span className="text-[11px] px-1 rounded bg-solar/20 text-solar font-bold">
                    CRIT
                  </span>
                )}
                <span className="font-mono-numbers font-bold text-white">
                  -{log.damage} DMG
                </span>
                <span className="text-[11px] font-mono-numbers text-slate-400">
                  [{log.remainingHp} HP]
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
