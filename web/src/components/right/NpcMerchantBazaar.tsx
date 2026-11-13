"use client";

import React, { useEffect, useState } from "react";
import {
  Store,
  TrendingUp,
  Lock,
  ShoppingCart,
  HelpCircle,
  Wallet,
} from "lucide-react";
import { PlayerInventory, ItemId, MerchantQuote, get_quote } from "@/lib/contract";
import {
  MERCHANT_TARGET_STOCK,
  MERCHANT_CAP_PER_ITEM_EPOCH,
  MERCHANT_MIN_CASH_NEAR,
  MERCHANT_SPREAD_BPS,
  yoctoToNear,
} from "@/lib/spire/constants";
import { formatNearAmount } from "@/lib/utils/cn";

interface NpcMerchantBazaarProps {
  cashYocto: string;
  isOpen: boolean;
  stock: Record<ItemId, number>;
  inventory: PlayerInventory;
  onTrade: (action: "buy" | "sell", itemId: ItemId, amount: number) => Promise<void>;
  onFundMerchant?: (amountNear: number) => Promise<void>;
  disabled?: boolean;
}

const CATALOG: { id: ItemId; name: string; group: "Materials" | "Weapons"; weaponIdx?: 0 | 1 | 2 }[] = [
  { id: "ore:iron", name: "Iron Ore", group: "Materials" },
  { id: "essence:solar", name: "Solar Essence", group: "Materials" },
  { id: "essence:frost", name: "Frost Essence", group: "Materials" },
  { id: "essence:void", name: "Void Essence", group: "Materials" },
  { id: "weapon:solar", name: "Solar Blade", group: "Weapons", weaponIdx: 0 },
  { id: "weapon:frost", name: "Frost Spear", group: "Weapons", weaponIdx: 1 },
  { id: "weapon:void", name: "Void Scythe", group: "Weapons", weaponIdx: 2 },
];

export const NpcMerchantBazaar: React.FC<NpcMerchantBazaarProps> = ({
  cashYocto,
  isOpen,
  stock,
  inventory,
  onTrade,
  onFundMerchant,
  disabled = false,
}) => {
  const [selectedItem, setSelectedItem] = useState<ItemId>("ore:iron");
  const [qty, setQty] = useState<number>(1);
  const [isTrading, setIsTrading] = useState(false);
  const [fundInput, setFundInput] = useState<string>("2");
  const [isFunding, setIsFunding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveQuotes, setLiveQuotes] = useState<{ buy: MerchantQuote | null; sell: MerchantQuote | null }>({
    buy: null,
    sell: null,
  });

  const cashNear = yoctoToNear(cashYocto);
  const isClosed = !isOpen;

  const itemMeta = CATALOG.find((c) => c.id === selectedItem)!;
  const currentStock = stock[selectedItem] ?? 0;

  const lockedCount =
    itemMeta.weaponIdx !== undefined ? inventory.starter_locked[itemMeta.weaponIdx] : 0;
  const rawHoldings =
    itemMeta.weaponIdx !== undefined
      ? inventory.weapons[itemMeta.weaponIdx]
      : inventory.materials[selectedItem];
  const sellableBalance =
    itemMeta.weaponIdx !== undefined ? Math.max(0, rawHoldings - lockedCount) : rawHoldings;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get_quote(selectedItem, "buy", qty).catch(() => null),
      get_quote(selectedItem, "sell", qty).catch(() => null),
    ]).then(([buy, sell]) => {
      if (!cancelled) setLiveQuotes({ buy, sell });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedItem, qty, cashYocto]);

  const handleAction = async (action: "buy" | "sell") => {
    if (isClosed || isTrading || disabled || qty < 1) return;
    setIsTrading(true);
    setError(null);
    try {
      await onTrade(action, selectedItem, qty);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Trade failed: check merchant reserve and stock.");
    } finally {
      setIsTrading(false);
    }
  };

  const handleFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onFundMerchant || isFunding || disabled) return;
    const amt = Number(fundInput);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a positive NEAR amount to refill the merchant reserve.");
      return;
    }
    setIsFunding(true);
    setError(null);
    try {
      await onFundMerchant(amt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fund merchant reserve.");
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <div className="citadel-stage p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-solar" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
            NPC Merchant Desk
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-ash">Cash Reserve:</span>
          <span className={`font-bold font-mono-numbers ${isClosed ? "text-hp" : "text-emerald-400"}`}>
            {cashNear.toFixed(2)} NEAR
          </span>
        </div>
      </div>

      {/* Closed warning */}
      {isClosed && (
        <div className="p-3 rounded-lg bg-hp/15 border border-hp/40 text-hp text-xs font-mono flex items-start gap-2.5">
          <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-bold uppercase tracking-wider block">Bazaar Closed (Liquidity Halt)</span>
            <span className="text-xs text-rose-100 block mt-0.5 leading-relaxed">
              Merchant reserve fell below {MERCHANT_MIN_CASH_NEAR.toFixed(1)} NEAR. Trading pauses automatically until ticket inflow or a liquidity refill restores cash above 1.0 NEAR.
            </span>
          </div>
        </div>
      )}

      {/* Item selector */}
      <div>
        <label htmlFor="merchant-item-select" className="text-xs font-mono uppercase text-ash mb-1.5 block">
          Select Commodity or Weapon
        </label>
        <select
          id="merchant-item-select"
          value={selectedItem}
          onChange={(e) => setSelectedItem(e.target.value as ItemId)}
          className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-brass/20 text-xs font-mono text-parchment focus:outline-none focus:border-frost"
        >
          <optgroup label="Materials">
            {CATALOG.filter((c) => c.group === "Materials").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Stock: {stock[c.id] ?? 0})
              </option>
            ))}
          </optgroup>
          <optgroup label="Weapons">
            {CATALOG.filter((c) => c.group === "Weapons").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Stock: {stock[c.id] ?? 0})
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Live AMM Bonding Curve Gauge + Stock Ledger */}
      <div className="rounded-lg border border-brass/20 bg-[#090A10]/90 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-ash">
          <span>AMM Curve vs Target Stock ({MERCHANT_TARGET_STOCK})</span>
          <span className="text-frost font-bold">{currentStock} units in vault</span>
        </div>
        <svg viewBox="0 0 320 68" className="w-full h-16" aria-label="Bonding curve stock pricing gauge">
          <path
            d="M 10 12 Q 110 22, 160 36 T 310 56"
            fill="none"
            stroke="#38BDF8"
            strokeOpacity="0.65"
            strokeWidth="2"
          />
          <line x1="160" y1="6" x2="160" y2="62" stroke="#E5A93B" strokeOpacity="0.4" strokeDasharray="3 3" />
          <circle
            cx={Math.max(14, Math.min(306, 160 + (currentStock - MERCHANT_TARGET_STOCK) * 1.4))}
            cy={Math.max(12, Math.min(56, 36 + (currentStock - MERCHANT_TARGET_STOCK) * 0.19))}
            r="5"
            fill="#F2A63B"
          />
          <text x="12" y="62" fill="#CEC4B3" fontSize="10" fontFamily="monospace">Scarce (High Ask)</text>
          <text x="225" y="18" fill="#CEC4B3" fontSize="10" fontFamily="monospace">Surplus (Low Bid)</text>
        </svg>
      </div>

      {/* Flat Telemetry Ledger */}
      <dl className="rounded-lg bg-panel-dark divide-x divide-brass/15 grid grid-cols-3 text-xs font-mono">
        <div className="p-2.5 flex flex-col">
          <dt className="text-[11px] text-pewter">Stock</dt>
          <dd className="font-mono-numbers text-parchment font-bold mt-0.5">{currentStock}</dd>
        </div>
        <div className="p-2.5 flex flex-col">
          <dt className="text-[11px] text-pewter">Sellable</dt>
          <dd className="font-mono-numbers text-parchment font-bold mt-0.5">
            {sellableBalance}
            {lockedCount > 0 && <span className="text-[11px] text-pewter font-normal"> (+{lockedCount} locked)</span>}
          </dd>
        </div>
        <div className="p-2.5 flex flex-col">
          <dt className="text-[11px] text-pewter">Target / Cap</dt>
          <dd className="font-mono-numbers text-ash font-bold mt-0.5">
            {MERCHANT_TARGET_STOCK} · {MERCHANT_CAP_PER_ITEM_EPOCH}/ep
          </dd>
        </div>
      </dl>

      {/* Quantity + Trade Actions */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-3">
          <label htmlFor="merchant-qty-input" className="text-xs font-mono uppercase text-slate-300 shrink-0">
            Quantity
          </label>
          <input
            id="merchant-qty-input"
            type="number"
            min={1}
            max={MERCHANT_CAP_PER_ITEM_EPOCH}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(MERCHANT_CAP_PER_ITEM_EPOCH, Number(e.target.value) || 1)))}
            className="w-24 min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-white text-xs font-mono-numbers focus:outline-none focus:border-frost"
          />
          <span className="text-[11px] font-mono text-slate-400">
            {MERCHANT_SPREAD_BPS / 100}% bid-ask spread
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleAction("buy")}
            disabled={isClosed || isTrading || disabled || currentStock < qty}
            title={liveQuotes.buy?.reason || "Bonding curve ask price from on-chain quote"}
            className="min-h-[48px] py-2.5 px-3 rounded-lg bg-frost/15 hover:bg-frost/25 border border-frost/40 text-frost text-xs font-mono font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-1.5 uppercase">
              <ShoppingCart className="w-4 h-4 shrink-0" aria-hidden="true" />
              Buy {qty}x
            </span>
            <span className="font-mono-numbers text-white">
              {liveQuotes.buy ? formatNearAmount(liveQuotes.buy.total_price, 3) : "..."}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleAction("sell")}
            disabled={isClosed || isTrading || disabled || sellableBalance < qty}
            title={liveQuotes.sell?.reason || "Bonding curve bid price with 10% spread deduction"}
            className="min-h-[48px] py-2.5 px-3 rounded-lg bg-solar/15 hover:bg-solar/25 border border-solar/40 text-solar text-xs font-mono font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-1.5 uppercase">
              <TrendingUp className="w-4 h-4 shrink-0" aria-hidden="true" />
              Sell {qty}x
            </span>
            <span className="font-mono-numbers text-white">
              {liveQuotes.sell ? formatNearAmount(liveQuotes.sell.total_price, 3) : "..."}
            </span>
          </button>
        </div>

        {/* Inline Quote Reasoning Tooltip Banner */}
        {(liveQuotes.buy?.reason || liveQuotes.sell?.reason) && (
          <div className="px-3 py-2 rounded-lg bg-panel-dark text-xs font-mono text-slate-300 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-frost shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong className="text-white">Contract Pricing Reason:</strong>{" "}
              {liveQuotes.buy?.reason ?? liveQuotes.sell?.reason}
            </span>
          </div>
        )}
      </div>

      {/* Rescue Reserve Control */}
      {onFundMerchant && (
        <form onSubmit={handleFund} className="pt-3 border-t border-white/10 space-y-2">
          <label htmlFor="fund-merchant-input" className="text-[11px] font-mono uppercase text-slate-300 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-jackpot" aria-hidden="true" />
            <span>Refill Merchant Liquidity Reserve (NEAR)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="fund-merchant-input"
              type="number"
              step="0.1"
              min="0.1"
              value={fundInput}
              onChange={(e) => setFundInput(e.target.value)}
              className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-white text-xs font-mono-numbers focus:outline-none focus:border-jackpot"
            />
            <button
              type="submit"
              disabled={isFunding || disabled}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-jackpot/15 hover:bg-jackpot/25 border border-jackpot/40 text-jackpot text-xs font-mono font-bold uppercase transition-colors disabled:opacity-40"
            >
              {isFunding ? "Sending..." : "Fund Reserve"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div role="alert" className="text-xs font-mono text-hp bg-hp/10 border border-hp/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
};
