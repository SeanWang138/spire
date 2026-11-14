"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Store,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Hammer,
  FlaskConical,
} from "lucide-react";
import { NpcMerchantBazaar, FloorBuybackDesk } from "@/components/right/NpcMerchantBazaar";
import { MarketSimulator } from "@/components/right/MarketSimulator";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  emptyInventory,
  get_merchant,
  get_inventory,
  get_quote,
  get_tower,
  buy_from_merchant,
  sell_to_merchant,
  fund_merchant,
  sell_to_boss_buyback,
  type ItemId,
  type MerchantQuote,
  type ElementIndex,
} from "@/lib/contract";
import { useContractView, useSessionAccount } from "@/lib/spire/hooks";
import { formatNearAmount, getExplorerTxUrl } from "@/lib/utils/cn";
import {
  ELEMENT_NAMES,
  MERCHANT_BASE_PRICE_NEAR,
  nearToYocto,
  yoctoToNear,
} from "@/lib/spire/constants";
import { explainMerchantQuote } from "@/lib/merchant-reasoning";

const QUOTE_ITEMS: {
  id: Extract<ItemId, "ore:iron" | "essence:solar" | "essence:frost" | "essence:void">;
  name: string;
}[] = [
  { id: "ore:iron", name: "Iron Ore" },
  { id: "essence:solar", name: "Solar Essence" },
  { id: "essence:frost", name: "Frost Essence" },
  { id: "essence:void", name: "Void Essence" },
];

export default function MerchantPage() {
  const session = useSessionAccount();
  const accountId = session?.accountId ?? "";

  const merchant = useContractView(get_merchant, []);
  const tower = useContractView(get_tower, []);
  const inventory = useContractView(
    async () => (accountId ? await get_inventory(accountId) : null),
    [accountId]
  );

  const [quoteItem, setQuoteItem] = useState<
    "ore:iron" | "essence:solar" | "essence:frost" | "essence:void"
  >("ore:iron");
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
    try {
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
    } catch (err: unknown) {
      setBanner({
        text: err instanceof Error ? err.message : "Trade failed.",
        type: "error",
      });
      throw err;
    }
  };

  const handleFundMerchant = async (amountNear: number) => {
    try {
      const res = await fund_merchant(nearToYocto(amountNear));
      setBanner({
        text: `Refilled merchant cash reserve with ${amountNear.toFixed(2)} NEAR.`,
        type: "success",
        txHash: res.txHash,
      });
      merchant.reload();
    } catch (err: unknown) {
      setBanner({
        text: err instanceof Error ? err.message : "Refill failed.",
        type: "error",
      });
      throw err;
    }
  };

  const handleBuyback = async (floor: number, element: ElementIndex, qty: number) => {
    try {
      const res = await sell_to_boss_buyback(floor, element, qty);
      setBanner({
        text: `Sold ${qty}x ${ELEMENT_NAMES[element]} weapon to Floor ${floor} Buyback Reserve.`,
        type: "success",
        txHash: res.txHash,
      });
      tower.reload();
      if (inventory.data) inventory.reload();
    } catch (err: unknown) {
      setBanner({
        text: err instanceof Error ? err.message : "Floor buyback failed.",
        type: "error",
      });
      throw err;
    }
  };

  const txUrl = getExplorerTxUrl(banner?.txHash);
  const cashNear = merchant.data ? yoctoToNear(merchant.data.cash) : 0;
  const itemStock = merchant.data ? (merchant.data.stock[quoteItem] ?? 0) : 0;

  const buyReasoning = merchant.data
    ? explainMerchantQuote({
        itemId: quoteItem,
        side: "buy",
        stock: itemStock,
        cashNear,
        unitPriceNear: quotes.buy ? yoctoToNear(quotes.buy.unit_price) : MERCHANT_BASE_PRICE_NEAR,
        basePriceNear: MERCHANT_BASE_PRICE_NEAR,
        rawReason: quotes.buy?.reason,
      })
    : "Loading contract reasoning...";

  const sellReasoning = merchant.data
    ? explainMerchantQuote({
        itemId: quoteItem,
        side: "sell",
        stock: itemStock,
        cashNear,
        unitPriceNear: quotes.sell ? yoctoToNear(quotes.sell.unit_price) : MERCHANT_BASE_PRICE_NEAR,
        basePriceNear: MERCHANT_BASE_PRICE_NEAR,
        rawReason: quotes.sell?.reason,
      })
    : "Loading contract reasoning...";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-brass/15">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-parchment tracking-wide">
            Material Bazaar &amp; Floor Buyback
          </h1>
          <p className="text-sm text-ash mt-1.5 max-w-2xl leading-relaxed">
            On-chain material pricing comes directly from <code className="font-mono text-frost">get_quote()</code> with 0.05 NEAR base, 100 target stock, and &plusmn;10% spread. Weapon buybacks settle through the separate Floor Buyback Desk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/game/forge"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-solar/40 bg-solar/15 hover:bg-solar/25 text-solar text-xs font-mono font-bold inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
          >
            <Hammer className="w-4 h-4" aria-hidden="true" />
            <span>Back to Town &amp; Forge</span>
          </Link>
          <Link
            href="/game/ai#time-warp"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-frost/35 bg-frost/10 hover:bg-frost/20 text-frost text-xs font-mono font-bold inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
          >
            <FlaskConical className="w-4 h-4" aria-hidden="true" />
            <span>Proof &amp; Lab Time-Warp</span>
          </Link>
        </div>
      </div>

      {banner && (
        <div
          role={banner.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`p-3 rounded-lg border font-mono text-xs flex flex-wrap items-center justify-between gap-2 ${
            banner.type === "success"
              ? "bg-jackpot/10 border-jackpot/35 text-jackpot"
              : "bg-hp/15 border-hp/40 text-hp-text"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-jackpot" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-hp-text" aria-hidden="true" />
            )}
            <span>{banner.text}</span>
          </div>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-frost hover:underline inline-flex items-center gap-1 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar rounded"
            >
              NearBlocks <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {!session ? (
        <EmptyState
          title="Connect session to execute live trades"
          hint="Launch an Ephemeral Testnet Session Subaccount in 1 click to buy, sell, or refill the merchant reserve. The 1-week market sandbox below runs immediately without sign-in."
          actionHref="/game/start"
          actionLabel="Go to 1-Click Start"
        />
      ) : merchant.loading && !merchant.data ? (
        <div className="obsidian-surface p-6 text-xs font-mono text-ash">
          Loading Material Bazaar state from NEAR Testnet...
        </div>
      ) : !merchant.data ? (
        <EmptyState
          title="Bazaar unavailable"
          hint={merchant.error ?? "Unable to retrieve merchant state from NEAR Testnet."}
          onReload={merchant.reload}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
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

            <div className="lg:col-span-7 space-y-6">
              <section className="obsidian-surface p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-frost" aria-hidden="true" />
                    <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
                      Live Contract Quote Inspector
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="quote-item-select" className="sr-only">
                      Quote material
                    </label>
                    <select
                      id="quote-item-select"
                      value={quoteItem}
                      onChange={(e) =>
                        setQuoteItem(
                          e.target.value as
                            | "ore:iron"
                            | "essence:solar"
                            | "essence:frost"
                            | "essence:void"
                        )
                      }
                      className="min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-brass/25 text-xs font-mono text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                    >
                      {QUOTE_ITEMS.map((qi) => (
                        <option key={qi.id} value={qi.id}>
                          {qi.name} (Stock: {merchant.data!.stock[qi.id] ?? 0})
                        </option>
                      ))}
                    </select>

                    <label htmlFor="quote-qty-input" className="sr-only">
                      Quote quantity
                    </label>
                    <input
                      id="quote-qty-input"
                      type="number"
                      min={1}
                      max={40}
                      placeholder="1"
                      value={quoteQty}
                      onChange={(e) => setQuoteQty(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
                      className="w-20 min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-brass/25 text-xs font-mono-numbers text-parchment placeholder-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                    />
                  </div>
                </div>

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
                      <div className="text-xs font-mono text-ash font-mono-numbers">
                        Unit: {formatNearAmount(quotes.buy.unit_price, 4)} · {quotes.buy.is_open ? "Open" : "Closed"}
                      </div>
                    )}
                    <blockquote className="pt-1 font-lore italic text-base text-parchment leading-snug">
                      {buyReasoning}
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
                      <div className="text-xs font-mono text-ash font-mono-numbers">
                        Unit: {formatNearAmount(quotes.sell.unit_price, 4)} · {quotes.sell.is_open ? "Open" : "Closed"}
                      </div>
                    )}
                    <blockquote className="pt-1 font-lore italic text-base text-parchment leading-snug">
                      {sellReasoning}
                    </blockquote>
                  </div>
                </div>

                <div className="text-xs font-mono text-ash border-t border-brass/15 pt-3 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    On-Chain Reserve:{" "}
                    <strong className="font-mono-numbers text-parchment">
                      {formatNearAmount(merchant.data.cash, 2)}
                    </strong>
                  </span>
                  <span className={merchant.data.is_open ? "text-jackpot font-bold" : "text-hp-text font-bold"}>
                    Status: {merchant.data.is_open ? "OPEN" : "CLOSED (<1.00 NEAR)"}
                  </span>
                </div>
              </section>

              {tower.data && (
                <FloorBuybackDesk
                  floors={tower.data.floors}
                  inventory={inventory.data ?? emptyInventory()}
                  onBuyback={handleBuyback}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1-Week Market Time-Warp Workbench */}
      <MarketSimulator />
    </div>
  );
}
