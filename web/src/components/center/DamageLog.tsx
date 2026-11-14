"use client";

import React, { useState } from "react";
import { Terminal, Flame, Snowflake, Sparkles, ExternalLink, Radio } from "lucide-react";
import { truncateAccountId, getExplorerTxUrl } from "@/lib/utils/cn";
import type { IndexedSpireEvent } from "@/lib/spire/telemetry";

export interface LogEntry {
  id: string;
  timestamp: string;
  accountId: string;
  element: "solar" | "frost" | "void";
  damage: number;
  remainingHp: number;
  isExact?: boolean;
  isCrit?: boolean;
  isConfiscated?: boolean;
  note?: string;
  txHash?: string;
}

interface DamageLogProps {
  logs: LogEntry[];
  accountId?: string;
  globalEvents?: IndexedSpireEvent[];
  indexerConnected?: boolean;
}

function summarizeGlobalEvent(ev: IndexedSpireEvent): {
  actor: string;
  summary: string;
  badge?: string;
} {
  const payload = ev.data?.[0] ?? {};
  const actor =
    typeof payload.account_id === "string"
      ? truncateAccountId(payload.account_id, 18)
      : typeof payload.killer === "string"
        ? truncateAccountId(payload.killer, 18)
        : "spire.testnet";

  switch (ev.event) {
    case "raid":
      return {
        actor,
        summary: `F${Number(payload.floor ?? 0) + 1} hit for ${Number(payload.damage ?? 0)} DMG [${Number(payload.boss_remaining_hp ?? 0)} HP]`,
        badge: payload.tribute_taken ? "TRIBUTE" : undefined,
      };
    case "boss_defeated":
      return {
        actor,
        summary: `Defeated F${Number(payload.floor ?? 0) + 1} Round ${Number(payload.round ?? 0)} Boss`,
        badge: "KILL",
      };
    case "meta_updated":
      return {
        actor: "keeper",
        summary: `Epoch ${Number(payload.epoch ?? 0)} resistance shifted`,
        badge: "EPOCH",
      };
    case "merchant_trade":
      return {
        actor,
        summary: `${String(payload.side ?? "trade")} ${Number(payload.qty ?? 0)}x ${String(payload.item_id ?? "item")}`,
      };
    case "backer_staked":
      return {
        actor,
        summary: `Backed F${Number(payload.floor ?? 0) + 1} Vault`,
        badge: "BACKER",
      };
    default:
      return { actor, summary: ev.event };
  }
}

export const DamageLog: React.FC<DamageLogProps> = ({
  logs,
  accountId,
  globalEvents = [],
  indexerConnected = false,
}) => {
  const [feedTab, setFeedTab] = useState<"personal" | "global">("personal");
  const hasGlobalFeed = globalEvents.length > 0 || indexerConnected;

  const elementIcons = {
    solar: <Flame className="w-3.5 h-3.5 text-solar flex-shrink-0" aria-hidden="true" />,
    frost: <Snowflake className="w-3.5 h-3.5 text-frost flex-shrink-0" aria-hidden="true" />,
    void: <Sparkles className="w-3.5 h-3.5 text-void-text flex-shrink-0" aria-hidden="true" />,
  };

  return (
    <div className="obsidian-surface overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-brass/20">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-jackpot shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
            Combat Chronicle &amp; Strike Feed
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {hasGlobalFeed && (
            <div className="inline-flex rounded-md border border-brass/25 bg-panel-dark p-0.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setFeedTab("personal")}
                className={`px-2 py-1 rounded transition-colors ${
                  feedTab === "personal" ? "bg-panel-elevated text-parchment font-bold" : "text-ash hover:text-parchment"
                }`}
              >
                Yours ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setFeedTab("global")}
                className={`px-2 py-1 rounded inline-flex items-center gap-1 transition-colors ${
                  feedTab === "global" ? "bg-frost/15 text-frost font-bold" : "text-ash hover:text-parchment"
                }`}
              >
                <Radio className="w-3 h-3" aria-hidden="true" />
                Live Feed ({globalEvents.length})
              </button>
            </div>
          )}
          <span className="text-xs font-mono text-ash truncate max-w-[180px]">
            {accountId ? truncateAccountId(accountId, 20) : "Guest Log"}
          </span>
        </div>
      </div>

      <div className="h-44 overflow-y-auto bg-oled divide-y divide-brass/15 font-mono text-xs">
        {feedTab === "global" && hasGlobalFeed ? (
          globalEvents.length === 0 ? (
            <div className="h-full flex items-center justify-center text-ash text-xs px-4 text-center">
              Connected to SpireFi Indexer — waiting for live on-chain NEP-297 events...
            </div>
          ) : (
            globalEvents.map((ev, idx) => {
              const row = summarizeGlobalEvent(ev);
              return (
                <div
                  key={`${ev.event}-${ev.receivedAt}-${idx}`}
                  className="px-4 py-2 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-frost font-bold shrink-0">{row.actor}</span>
                    <span className="text-xs text-parchment truncate">{row.summary}</span>
                  </div>
                  {row.badge && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-jackpot/15 text-jackpot font-bold shrink-0">
                      {row.badge}
                    </span>
                  )}
                </div>
              );
            })
          )
        ) : logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-ash text-xs px-4 text-center">
            No strikes dispatched for this guest account yet. Strike the boss to log live NearBlocks transactions.
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
                      {log.isExact ? `-${log.damage}` : `~-${log.damage}`} DMG
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
                      aria-label={`Inspect transaction ${log.txHash} on NearBlocks`}
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
