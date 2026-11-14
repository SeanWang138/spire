import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Safely parses integer, decimal, or scientific-notation yoctoNEAR values
 * (e.g. "2.3683e+24", "5.7e+22", "4e+22") into bigint. Returns 0n on null,
 * undefined, non-finite numbers, or malformed strings without throwing SyntaxError.
 */
export function parseYoctoSafe(
  value: string | number | bigint | null | undefined
): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;

  let raw: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    raw = String(value);
  } else if (typeof value === "string") {
    raw = value.trim();
  } else {
    return 0n;
  }

  if (!raw) return 0n;

  const match =
    /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match) return 0n;

  const sign = match[1] === "-" ? "-" : "";
  const intPart = match[2] ?? "";
  const fracPart = match[3] ?? match[4] ?? "";
  const exp = match[5] !== undefined ? Number.parseInt(match[5], 10) : 0;
  if (!Number.isSafeInteger(exp)) return 0n;

  const digits = intPart + fracPart;
  if (!digits || /^0+$/.test(digits)) return 0n;

  const shift = exp - fracPart.length;
  if (!Number.isSafeInteger(shift) || shift > 10000) return 0n;

  let integerDigits: string;
  if (shift >= 0) {
    integerDigits = digits + "0".repeat(shift);
  } else {
    const cut = digits.length + shift;
    if (cut <= 0) return 0n;
    integerDigits = digits.slice(0, cut);
  }

  const normalized = integerDigits.replace(/^0+/, "") || "0";
  if (normalized === "0") return 0n;

  try {
    return BigInt(sign + normalized);
  } catch {
    return 0n;
  }
}

export function formatNearAmount(
  yoctoNear: string | bigint | number | null | undefined,
  decimals: number = 2
): string {
  const raw = parseYoctoSafe(yoctoNear);
  const nearWhole = Number(raw / 10n ** 16n) / 1e8;
  if (!Number.isFinite(nearWhole)) return `${(0).toFixed(decimals)} NEAR`;
  return `${nearWhole.toFixed(decimals)} NEAR`;
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function truncateAccountId(accountId: string, maxLen: number = 18): string {
  if (!accountId || accountId.length <= maxLen) return accountId || "";
  const half = Math.floor((maxLen - 3) / 2);
  return `${accountId.slice(0, half)}...${accountId.slice(-half)}`;
}

export function getExplorerTxUrl(txHash?: string | null): string | null {
  if (!txHash || txHash === "pending") return null;
  return `https://testnet.nearblocks.io/txns/${encodeURIComponent(txHash)}`;
}

/** Ensures raw inline SVG data URIs escape hash characters so hex fills render in img tags. */
export function normalizeSvgDataUri(uri?: string | null): string | null {
  if (!uri) return null;
  if (uri.startsWith("data:image/svg+xml;utf8,")) {
    const body = uri.slice("data:image/svg+xml;utf8,".length);
    return `data:image/svg+xml;utf8,${body.replace(/#/g, "%23")}`;
  }
  return uri;
}
