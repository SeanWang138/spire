import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UPSTREAM_RPC_ENDPOINTS = [
  process.env.NEAR_RPC_URL,
  "https://rpc.testnet.near.org",
  "https://test.rpc.fastnear.com",
  "https://rpc.testnet.fastnear.com",
  "https://archival-rpc.testnet.near.org",
].filter((u): u is string => Boolean(u && u.trim()));

const CACHE_TTL_MS = 2500;
const MAX_CACHE_ENTRIES = 250;

interface CacheEntry {
  expiresAt: number;
  payload: unknown;
}

const queryCache = new Map<string, CacheEntry>();
const inflightQueries = new Map<string, Promise<unknown>>();

function buildCacheKey(body: Record<string, unknown>): string | null {
  if (body.method !== "query") return null;
  const params = body.params;
  if (!params || typeof params !== "object") return null;
  return JSON.stringify(params);
}

function pruneCache(now: number): void {
  if (queryCache.size <= MAX_CACHE_ENTRIES) return;
  for (const [k, v] of queryCache.entries()) {
    if (v.expiresAt <= now || queryCache.size > MAX_CACHE_ENTRIES) {
      queryCache.delete(k);
    }
  }
}

async function forwardRpcWithFailover(bodyObj: Record<string, unknown>): Promise<unknown> {
  const payloadStr = JSON.stringify(bodyObj);
  let lastError: unknown = null;

  for (const endpoint of UPSTREAM_RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadStr,
        signal: controller.signal,
        cache: "no-store",
      }).finally(() => clearTimeout(timeout));

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Upstream HTTP ${res.status} from ${endpoint}`);
        continue;
      }

      const json = (await res.json()) as Record<string, unknown>;
      const errObj = json?.error as { code?: number; message?: string } | undefined;
      if (errObj && (errObj.code === -429 || /rate limit/i.test(String(errObj.message ?? "")))) {
        lastError = new Error(`Upstream rate limit from ${endpoint}`);
        continue;
      }

      return json;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All upstream NEAR Testnet RPC endpoints failed");
}

export async function POST(req: NextRequest) {
  let bodyObj: Record<string, unknown>;
  try {
    bodyObj = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    );
  }

  const reqId = bodyObj.id ?? "spirefi-rpc";
  const cacheKey = buildCacheKey(bodyObj);
  const now = Date.now();

  if (cacheKey) {
    const hit = queryCache.get(cacheKey);
    if (hit && hit.expiresAt > now && hit.payload && typeof hit.payload === "object") {
      return NextResponse.json({ ...(hit.payload as Record<string, unknown>), id: reqId });
    }

    const existingInflight = inflightQueries.get(cacheKey);
    if (existingInflight) {
      try {
        const shared = (await existingInflight) as Record<string, unknown>;
        return NextResponse.json({ ...shared, id: reqId });
      } catch {
        // Fall through to fresh attempt
      }
    }
  }

  const task = forwardRpcWithFailover(bodyObj);
  if (cacheKey) {
    inflightQueries.set(cacheKey, task);
  }

  try {
    const upstreamJson = (await task) as Record<string, unknown>;
    if (cacheKey && upstreamJson && !upstreamJson.error) {
      pruneCache(Date.now());
      queryCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload: upstreamJson,
      });
    }
    return NextResponse.json({ ...upstreamJson, id: reqId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: reqId,
        error: { code: -32000, message },
      },
      { status: 502 }
    );
  } finally {
    if (cacheKey) {
      inflightQueries.delete(cacheKey);
    }
  }
}

