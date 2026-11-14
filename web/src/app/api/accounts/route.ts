import { NextRequest, NextResponse } from "next/server";
import { connect, keyStores, KeyPair, utils } from "near-api-js";

export const dynamic = "force-dynamic";

const DEFAULT_SUBACCOUNT_FUNDING_YOCTO = "600000000000000000000000"; // 0.60 NEAR
const NEAR_YOCTO_DECIMALS = 24;
const SUBACCOUNT_PREFIX_RE = /^[a-z0-9][a-z0-9_-]{1,30}$/;
const ED25519_PUB_RE = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_ACCOUNTS_PER_IP_HOUR = 8;
const MAX_ACCOUNTS_GLOBAL_DAY = 60;
const DEFAULT_RESERVE_FLOOR_NEAR = "5.0";

const ipRequestLog = new Map<string, number[]>();
const globalRequestLog: number[] = [];

function getClientIp(req: NextRequest): string {
  const platformIp =
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim();
  if (platformIp) return platformIp.slice(0, 64);

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  if (process.env.FAUCET_RATE_LIMIT_DISABLED === "true") {
    return { allowed: true };
  }

  const now = Date.now();
  while (globalRequestLog.length > 0 && now - globalRequestLog[0] > DAY_MS) {
    globalRequestLog.shift();
  }
  if (globalRequestLog.length >= MAX_ACCOUNTS_GLOBAL_DAY) {
    const retryAfterSec = Math.max(60, Math.ceil((DAY_MS - (now - globalRequestLog[0])) / 1000));
    return { allowed: false, retryAfterSec };
  }

  const recentForIp = (ipRequestLog.get(ip) ?? []).filter((ts) => now - ts <= HOUR_MS);
  ipRequestLog.set(ip, recentForIp);
  if (recentForIp.length >= MAX_ACCOUNTS_PER_IP_HOUR) {
    const retryAfterSec = Math.max(30, Math.ceil((HOUR_MS - (now - recentForIp[0])) / 1000));
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

function recordRateLimit(ip: string): void {
  if (process.env.FAUCET_RATE_LIMIT_DISABLED === "true") {
    return;
  }
  const now = Date.now();
  const recentForIp = (ipRequestLog.get(ip) ?? []).filter((ts) => now - ts <= HOUR_MS);
  recentForIp.push(now);
  ipRequestLog.set(ip, recentForIp);
  globalRequestLog.push(now);
}

function nearDecimalToYocto(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const [whole, frac = ""] = trimmed.split(".");
  const paddedFrac = frac
    .padEnd(NEAR_YOCTO_DECIMALS, "0")
    .slice(0, NEAR_YOCTO_DECIMALS);
  const yocto = `${whole}${paddedFrac}`.replace(/^0+(?=\d)/, "") || "0";
  return BigInt(yocto) > 0n ? yocto : null;
}

function resolveFundingYocto(): string {
  const envYocto = process.env.SUBACCOUNT_FUNDING_YOCTO?.trim();
  if (envYocto && /^\d+$/.test(envYocto)) {
    const normalized = BigInt(envYocto);
    if (normalized > 0n) {
      return normalized.toString();
    }
  }
  const envNear = process.env.AUTO_ACCOUNT_FUNDING_NEAR?.trim();
  if (envNear) {
    const converted = nearDecimalToYocto(envNear);
    if (converted) {
      return converted;
    }
  }
  return DEFAULT_SUBACCOUNT_FUNDING_YOCTO;
}

function resolveSafetyBufferYocto(): bigint {
  const envFloor = process.env.FAUCET_RESERVE_FLOOR_NEAR?.trim() || DEFAULT_RESERVE_FLOOR_NEAR;
  const parsed = nearDecimalToYocto(envFloor);
  return BigInt(parsed ?? "5000000000000000000000000");
}

async function checkAccountExistsOnChain(rpcUrl: string, accountId: string): Promise<boolean> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "exists-check",
      method: "query",
      params: {
        request_type: "view_account",
        finality: "optimistic",
        account_id: accountId,
      },
    }),
  });
  if (!res.ok) return false;
  const json = await res.json();
  if (json?.error?.cause?.name === "UNKNOWN_ACCOUNT") return false;
  return Boolean(json?.result?.amount);
}

/** Sums live contract pool commitments; fails closed if live reserve views cannot be read. */
async function readCommittedPoolReserveYocto(
  rpcUrl: string,
  contractId: string
): Promise<bigint> {
  const callView = async (method: string, optionalNotDeployed = false) => {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `reserve-check-${method}`,
        method: "query",
        params: {
          request_type: "call_function",
          finality: "optimistic",
          account_id: contractId,
          method_name: method,
          args_base64: "e30=",
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`RESERVE_CHECK_UNAVAILABLE: HTTP ${res.status} on ${method}`);
    }
    const json = await res.json();
    const rpcErr = json?.error
      ? JSON.stringify(json.error)
      : json?.result?.error
        ? String(json.result.error)
        : "";
    if (rpcErr) {
      if (optionalNotDeployed && /MethodNotFound|MethodResolveError/i.test(rpcErr)) {
        return null;
      }
      throw new Error(`RESERVE_CHECK_UNAVAILABLE: ${rpcErr}`);
    }
    const raw = new Uint8Array(json?.result?.result ?? []);
    if (raw.length === 0) {
      throw new Error(`RESERVE_CHECK_UNAVAILABLE: empty result on ${method}`);
    }
    const text = new TextDecoder().decode(raw).replace(
      /"(jackpot|dividend_pool|buyback_reserve|cash)":\s*(\d{15,})(?=[,\s}])/g,
      '"$1":"$2"'
    );
    return JSON.parse(text);
  };

  const [tower, merchant, unclaimedRounds] = await Promise.all([
    callView("get_tower") as Promise<{
      floors?: Array<{
        jackpot?: string;
        dividend_pool?: string;
        buyback_reserve?: string;
      }>;
    }>,
    callView("get_merchant") as Promise<{ cash?: string }>,
    callView("get_unclaimed_rounds_yocto", true) as Promise<string | null>,
  ]);

  let committed = BigInt(merchant?.cash ?? "0") + BigInt(unclaimedRounds ?? "0");
  for (const f of tower?.floors ?? []) {
    committed += BigInt(f?.jackpot ?? "0");
    committed += BigInt(f?.dividend_pool ?? "0");
    committed += BigInt(f?.buyback_reserve ?? "0");
  }
  return committed;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { account_id, public_key } = body;

    if (!account_id || typeof account_id !== "string") {
      return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
    }

    const contractId = (process.env.NEXT_PUBLIC_CONTRACT_ID || "spire.testnet").trim();
    const parentAccountId = (
      process.env.NEXT_PUBLIC_GUEST_PARENT_ACCOUNT ||
      process.env.NEAR_FAUCET_ACCOUNT_ID ||
      process.env.NEAR_PARENT_ACCOUNT_ID ||
      contractId ||
      "spire.testnet"
    ).trim();
    const parentPrivateKey = (
      process.env.NEAR_FAUCET_PRIVATE_KEY ||
      process.env.NEAR_PARENT_PRIVATE_KEY ||
      process.env.KEEPER_PRIVATE_KEY ||
      ""
    ).trim();
    const rpcUrl = (
      process.env.NEAR_RPC_URL || "https://rpc.testnet.fastnear.com"
    ).trim();
    const fundingYocto = resolveFundingYocto();

    // Strict domain suffix + prefix check (*.spire.testnet or configured faucet parent)
    const cleanAccountId = account_id.trim().toLowerCase();
    const expectedSuffix = `.${parentAccountId}`;
    if (!cleanAccountId.endsWith(expectedSuffix) || cleanAccountId.length > 64) {
      return NextResponse.json(
        { error: `Invalid account_id: must end with "${expectedSuffix}".` },
        { status: 400 }
      );
    }
    const prefix = cleanAccountId.slice(0, -expectedSuffix.length);
    if (!SUBACCOUNT_PREFIX_RE.test(prefix)) {
      return NextResponse.json(
        {
          error:
            "Invalid handle prefix: use 2-31 lowercase letters, digits, hyphens, or underscores.",
        },
        { status: 400 }
      );
    }

    if (public_key !== undefined) {
      if (typeof public_key !== "string" || !ED25519_PUB_RE.test(public_key.trim())) {
        return NextResponse.json(
          { error: "Invalid public_key format: expected ed25519:<base58>." },
          { status: 400 }
        );
      }
    }

    if (!parentPrivateKey) {
      return NextResponse.json(
        {
          error: "TESTNET_FAUCET_NOT_CONFIGURED",
          message:
            "Configure NEAR_PARENT_PRIVATE_KEY in environment to provision live testnet accounts.",
        },
        { status: 503 }
      );
    }

    const clientIp = getClientIp(req);
    const rate = checkRateLimit(clientIp);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "RATE_LIMITED",
          message: "Too many guest accounts created recently. Wait briefly or import your Recovery Key.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec ?? 60) },
        }
      );
    }

    try {
      const targetPublicKey = public_key
        ? utils.PublicKey.from(public_key.trim())
        : KeyPair.fromRandom("ed25519").getPublicKey();

      const keyStore = new keyStores.InMemoryKeyStore();
      await keyStore.setKey(
        "testnet",
        parentAccountId,
        KeyPair.fromString(parentPrivateKey as Parameters<typeof KeyPair.fromString>[0])
      );
      const near = await connect({ networkId: "testnet", nodeUrl: rpcUrl, keyStore } as never);
      const parent = await near.account(parentAccountId);

      // Fail-closed reserve guard: protect active jackpot, backer & merchant cash on spire.testnet
      let parentState;
      let committedPoolYocto = 0n;
      try {
        [parentState, committedPoolYocto] = await Promise.all([
          parent.state(),
          parentAccountId === contractId
            ? readCommittedPoolReserveYocto(rpcUrl, contractId)
            : Promise.resolve(0n),
        ]);
      } catch (guardErr) {
        console.error("[API Accounts] Fail-closed reserve guard tripped:", guardErr);
        return NextResponse.json(
          {
            error: "RESERVE_CHECK_UNAVAILABLE",
            message:
              "Citadel guest provisioning is temporarily paused while verifying on-chain reserve balances.",
          },
          { status: 503 }
        );
      }

      const parentAmountYocto = BigInt(parentState?.amount ?? "0");
      const safetyFloor = committedPoolYocto + resolveSafetyBufferYocto() + BigInt(fundingYocto);
      if (parentAmountYocto < safetyFloor) {
        return NextResponse.json(
          {
            error: "FAUCET_RESERVE_FLOOR_REACHED",
            message:
              "Citadel guest provisioning is temporarily paused to protect active player jackpot reserves.",
          },
          { status: 503 }
        );
      }

      if (await checkAccountExistsOnChain(rpcUrl, cleanAccountId)) {
        return NextResponse.json(
          {
            error: `Account "${cleanAccountId}" already exists on-chain. Please choose a different name.`,
          },
          { status: 409 }
        );
      }

      recordRateLimit(clientIp);
      await parent.createAccount(cleanAccountId, targetPublicKey, BigInt(fundingYocto));

      return NextResponse.json({
        success: true,
        status: "provisioned",
        account_id: cleanAccountId,
        public_key: targetPublicKey.toString(),
        onchain: true,
        funding_yocto: fundingYocto,
        keyMode: "ephemeral-full-access",
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("already exists") || errMsg.includes("AccountAlreadyExists")) {
        return NextResponse.json(
          {
            error: `Account "${cleanAccountId}" already exists on-chain. Please choose a different name.`,
          },
          { status: 409 }
        );
      }
      console.error("[API Accounts] On-chain creation error:", err);
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error("[API Accounts] Request parsing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
