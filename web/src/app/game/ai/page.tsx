"use client";

import React, { useEffect, useState } from "react";
import {
  BrainCircuit,
  Check,
  Copy,
  Cpu,
  ExternalLink,
  Flame,
  MessageSquareQuote,
  RefreshCw,
  ShieldCheck,
  Snowflake,
  Sparkles,
  TerminalSquare,
  TrendingUp,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  get_tower,
  get_ai_state,
  get_buyback_quote,
  get_inventory,
  sell_to_boss_buyback,
} from "@/lib/contract";
import type {
  AiStateResponse,
  BuybackQuote,
  ElementIndex,
  PlayerInventory,
} from "@/lib/contract";
import { useContractView, useSessionAccount } from "@/lib/spire/hooks";
import { formatNearAmount, getExplorerTxUrl } from "@/lib/utils/cn";
import {
  ALTAR_RECIPE_2_TO_1,
  ALTAR_RECIPE_3_TO_2,
  BUYBACK_MAX_BPS,
  BUYBACK_MAX_PER_ACCOUNT_EPOCH,
  BUYBACK_MAX_PER_FLOOR_EPOCH,
} from "@/lib/spire/constants";

const ELEMENTS: {
  index: ElementIndex;
  name: string;
  icon: React.ReactNode;
  color: string;
  barColor: string;
}[] = [
  {
    index: 0,
    name: "Solar",
    icon: <Flame className="w-3.5 h-3.5" aria-hidden="true" />,
    color: "text-solar",
    barColor: "bg-solar",
  },
  {
    index: 1,
    name: "Frost",
    icon: <Snowflake className="w-3.5 h-3.5" aria-hidden="true" />,
    color: "text-frost",
    barColor: "bg-frost",
  },
  {
    index: 2,
    name: "Void",
    icon: <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />,
    color: "text-void",
    barColor: "bg-void",
  },
];

interface TxFeedback {
  text: string;
  isError?: boolean;
  txHash?: string;
}

function FloorSelector({
  floor,
  setFloor,
}: {
  floor: number;
  setFloor: (f: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Select tower floor">
      {[1, 2, 3].map((f) => (
        <button
          type="button"
          key={f}
          onClick={() => setFloor(f)}
          className={`min-h-[44px] px-4 py-2 rounded-lg border text-xs font-mono font-bold transition-colors ${
            floor === f
              ? "bg-frost/20 border-frost text-frost"
              : "bg-panel-dark border-white/10 text-slate-300 hover:text-white"
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
  const accountId = session?.accountId ?? "";

  const tower = useContractView(get_tower, []);
  const inventory = useContractView<PlayerInventory | null>(
    async () => (accountId ? await get_inventory(accountId) : null),
    [accountId]
  );

  const [floor, setFloor] = useState(1);
  const [buybackQuotes, setBuybackQuotes] = useState<(BuybackQuote | null)[]>([
    null,
    null,
    null,
  ]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [sellQty, setSellQty] = useState<number>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxFeedback | null>(null);
  const [copiedPreimage, setCopiedPreimage] = useState(false);

  const aiState = useContractView<AiStateResponse | null>(
    async () => await get_ai_state(floor),
    [floor]
  );

  // Live quote fetch from get_buyback_quote(floor, element)
  useEffect(() => {
    let cancelled = false;
    setQuotesLoading(true);
    Promise.all(
      ([0, 1, 2] as ElementIndex[]).map((el) =>
        get_buyback_quote(floor, el).catch(() => null)
      )
    ).then((quotes) => {
      if (!cancelled) {
        setBuybackQuotes(quotes);
        setQuotesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [floor, aiState.data?.nonce]);

  const handleSellBack = async (element: ElementIndex) => {
    if (!session || busy) return;
    setBusy(`sell-${element}`);
    setTxStatus(null);
    try {
      const res = await sell_to_boss_buyback(floor, element, sellQty);
      setTxStatus({
        text: `Sold ${sellQty} ${ELEMENTS[element].name} weapon(s) to Floor ${floor} Boss Buyback.`,
        txHash: res.txHash,
      });
      tower.reload();
      aiState.reload();
      inventory.reload();
    } catch (err: unknown) {
      setTxStatus({
        text:
          err instanceof Error
            ? err.message
            : "Sellback failed: verify per-epoch caps or weapon lock status.",
        isError: true,
      });
    } finally {
      setBusy(null);
    }
  };

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <EmptyState
          title="No active session"
          hint="Enter your account name and authorize a session key on the Title Screen to inspect the Boss Brain."
          actionHref="/game/start"
          actionLabel="Go to Title Screen"
        />
      </div>
    );
  }

  if (aiState.error) {
    return (
      <div className="px-1 py-6 sm:py-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">
            Boss Brain TEE Oracle
          </h1>
          <p className="text-xs sm:text-sm font-mono text-slate-300">
            Per-epoch TEE enclave proposals: elemental buyback multipliers, altar transmutation recipes, and boss taunts verified on-chain via Ed25519 signatures.
          </p>
          <FloorSelector floor={floor} setFloor={setFloor} />
        </div>
        <EmptyState
          title="AI state unavailable"
          hint="Unable to retrieve AI oracle telemetry from the network. Please reload or check your connection."
          onReload={() => {
            tower.reload();
            aiState.reload();
            inventory.reload();
          }}
        />
      </div>
    );
  }

  const uncommittedProposal = !aiState.data;
  const ai: AiStateResponse = aiState.data ?? {
    floor,
    epoch: 0,
    nonce: 0,
    buyback_multiplier_bps: [10000, 10000, 10000],
    altar_recipe_id: "",
    taunt: null,
    chat_id: null,
    signature_hex: "",
  };
  const canonicalMessage = `spire/floor=${floor}/epoch=${ai.epoch}/buyback=${ai.buyback_multiplier_bps.join(
    "-"
  )}/recipe=${ai.altar_recipe_id || "none"}/nonce=${ai.nonce}`;
  const isEd25519HexValid =
    typeof ai.signature_hex === "string" && ai.signature_hex.length >= 64;
  const explorerUrl = getExplorerTxUrl(txStatus?.txHash);

  const handleCopyCanonical = async () => {
    try {
      await navigator.clipboard.writeText(canonicalMessage);
      setCopiedPreimage(true);
      setTimeout(() => setCopiedPreimage(false), 1800);
    } catch {
      // clipboard unsupported in this context
    }
  };

  return (
    <div className="px-1 py-6 sm:py-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">
            Boss Brain TEE Oracle
          </h1>
          <p className="text-xs sm:text-sm font-mono text-slate-300">
            Per-epoch TEE enclave proposals: elemental buyback multipliers, altar transmutation recipes, and boss taunts verified on-chain via Ed25519 signatures.
          </p>
          <FloorSelector floor={floor} setFloor={setFloor} />
        </div>
      </div>

      {uncommittedProposal && !aiState.loading && (
        <div className="px-4 py-3 rounded-xl bg-panel-card border border-frost/30 text-xs font-mono text-slate-200">
          No TEE enclave proposal has been committed on Floor {floor} yet. Baseline 1.00x buyback quotes remain live on-chain via <code className="text-frost">get_buyback_quote()</code>.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left column: Boss Taunt, Enclave Proof & Canonical Preimage */}
        <div className="md:col-span-7 flex flex-col gap-4">
          <section className="rounded-xl bg-panel-card border border-white/10 p-5 elevation-panel space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-solar" aria-hidden="true" />
                <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
                  Enclave Proclamation
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-300">
                Epoch {ai.epoch} · Nonce {ai.nonce}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-panel-dark/70 border border-void/30 text-xs font-mono leading-relaxed flex items-start gap-2.5">
              <MessageSquareQuote className="w-4 h-4 text-void mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span className="text-slate-200">
                {ai.taunt || "The enclave has not issued a taunt for this floor yet."}
              </span>
            </div>

            {/* Ed25519 Verification & Proposal Facts */}
            <div className="pt-3 border-t border-white/10 font-mono text-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wide text-xs">
                  <BrainCircuit className="w-4 h-4 text-frost" aria-hidden="true" />
                  Ed25519 Signature Verification
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                    isEd25519HexValid
                      ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-300"
                      : "bg-solar/15 border-solar/40 text-solar"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  {isEd25519HexValid ? "Signed Payload Present" : "Awaiting Enclave Signature"}
                </span>
              </div>

              <div className="divide-y divide-white/10">
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-slate-400">Buyback multipliers</span>
                  <span className="text-slate-100 font-bold font-mono-numbers">
                    {ai.buyback_multiplier_bps.map((b) => `${(b / 10000).toFixed(2)}x`).join(" / ")}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-slate-400">Active altar recipe</span>
                  <span className={`font-bold ${ai.altar_recipe_id ? "text-jackpot" : "text-slate-400"}`}>
                    {ai.altar_recipe_id || "None"}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-slate-400">Ed25519 signature hex</span>
                  <span
                    className="text-slate-200 font-mono-numbers truncate max-w-[60%] text-right"
                    title={ai.signature_hex}
                  >
                    {ai.signature_hex
                      ? `${ai.signature_hex.slice(0, 28)}${ai.signature_hex.length > 28 ? "..." : ""} (${ai.signature_hex.length / 2} B)`
                      : "Not available"}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-slate-400">Attestation / Chat ID</span>
                  <span
                    className="text-slate-200 font-semibold truncate max-w-[60%] text-right"
                    title={ai.chat_id ?? "None"}
                  >
                    {ai.chat_id || "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Canonical preimage signed by TEE */}
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold">
                  Canonical Signed Preimage
                </span>
                <button
                  type="button"
                  onClick={handleCopyCanonical}
                  className="min-h-[44px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  {copiedPreimage ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-frost" aria-hidden="true" />
                      Copy String
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-panel-dark font-mono text-[11px] text-frost overflow-x-auto whitespace-pre-wrap break-all">
                {canonicalMessage}
              </pre>
              <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                The NEAR smart contract reconstructs this exact byte string and verifies the NEAR AI TEE Ed25519 signature before applying buyback caps or altar transmutations.
              </p>
            </div>
          </section>
        </div>

        {/* Right column: Buyback Desk + Multiplier Meters + Altar Recipe Status */}
        <div className="md:col-span-5 flex flex-col gap-4">
          <section className="rounded-xl bg-panel-card border border-void/35 p-5 elevation-panel space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-void" aria-hidden="true" />
                <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-white">
                  Boss Buyback Desk
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  aiState.reload();
                  inventory.reload();
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
                aria-label="Reload AI state and quotes"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
              <label htmlFor="sell-qty-input" className="text-slate-300">
                Quantity per sale
              </label>
              <input
                id="sell-qty-input"
                type="number"
                min={1}
                max={BUYBACK_MAX_PER_ACCOUNT_EPOCH}
                value={sellQty}
                onChange={(e) => setSellQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 min-h-[44px] px-2.5 py-2 rounded-lg bg-panel-dark border border-white/15 text-white font-mono-numbers"
              />
              <span className="text-[11px] text-slate-400">
                Cap: {BUYBACK_MAX_PER_ACCOUNT_EPOCH}/acct, {BUYBACK_MAX_PER_FLOOR_EPOCH}/floor per epoch
              </span>
            </div>

            <div className="divide-y divide-white/10 border-t border-white/10">
              {ELEMENTS.map((el) => {
                const quote = buybackQuotes[el.index];
                const rawBps = quote?.multiplier_bps ?? ai.buyback_multiplier_bps[el.index] ?? 10000;
                const multRatio = rawBps / 10000;
                const meterPct = Math.min(100, Math.round((rawBps / BUYBACK_MAX_BPS) * 100));

                const owned = inventory.data?.weapons[el.index] ?? 0;
                const locked = inventory.data?.starter_locked[el.index] ?? 0;
                const tradeable = Math.max(0, owned - locked);

                return (
                  <div key={el.index} className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${el.color}`}>
                          {el.icon}
                          <span>{el.name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                          Tradeable: <span className="text-white font-semibold">{tradeable}</span>
                          {locked > 0 ? ` (${locked} starter locked)` : ""}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono-numbers text-xs text-white font-bold">
                          {quotesLoading
                            ? "Loading..."
                            : quote
                            ? `${formatNearAmount(quote.unit_price, 4)} /unit`
                            : "Quote unavailable"}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {multRatio.toFixed(2)}x ({rawBps} bps)
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSellBack(el.index)}
                        disabled={busy !== null || !quote || tradeable < sellQty}
                        className="min-h-[44px] px-4 py-2 rounded-lg bg-void/20 hover:bg-void/30 border border-void/40 text-void text-xs font-mono font-bold uppercase transition-colors disabled:opacity-40"
                      >
                        {busy === `sell-${el.index}` ? "..." : "Sell"}
                      </button>
                    </div>

                    {/* Buyback Multiplier Meter (1.0x - 4.0x vs 40,000 bps cap) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-slate-400">
                        <span>Buyback Multiplier Meter</span>
                        <span className="font-mono-numbers text-slate-200">
                          {multRatio.toFixed(2)}x / {(BUYBACK_MAX_BPS / 10000).toFixed(1)}x max
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-oled overflow-hidden">
                        <div
                          className={`h-full rounded-full ${el.barColor} transition-all duration-300`}
                          style={{ width: `${meterPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {txStatus && (
              <div
                aria-live="polite"
                className={`p-3 rounded-lg border text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
                  txStatus.isError
                    ? "bg-solar/10 border-solar/40 text-solar"
                    : "bg-emerald-500/10 border-emerald-400/35 text-emerald-300"
                }`}
              >
                <span>{txStatus.text}</span>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline font-bold text-white hover:text-jackpot"
                  >
                    NearBlocks
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </section>

          {/* Altar recipe status */}
          <section className="rounded-xl bg-panel-card border border-frost/25 p-5 elevation-panel font-mono text-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white">
              <Cpu className="w-4 h-4 text-frost" aria-hidden="true" />
              Altar Recipe Status
            </div>
            <div className="divide-y divide-white/10">
              {[
                { id: ALTAR_RECIPE_2_TO_1, label: "Reforge 2 into 1 (2 any -> 1 chosen)" },
                { id: ALTAR_RECIPE_3_TO_2, label: "Reforge 3 into 2 (3 any -> 2 chosen)" },
              ].map((r) => {
                const active = ai.altar_recipe_id === r.id;
                return (
                  <div key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-200">{r.label}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${
                        active
                          ? "bg-jackpot/15 border-jackpot/40 text-jackpot"
                          : "bg-white/5 border-white/10 text-slate-400"
                      }`}
                    >
                      {active ? "ACTIVE" : "Locked"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
