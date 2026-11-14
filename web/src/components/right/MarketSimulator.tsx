"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Play, Pause, RotateCcw, FastForward, AlertTriangle, TrendingUp } from "lucide-react";
import {
  calculateAdaptiveResistance,
  calculateMerchantPrice,
  TRIBUTE_THRESHOLD_BPS,
} from "@/lib/simulation/pricing";
import { explainMerchantQuote } from "@/lib/merchant-reasoning";
import {
  MERCHANT_BASE_PRICE_NEAR,
  MERCHANT_TARGET_STOCK,
  MERCHANT_MIN_CASH_NEAR,
} from "@/lib/spire/constants";

type ScenarioId = "balanced" | "monoculture" | "bankrun";

interface SimTick {
  hour: number;
  day: number;
  cashNear: number;
  stock: number;
  demandAvg: number;
  midPrice: number;
  buyPrice: number;
  sellPrice: number;
  isClosed: boolean;
  supply: [number, number, number];
  resistance: [number, number, number];
  reason: string;
}

interface LiveSeedParams {
  cashNear?: number;
  stock?: number;
  supply?: [number, number, number];
}

interface MarketSimulatorProps {
  liveSeed?: LiveSeedParams;
}

const SCENARIOS: Record<ScenarioId, { label: string; summary: string }> = {
  balanced: {
    label: "Balanced Citadel",
    summary:
      "Steady raiding and crafting across Solar, Frost, and Void keeps stock near 100 and reserves comfortably above 1.00 NEAR.",
  },
  monoculture: {
    label: "Solar Monoculture",
    summary:
      "Crowd stacks Solar blades until Solar resistance breaches 7,000 bps Tribute seizure and demand spikes material prices.",
  },
  bankrun: {
    label: "Merchant Bank Run",
    summary:
      "Artisans dump surplus materials continuously, draining merchant cash below 1.00 NEAR until rescue liquidity arrives.",
  },
};

function buildWeekTimeline(
  scenario: ScenarioId,
  liveSeed?: LiveSeedParams | null
): SimTick[] {
  const ticks: SimTick[] = [];
  let cash =
    liveSeed?.cashNear !== undefined && liveSeed.cashNear > 0
      ? liveSeed.cashNear
      : scenario === "bankrun"
        ? 4.8
        : 6.0;
  let stock =
    liveSeed?.stock !== undefined && liveSeed.stock >= 0 ? liveSeed.stock : 95;
  let s0 = liveSeed?.supply?.[0] ?? 40;
  let s1 = liveSeed?.supply?.[1] ?? 35;
  let s2 = liveSeed?.supply?.[2] ?? 30;
  const recentDemands: number[] = [18, 20, 22, 19, 21];

  for (let h = 0; h <= 168; h += 1) {
    let hourlyBuys = 20;

    if (h > 0) {
      if (scenario === "balanced") {
        const wave = Math.sin((h / 18) * Math.PI);
        s0 += h % 4 === 0 ? 2 : 0;
        s1 += h % 4 === 1 ? 2 : 0;
        s2 += h % 4 === 2 ? 2 : 0;
        const deltaCash = wave > 0 ? 0.14 : -0.09;
        cash = Math.max(2.4, Math.min(9.5, cash + deltaCash));
        stock = Math.max(70, Math.min(130, Math.round(stock - wave * 3)));
        hourlyBuys = Math.max(10, Math.round(22 + wave * 12));
      } else if (scenario === "monoculture") {
        s0 += h < 96 ? 3 : 1;
        s1 += h > 96 ? 4 : 0;
        s2 += h > 110 ? 2 : 0;
        const delta = h < 84 ? -0.03 : 0.08;
        cash = Math.max(1.2, Math.min(8.8, cash + delta));
        stock = Math.min(160, Math.max(30, stock + (h < 84 ? -2 : 2)));
        hourlyBuys = h < 84 ? 58 : 28;
      } else {
        // Bank run hits 1.00 NEAR closure floor around hour 56, rescued at hour 108
        s0 += 2;
        s1 += 1;
        if (h < 108) {
          cash = Math.max(0.65, cash - (cash > MERCHANT_MIN_CASH_NEAR ? 0.08 : 0.01));
          stock = Math.min(190, stock + 1);
          hourlyBuys = cash < MERCHANT_MIN_CASH_NEAR ? 0 : 6;
        } else if (h === 108) {
          cash += 4.5; // Rescue fund_merchant() + raid ticket inflow
          stock = Math.max(60, stock - 25);
          hourlyBuys = 32;
        } else {
          cash = Math.min(8.5, cash + 0.07);
          stock = Math.max(65, stock - 1);
          hourlyBuys = 26;
        }
      }
    }

    recentDemands.push(hourlyBuys);
    if (recentDemands.length > 5) recentDemands.shift();
    const demandAvg = Math.round(
      recentDemands.reduce((acc, v) => acc + v, 0) / recentDemands.length
    );

    const quote = calculateMerchantPrice(
      stock,
      MERCHANT_TARGET_STOCK,
      MERCHANT_BASE_PRICE_NEAR,
      cash,
      demandAvg
    );
    const resistance = calculateAdaptiveResistance([s0, s1, s2]);
    const cashFixed = Number(cash.toFixed(2));
    const reason = explainMerchantQuote({
      itemId: "ore:iron",
      side: "buy",
      stock,
      demand: demandAvg,
      cashNear: cashFixed,
      unitPriceNear: quote.buyPriceNear,
      basePriceNear: MERCHANT_BASE_PRICE_NEAR,
      rawReason: quote.isClosed ? "shop_closed" : undefined,
    });

    ticks.push({
      hour: h,
      day: Math.floor(h / 24) + 1,
      cashNear: cashFixed,
      stock,
      demandAvg,
      midPrice: quote.midPriceNear,
      buyPrice: quote.buyPriceNear,
      sellPrice: quote.sellPriceNear,
      isClosed: quote.isClosed,
      supply: [s0, s1, s2],
      resistance,
      reason,
    });
  }

  return ticks;
}

export const MarketSimulator: React.FC<MarketSimulatorProps> = ({ liveSeed }) => {
  const [scenario, setScenario] = useState<ScenarioId>("balanced");
  const [seedLive, setSeedLive] = useState<boolean>(false);
  const [hour, setHour] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<1 | 4 | 12>(4);

  const hasLiveSeed = Boolean(
    liveSeed &&
      (liveSeed.cashNear !== undefined ||
        liveSeed.stock !== undefined ||
        liveSeed.supply !== undefined)
  );
  const timeline = useMemo(
    () => buildWeekTimeline(scenario, seedLive ? liveSeed : null),
    [scenario, seedLive, liveSeed]
  );
  const current = timeline[Math.min(168, Math.max(0, hour))];

  useEffect(() => {
    if (!playing) return;
    const intervalMs = Math.max(30, Math.round(357 / speed));
    const timer = setInterval(() => {
      setHour((prev) => {
        if (prev >= 168) {
          setPlaying(false);
          return 168;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [playing, speed]);

  // SVG chart scaling (640 x 210)
  const W = 640;
  const H = 210;
  const padX = 36;
  const padY = 18;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;
  const maxCash = Math.max(8, ...timeline.map((t) => t.cashNear));
  const maxPrice = Math.max(0.12, ...timeline.map((t) => t.buyPrice));

  const cashPath = timeline
    .map((t, i) => {
      const x = padX + (t.hour / 168) * plotW;
      const y = padY + plotH - (t.cashNear / maxCash) * plotH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const pricePath = timeline
    .map((t, i) => {
      const x = padX + (t.hour / 168) * plotW;
      const y = padY + plotH - (t.buyPrice / maxPrice) * plotH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const closeLineY = padY + plotH - (MERCHANT_MIN_CASH_NEAR / maxCash) * plotH;
  const cursorX = padX + (current.hour / 168) * plotW;
  const maxRes = Math.max(...current.resistance);

  return (
    <section
      id="time-warp"
      className="citadel-stage p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-parchment">
            1-Week Market Time-Warp
          </h2>
          <p className="text-xs font-mono text-ash mt-1.5 max-w-2xl leading-relaxed text-pretty">
            Deterministic offline projection of 168 hours using on-chain <code className="text-frost">merchant.rs</code> math (0.05 NEAR base, 100 target stock, &plusmn;10% spread, 1.00 NEAR halt floor) and adaptive resistance renormalization.
          </p>
        </div>

        {/* Play / Reset / Speed Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (hour >= 168) setHour(0);
              setPlaying((p) => !p);
            }}
            className="rpg-sheen min-h-[44px] px-4 py-2 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 border border-amber-300/60 text-oled font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar focus-visible:ring-offset-2 focus-visible:ring-offset-oled"
          >
            {playing ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
            <span>{playing ? "Pause" : hour >= 168 ? "Replay Week" : "Fast-Forward"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setHour(0);
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-lg border border-brass/25 bg-panel-dark hover:bg-panel-elevated text-ash hover:text-parchment font-mono text-xs inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar focus-visible:ring-offset-2 focus-visible:ring-offset-oled"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>

          <div
            className="flex items-center gap-2 rounded-lg bg-panel-dark p-1 border border-brass/20"
            role="group"
            aria-label="Time-warp playback speed"
          >
            {([1, 4, 12] as const).map((sp) => (
              <button
                type="button"
                key={sp}
                onClick={() => setSpeed(sp)}
                aria-pressed={speed === sp}
                className={`min-h-[44px] min-w-[44px] px-3 rounded text-xs font-mono font-bold inline-flex items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar focus-visible:ring-offset-2 focus-visible:ring-offset-oled ${
                  speed === sp ? "bg-frost text-oled" : "text-ash hover:text-parchment"
                }`}
              >
                <FastForward className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{sp}x</span>
              </button>
            ))}
          </div>

          {hasLiveSeed && (
            <button
              type="button"
              aria-pressed={seedLive}
              onClick={() => {
                setPlaying(false);
                setHour(0);
                setSeedLive((prev) => !prev);
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg border text-xs font-mono font-semibold inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar focus-visible:ring-offset-2 focus-visible:ring-offset-oled ${
                seedLive
                  ? "bg-jackpot/15 border-jackpot/50 text-jackpot"
                  : "border-brass/25 bg-panel-dark hover:bg-panel-elevated text-ash hover:text-parchment"
              }`}
            >
              <span>{seedLive ? "Live Chain Seed: ON" : "Seed from Live On-Chain State"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Scenario Presets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5" role="group" aria-label="Market simulation presets">
        {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
          const item = SCENARIOS[id];
          const active = scenario === id;
          return (
            <button
              type="button"
              key={id}
              onClick={() => {
                setPlaying(false);
                setScenario(id);
                setHour(0);
              }}
              aria-pressed={active}
              className={`min-h-[68px] p-3.5 rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar focus-visible:ring-offset-2 focus-visible:ring-offset-oled ${
                active
                  ? "bg-panel-dark border-frost/60"
                  : "bg-panel-dark/60 border-brass/20 hover:border-brass/45"
              }`}
            >
              <span className={`text-xs font-mono font-bold block ${active ? "text-frost" : "text-parchment"}`}>
                {item.label}
              </span>
              <span className="text-xs text-ash mt-1 block leading-snug">{item.summary}</span>
            </button>
          );
        })}
      </div>

      {/* SVG Timeline Chart */}
      <div className="border-t border-b border-brass/20 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-solar font-semibold">
              <span className="w-3 h-0.5 bg-solar inline-block" aria-hidden="true" />
              <span>Merchant Cash (NEAR)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-frost font-semibold">
              <span className="w-3 h-0.5 bg-frost inline-block" aria-hidden="true" />
              <span>Buy Ask Quote (NEAR)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-hp-text font-semibold">
              <span className="w-3 h-0.5 bg-hp inline-block" aria-hidden="true" />
              <span>1.00 NEAR Halt Floor</span>
            </span>
          </div>
          <span className="font-mono-numbers text-parchment font-bold">
            Day {current.day} · Hour {current.hour} / 168
          </span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-48 sm:h-56 overflow-visible"
          role="img"
          aria-label={`Simulated 168-hour economy curve for ${SCENARIOS[scenario].label}`}
        >
          {/* Danger zone below 1.00 NEAR */}
          <rect
            x={padX}
            y={closeLineY}
            width={plotW}
            height={Math.max(0, padY + plotH - closeLineY)}
            fill="rgba(239, 68, 68, 0.08)"
          />
          {/* Closure threshold line */}
          <line
            x1={padX}
            y1={closeLineY}
            x2={padX + plotW}
            y2={closeLineY}
            stroke="#EF4444"
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />

          {/* Day dividers */}
          {[24, 48, 72, 96, 120, 144, 168].map((dHour) => {
            const x = padX + (dHour / 168) * plotW;
            return (
              <g key={dHour}>
                <line x1={x} y1={padY} x2={x} y2={padY + plotH} stroke="rgba(229,169,59,0.12)" />
                <text x={x} y={H - 2} fill="#CEC4B3" fontSize="12" textAnchor="middle">
                  D{dHour / 24}
                </text>
              </g>
            );
          })}

          {/* Curves */}
          <path d={cashPath} fill="none" stroke="#F2A63B" strokeWidth="2.2" />
          <path d={pricePath} fill="none" stroke="#38BDF8" strokeWidth="1.8" strokeDasharray="3 2" />

          {/* Active Hour Scrubber Cursor */}
          <line x1={cursorX} y1={padY} x2={cursorX} y2={padY + plotH} stroke="#F3EAD8" strokeWidth="1.5" />
          <circle
            cx={cursorX}
            cy={padY + plotH - (current.cashNear / maxCash) * plotH}
            r="4.5"
            fill={current.isClosed ? "#EF4444" : "#F2A63B"}
            stroke="#06060A"
            strokeWidth="1.5"
          />
        </svg>

        {/* Hour Slider (>= 44px touch area) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label htmlFor="sim-hour-slider" className="text-xs font-mono text-ash shrink-0">
            Scrub Timeline (Hour {current.hour})
          </label>
          <input
            id="sim-hour-slider"
            type="range"
            min={0}
            max={168}
            value={hour}
            onChange={(e) => {
              setPlaying(false);
              setHour(Number(e.target.value));
            }}
            className="w-full min-h-[44px] py-2 accent-solar cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar focus-visible:ring-offset-2 focus-visible:ring-offset-oled"
          />
        </div>
      </div>

      {/* Live Tick Readout */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 text-xs font-mono">
        <div className="space-y-1">
          <dt className="text-xs text-pewter">Bazaar Status</dt>
          <dd className={`text-sm font-bold font-mono-numbers ${current.isClosed ? "text-hp-text" : "text-jackpot"}`}>
            {current.isClosed ? "CLOSED (<1.0 NEAR)" : "OPEN"} · {current.cashNear.toFixed(2)} NEAR
          </dd>
        </div>

        <div className="space-y-1">
          <dt className="text-xs text-pewter">Curve Quote (Ask / Bid)</dt>
          <dd className="text-sm font-bold text-parchment font-mono-numbers">
            <span className="text-frost">{current.buyPrice.toFixed(4)}</span> /{" "}
            <span className="text-solar">{current.sellPrice.toFixed(4)}</span> N
          </dd>
        </div>

        <div className="space-y-1">
          <dt className="text-xs text-pewter">Stock &amp; 5h Demand</dt>
          <dd className="text-sm font-bold text-parchment font-mono-numbers">
            {current.stock}/{MERCHANT_TARGET_STOCK} · {current.demandAvg} avg
          </dd>
        </div>

        <div className="space-y-1">
          <dt className="text-xs text-pewter flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
            <span>Boss Resistance (bps)</span>
          </dt>
          <dd className={`text-sm font-bold font-mono-numbers ${maxRes >= TRIBUTE_THRESHOLD_BPS ? "text-hp-text" : "text-jackpot"}`}>
            {current.resistance.join(" / ")}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-ash pt-1">
        <span>
          <strong className="text-parchment">Simulated Quote Logic:</strong> {current.reason}
        </span>
        {maxRes >= TRIBUTE_THRESHOLD_BPS && (
          <span className="inline-flex items-center gap-1.5 text-hp-text font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tribute Seizure Active (&ge;{TRIBUTE_THRESHOLD_BPS} bps)</span>
          </span>
        )}
      </div>
    </section>
  );
};
