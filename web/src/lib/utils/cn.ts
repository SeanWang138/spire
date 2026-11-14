import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseYoctoSafe } from "../spire/constants";

export { parseYoctoSafe };

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
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
