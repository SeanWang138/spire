/**
 * Human-readable economic reasoning for NPC Merchant quotes (no AI, pure math).
 * Replaces terse contract codes like `"ok"` with clear pricing context.
 */

import {
  MERCHANT_BASE_PRICE_NEAR,
  MERCHANT_MIN_CASH_NEAR,
  MERCHANT_SPREAD_BPS,
  MERCHANT_TARGET_STOCK,
} from "./spire/constants";

export interface ExplainMerchantQuoteInput {
  itemId: string;
  side: "buy" | "sell";
  stock: number;
  demand?: number;
  cashNear: number;
  unitPriceNear: number;
  basePriceNear?: number;
  rawReason?: string | null;
}

const ITEM_LABELS: Record<string, string> = {
  "ore:iron": "Iron Ore",
  "essence:solar": "Solar Essence",
  "essence:frost": "Frost Essence",
  "essence:void": "Void Essence",
};

/**
 * Formats a concise one-line economic explanation covering:
 * % vs 0.05 NEAR base, stock/100 pressure, demand, ±10% spread, and reserve >= 1.0 NEAR.
 * Never returns literal `"ok"`.
 */
export function explainMerchantQuote({
  itemId,
  side,
  stock,
  demand = 0,
  cashNear,
  unitPriceNear,
  basePriceNear = MERCHANT_BASE_PRICE_NEAR,
  rawReason,
}: ExplainMerchantQuoteInput): string {
  const label = ITEM_LABELS[itemId] ?? itemId;
  const target = MERCHANT_TARGET_STOCK;
  const spreadPct = Math.round(MERCHANT_SPREAD_BPS / 100);
  const minCash = MERCHANT_MIN_CASH_NEAR.toFixed(2);
  const reserveText = `${cashNear.toFixed(2)} NEAR`;
  const reason = (rawReason ?? "").trim().toLowerCase();

  const stockState =
    stock < target ? "scarce" : stock > target ? "surplus" : "balanced";
  const pctVsBase =
    basePriceNear > 0 ? ((unitPriceNear - basePriceNear) / basePriceNear) * 100 : 0;
  const signedPct = `${pctVsBase >= 0 ? "+" : ""}${pctVsBase.toFixed(1)}%`;

  if (
    reason === "shop_closed" ||
    reason === "treasury_below_min_reserve" ||
    cashNear < MERCHANT_MIN_CASH_NEAR
  ) {
    return `Bazaar closed: reserve ${reserveText} is below ${minCash} NEAR minimum (${label} stock ${stock}/${target}, demand ${demand}, base ${basePriceNear} NEAR, ±${spreadPct}% spread).`;
  }

  if (reason === "invalid_item" || itemId.startsWith("weapon:")) {
    return `${label} is excluded from NPC Merchant (materials only; sell weapons via Boss Buyback).`;
  }

  if (reason === "out_of_stock") {
    return `${label} out of stock (${stock}/${target} target); sell materials to restock or wait for inflows (reserve ${reserveText} >= ${minCash} NEAR).`;
  }

  if (reason === "volume_cap") {
    return `Epoch buy cap reached for ${label} (40/item/epoch max; stock ${stock}/${target}, reserve ${reserveText} >= ${minCash} NEAR).`;
  }

  if (reason === "reserve_low") {
    return `Reserve ${reserveText} cannot fund this ${label} sell payout above the ${minCash} NEAR floor (quote ${signedPct} vs ${basePriceNear} NEAR base, ±${spreadPct}% spread).`;
  }

  const sideLabel = side === "buy" ? "Ask" : "Bid";
  const spreadDir = side === "buy" ? `+${spreadPct}% ask` : `-${spreadPct}% bid`;

  return `${sideLabel} ${signedPct} vs ${basePriceNear} NEAR base: ${label} stock ${stock}/${target} (${stockState}), demand ${demand}, ${spreadDir} on ±${spreadPct}% spread, reserve ${reserveText} (>= ${minCash} NEAR open).`;
}
