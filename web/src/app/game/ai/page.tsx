"use client";

import React, { useEffect, useState } from "react";
import {
  BrainCircuit,
  Cpu,
  KeyRound,
  MessageSquareQuote,
  RefreshCw,
  TerminalSquare,
  TrendingUp,
  Flame,
  Snowflake,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { get_tower, get_ai_state, get_buyback_quote, sell_to_boss_buyback } from "@/lib/contract";
import type { AiStateResponse, BuybackQuote, ElementIndex } from "@/lib/contract";
import { useContractView, useSessionAccount } from "@/lib/spire/hooks";
import { formatNearAmount } from "@/lib/utils/cn";
import { ALTAR_RECIPE_2_TO_1, ALTAR_RECIPE_3_TO_2 } from "@/lib/spire/constants";

const ELEMENTS: { index: ElementIndex; name: string; icon: React.ReactNode; color: string }[] = [
  { index: 0, name: "Solar", icon: <Flame className="w-3.5 h-3.5" />, color: "text-solar" },
  { index: 1, name: "Frost", icon: <Snowflake className="w-3.5 h-3.5" />, color: "text-frost" },
  { index: 2, name: "Void", icon: <Sparkles className="w-3.5 h-3.5" />, color: "text-void" },
];

function FloorSelector({
  floor,
  setFloor,
}: {
  floor: number;
  setFloor: (f: number) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3].map((f) => (
        <button
          key={f}
          onClick={() => setFloor(f)}
          className={`px-3 py-1 rounded-lg border text-[11px] font-mono font-bold transition-all ${
            floor === f
              ? "bg-frost/20 border-frost text-frost"
              : "bg-panel-dark border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          Floor {f}
        </button>
      ))}
    </div>
  );
}

export default function AiPage() {
  const session = useSessionAccount();
  const tower = useContractView(get_tower, []);

  const [floor, setFloor] = useState(1);
  const [buybackQuotes, setBuybackQuotes] = useState<(BuybackQuote | null)[]>([null, null, null]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [sellQty, setSellQty] = useState<number>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const aiState = useContractView<AiStateResponse>(
    async () => await get_ai_state(floor),
    [floor]
  );

  // get_buyback_quote(floor, element) per element — live from the contract.
  useEffect(() => {
    let cancelled = false;
    setQuotesLoading(true);
    Promise.all(
      ([0, 1, 2] as ElementIndex[]).map((el) =>
        get_buyback_quote(floor, el).catch(() => null)
      )
    ).then((quotes) => {
      if (!cancelled) setBuybackQuotes(quotes);
      if (!cancelled) setQuotesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [floor, aiState.data?.nonce]);

  const handleSellBack = async (element: ElementIndex) => {
    if (!session || busy) return;
    setBusy(`sell-${element}`);
    setMessage(null);
    try {
      await sell_to_boss_buyback(floor, element, sellQty);
      setMessage(`sell_to_boss_buyback sent: floor ${floor}, ${ELEMENTS[element].name} ×${sellQty}`);
      tower.reload();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Sellback failed — check the per-epoch buyback cap.");
    } finally {
      setBusy(null);
    }
  };

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <EmptyState title="No session yet" hint="Enter from /game/start to meet the Boss Brain." />
      </div>
    );
  }

  if (!aiState.data) {
    return (
      <div className="px-1 py-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">Boss Brain</h1>
          <p className="text-xs sm:text-sm font-mono text-slate-400">
            Proposal TEE per-epoch: multiplier buyback per elemen, resep altar, dan taunt —
            semuanya diverifikasi tanda tangan Ed25519 oleh kontrak.
          </p>
          <FloorSelector floor={floor} setFloor={setFloor} />
        </div>
        <EmptyState
          title="AI state unavailable"
          hint="get_ai_state view call failed from the public RPC — the latest TEE proposal cannot be displayed. No simulated data on this page."
          onReload={() => {
            tower.reload();
            aiState.reload();
          }}
        />
      </div>
    );
  }

  const ai = aiState.data;

  return (
    <div className="px-1 py-8 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">Boss Brain</h1>
        <p className="text-xs sm:text-sm font-mono text-slate-400">
          Proposal TEE per-epoch: multiplier buyback per elemen, resep altar, dan taunt —
          semuanya diverifikasi tanda tangan Ed25519 oleh kontrak.
        </p>
        <FloorSelector floor={floor} setFloor={setFloor} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Taunt + proposal facts */}
        <div className="md:col-span-7 flex flex-col gap-3">
          <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <TerminalSquare className="w-4 h-4 text-solar" />
              <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
                Taunt Boss
              </h2>
              <span className="text-[10px] font-mono text-slate-400">
                epoch {ai.epoch} · nonce {ai.nonce}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-panel-dark border border-void/30 text-[12px] font-mono leading-relaxed flex items-start gap-2">
              <MessageSquareQuote className="w-4 h-4 text-void mt-0.5 flex-shrink-0" />
              <span className="text-slate-300">
                {ai.taunt || "(the enclave has not sent a taunt for this floor yet)"}
              </span>
            </div>

            {/* Proposal facts — straight from get_ai_state */}
            <div className="rounded-xl bg-panel-dark border border-white/10 p-3 font-mono text-xs space-y-2">
              <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wide text-[11px]">
                <BrainCircuit className="w-3.5 h-3.5 text-frost" />
                Proposal Facts
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Buyback multiplier</span>
                <span className="text-slate-200 font-bold font-mono-numbers">
                  {ai.buyback_multiplier_bps.map((b) => `${b} bps`).join(" / ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Altar recipe</span>
                <span className={`font-bold ${ai.altar_recipe_id ? "text-jackpot" : "text-slate-500"}`}>
                  {ai.altar_recipe_id || "— none —"}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400">Signature</span>
                <span
                  className="text-slate-300 font-mono-numbers truncate max-w-[60%] text-right"
                  title={ai.signature_hex}
                >
                  {ai.signature_hex
                    ? ai.signature_hex.slice(0, 28) + (ai.signature_hex.length > 28 ? "…" : "")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Chat id</span>
                <span
                  className="text-slate-300 font-bold truncate max-w-[60%] text-right"
                  title={ai.chat_id ?? ""}
                >
                  {ai.chat_id || "—"}
                </span>
              </div>
            </div>

            {/* Canonical message */}
            <div className="p-2.5 rounded-lg bg-panel-dark border border-frost/20 font-mono text-[10px] text-frost overflow-x-auto">
              spire/floor={floor}/epoch={ai.epoch}/buyback={ai.buyback_multiplier_bps.join("-")}
              /recipe={ai.altar_recipe_id || "none"}/nonce={ai.nonce}
            </div>
            <p className="text-[10px] font-mono text-slate-500">
              Canonical message signed by the enclave. The contract verifies it before
              applying the multiplier / recipe.
            </p>
          </div>
        </div>

        {/* Buyback desk + recipe status */}
        <div className="md:col-span-5 flex flex-col gap-3">
          <div className="rounded-xl bg-panel-card border border-void/30 p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-void" />
                <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
                  Boss Buyback Desk
                </h2>
              </div>
              <button
                onClick={() => aiState.reload()}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Reload AI state"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-400">Sell weapons:</span>
              <input
                type="number"
                min={1}
                value={sellQty}
                onChange={(e) => setSellQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 p-1.5 rounded bg-panel-dark border border-white/10 text-white font-mono-numbers focus:outline-none"
                aria-label="Sellback quantity"
              />
              <span className="text-slate-500">unit (cap 2/account/epoch)</span>
            </div>

            <div className="space-y-2">
              {ELEMENTS.map((el) => {
                const quote = buybackQuotes[el.index];
                return (
                  <div
                    key={el.index}
                    className="p-2.5 rounded-lg bg-panel-dark border border-white/10 flex items-center justify-between gap-2"
                  >
                    <div className={`flex items-center gap-1.5 text-xs font-bold ${el.color}`}>
                      {el.icon}
                      <span>{el.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono-numbers text-xs text-white font-bold">
                        {quotesLoading
                          ? "…"
                          : quote
                          ? `${formatNearAmount(quote.unit_price)} /unit`
                          : "—"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {quote ? `${quote.multiplier_bps} bps × 0.10 NEAR base` : "quote failed"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSellBack(el.index)}
                      disabled={busy !== null || !quote}
                      className="px-3 py-1.5 rounded-lg bg-void/20 hover:bg-void/30 border border-void/40 text-void text-[11px] font-mono font-bold uppercase transition-all disabled:opacity-40 active:scale-95"
                    >
                      {busy === `sell-${el.index}` ? "…" : "Sell"}
                    </button>
                  </div>
                );
              })}
            </div>

            {message && (
              <div className="text-[11px] font-mono text-slate-300 bg-panel-dark border border-white/15 rounded px-2 py-1.5">
                {message}
              </div>
            )}
          </div>

          {/* Altar recipe status */}
          <div className="rounded-xl bg-panel-card border border-frost/20 p-4 shadow-xl font-mono text-xs space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white">
              <Cpu className="w-3.5 h-3.5 text-frost" />
              Altar Recipe Status
            </div>
            {[
              { id: ALTAR_RECIPE_2_TO_1, label: "Reforge 2 → 1" },
              { id: ALTAR_RECIPE_3_TO_2, label: "Reforge 3 → 2" },
            ].map((r) => {
              const active = ai.altar_recipe_id === r.id;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2 rounded bg-panel-dark border border-white/5"
                >
                  <span className="text-slate-300">{r.label}</span>
                  <span className={active ? "text-jackpot font-bold" : "text-slate-500"}>
                    {active ? "AKTIF" : "locked"}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <KeyRound className="w-3 h-3" />
              <span>Resep diaktifkan lewat proposal TEE yang ditandatangani — bukan input manual.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
