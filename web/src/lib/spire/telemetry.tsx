"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  get_balance,
  get_meta,
  INDEXER_URL,
  viewAccountBalanceYocto,
  type MetaResponse,
  type ParsedSpireEvent,
} from "@/lib/contract";
import { useContractView, useSessionAccount } from "./hooks";
import type { SessionData } from "@/lib/near";

export interface RecentTx {
  method: string;
  txHash: string;
}

export interface IndexedSpireEvent extends ParsedSpireEvent {
  receivedAt: number;
}

export interface SpireTelemetryValue {
  session: SessionData | null;
  meta: MetaResponse | null;
  metaLoading: boolean;
  metaError: string | null;
  /** Internal contract balance ("Citadel Pouch") in yoctoNEAR string. */
  pouchYocto: string | null;
  pouchLoading: boolean;
  /** Subaccount liquid balance ("Silent Gas Tank") in yoctoNEAR string. */
  gasTankYocto: string | null;
  lastTx: RecentTx | null;
  recentGlobalEvents: IndexedSpireEvent[];
  indexerConnected: boolean;
  reloadBalance: () => void;
  reloadMeta: () => void;
  reloadAll: () => void;
}

const MAX_GLOBAL_EVENTS = 25;
const REFRESH_TRIGGER_EVENTS = new Set([
  "raid",
  "boss_defeated",
  "round_expired",
  "meta_updated",
  "merchant_trade",
  "backer_staked",
  "payout_claimed",
]);

function toWsUrl(baseHttpUrl: string): string {
  const trimmed = baseHttpUrl.replace(/\/+$/, "");
  if (trimmed.startsWith("https://")) return `wss://${trimmed.slice("https://".length)}`;
  if (trimmed.startsWith("http://")) return `ws://${trimmed.slice("http://".length)}`;
  return trimmed;
}

const SpireTelemetryContext = createContext<SpireTelemetryValue | null>(null);

export function SpireTelemetryProvider({ children }: { children: React.ReactNode }) {
  const session = useSessionAccount();
  const [lastTx, setLastTx] = useState<RecentTx | null>(null);
  const [recentGlobalEvents, setRecentGlobalEvents] = useState<IndexedSpireEvent[]>([]);
  const [indexerConnected, setIndexerConnected] = useState(false);

  const pouchView = useContractView(
    async () =>
      session && session.provision !== "pending"
        ? get_balance(session.accountId)
        : null,
    [session?.accountId, session?.provision]
  );

  const gasTankView = useContractView(
    async () =>
      session && session.provision !== "pending"
        ? viewAccountBalanceYocto(session.accountId)
        : null,
    [session?.accountId, session?.provision]
  );

  const metaView = useContractView(get_meta, []);

  const reloadBalance = useCallback(() => {
    pouchView.reload();
    gasTankView.reload();
  }, [pouchView, gasTankView]);

  const reloadAll = useCallback(() => {
    pouchView.reload();
    gasTankView.reload();
    metaView.reload();
  }, [pouchView, gasTankView, metaView]);

  const reloadAllRef = useRef(reloadAll);
  const reloadMetaRef = useRef(metaView.reload);
  useEffect(() => {
    reloadAllRef.current = reloadAll;
    reloadMetaRef.current = metaView.reload;
  }, [reloadAll, metaView.reload]);

  useEffect(() => {
    const onTx = (ev: Event) => {
      const detail = (ev as CustomEvent<{ method: string; txHash: string }>).detail;
      if (detail?.txHash) {
        setLastTx({ method: detail.method, txHash: detail.txHash });
      }
      reloadAll();
    };
    window.addEventListener("spire:tx", onTx);
    return () => window.removeEventListener("spire:tx", onTx);
  }, [reloadAll]);

  // Optional live Indexer bridge (100% no NEAR AI; silent fallback when INDEXER_URL unset)
  useEffect(() => {
    if (!INDEXER_URL || typeof window === "undefined") {
      setIndexerConnected(false);
      return;
    }

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const base = INDEXER_URL.replace(/\/+$/, "");

    void (async () => {
      try {
        const res = await fetch(`${base}/api/events?limit=20`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { events?: ParsedSpireEvent[] };
        if (!cancelled && Array.isArray(json.events)) {
          const now = Date.now();
          setRecentGlobalEvents(
            json.events
              .slice(-MAX_GLOBAL_EVENTS)
              .reverse()
              .map((e) => ({ ...e, receivedAt: now }))
          );
        }
      } catch {
        // Offline/serverless fallback: ignore quietly
      }
    })();

    const connectWs = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(toWsUrl(base));
      } catch {
        return;
      }

      ws.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setIndexerConnected(true);
      };

      ws.onmessage = (msg) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(String(msg.data)) as ParsedSpireEvent;
          if (!parsed || typeof parsed.event !== "string" || !Array.isArray(parsed.data)) {
            return;
          }
          setRecentGlobalEvents((prev) => [
            { ...parsed, receivedAt: Date.now() },
            ...prev,
          ].slice(0, MAX_GLOBAL_EVENTS));

          if (parsed.event === "meta_updated") {
            reloadMetaRef.current();
          } else if (REFRESH_TRIGGER_EVENTS.has(parsed.event)) {
            reloadAllRef.current();
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setIndexerConnected(false);
        const delayMs = Math.min(30_000, 1_500 * Math.pow(2, attempt));
        attempt += 1;
        reconnectTimer = setTimeout(connectWs, delayMs);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connectWs();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        // ignore close failure
      }
    };
  }, []);

  const value = useMemo<SpireTelemetryValue>(
    () => ({
      session,
      meta: metaView.data,
      metaLoading: metaView.loading,
      metaError: metaView.error,
      pouchYocto: pouchView.data,
      pouchLoading: pouchView.loading,
      gasTankYocto: gasTankView.data,
      lastTx,
      recentGlobalEvents,
      indexerConnected,
      reloadBalance,
      reloadMeta: metaView.reload,
      reloadAll,
    }),
    [
      session,
      metaView.data,
      metaView.loading,
      metaView.error,
      metaView.reload,
      pouchView.data,
      pouchView.loading,
      gasTankView.data,
      lastTx,
      recentGlobalEvents,
      indexerConnected,
      reloadBalance,
      reloadAll,
    ]
  );

  return (
    <SpireTelemetryContext.Provider value={value}>
      {children}
    </SpireTelemetryContext.Provider>
  );
}

export function useSpireTelemetry(): SpireTelemetryValue {
  const ctx = useContext(SpireTelemetryContext);
  if (!ctx) {
    throw new Error("useSpireTelemetry must be used within SpireTelemetryProvider");
  }
  return ctx;
}

