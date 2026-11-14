"use client";

import React from "react";
import { Terminal, Flame, Snowflake, Sparkles, ExternalLink } from "lucide-react";
import { truncateAccountId, getExplorerTxUrl } from "@/lib/utils/cn";

export interface LogEntry {
  id: string;
  timestamp: string;
  accountId: string;
  element: "solar" | "frost" | "void";
  damage: number;
  remainingHp: number;
  isCrit?: boolean;
  isConfiscated?: boolean;
  note?: string;
  txHash?: string;
}

interface DamageLogProps {
  logs: LogEntry[];
}

export const DamageLog: React.FC<DamageLogProps> = ({ logs }) => {
  const elementIcons = {
    solar: <Flame className="w-3.5 h-3.5 text-solar flex-shrink-0" aria-hidden="true" />,
    frost: <Snowflake className="w-3.5 h-3.5 text-frost flex-shrink-0" aria-hidden="true" />,
    void: <Sparkles className="w-3.5 h-3.5 text-void-text flex-shrink-0" aria-hidden="true" />,
  };

  return (
    <div className="obsidian-surface overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-brass/20">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-jackpot shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
            Combat Chronicle &amp; Strike Feed
          </h2>
        </div>
        <span className="text-xs font-mono text-ash">Session Feed</span>
      </div>

      <div className="h-44 overflow-y-auto bg-oled divide-y divide-brass/15 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-ash text-xs px-4 text-center">
            No strikes dispatched this session. Launch an attack to record on-chain transactions.
          </div>
        ) : (
          logs.map((log) => {
            const txUrl = getExplorerTxUrl(log.txHash);
            return (
              <div
                key={log.id}
                className={`px-4 py-2 flex flex-wrap items-center justify-between gap-2 ${
                  log.isConfiscated ? "bg-hp/10" : log.isCrit ? "bg-solar/10" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-pewter font-mono-numbers shrink-0">
                    {log.timestamp}
                  </span>
                  {elementIcons[log.element]}
                  <span className="text-parchment font-medium truncate">
                    {truncateAccountId(log.accountId, 16)}
                  </span>
                  {log.note && (
                    <span className="text-xs text-ash truncate">{log.note}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {log.isConfiscated && (
                    <span className="text-xs px-2 py-0.5 rounded bg-hp/20 text-hp-text font-bold">
                      TRIBUTE SEIZED
                    </span>
                  )}
                  {log.isCrit && (
                    <span className="text-xs px-2 py-0.5 rounded bg-solar/20 text-solar font-bold">
                      CRIT
                    </span>
                  )}
                  {log.damage > 0 && (
                    <span className="font-mono-numbers font-bold text-parchment">
                      ~-{log.damage} DMG
                    </span>
                  )}
                  <span className="text-xs font-mono-numbers text-ash">
                    [{log.remainingHp} HP]
                  </span>
                  {txUrl && (
                    <a
                      href={txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] px-2 -my-1.5 text-xs text-frost hover:underline inline-flex items-center gap-1.5 rounded"
                      title={`Inspect tx ${log.txHash} on NearBlocks`}
                    >
                      <span>tx</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
