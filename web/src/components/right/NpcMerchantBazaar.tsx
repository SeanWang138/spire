"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Store,
  TrendingUp,
  Lock,
  ShoppingCart,
  HelpCircle,
  Wallet,
  Coins,
  ShieldAlert,
} from "lucide-react";
import { SpireTooltip } from "@/components/ui/SpireUi";
import { formatContractErrorMessage } from "@/lib/errors";
import {
  get_quote,
  get_buyback_quote,
  type PlayerInventory,
  type ItemId,
  type MerchantQuote,
  type FloorResponse,
  type ElementIndex,
  type BuybackQuote,
} from "@/lib/contract";
import {
  MERCHANT_BASE_PRICE_NEAR,
  MERCHANT_TARGET_STOCK,
  MERCHANT_CAP_PER_ITEM_EPOCH,
  MERCHANT_MIN_CASH_NEAR,
  MERCHANT_SPREAD_BPS,
  BUYBACK_MAX_PER_FLOOR_EPOCH,
  BUYBACK_MAX_PER_ACCOUNT_EPOCH,
  ELEMENT_NAMES,
  yoctoToNear,
} from "@/lib/spire/constants";
import { explainMerchantQuote } from "@/lib/merchant-reasoning";
import { getFreeWeaponCounts } from "@/lib/combat-rules";
import { formatNearAmount, parseYoctoSafe } from "@/lib/utils/cn";

interface NpcMerchantBazaarProps {
  cashYocto: string;
  isOpen: boolean;
  stock: Record<ItemId, number>;
  inventory: PlayerInventory;
  /** Playable contract Citadel Pouch balance in yoctoNEAR for pre-trade Buy guard. */
  pouchYocto?: string | null;
  onTrade: (action: "buy" | "sell", itemId: ItemId, amount: number) => Promise<void>;
  onFundMerchant?: (amountNear: number) => Promise<void>;
  disabled?: boolean;
}

const MATERIAL_CATALOG: { id: Extract<ItemId, "ore:iron" | "essence:solar" | "essence:frost" | "essence:void">; name: string }[] = [
  { id: "ore:iron", name: "Iron Ore" },
  { id: "essence:solar", name: "Solar Essence" },
  { id: "essence:frost", name: "Frost Essence" },
  { id: "essence:void", name: "Void Essence" },
];

export const NpcMerchantBazaar: React.FC<NpcMerchantBazaarProps> = ({
  cashYocto,
  isOpen,
  stock,
  inventory,
  pouchYocto,
  onTrade,
  onFundMerchant,
  disabled = false,
}) => {
  const [selectedItem, setSelectedItem] = useState<
    "ore:iron" | "essence:solar" | "essence:frost" | "essence:void"
  >("ore:iron");
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
  const isClosed = !isOpen || cashNear < MERCHANT_MIN_CASH_NEAR;
  const currentStock = stock[selectedItem] ?? 0;
  const sellableBalance = inventory.materials[selectedItem] ?? 0;
  const buyCostYocto = parseYoctoSafe(liveQuotes.buy?.total_price);
  const insufficientPouchForBuy =
    pouchYocto != null &&
    buyCostYocto > 0n &&
    parseYoctoSafe(pouchYocto) < buyCostYocto;

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
  }, [selectedItem, qty, cashYocto, currentStock]);

  const buyReasoning = explainMerchantQuote({
    itemId: selectedItem,
    side: "buy",
    stock: currentStock,
    cashNear,
    unitPriceNear: liveQuotes.buy ? yoctoToNear(liveQuotes.buy.unit_price) : MERCHANT_BASE_PRICE_NEAR,
    basePriceNear: MERCHANT_BASE_PRICE_NEAR,
    rawReason: liveQuotes.buy?.reason,
  });

  const sellReasoning = explainMerchantQuote({
    itemId: selectedItem,
    side: "sell",
    stock: currentStock,
    cashNear,
    unitPriceNear: liveQuotes.sell ? yoctoToNear(liveQuotes.sell.unit_price) : MERCHANT_BASE_PRICE_NEAR,
    basePriceNear: MERCHANT_BASE_PRICE_NEAR,
    rawReason: liveQuotes.sell?.reason,
  });

  const handleAction = async (action: "buy" | "sell") => {
    if (isClosed || isTrading || disabled || qty < 1) return;
    if (action === "buy" && insufficientPouchForBuy) return;
    setIsTrading(true);
    setError(null);
    try {
      await onTrade(action, selectedItem, qty);
    } catch (err: unknown) {
      setError(formatContractErrorMessage(err));
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
      setError(formatContractErrorMessage(err));
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <section className="citadel-stage p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-solar" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
            NPC Material Desk
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-ash">Cash Reserve:</span>
          <span className={`font-bold font-mono-numbers ${isClosed ? "text-hp-text" : "text-jackpot"}`}>
            {formatNearAmount(cashYocto, 2)}
          </span>
        </div>
      </div>

      {isClosed && (
        <div className="p-3 rounded-lg bg-hp/15 border border-hp/40 text-hp-text text-xs font-mono flex items-start gap-2.5">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-bold uppercase tracking-wider block">Bazaar Closed (Liquidity Halt)</span>
            <span className="text-xs text-parchment block mt-0.5 leading-relaxed">
              Reserve fell below {MERCHANT_MIN_CASH_NEAR.toFixed(2)} NEAR. Trading pauses until raid ticket inflows or a liquidity refill restores cash above 1.00 NEAR.
            </span>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="merchant-item-select" className="text-xs font-mono uppercase text-ash mb-1.5 block">
          Select Material (4 Commodities Only)
        </label>
        <select
          id="merchant-item-select"
          value={selectedItem}
          onChange={(e) =>
            setSelectedItem(
              e.target.value as "ore:iron" | "essence:solar" | "essence:frost" | "essence:void"
            )
          }
          className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-brass/25 text-xs font-mono text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-solar"
        >
          {MATERIAL_CATALOG.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (Stock: {stock[c.id] ?? 0})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg bg-panel-dark p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-ash">
          <span>
            Base {MERCHANT_BASE_PRICE_NEAR.toFixed(2)} NEAR · Target {MERCHANT_TARGET_STOCK}
          </span>
          <span className="text-frost font-bold font-mono-numbers">{currentStock} units in vault</span>
        </div>
        <svg viewBox="0 0 320 72" className="w-full h-16" aria-label="Bonding curve stock pricing gauge">
          <path
            d="M 10 14 Q 110 24, 160 38 T 310 58"
            fill="none"
            stroke="#38BDF8"
            strokeOpacity="0.7"
            strokeWidth="2"
          />
          <line x1="160" y1="8" x2="160" y2="64" stroke="#E5A93B" strokeOpacity="0.45" strokeDasharray="3 3" />
          <circle
            cx={Math.max(14, Math.min(306, 160 + (currentStock - MERCHANT_TARGET_STOCK) * 1.4))}
            cy={Math.max(14, Math.min(58, 38 + (currentStock - MERCHANT_TARGET_STOCK) * 0.19))}
            r="5"
            fill="#F2A63B"
          />
          <text x="12" y="66" fill="#CEC4B3" fontSize="12" fontFamily="monospace">
            Scarce (High Ask)
          </text>
          <text x="195" y="18" fill="#CEC4B3" fontSize="12" fontFamily="monospace">
            Surplus (Low Bid)
          </text>
        </svg>
      </div>

      <dl className="rounded-lg bg-panel-dark divide-x divide-brass/15 grid grid-cols-3 text-xs font-mono">
        <div className="p-2.5 flex flex-col">
          <dt className="text-xs text-pewter">Stock</dt>
          <dd className="font-mono-numbers text-parchment font-bold mt-0.5">{currentStock}</dd>
        </div>
        <div className="p-2.5 flex flex-col">
          <dt className="text-xs text-pewter">Your Bag</dt>
          <dd className="font-mono-numbers text-parchment font-bold mt-0.5">{sellableBalance}</dd>
        </div>
        <div className="p-2.5 flex flex-col">
          <dt className="text-xs text-pewter">Target / Cap</dt>
          <dd className="font-mono-numbers text-ash font-bold mt-0.5">
            {MERCHANT_TARGET_STOCK} · {MERCHANT_CAP_PER_ITEM_EPOCH}/ep
          </dd>
        </div>
      </dl>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="merchant-qty-input" className="text-xs font-mono uppercase text-ash shrink-0">
            Quantity
          </label>
          <input
            id="merchant-qty-input"
            type="number"
            min={1}
            max={MERCHANT_CAP_PER_ITEM_EPOCH}
            placeholder="1"
            value={qty}
            onChange={(e) =>
              setQty(Math.max(1, Math.min(MERCHANT_CAP_PER_ITEM_EPOCH, Number(e.target.value) || 1)))
            }
            className="w-24 min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-brass/25 text-parchment text-xs font-mono-numbers placeholder-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-solar"
          />
          <span className="text-xs font-mono text-pewter">
            &plusmn;{MERCHANT_SPREAD_BPS / 100}% bid-ask spread
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleAction("buy")}
            disabled={isClosed || isTrading || disabled || currentStock < qty || insufficientPouchForBuy}
            className="min-h-[48px] py-2.5 px-3 rounded-lg bg-frost/15 hover:bg-frost/25 border border-frost/40 text-frost text-xs font-mono font-bold transition-colors disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
          >
            <span className="inline-flex items-center gap-1.5 uppercase">
              <ShoppingCart className="w-4 h-4 shrink-0" aria-hidden="true" />
              Buy {qty}x
            </span>
            <span className="font-mono-numbers text-parchment">
              {liveQuotes.buy ? formatNearAmount(liveQuotes.buy.total_price, 4) : "..."}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleAction("sell")}
            disabled={isClosed || isTrading || disabled || sellableBalance < qty}
            className="min-h-[48px] py-2.5 px-3 rounded-lg bg-solar/15 hover:bg-solar/25 border border-solar/40 text-solar text-xs font-mono font-bold transition-colors disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
          >
            <span className="inline-flex items-center gap-1.5 uppercase">
              <TrendingUp className="w-4 h-4 shrink-0" aria-hidden="true" />
              Sell {qty}x
            </span>
            <span className="font-mono-numbers text-parchment">
              {liveQuotes.sell ? formatNearAmount(liveQuotes.sell.total_price, 4) : "..."}
            </span>
          </button>
        </div>

        {insufficientPouchForBuy && (
          <div className="px-3 py-2.5 rounded-lg bg-solar/10 border border-solar/35 text-xs font-mono text-solar flex flex-wrap items-center justify-between gap-2">
            <span>
              Citadel Pouch ({formatNearAmount(pouchYocto ?? "0", 4)}) is below Buy Ask.
            </span>
            <Link
              href="/game/vault?tab=pouch"
              className="underline font-bold text-parchment hover:text-solar"
            >
              Deposit in Vault →
            </Link>
          </div>
        )}

        <div className="px-3.5 py-2.5 rounded-lg bg-panel-dark text-xs font-mono text-ash space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="leading-relaxed">{buyReasoning}</span>
            <SpireTooltip
              triggerLabel="Inspect bonding curve pricing formula"
              content={
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="font-bold text-solar">Bonding-Curve Pricing Logic</div>
                  <p className="text-ash">
                    Mid price shifts dynamically from the {MERCHANT_BASE_PRICE_NEAR.toFixed(2)} NEAR base using stock vs {MERCHANT_TARGET_STOCK} target + demand pressure, clamped 0.50x..2.00x with &plusmn;{MERCHANT_SPREAD_BPS / 100}% spread.
                  </p>
                  <p className="text-pewter">{sellReasoning}</p>
                </div>
              }
            >
              <HelpCircle className="w-4 h-4 text-frost shrink-0" aria-hidden="true" />
            </SpireTooltip>
          </div>
          <div className="text-pewter">{sellReasoning}</div>
        </div>
      </div>

      {onFundMerchant && (
        <form onSubmit={handleFund} className="pt-3 border-t border-brass/15 space-y-2">
          <label htmlFor="fund-merchant-input" className="text-xs font-mono uppercase text-ash flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-jackpot" aria-hidden="true" />
            <span>Refill Merchant Liquidity Reserve (NEAR)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="fund-merchant-input"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="2.0"
              value={fundInput}
              onChange={(e) => setFundInput(e.target.value)}
              className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-brass/25 text-parchment text-xs font-mono-numbers placeholder-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-solar"
            />
            <button
              type="submit"
              disabled={isFunding || disabled}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-jackpot/15 hover:bg-jackpot/25 border border-jackpot/40 text-jackpot text-xs font-mono font-bold uppercase transition-colors disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
            >
              {isFunding ? "Sending..." : "Fund Reserve"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div role="alert" className="text-xs font-mono text-hp-text bg-hp/15 border border-hp/40 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </section>
  );
};

export interface FloorBuybackDeskProps {
  floors: FloorResponse[];
  inventory: PlayerInventory;
  onBuyback: (floor: number, element: ElementIndex, qty: number) => Promise<void>;
  disabled?: boolean;
}

/**
 * Separate Floor Buyback Desk (`get_buyback_quote` / `sell_to_boss_buyback`).
 * Buys back Free Crafted (non-starter) weapons from players using a floor's
 * buyback_reserve at the AI-governed multiplier, crediting Citadel Ledger.
 */
export const FloorBuybackDesk: React.FC<FloorBuybackDeskProps> = ({
  floors,
  inventory,
  onBuyback,
  disabled = false,
}) => {
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [selectedElement, setSelectedElement] = useState<ElementIndex>(0);
  const [qty, setQty] = useState<number>(1);
  const [quote, setQuote] = useState<BuybackQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const floorData = floors.find((f) => f.floor === selectedFloor) ?? floors[0];
  const activeFloor = floorData?.floor ?? selectedFloor;
  const freeCounts = getFreeWeaponCounts(inventory.weapons, inventory.starter_locked);
  const freeForElement = freeCounts[selectedElement] ?? 0;

  useEffect(() => {
    let cancelled = false;
    setLoadingQuote(true);
    get_buyback_quote(activeFloor, selectedElement)
      .then((res) => {
        if (!cancelled) setQuote(res);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeFloor, selectedElement]);

  const unitYocto = parseYoctoSafe(quote?.unit_price);
  const totalPayoutYocto = unitYocto * BigInt(qty);
  const reserveYocto = parseYoctoSafe(floorData?.buyback_reserve);
  const floorCapUsed = floorData?.volume_buyback_epoch ?? 0;
  const floorCapLeft = Math.max(0, BUYBACK_MAX_PER_FLOOR_EPOCH - floorCapUsed);

  const isUnlocked = Boolean(floorData?.unlocked);
  const hasEnoughWeapons = freeForElement >= qty;
  const hasEnoughReserve = reserveYocto >= totalPayoutYocto && totalPayoutYocto > 0n;
  const hasFloorCap = floorCapLeft >= qty;

  const canSell =
    isUnlocked && hasEnoughWeapons && hasEnoughReserve && hasFloorCap && !isSelling && !disabled;

  const handleSellBuyback = async () => {
    if (!canSell) return;
    setIsSelling(true);
    setError(null);
    try {
      await onBuyback(activeFloor, selectedElement, qty);
    } catch (err: unknown) {
      setError(formatContractErrorMessage(err));
    } finally {
      setIsSelling(false);
    }
  };

  let disabledHint: string | null = null;
  if (!isUnlocked) {
    disabledHint = `Floor ${activeFloor} is locked until the prior floor boss falls.`;
  } else if (!hasEnoughWeapons) {
    disabledHint = `Need ${qty} Free Crafted ${ELEMENT_NAMES[selectedElement]} weapon(s). Starter Locked blades cannot be sold.`;
  } else if (!hasFloorCap) {
    disabledHint = `Floor ${activeFloor} epoch buyback limit (${BUYBACK_MAX_PER_FLOOR_EPOCH}/epoch) reached.`;
  } else if (!hasEnoughReserve && quote) {
    disabledHint = `Floor ${activeFloor} buyback reserve (${formatNearAmount(reserveYocto, 4)}) is below payout.`;
  }

  return (
    <section className="obsidian-surface p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-void-text" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-parchment">
            Floor Buyback Desk
          </h2>
        </div>
        <span className="text-xs font-mono text-ash">
          Reserve:{" "}
          <strong className="font-mono-numbers text-jackpot">
            {floorData ? formatNearAmount(floorData.buyback_reserve, 4) : "0.0000 NEAR"}
          </strong>
        </span>
      </div>

      <p className="text-xs text-ash leading-relaxed">
        Sell Free Crafted weapons to a floor&apos;s Boss Reserve at its live floor multiplier (1.00x baseline in epoch-only mode). Credits directly to your Citadel Pouch (Starter Locked weapons excluded).
      </p>

      {/* Floor selector */}
      <div className="space-y-1.5">
        <span className="text-xs font-mono uppercase text-ash block">Target Floor</span>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((fl) => {
            const f = floors.find((x) => x.floor === fl);
            const active = activeFloor === fl;
            return (
              <button
                key={fl}
                type="button"
                onClick={() => setSelectedFloor(fl)}
                aria-pressed={active}
                className={`min-h-[44px] px-3 py-2 rounded-lg border text-xs font-mono font-semibold flex flex-col items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
                  active
                    ? "border-void/60 bg-void/20 text-void-text"
                    : "border-brass/20 bg-panel-dark text-ash hover:text-parchment hover:bg-panel-elevated"
                }`}
              >
                <span>Floor {fl}</span>
                <span className="text-xs text-pewter">
                  {f?.unlocked ? "Open" : "Locked"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Element selector */}
      <div className="space-y-1.5">
        <span className="text-xs font-mono uppercase text-ash block">Weapon Element (Free Crafted)</span>
        <div className="grid grid-cols-3 gap-2">
          {([0, 1, 2] as ElementIndex[]).map((el) => {
            const active = selectedElement === el;
            return (
              <button
                key={el}
                type="button"
                onClick={() => setSelectedElement(el)}
                aria-pressed={active}
                className={`min-h-[44px] px-2.5 py-2 rounded-lg border text-xs font-mono font-semibold flex flex-col items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
                  active
                    ? "border-solar/60 bg-solar/15 text-solar"
                    : "border-brass/20 bg-panel-dark text-ash hover:text-parchment hover:bg-panel-elevated"
                }`}
              >
                <span>{ELEMENT_NAMES[el]}</span>
                <span className="text-xs font-mono-numbers text-pewter">
                  {freeCounts[el]} free
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <dl className="rounded-lg bg-panel-dark divide-x divide-brass/15 grid grid-cols-3 text-xs font-mono">
        <div className="p-2.5 flex flex-col">
          <dt className="text-xs text-pewter">Multiplier</dt>
          <dd className="font-mono-numbers text-void-text font-bold mt-0.5">
            {loadingQuote ? "..." : quote ? `${(quote.multiplier_bps / 100).toFixed(0)}%` : "N/A"}
          </dd>
        </div>
        <div className="p-2.5 flex flex-col">
          <dt className="text-xs text-pewter">Unit Bid</dt>
          <dd className="font-mono-numbers text-parchment font-bold mt-0.5">
            {loadingQuote ? "..." : quote ? formatNearAmount(quote.unit_price, 4) : "N/A"}
          </dd>
        </div>
        <div className="p-2.5 flex flex-col">
          <dt className="text-xs text-pewter">Epoch Cap</dt>
          <dd className="font-mono-numbers text-ash font-bold mt-0.5">
            {floorCapUsed}/{BUYBACK_MAX_PER_FLOOR_EPOCH} fl · {BUYBACK_MAX_PER_ACCOUNT_EPOCH}/acct
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="buyback-qty-input" className="text-xs font-mono uppercase text-ash shrink-0">
          Qty (1-{BUYBACK_MAX_PER_ACCOUNT_EPOCH})
        </label>
        <input
          id="buyback-qty-input"
          type="number"
          min={1}
          max={BUYBACK_MAX_PER_ACCOUNT_EPOCH}
          placeholder="1"
          value={qty}
          onChange={(e) =>
            setQty(Math.max(1, Math.min(BUYBACK_MAX_PER_ACCOUNT_EPOCH, Number(e.target.value) || 1)))
          }
          className="w-24 min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-brass/25 text-parchment text-xs font-mono-numbers placeholder-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-solar"
        />
        <span className="text-xs font-mono text-pewter">
          Payout:{" "}
          <strong className="font-mono-numbers text-jackpot">
            {quote ? formatNearAmount(totalPayoutYocto, 4) : "..."}
          </strong>
        </span>
      </div>

      {disabledHint && (
        <div className="px-3 py-2 rounded-lg bg-panel-dark text-xs font-mono text-solar flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{disabledHint}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleSellBuyback}
        disabled={!canSell}
        className="min-h-[44px] w-full py-2.5 px-4 rounded-lg bg-void/25 hover:bg-void/35 border border-void/50 text-void-text font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-between gap-2 transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
      >
        <span>
          {isSelling
            ? "Settling Buyback..."
            : `Sell ${qty}x ${ELEMENT_NAMES[selectedElement]} to Floor ${activeFloor}`}
        </span>
        <span className="font-mono-numbers text-parchment">
          {quote ? formatNearAmount(totalPayoutYocto, 4) : "..."}
        </span>
      </button>

      {error && (
        <div role="alert" className="text-xs font-mono text-hp-text bg-hp/15 border border-hp/40 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </section>
  );
};
