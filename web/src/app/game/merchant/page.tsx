"use client";

import React, { useState } from "react";
import { Store, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { NpcMerchantBazaar } from "@/components/right/NpcMerchantBazaar";
import { EmptyState } from "@/components/shared/EmptyState";
import { emptyInventory } from "@/lib/contract";
import type { ItemId, MerchantQuote } from "@/lib/contract";
import {
  get_merchant,
  get_inventory,
  get_quote,
  buy_from_merchant,
  sell_to_merchant,
} from "@/lib/contract";
import { useContractView, useSessionAccount } from "@/lib/spire/hooks";
import { formatNearAmount } from "@/lib/utils/cn";
import { yoctoToNear } from "@/lib/spire/constants";

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

  // Live quotes: get_quote(item, side, qty) — reason strings come from the contract.
  React.useEffect(() => {
    let cancelled = false;
    setQuoteLoading(true);
    Promise.all([
      get_quote(quoteItem, "buy", quoteQty).catch(() => null),
      get_quote(quoteItem, "sell", quoteQty).catch(() => null),
    ]).then(([buy, sell]) => {
      if (!cancelled) setQuotes({ buy, sell });
      if (!cancelled) setQuoteLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [quoteItem, quoteQty, merchant.data?.cash]);

  const handleTrade = async (action: "buy" | "sell", item: ItemId, amount: number) => {
    if (action === "buy") {
      await buy_from_merchant(item, amount);
    } else {
      await sell_to_merchant(item, amount);
    }
    merchant.reload();
    if (inventory.data) inventory.reload();
  };

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <EmptyState title="No session yet" hint="Enter from /game/start to trade signless at the bazaar." />
      </div>
    );
  }

  return (
    <div className="px-1 py-8 flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">Merchant Bazaar</h1>
        <p className="text-xs sm:text-sm font-mono text-slate-400 mt-1">
          Prices follow the stock + cash-reserve bonding curve. Quote reasons come
          straight from the contract — not client-side guesses.
        </p>
      </div>

      {!merchant.data ? (
        <EmptyState
          title="Bazaar unavailable"
          hint="get_merchant view call failed from the public RPC — the contract may not be deployed yet. The panel stays empty, no simulated data is shown."
          onReload={merchant.reload}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Trading desk */}
          <div className="md:col-span-5">
            <NpcMerchantBazaar
              cashYocto={merchant.data.cash}
              isOpen={merchant.data.is_open}
              stock={merchant.data.stock}
              inventory={inventory.data ?? emptyInventory()}
              onTrade={handleTrade}
            />
          </div>

          {/* Contract quote panel: price + reason */}
          <div className="md:col-span-7 flex flex-col gap-3">
            <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-frost" />
                  <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
                    Quote Inspector <span className="text-slate-500">// get_quote + reason kontrak</span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={quoteItem}
                    onChange={(e) => setQuoteItem(e.target.value as ItemId)}
                    className="p-1.5 rounded bg-panel-dark border border-white/10 text-xs font-mono text-white focus:outline-none"
                    aria-label="Quote item"
                  >
                    {QUOTE_ITEMS.map((qi) => (
                      <option key={qi.id} value={qi.id}>
                        {qi.name} (stock {merchant.data!.stock[qi.id]})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={quoteQty}
                    onChange={(e) => setQuoteQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-14 p-1.5 rounded bg-panel-dark border border-white/10 text-xs font-mono-numbers text-white focus:outline-none"
                    aria-label="Quote quantity"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Buy quote */}
                <div className="p-3 rounded-lg bg-panel-dark border border-frost/20">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 mb-1">
                    <span>Buy {quoteQty}×</span>
                    <ArrowUpRight className="w-3 h-3 text-frost" />
                  </div>
                  <div className="text-base font-bold font-mono-numbers text-frost">
                    {quoteLoading ? "…" : quotes.buy ? formatNearAmount(quotes.buy.total_price) : "—"}
                  </div>
                  {quotes.buy && (
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      unit {formatNearAmount(quotes.buy.unit_price)} ·{" "}
                      {quotes.buy.is_open ? "open" : "closed"}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] font-mono text-slate-400 leading-relaxed">
                    {quotes.buy?.reason
                      ? quotes.buy.reason
                      : quotes.buy
                      ? "The contract did not provide a reason."
                      : "Quote unavailable (get_quote failed)."}
                  </p>
                </div>

                {/* Sell quote */}
                <div className="p-3 rounded-lg bg-panel-dark border border-solar/20">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 mb-1">
                    <span>Sell {quoteQty}×</span>
                    <ArrowDownRight className="w-3 h-3 text-solar" />
                  </div>
                  <div className="text-base font-bold font-mono-numbers text-solar">
                    {quoteLoading ? "…" : quotes.sell ? formatNearAmount(quotes.sell.total_price) : "—"}
                  </div>
                  {quotes.sell && (
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      unit {formatNearAmount(quotes.sell.unit_price)} ·{" "}
                      {quotes.sell.is_open ? "open" : "closed"}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] font-mono text-slate-400 leading-relaxed">
                    {quotes.sell?.reason
                      ? quotes.sell.reason
                      : quotes.sell
                      ? "The contract did not provide a reason."
                      : "Quote unavailable (get_quote failed)."}
                  </p>
                </div>
              </div>

              {/* Merchant cash reserve */}
              <div className="text-[11px] font-mono text-slate-400 border-t border-white/5 pt-2">
                Merchant cash:{" "}
                <span className="font-mono-numbers text-white font-bold">
                  {yoctoToNear(merchant.data.cash).toFixed(2)} NEAR
                </span>{" "}
                · status{" "}
                <span className={merchant.data.is_open ? "text-jackpot font-bold" : "text-hp font-bold"}>
                  {merchant.data.is_open ? "OPEN" : "CLOSED"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
