"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Store,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Hammer,
  FlaskConical,
  HelpCircle,
} from "lucide-react";
import { NpcMerchantBazaar, FloorBuybackDesk } from "@/components/right/NpcMerchantBazaar";
import { MarketSimulator } from "@/components/right/MarketSimulator";
import { EmptyState } from "@/components/shared/EmptyState";
import { SpireTooltip } from "@/components/ui/SpireUi";
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
import { useContractView } from "@/lib/spire/hooks";
import { useSpireTelemetry } from "@/lib/spire/telemetry";
import { formatContractErrorMessage } from "@/lib/errors";
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

type MatrixRow = {
  id: Extract<ItemId, "ore:iron" | "essence:solar" | "essence:frost" | "essence:void">;
  name: string;
  buy: MerchantQuote | null;
  sell: MerchantQuote | null;
};

export default function MerchantPage() {
  const { session, pouchYocto, reloadBalance } = useSpireTelemetry();
  const accountId = session?.accountId ?? "";

  const merchant = useContractView(get_merchant, []);
  const tower = useContractView(get_tower, []);
  const inventory = useContractView(
    async () => (accountId ? await get_inventory(accountId) : null),
    [accountId]
  );

  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [banner, setBanner] = useState<{ text: string; type: "success" | "error"; txHash?: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setMatrixLoading(true);
    Promise.all(
      QUOTE_ITEMS.map(async (item) => {
        const [buy, sell] = await Promise.all([
          get_quote(item.id, "buy", 1).catch(() => null),
          get_quote(item.id, "sell", 1).catch(() => null),
        ]);
        return { id: item.id, name: item.name, buy, sell };
      })
    )
      .then((rows) => {
        if (!cancelled) {
          setMatrixRows(rows);
          setMatrixLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setMatrixLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [merchant.data?.cash, merchant.data?.stock]);

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
      reloadBalance();
      if (inventory.data) inventory.reload();
    } catch (err: unknown) {
      setBanner({
        text: formatContractErrorMessage(err),
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
      reloadBalance();
    } catch (err: unknown) {
      setBanner({
        text: formatContractErrorMessage(err),
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
      reloadBalance();
      if (inventory.data) inventory.reload();
    } catch (err: unknown) {
      setBanner({
        text: formatContractErrorMessage(err),
        type: "error",
      });
      throw err;
    }
  };

  const txUrl = getExplorerTxUrl(banner?.txHash);
  const cashNear = merchant.data ? yoctoToNear(merchant.data.cash) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-brass/15">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-parchment tracking-wide text-balance">
            Material Bazaar &amp; Floor Buyback
          </h1>
          <p className="text-sm text-ash mt-1.5 max-w-[65ch] leading-relaxed">
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
          title="Start a guest session to execute live trades"
          hint="Launch a Walletless NEAR Testnet Subaccount in 1 click (pre-loaded with 0.35 NEAR Citadel Pouch) to buy, sell, or refill the merchant reserve. The 1-week market sandbox below runs immediately."
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
                pouchYocto={pouchYocto}
                onTrade={handleTrade}
                onFundMerchant={handleFundMerchant}
              />
            </div>

            <div className="lg:col-span-7 space-y-6">
              <section className="obsidian-surface p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-frost" aria-hidden="true" />
                    <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
                      All-Material Live Spread Matrix (1x Unit)
                    </h2>
                  </div>
                  <span className={merchant.data.is_open ? "text-xs font-mono text-jackpot font-bold" : "text-xs font-mono text-hp-text font-bold"}>
                    {merchant.data.is_open ? "OPEN" : "CLOSED (<1.00 NEAR)"} · {formatNearAmount(merchant.data.cash, 2)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-brass/20 text-pewter">
                        <th className="py-2 pr-3 font-semibold">Commodity</th>
                        <th className="py-2 px-2 font-semibold">Stock / Bag</th>
                        <th className="py-2 px-2 font-semibold text-frost">Buy Ask (1x)</th>
                        <th className="py-2 px-2 font-semibold text-solar">Sell Bid (1x)</th>
                        <th className="py-2 pl-2 font-semibold text-right">Formula</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brass/10">
                      {QUOTE_ITEMS.map((qi) => {
                        const row = matrixRows.find((r) => r.id === qi.id);
                        const stockCount = merchant.data!.stock[qi.id] ?? 0;
                        const bagCount = inventory.data?.materials[qi.id] ?? 0;
                        const buyReason = explainMerchantQuote({
                          itemId: qi.id,
                          side: "buy",
                          stock: stockCount,
                          cashNear,
                          unitPriceNear: row?.buy ? yoctoToNear(row.buy.unit_price) : MERCHANT_BASE_PRICE_NEAR,
                          basePriceNear: MERCHANT_BASE_PRICE_NEAR,
                          rawReason: row?.buy?.reason,
                        });
                        return (
                          <tr key={qi.id} className="hover:bg-panel-elevated/40">
                            <td className="py-2.5 pr-3 text-parchment font-semibold whitespace-nowrap">
                              {qi.name}
                            </td>
                            <td className="py-2.5 px-2 font-mono-numbers text-ash whitespace-nowrap">
                              {stockCount} <span className="text-pewter">/ {bagCount}</span>
                            </td>
                            <td className="py-2.5 px-2 font-mono-numbers text-frost font-bold whitespace-nowrap">
                              {matrixLoading ? "..." : row?.buy ? formatNearAmount(row.buy.unit_price, 4) : "N/A"}
                            </td>
                            <td className="py-2.5 px-2 font-mono-numbers text-solar font-bold whitespace-nowrap">
                              {matrixLoading ? "..." : row?.sell ? formatNearAmount(row.sell.unit_price, 4) : "N/A"}
                            </td>
                            <td className="py-2.5 pl-2 text-right">
                              <SpireTooltip
                                triggerLabel={`Inspect pricing logic for ${qi.name}`}
                                content={
                                  <div className="space-y-1 text-xs font-mono">
                                    <div className="font-bold text-solar">{qi.name} Curve Reasoning</div>
                                    <p className="text-ash leading-relaxed">{buyReason}</p>
                                  </div>
                                }
                              >
                                <HelpCircle className="w-4 h-4 text-pewter hover:text-frost" aria-hidden="true" />
                              </SpireTooltip>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
