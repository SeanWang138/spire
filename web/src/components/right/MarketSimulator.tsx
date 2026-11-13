"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Play, Pause, RotateCcw, FastForward, AlertTriangle, TrendingUp } from "lucide-react";
import {
  calculateAdaptiveResistance,
  calculateMerchantPrice,
  TRIBUTE_THRESHOLD_BPS,
} from "@/lib/simulation/pricing";
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
  buyPrice: number;
  sellPrice: number;
  isClosed: boolean;
  supply: [number, number, number];
  resistance: [number, number, number];
  reason: string;
}

const SCENARIOS: Record<ScenarioId, { label: string; summary: string }> = {
  balanced: {
    label: "Balanced Citadel",
    summary: "Healthy player crafting across Solar/Frost/Void keeps ticket inflows ahead of bazaar sells.",
  },
  monoculture: {
    label: "Solar Monoculture",
    summary: "Crowd spams Solar weapons until Solar resistance surges past 7,000 bps Tribute confiscation.",
  },
  bankrun: {
    label: "Merchant Bank Run",
    summary: "Artisans dump surplus weapons continuously, draining merchant cash under 1.00 NEAR until rescue.",
  },
};

function buildWeekTimeline(scenario: ScenarioId): SimTick[] {
  const ticks: SimTick[] = [];
  let cash = scenario === "bankrun" ? 4.8 : 6.0;
  let stock = 95;
  let s0 = 40;
  let s1 = 35;
  let s2 = 30;

  for (let h = 0; h <= 168; h += 1) {
    if (h > 0) {
      if (scenario === "balanced") {
        // Sinusoidal crafting & raid replenishment
        const wave = Math.sin((h / 18) * Math.PI);
        s0 += h % 4 === 0 ? 2 : 0;
        s1 += h % 4 === 1 ? 2 : 0;
        s2 += h % 4 === 2 ? 2 : 0;
        const deltaCash = wave > 0 ? 0.14 : -0.09;
        cash = Math.max(0.4, cash + deltaCash);
        stock = Math.max(25, Math.min(180, Math.round(stock - wave * 2)));
      } else if (scenario === "monoculture") {
        s0 += h < 96 ? 3 : 1;
        s1 += h > 96 ? 4 : 0;
        s2 += h > 110 ? 2 : 0;
        const delta = h < 84 ? -0.03 : 0.08;
        cash = Math.max(1.2, cash + delta);
        stock = Math.min(195, Math.max(40, stock + (h < 84 ? 1 : -1)));
      } else {
        // Bank run hits 1.0 NEAR closure floor around hour 58, rescued by vault injection around hour 108
        s0 += 2;
        s1 += 1;
        if (h < 108) {
          cash = Math.max(0.65, cash - (cash > MERCHANT_MIN_CASH_NEAR ? 0.08 : 0.01));
          stock = Math.min(190, stock + 1);
        } else if (h === 108) {
          cash += 4.5; // Rescue fund_merchant() + raid ticket inflow
          stock = Math.max(60, stock - 25);
        } else {
          cash = Math.min(8.5, cash + 0.07);
          stock = Math.max(50, stock - 1);
        }
      }
    }

    const quote = calculateMerchantPrice(
      stock,
      MERCHANT_TARGET_STOCK,
      MERCHANT_BASE_PRICE_NEAR,
      cash,
      10000
    );
    const resistance = calculateAdaptiveResistance([s0, s1, s2]);

    ticks.push({
      hour: h,
      day: Math.floor(h / 24) + 1,
      cashNear: Number(cash.toFixed(2)),
      stock,
      buyPrice: quote.buyPriceNear,
      sellPrice: quote.sellPriceNear,
      isClosed: quote.isClosed,
      supply: [s0, s1, s2],
      resistance,
      reason: quote.isClosed
        ? "Merchant closed: cash reserve dropped below 1.00 NEAR minimum until refunded."
        : "Merchant active within 10% base spread.",
    });
  }

  return ticks;
}

export const MarketSimulator: React.FC = () => {
  const [scenario, setScenario] = useState<ScenarioId>("bankrun");
  const [hour, setHour] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<1 | 4 | 12>(4);

  const timeline = useMemo(() => buildWeekTimeline(scenario), [scenario]);
  const current = timeline[Math.min(168, Math.max(0, hour))];

  useEffect(() => {
    if (!playing) return;
    // Target ~60s for full 168h at 1x (~357ms per hour), scaled cleanly by 4x / 12x
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
  const H = 200;
  const padX = 36;
  const padY = 18;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;
  const maxCash = Math.max(8, ...timeline.map((t) => t.cashNear));
  const maxPrice = Math.max(0.15, ...timeline.map((t) => t.buyPrice));

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
      id="simulasi"
      className="rounded-xl bg-panel-card border border-frost/30 elevation-panel p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded bg-frost/15 border border-frost/40 text-frost font-mono text-xs font-bold tracking-widest uppercase">
              SIMULASI
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
              1-Week Fast-Forward Market Workbench
            </h2>
          </div>
          <p className="text-xs font-mono text-slate-300 mt-1.5">
            Accelerates 168 hours of raids, merchant cash reserve drains, and adaptive boss resistance into under a minute using deterministic contract math.
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
            className="min-h-[44px] px-4 py-2 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors"
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
            className="min-h-[44px] px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 font-mono text-xs inline-flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>

          <div className="flex items-center rounded-lg bg-panel-dark p-1 border border-white/10">
            {([1, 4, 12] as const).map((sp) => (
              <button
                type="button"
                key={sp}
                onClick={() => setSpeed(sp)}
                aria-pressed={speed === sp}
                className={`min-h-[36px] px-2.5 rounded text-xs font-mono font-bold inline-flex items-center gap-1 transition-colors ${
                  speed === sp ? "bg-frost text-oled" : "text-slate-300 hover:text-white"
                }`}
              >
                <FastForward className="w-3 h-3" aria-hidden="true" />
                {sp}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scenario Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
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
              className={`min-h-[68px] p-3 rounded-lg border text-left transition-colors ${
                active
                  ? "bg-panel-dark border-frost/60"
                  : "bg-panel-dark/60 border-white/10 hover:border-white/25"
              }`}
            >
              <span className={`text-xs font-mono font-bold block ${active ? "text-frost" : "text-white"}`}>
                {item.label}
              </span>
              <span className="text-[11px] text-slate-300 mt-1 block leading-snug">{item.summary}</span>
            </button>
          );
        })}
      </div>

      {/* SVG Timeline Chart */}
      <div className="rounded-lg bg-panel-dark p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-solar font-semibold">
              <span className="w-3 h-0.5 bg-solar inline-block" aria-hidden="true" /> Merchant Cash (NEAR)
            </span>
            <span className="inline-flex items-center gap-1.5 text-frost font-semibold">
              <span className="w-3 h-0.5 bg-frost inline-block" aria-hidden="true" /> Buy Quote Price (NEAR)
            </span>
            <span className="inline-flex items-center gap-1.5 text-hp font-semibold">
              <span className="w-3 h-0.5 bg-hp inline-block" aria-hidden="true" /> 1.0 NEAR Halt Floor
            </span>
          </div>
          <span className="font-mono-numbers text-slate-200 font-bold">
            Day {current.day} · Hour {current.hour} / 168
          </span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-48 sm:h-56 overflow-visible"
          role="img"
          aria-label={`Simulated 168-hour economy curve for ${SCENARIOS[scenario].label}`}
        >
          {/* Danger zone below 1.0 NEAR */}
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
                <line x1={x} y1={padY} x2={x} y2={padY + plotH} stroke="rgba(255,255,255,0.06)" />
                <text x={x} y={H - 2} fill="#94A3B8" fontSize="10" textAnchor="middle">
                  D{dHour / 24}
                </text>
              </g>
            );
          })}

          {/* Curves */}
          <path d={cashPath} fill="none" stroke="#F59E0B" strokeWidth="2.2" />
          <path d={pricePath} fill="none" stroke="#38BDF8" strokeWidth="1.8" strokeDasharray="3 2" />

          {/* Active Hour Scrubber Cursor */}
          <line x1={cursorX} y1={padY} x2={cursorX} y2={padY + plotH} stroke="#E2E8F0" strokeWidth="1.5" />
          <circle
            cx={cursorX}
            cy={padY + plotH - (current.cashNear / maxCash) * plotH}
            r="4.5"
            fill={current.isClosed ? "#EF4444" : "#F59E0B"}
            stroke="#080B11"
            strokeWidth="1.5"
          />
        </svg>

        {/* Hour Slider */}
        <div className="flex items-center gap-3">
          <label htmlFor="sim-hour-slider" className="text-xs font-mono text-slate-300 shrink-0">
            Scrub Week
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
            className="w-full accent-solar cursor-pointer"
          />
        </div>
      </div>

      {/* Live Tick Readout */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1 text-xs font-mono">
        <div className="p-3 rounded-lg bg-panel-dark">
          <dt className="text-[11px] text-slate-400">Bazaar Status</dt>
          <dd className={`text-sm font-bold mt-1 font-mono-numbers ${current.isClosed ? "text-hp" : "text-jackpot"}`}>
            {current.isClosed ? "CLOSED (<1.0 NEAR)" : "OPEN"} · {current.cashNear.toFixed(2)} NEAR
          </dd>
        </div>

        <div className="p-3 rounded-lg bg-panel-dark">
          <dt className="text-[11px] text-slate-400">Curve Quote (Ask / Bid)</dt>
          <dd className="text-sm font-bold mt-1 text-white font-mono-numbers">
            <span className="text-frost">{current.buyPrice.toFixed(4)}</span> /{" "}
            <span className="text-solar">{current.sellPrice.toFixed(4)}</span> N
          </dd>
        </div>

        <div className="p-3 rounded-lg bg-panel-dark">
          <dt className="text-[11px] text-slate-400">Supply [S / F / V]</dt>
          <dd className="text-sm font-bold mt-1 text-slate-100 font-mono-numbers">
            {current.supply.join(" / ")}
          </dd>
        </div>

        <div className="p-3 rounded-lg bg-panel-dark">
          <dt className="text-[11px] text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
            <span>Boss Adaptation (bps)</span>
          </dt>
          <dd className={`text-sm font-bold mt-1 font-mono-numbers ${maxRes >= TRIBUTE_THRESHOLD_BPS ? "text-hp" : "text-emerald-300"}`}>
            {current.resistance.join(" / ")}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300 pt-1">
        <span>
          <strong className="text-white">Sim Quote Logic:</strong> {current.reason}
        </span>
        {maxRes >= TRIBUTE_THRESHOLD_BPS && (
          <span className="inline-flex items-center gap-1.5 text-hp font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Tribute Seizure Active (&ge;{TRIBUTE_THRESHOLD_BPS} bps)
          </span>
        )}
      </div>
    </section>
  );
};
