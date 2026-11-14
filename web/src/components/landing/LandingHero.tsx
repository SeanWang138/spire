"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Play,
  Pause,
  Flame,
  Snowflake,
  Sparkles,
  Swords,
  TrendingUp,
} from "lucide-react";
import { CitadelDiorama } from "@/components/three/CitadelDiorama";
import { FLOOR_MAX_HP, FLOOR_TICKET_COST_NEAR } from "@/lib/spire/constants";
import { useMotionControl } from "@/lib/spire/motion";

const FLOOR_DOSSIERS: Record<
  number,
  {
    floor: number;
    roman: string;
    tierName: string;
    boss: string;
    elementIndex: 0 | 1 | 2;
    hp: number;
    ticket: number;
    rule: string;
    accentText: string;
    accentBorder: string;
    activePill: string;
  }
> = {
  1: {
    floor: 1,
    roman: "I",
    tierName: "Foundation Keep",
    boss: "Malakor, Solar Sentinel",
    elementIndex: 0,
    hp: FLOOR_MAX_HP[0],
    ticket: FLOOR_TICKET_COST_NEAR[0],
    rule: "Open entry floor · No round timer · 10% of defeated jackpot drips upward to Floor 2",
    accentText: "text-solar",
    accentBorder: "border-solar/50",
    activePill: "border-solar/70 bg-solar/20 text-parchment",
  },
  2: {
    floor: 2,
    roman: "II",
    tierName: "Glacial Bastion",
    boss: "Valkyr, Glacial Warden",
    elementIndex: 1,
    hp: FLOOR_MAX_HP[1],
    ticket: FLOOR_TICKET_COST_NEAR[1],
    rule: "Frost Ward (+1,500 bps Frost resist) · 30 min round timer · Unlocks Floor 3 on kill",
    accentText: "text-frost",
    accentBorder: "border-frost/50",
    activePill: "border-frost/70 bg-frost/20 text-parchment",
  },
  3: {
    floor: 3,
    roman: "III",
    tierName: "Void Apex Sanctum",
    boss: "Kaelen, Void Sovereign",
    elementIndex: 2,
    hp: FLOOR_MAX_HP[2],
    ticket: FLOOR_TICKET_COST_NEAR[2],
    rule: "Enrage (+10% max HP every 5 min) · 20 min timer · Mints NEP-171 Conqueror Trophy",
    accentText: "text-void-text",
    accentBorder: "border-void/55",
    activePill: "border-void/70 bg-void/20 text-parchment",
  },
};

export const LandingHeader: React.FC = () => {
  const { paused, togglePaused } = useMotionControl();

  return (
    <header className="sticky top-0 z-40 border-b border-brass/20 bg-[#06060A]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="SpireFi home"
          className="flex items-center gap-2.5 min-h-[44px] text-parchment font-serif font-bold tracking-[0.2em] text-base sm:text-lg"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-solar/15 border border-solar/45">
            <Swords className="w-4 h-4 text-solar" aria-hidden="true" />
          </span>
          <span>
            SPIRE<span className="text-solar">FI</span>
          </span>
        </Link>

        <nav
          aria-label="Protocol sections"
          className="hidden md:flex items-center gap-7 text-xs font-semibold tracking-wide text-ash"
        >
          <a href="#loop" className="hover:text-parchment transition-colors min-h-[44px] flex items-center">
            Game Loop
          </a>
          <a href="#tower" className="hover:text-parchment transition-colors min-h-[44px] flex items-center">
            Three-Floor Spire
          </a>
          <a href="#economy" className="hover:text-parchment transition-colors min-h-[44px] flex items-center">
            Ticket Conduit
          </a>
          <a href="#boss-brain" className="hover:text-parchment transition-colors min-h-[44px] flex items-center">
            Boss Brain &amp; TEE
          </a>
          <Link
            href="/game/ai#time-warp"
            className="text-frost hover:text-parchment transition-colors min-h-[44px] flex items-center"
          >
            1-Week Market Sim
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePaused}
            aria-pressed={paused}
            aria-label={paused ? "Resume 3D motion" : "Pause 3D motion"}
            className="min-h-[44px] px-3 rounded-lg border border-brass/25 bg-panel-dark/90 text-xs font-medium text-ash hover:text-parchment hover:border-brass/60 flex items-center gap-2 transition-colors"
          >
            {paused ? (
              <Play className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
            ) : (
              <Pause className="w-3.5 h-3.5 text-frost" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{paused ? "Resume FX" : "Pause FX"}</span>
          </button>

          <Link
            href="/game/start"
            className="rpg-sheen inline-flex items-center gap-2 min-h-[44px] px-4 sm:px-5 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 text-oled font-bold text-xs uppercase tracking-wider border border-amber-300/60 hover:from-amber-300 hover:to-amber-500 transition-all"
          >
            <span className="hidden sm:inline">Play Now (1 Click)</span>
            <span className="sm:hidden">Play Now</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
};

interface LandingHeroProps {
  showHeader?: boolean;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ showHeader = true }) => {
  const { reducedMotion } = useMotionControl();
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);

  const inspectFloor = hoveredFloor ?? selectedFloor;
  const activeDossier = FLOOR_DOSSIERS[inspectFloor] ?? FLOOR_DOSSIERS[1];

  return (
    <section className="relative w-full flex flex-col">
      {showHeader && <LandingHeader />}

      {/* Full-Bleed Living 3D Panorama Stage */}
      <div className="relative w-full lg:min-h-[760px] lg:h-[calc(100vh-4rem)] lg:max-h-[920px] flex flex-col lg:block overflow-hidden bg-oled">
        {/* Desktop Full-Bleed WebGL World Layer (Hero Backdrop + 3D Valley + Spire + Optical Bloom) */}
        <div className="relative h-[370px] sm:h-[460px] lg:h-full lg:absolute lg:inset-0 w-full z-0">
          <CitadelDiorama
            mode="showcase"
            selectedFloor={selectedFloor}
            onSelectFloor={setSelectedFloor}
            externalHoveredFloor={hoveredFloor}
            onHoverChange={(_hovered, fNum) => {
              setHoveredFloor(fNum);
            }}
            dominantElement={activeDossier.elementIndex}
            showFloorDock={false}
            showControls={true}
            className="w-full h-full"
          />
          {/* Left editorial legibility veil on wide viewports + bottom chasm mist fade */}
          <div
            aria-hidden="true"
            className="hidden lg:block pointer-events-none absolute inset-y-0 left-0 w-[56%]"
            style={{
              background:
                "linear-gradient(90deg, rgba(6,6,10,0.88) 0%, rgba(6,6,10,0.68) 58%, rgba(6,6,10,0) 100%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 sm:h-36 citadel-mist-fade"
          />
        </div>

        {/* Left Floating Editorial Lockup & Synchronized Floor Scry Plaque */}
        <div className="relative z-20 max-w-7xl mx-auto w-full px-4 sm:px-6 pb-12 pt-4 lg:py-0 lg:h-full flex items-center pointer-events-none">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full lg:max-w-[540px] flex flex-col items-start gap-5 pointer-events-auto"
          >
            <div className="w-full">
              <h1 className="font-serif text-5xl sm:text-6xl xl:text-7xl font-extrabold tracking-[0.04em] leading-[1.0] text-parchment">
                SPIRE<span className="text-solar">FI</span>
              </h1>
              <div className="engraved-rule w-48 my-3.5" aria-hidden="true" />
              <p className="font-lore italic text-xl sm:text-2xl text-ash leading-snug max-w-lg">
                &ldquo;A living citadel where crowded steel fuels the Boss, scarce blades pierce its heart, and the mountain settles every claim in gold.&rdquo;
              </p>
            </div>

            <p className="text-sm sm:text-base text-ash max-w-lg leading-relaxed">
              Gather ore, forge elemental steel, outmaneuver an adaptive boss that counters dominant weapons every epoch, and raid popup-free via a 1-click 0.60 NEAR ephemeral testnet guest subaccount.
            </p>

            {/* Primary & Secondary Actions */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <Link
                href="/game/start"
                className="rpg-sheen inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300/60 text-oled font-bold text-sm uppercase tracking-wider hover:from-amber-300 hover:to-amber-500 transition-all"
              >
                <span>Play Now (1 Click)</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>

              <Link
                href="/game/ai#time-warp"
                className="rpg-sheen inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-lg bg-panel-dark/90 border border-frost/45 text-frost hover:bg-frost/15 hover:border-frost/75 font-mono text-xs font-bold uppercase tracking-wider transition-all"
              >
                <TrendingUp className="w-4 h-4" aria-hidden="true" />
                <span>Run 1-Week Market Sim</span>
              </Link>
            </div>

            {/* Interactive Floor Scry Plaque synced with 3D Horizon & Bloom */}
            <div
              className={`obsidian-chamfer w-full p-4 sm:p-5 border-t ${activeDossier.accentBorder} backdrop-blur-sm transition-colors duration-300`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {activeDossier.floor === 1 ? (
                    <Flame className="w-4 h-4 text-solar" aria-hidden="true" />
                  ) : activeDossier.floor === 2 ? (
                    <Snowflake className="w-4 h-4 text-frost" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-void" aria-hidden="true" />
                  )}
                  <span className={`font-mono text-xs font-bold uppercase tracking-wider ${activeDossier.accentText}`}>
                    Floor {activeDossier.roman} · {activeDossier.tierName}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono-numbers text-xs">
                  <span className="px-2.5 py-0.5 rounded bg-panel-elevated/90 text-parchment">
                    {activeDossier.hp.toLocaleString("en-US")} HP
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-solar/20 text-parchment font-semibold">
                    {activeDossier.ticket.toFixed(2)} N
                  </span>
                </div>
              </div>

              <div className="font-serif text-lg sm:text-xl font-bold text-parchment mb-1">
                {activeDossier.boss}
              </div>
              <p className="text-xs sm:text-sm text-ash leading-relaxed mb-3.5">
                {activeDossier.rule}
              </p>

              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Focus Citadel Floor">
                {[1, 2, 3].map((n) => {
                  const isActive = inspectFloor === n;
                  const meta = FLOOR_DOSSIERS[n];
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSelectedFloor(n)}
                      onMouseEnter={() => setHoveredFloor(n)}
                      onMouseLeave={() => setHoveredFloor(null)}
                      aria-pressed={selectedFloor === n}
                      className={`min-h-[44px] px-2.5 py-2 rounded-lg border text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 ${
                        isActive
                          ? meta.activePill
                          : "border-brass/20 bg-oled/80 text-ash hover:border-brass/50 hover:text-parchment"
                      }`}
                    >
                      <span>Floor {meta.roman}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
