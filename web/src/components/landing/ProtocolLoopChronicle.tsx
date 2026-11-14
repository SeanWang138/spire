"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Hammer,
  KeyRound,
  Radar,
  ShieldCheck,
  Store,
  Swords,
  Vault,
} from "lucide-react";
import { SpireSurface } from "@/components/ui/SpireUi";
import { useMotionControl } from "@/lib/spire/motion";

interface ChronicleStage {
  id: string;
  tabLabel: string;
  cadence: string;
  headline: string;
  loreNote: string;
  steps: { title: string; detail: string; metric: string; icon: React.ReactNode }[];
  ctaHref: string;
  ctaLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  accentBorder: string;
  accentText: string;
}

const STAGES: ChronicleStage[] = [
  {
    id: "30s",
    tabLabel: "30-Second Loop · City & Bazaar",
    cadence: "Every 30 Seconds",
    headline: "Zero-Popup Play Meets Live NPC Supply & Demand",
    loreNote: "One deposit fills your satchel. From there, every swing of the pickaxe and barter with the town merchant lands cleanly without interrupting wallet prompts.",
    steps: [
      {
        title: "Instant 1-Click Ephemeral Account",
        detail: "Provision an ephemeral 0.60 NEAR testnet guest subaccount with a local FullAccess keypair (or deposit via your wallet) into the internal vault.",
        metric: "0.60 N Guest · 0 Popups",
        icon: <KeyRound className="w-4 h-4 text-solar" aria-hidden="true" />,
      },
      {
        title: "Claim Starter Kit & Gather",
        detail: "Claim 4x Solar + 1x Frost blades plus 4 Ore and 3 each Essence, then harvest +2 Iron Ore or Essences every 30 seconds.",
        metric: "+2 Unit · 20/Epoch Cap",
        icon: <Hammer className="w-4 h-4 text-frost" aria-hidden="true" />,
      },
      {
        title: "Inspect Merchant Reasoning",
        detail: "The NPC Merchant prices goods from live stock vs 5-epoch demand pressure and explains every quote in its ledger tooltip.",
        metric: "10% Spread · >=1.00 N Cash",
        icon: <Store className="w-4 h-4 text-jackpot" aria-hidden="true" />,
      },
    ],
    ctaHref: "/game/start",
    ctaLabel: "Play Now (1 Click)",
    secondaryHref: "/game/merchant",
    secondaryLabel: "Open Town Bazaar",
    accentBorder: "border-solar/45",
    accentText: "text-solar",
  },
  {
    id: "5m",
    tabLabel: "5-Minute Loop · Meta Radar & Raid",
    cadence: "Every 5 Minutes",
    headline: "Read the Shifting Armor, Reforge Scarce Void, Storm Floor 1",
    loreNote: "When crowds flood the Spire with Solar blades, the Keeper raises Solar defense toward 8,500 bps while crushing Frost and Void downward within a fixed 13,500 bps pool.",
    steps: [
      {
        title: "Forge Elemental Steel",
        detail: "Burn 2 Iron Ore + 3 Essence at the anvil to mint tradeable Solar, Frost, or scarce Void armaments.",
        metric: "2 Ore + 3 Essence",
        icon: <Hammer className="w-4 h-4 text-solar" aria-hidden="true" />,
      },
      {
        title: "Scout Radar & Reforge at the Altar",
        detail: "Spot saturated elements above 7,000 bps Tribute risk and burn surplus blades via reforge_2_to_1 anytime (or AI-unlocked reforge_3_to_2).",
        metric: "13,500 bps Total Pool",
        icon: <Radar className="w-4 h-4 text-void" aria-hidden="true" />,
      },
      {
        title: "Execute 3-Turn Stance Assault",
        detail: "Sequence Aggressive (1.20x), Feint (safe variance), and Pierce (-1,500 bps armor) in one strike, then claim 90/10 Jackpot.",
        metric: "90% Dmg / 10% Executioner",
        icon: <Swords className="w-4 h-4 text-frost" aria-hidden="true" />,
      },
    ],
    ctaHref: "/game/forge",
    ctaLabel: "Enter Forge & Altar",
    secondaryHref: "/game/raid",
    secondaryLabel: "Scout Raid Arena",
    accentBorder: "border-frost/45",
    accentText: "text-frost",
  },
  {
    id: "session",
    tabLabel: "Per Session · Ascension, Backers & AI",
    cadence: "Across Each Session",
    headline: "Higher Tiers, Backer Yields & Contract-Bounded AI",
    loreNote: "Defeating Floor 1 drips 10% of its pool into Frost-warded heights and Enraging Void spires. AI proposes buyback multipliers or taunts off-chain, and the contract enforces every boundary.",
    steps: [
      {
        title: "Conquer Enrage & Mint Trophy",
        detail: "Clear Floor 2 Frost Ward (30m deadline) and Floor 3 Enrage (20m, +10% HP/5m) to mint a dynamic NEP-171 SVG Trophy.",
        metric: "10% Upward Drip",
        icon: <Vault className="w-4 h-4 text-void" aria-hidden="true" />,
      },
      {
        title: "Boss Buyback & Backer Vault",
        detail: "Sell scarce non-starter blades at 1.0x-4.0x buyback quotes, or fund Floor jackpots directly for 15% ticket dividends until Boss defeat.",
        metric: "15% Ticket Stream",
        icon: <Clock className="w-4 h-4 text-jackpot" aria-hidden="true" />,
      },
      {
        title: "AI Proposes, Contract Decides",
        detail: "NEAR AI Cloud proposes buyback multipliers, reforge_3_to_2 unlock, and taunts off-chain with chat_id audit logs while Ed25519 relayer signatures and bounds run on-chain.",
        metric: "Max 2,500 bps Shift/Epoch",
        icon: <ShieldCheck className="w-4 h-4 text-solar" aria-hidden="true" />,
      },
    ],
    ctaHref: "/game/vault",
    ctaLabel: "Open Boss Vault",
    secondaryHref: "/game/ai",
    secondaryLabel: "Inspect Boss Brain & Sim",
    accentBorder: "border-void/50",
    accentText: "text-void-text",
  },
];

export const ProtocolLoopChronicle: React.FC = () => {
  const { reducedMotion } = useMotionControl();
  const [activeId, setActiveId] = useState<string>("30s");
  const current = STAGES.find((s) => s.id === activeId) ?? STAGES[0];

  const handleTabKeyDown = (idx: number) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveId(STAGES[(idx + 1) % STAGES.length].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveId(STAGES[(idx - 1 + STAGES.length) % STAGES.length].id);
    }
  };

  return (
    <section id="loop" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-parchment tracking-tight">
            The Three Cadences of the Spire
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-ash max-w-2xl leading-relaxed">
            Built around a continuous closed-loop economy from thirty-second town trades to full multi-floor boss expeditions and market simulation.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Game loop cadences">
          {STAGES.map((stage, idx) => {
            const active = stage.id === activeId;
            return (
              <button
                key={stage.id}
                id={`chronicle-tab-${stage.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`chronicle-panel-${stage.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveId(stage.id)}
                onKeyDown={handleTabKeyDown(idx)}
                className={`min-h-[44px] px-4 py-2 rounded-lg border font-mono text-xs font-bold transition-all ${
                  active
                    ? "bg-solar/20 border-solar text-parchment"
                    : "bg-panel-dark/90 border-brass/20 text-ash hover:border-brass/50 hover:text-parchment"
                }`}
              >
                {stage.cadence}
              </button>
            );
          })}
        </div>
      </div>

      <SpireSurface variant="stage" className={`p-6 sm:p-8 border-t ${current.accentBorder}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            id={`chronicle-panel-${current.id}`}
            role="tabpanel"
            aria-labelledby={`chronicle-tab-${current.id}`}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-brass/15 pb-5">
              <div>
                <h3 className="font-serif text-2xl font-bold text-parchment">
                  {current.headline}
                </h3>
                <p className="font-lore italic text-lg sm:text-xl text-ash mt-1.5 max-w-3xl leading-snug">
                  &ldquo;{current.loreNote}&rdquo;
                </p>
              </div>
              <span className={`font-mono text-xs font-bold uppercase tracking-wider shrink-0 ${current.accentText}`}>
                {current.tabLabel}
              </span>
            </div>

            <div className="rounded-xl bg-oled/85 divide-y md:divide-y-0 md:divide-x divide-brass/15 grid grid-cols-1 md:grid-cols-3">
              {current.steps.map((step, idx) => (
                <div
                  key={step.title}
                  className="p-5 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-panel-card shrink-0">
                        {step.icon}
                      </span>
                      <h4 className="font-serif text-base font-bold text-parchment">
                        {idx + 1}. {step.title}
                      </h4>
                    </div>
                    <p className="mt-1.5 text-xs sm:text-sm text-ash leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-brass/10 font-mono text-xs font-semibold text-parchment">
                    {step.metric}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={current.ctaHref}
                className="rpg-sheen inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 text-oled font-bold text-xs uppercase tracking-wider border border-amber-300/60 hover:from-amber-300 hover:to-amber-500 transition-all"
              >
                <span>{current.ctaLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
              <Link
                href={current.secondaryHref}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg border border-brass/30 bg-panel-dark/90 text-xs font-mono font-bold text-parchment hover:border-solar/60 transition-colors"
              >
                <span>{current.secondaryLabel}</span>
                <ArrowRight className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </SpireSurface>
    </section>
  );
};

