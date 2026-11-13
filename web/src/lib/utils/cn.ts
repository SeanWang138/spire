import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatNearAmount(yoctoNear: string | bigint | number, decimals: number = 2): string {
  try {
    const raw = typeof yoctoNear === "bigint" ? yoctoNear : BigInt(yoctoNear || "0");
    const nearWhole = Number(raw / 10n ** 20n) / 10000;
    return `${nearWhole.toFixed(decimals)} NEAR`;
  } catch {
    return "0.00 NEAR";
  }
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
