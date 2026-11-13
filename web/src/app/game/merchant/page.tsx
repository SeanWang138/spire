"use client";

import React, { useState } from "react";
import { Store, ArrowUpRight, ArrowDownRight, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { NpcMerchantBazaar } from "@/components/right/NpcMerchantBazaar";
import { MarketSimulator } from "@/components/right/MarketSimulator";
import { EmptyState } from "@/components/shared/EmptyState";
import { emptyInventory } from "@/lib/contract";
import type { ItemId, MerchantQuote } from "@/lib/contract";
import {
  get_merchant,
  get_inventory,
  get_quote,
  buy_from_merchant,
  sell_to_merchant,
  fund_merchant,
} from "@/lib/contract";
import { useContractView, useSessionAccount } from "@/lib/spire/hooks";
import { formatNearAmount, getExplorerTxUrl } from "@/lib/utils/cn";
import { nearToYocto, yoctoToNear } from "@/lib/spire/constants";

const QUOTE_ITEMS: { id: ItemId; name: string }[] = [
  { id: "ore:iron", name: "Iron Ore" },
  { id: "essence:solar", name: "Solar Essence" },
  { id: "essence:frost", name: "Frost Essence" },
  { id: "essence:void", name: "Void Essence" },
  { id: "weapon:solar", name: "Solar Blade" },
  { id: "weapon:frost", name: "Frost Spear" },
  { id: "weapon:void", name: "Void Scythe" },
];

export default function MerchantPage() {
  const session = useSessionAccount();
  const accountId = session?.accountId ?? "";

  const merchant = useContractView(get_merchant, []);
  const inventory = useContractView(
    async () => (accountId ? await get_inventory(accountId) : null),
    [accountId]
  );
  const [quoteItem, setQuoteItem] = useState<ItemId>("ore:iron");
  const [quoteQty, setQuoteQty] = useState<number>(1);
  const [quotes, setQuotes] = useState<{ buy: MerchantQuote | null; sell: MerchantQuote | null }>({
    buy: null,
    sell: null,
  });
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [banner, setBanner] = useState<{ text: string; type: "success" | "error"; txHash?: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setQuoteLoading(true);
    Promise.all([
      get_quote(quoteItem, "buy", quoteQty).catch(() => null),
      get_quote(quoteItem, "sell", quoteQty).catch(() => null),
    ]).then(([buy, sell]) => {
      if (!cancelled) {
        setQuotes({ buy, sell });
        setQuoteLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [quoteItem, quoteQty, merchant.data?.cash]);

  const handleTrade = async (action: "buy" | "sell", item: ItemId, amount: number) => {
    const res =
      action === "buy"
        ? await buy_from_merchant(item, amount)
        : await sell_to_merchant(item, amount);
    setBanner({
      text: `${action === "buy" ? "Bought" : "Sold"} ${amount}x ${item} with on-chain quote settlement.`,
      type: "success",
      txHash: res.txHash,
    });
    merchant.reload();
    if (inventory.data) inventory.reload();
  };

  const handleFundMerchant = async (amountNear: number) => {
    const res = await fund_merchant(nearToYocto(amountNear));
    setBanner({
      text: `Refilled merchant cash reserve with ${amountNear.toFixed(2)} NEAR.`,
      type: "success",
      txHash: res.txHash,
    });
    merchant.reload();
  };

  const txUrl = getExplorerTxUrl(banner?.txHash);

  return (
    <div className="px-1 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">
          Merchant Bazaar &amp; Market Simulator
        </h1>
        <p className="text-xs sm:text-sm font-mono text-slate-300 mt-1">
          On-chain pricing comes directly from <code className="text-frost">get_quote()</code> with mathematical reasoning. Below, test an entire 1-week market cycle inside the fast-forward <span className="text-frost font-bold">SIMULASI</span> workbench.
        </p>
      </div>

      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-lg border font-mono text-xs flex flex-wrap items-center justify-between gap-2 ${
            banner.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-hp/15 border-hp/40 text-hp"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-hp" aria-hidden="true" />
            )}
            <span>{banner.text}</span>
          </div>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-frost hover:underline inline-flex items-center gap-1 font-bold"
            >
              NearBlocks <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {/* Live Contract Desk */}
      {!session ? (
        <EmptyState
          title="Connect session to execute live trades"
          hint="Provision your signless Function Call Key to buy, sell, or refill the merchant reserve. The 1-week SIMULASI workbench below runs immediately without login."
          actionHref="/game/start"
          actionLabel="Go to Session Key"
        />
      ) : !merchant.data ? (
        <EmptyState
          title="Bazaar unavailable"
          hint="Unable to retrieve merchant state from NEAR Testnet. Check connectivity or retry."
          onReload={merchant.reload}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-5">
            <NpcMerchantBazaar
              cashYocto={merchant.data.cash}
              isOpen={merchant.data.is_open}
              stock={merchant.data.stock}
              inventory={inventory.data ?? emptyInventory()}
              onTrade={handleTrade}
              onFundMerchant={handleFundMerchant}
            />
          </div>

          <div className="lg:col-span-7">
            <div className="obsidian-surface p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-frost" aria-hidden="true" />
                  <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
                    Live Contract Quote Inspector
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="quote-item-select" className="sr-only">Quote item</label>
                  <select
                    id="quote-item-select"
                    value={quoteItem}
                    onChange={(e) => setQuoteItem(e.target.value as ItemId)}
                    className="min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-xs font-mono text-white focus:outline-none focus:border-frost"
                  >
                    {QUOTE_ITEMS.map((qi) => (
                      <option key={qi.id} value={qi.id}>
                        {qi.name} (Stock: {merchant.data!.stock[qi.id]})
                      </option>
                    ))}
                  </select>

                  <label htmlFor="quote-qty-input" className="sr-only">Quote quantity</label>
                  <input
                    id="quote-qty-input"
                    type="number"
                    min={1}
                    value={quoteQty}
                    onChange={(e) => setQuoteQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-xs font-mono-numbers text-white focus:outline-none focus:border-frost"
                  />
                </div>
              </div>

              {/* Flat split panels inside inspector */}
              <div className="rounded-lg bg-panel-dark divide-y sm:divide-y-0 sm:divide-x divide-brass/15 grid grid-cols-1 sm:grid-cols-2">
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono uppercase text-ash">
                    <span>Buy Ask ({quoteQty}x)</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-frost" aria-hidden="true" />
                  </div>
                  <div className="text-xl font-bold font-mono-numbers text-frost">
                    {quoteLoading ? "..." : quotes.buy ? formatNearAmount(quotes.buy.total_price, 4) : "N/A"}
                  </div>
                  {quotes.buy && (
                    <div className="text-[11px] font-mono text-ash font-mono-numbers">
                      Unit: {formatNearAmount(quotes.buy.unit_price, 4)} · {quotes.buy.is_open ? "Open" : "Closed"}
                    </div>
                  )}
                  <blockquote className="pt-1 font-lore italic text-base text-parchment leading-snug">
                    &ldquo;{quotes.buy?.reason
                      ? quotes.buy.reason
                      : quotes.buy
                      ? "No reason returned by contract."
                      : "Quote temporarily unavailable."}&rdquo;
                  </blockquote>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono uppercase text-ash">
                    <span>Sell Bid ({quoteQty}x)</span>
                    <ArrowDownRight className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
                  </div>
                  <div className="text-xl font-bold font-mono-numbers text-solar">
                    {quoteLoading ? "..." : quotes.sell ? formatNearAmount(quotes.sell.total_price, 4) : "N/A"}
                  </div>
                  {quotes.sell && (
                    <div className="text-[11px] font-mono text-ash font-mono-numbers">
                      Unit: {formatNearAmount(quotes.sell.unit_price, 4)} · {quotes.sell.is_open ? "Open" : "Closed"}
                    </div>
                  )}
                  <blockquote className="pt-1 font-lore italic text-base text-parchment leading-snug">
                    &ldquo;{quotes.sell?.reason
                      ? quotes.sell.reason
                      : quotes.sell
                      ? "No reason returned by contract."
                      : "Quote temporarily unavailable."}&rdquo;
                  </blockquote>
                </div>
              </div>

              <div className="text-xs font-mono text-ash border-t border-brass/20 pt-3 flex flex-wrap items-center justify-between gap-2">
                <span>
                  On-Chain Reserve:{" "}
                  <strong className="font-mono-numbers text-parchment">
                    {yoctoToNear(merchant.data.cash).toFixed(2)} NEAR
                  </strong>
                </span>
                <span className={merchant.data.is_open ? "text-jackpot font-bold" : "text-hp font-bold"}>
                  Status: {merchant.data.is_open ? "OPEN" : "CLOSED (<1.0 NEAR)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1-Week Fast-Forward SIMULASI Workbench */}
      <MarketSimulator />
    </div>
  );
}
