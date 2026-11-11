"use client";

import { useCallback, useEffect, useState } from "react";
import { SessionData, SessionManager } from "@/lib/near";

/** Loads the signless session and re-reads it whenever the session changes
 *  (create / provision confirmed / clear — via the "spire:session-changed" event). */
export function useSessionAccount(): SessionData | null {
  const [session, setSession] = useState<SessionData | null>(null);
  useEffect(() => {
    const refresh = () => setSession(SessionManager.getInstance().getSession());
    refresh();
    window.addEventListener("spire:session-changed", refresh);
    return () => window.removeEventListener("spire:session-changed", refresh);
  }, []);
  return session;
}

/**
 * Generic contract view hook. view calls throw while the SpireFi contract
 * is not deployed; `data` stays null and `error` carries "VIEW_UNAVAILABLE*"
 * so pages can render a clean empty state instead of mock data.
 */
export function useContractView<T>(
  fetcher: () => Promise<T>,
  deps: unknown[]
): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}
