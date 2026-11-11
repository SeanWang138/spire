"use client";

import React, { useState } from "react";
import { Store, TrendingUp, Lock, ShoppingCart, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { PlayerInventory, ItemId } from "@/lib/contract";
import { MERCHANT_TARGET_STOCK, MERCHANT_CAP_PER_ITEM_EPOCH, MERCHANT_MIN_CASH_NEAR, yoctoToNear } from "@/lib/spire/constants";

interface NpcMerchantBazaarProps {
  /** Merchant cash reserve, yoctoNEAR string. */
  cashYocto: string;
  isOpen: boolean;
  stock: Record<ItemId, number>;
  inventory: PlayerInventory;
  onTrade: (action: "buy" | "sell", itemId: ItemId, amount: number) => Promise<void>;
  disabled?: boolean;
}

const CATALOG: { id: ItemId; name: string; group: "Materials" | "Weapons" }[] = [
  { id: "ore:iron", name: "Iron Ore", group: "Materials" },
  { id: "essence:solar", name: "Solar Essence", group: "Materials" },
  { id: "essence:frost", name: "Frost Essence", group: "Materials" },
  { id: "essence:void", name: "Void Essence", group: "Materials" },
  { id: "weapon:solar", name: "Solar Blade", group: "Weapons" },
  { id: "weapon:frost", name: "Frost Spear", group: "Weapons" },
  { id: "weapon:void", name: "Void Scythe", group: "Weapons" },
];

/**
 * NPC Merchant trading desk. Prices come from the contract's get_quote
 * (bonding curve + 10% two-way spread) — this desk only shows stock, reserve
 * and executes the signless buy/sell. No client-side price simulation.
 */
export const NpcMerchantBazaar: React.FC<NpcMerchantBazaarProps> = ({
  cashYocto,
  isOpen,
  stock,
  inventory,
  onTrade,
  disabled = false,
}) => {
  const [selectedItem, setSelectedItem] = useState<ItemId>("ore:iron");
  const [qty, setQty] = useState<number>(1);
  const [isTrading, setIsTrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashNear = yoctoToNear(cashYocto);
  const isClosed = !isOpen;

  const itemMeta = CATALOG.find((c) => c.id === selectedItem)!;
  const currentStock = stock[selectedItem] ?? 0;
  const userBalance =
    itemMeta.group === "Weapons"
      ? inventory.weapons[CATALOG.filter((c) => c.group === "Weapons").findIndex((c) => c.id === selectedItem)]
      : inventory.materials[selectedItem];

  const handleAction = async (action: "buy" | "sell") => {
    if (isClosed || isTrading || disabled || qty < 1) return;
    setIsTrading(true);
    setError(null);
    try {
      await onTrade(action, selectedItem, qty);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Trade failed — check reserve & stock.");
    } finally {
      setIsTrading(false);
    }
  };

  return (
    <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-solar" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
            NPC Merchant Bazaar
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-400">Cash:</span>
          <span className={`font-bold font-mono-numbers ${isClosed ? "text-hp" : "text-emerald-400"}`}>
            {cashNear.toFixed(2)} NEAR
          </span>
        </div>
      </div>

      {/* Closed warning — from get_merchant().is_open */}
      {isClosed && (
        <div className="p-2.5 rounded-lg bg-hp/15 border border-hp/40 text-hp text-xs font-mono flex items-center gap-2">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider block">Bazaar Closed</span>
            <span className="text-[11px] text-slate-300">
              Merchant cash &lt; {MERCHANT_MIN_CASH_NEAR.toFixed(1)} NEAR — trading is halted until the reserve is refilled.
            </span>
          </div>
        </div>
      )}

      {/* Market item selector */}
      <div>
        <label className="text-[10px] font-mono uppercase text-slate-400 mb-1 block">
          Select Commodity / Weapon
        </label>
        <select
          value={selectedItem}
          onChange={(e) => setSelectedItem(e.target.value as ItemId)}
          className="w-full p-2 rounded bg-panel-dark border border-white/10 text-xs font-mono text-white focus:outline-none"
        >
          <optgroup label="Materials">
            {CATALOG.filter((c) => c.group === "Materials").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (stock {stock[c.id] ?? 0})
              </option>
            ))}
          </optgroup>
          <optgroup label="Weapons">
            {CATALOG.filter((c) => c.group === "Weapons").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (stock {stock[c.id] ?? 0})
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Stock & holdings — contract facts only */}
      <div className="p-2 rounded bg-panel-dark border border-white/5 grid grid-cols-3 gap-2 text-[11px] font-mono">
        <div className="flex flex-col">
          <span className="text-slate-400">Merchant stock</span>
          <span className="font-mono-numbers text-white font-bold">{currentStock}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-400">Your holdings</span>
          <span className="font-mono-numbers text-white font-bold">{userBalance}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-400">Target / cap</span>
          <span className="font-mono-numbers text-slate-300 font-bold">
            {MERCHANT_TARGET_STOCK} · {MERCHANT_CAP_PER_ITEM_EPOCH}/epoch
          </span>
        </div>
      </div>

      {/* Qty + action desk */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase text-slate-400">Qty</span>
        <input
          type="number"
          min={1}
          max={MERCHANT_CAP_PER_ITEM_EPOCH}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Math.min(MERCHANT_CAP_PER_ITEM_EPOCH, Number(e.target.value) || 1)))}
          className="w-16 p-1.5 rounded bg-panel-dark border border-white/10 text-white text-xs font-mono-numbers focus:outline-none"
          aria-label="Trade quantity"
        />
        <div className="flex-1 grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAction("buy")}
            disabled={isClosed || isTrading || disabled || currentStock <= 0}
            className="py-2 px-3 rounded-lg bg-frost/20 hover:bg-frost/30 border border-frost/40 text-frost text-xs font-mono font-bold uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {isTrading ? <ArrowUpRight className="w-3.5 h-3.5 animate-pulse" /> : <ShoppingCart className="w-3.5 h-3.5" />}
            <span>Buy {qty}×</span>
          </button>
          <button
            onClick={() => handleAction("sell")}
            disabled={isClosed || isTrading || disabled || userBalance <= 0}
            className="py-2 px-3 rounded-lg bg-solar/20 hover:bg-solar/30 border border-solar/40 text-solar text-xs font-mono font-bold uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {isTrading ? <ArrowDownRight className="w-3.5 h-3.5 animate-pulse" /> : <TrendingUp className="w-3.5 h-3.5" />}
            <span>Sell {qty}×</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[11px] font-mono text-hp bg-hp/10 border border-hp/30 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      <p className="text-[10px] font-mono text-slate-500">
        Prices are calculated dynamically on-chain based on real-time stock pressure and demand volume.
      </p>
    </div>
  );
};
