"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";

const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 37 + 13) % 100,
  y0: 62 + ((i * 17) % 38),
  drift: 2 + (i % 5),
  delay: (i % 9) * 0.7,
  r: 0.6 + (i % 3) * 0.35,
  color: ["#F59E0B", "#38BDF8", "#A855F7"][i % 3],
}));

export const LandingHero: React.FC = () => {
  const reduced = useReducedMotion();

  return (
    <section className="relative min-h-[88vh] flex flex-col overflow-hidden citadel-backdrop">
      {/* Top navigation */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between gap-4">
        <Link href="/" className="font-serif text-lg font-bold tracking-[0.22em] text-slate-100">
          SPIRE<span className="text-solar">Fi</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-xs font-mono text-slate-300" aria-label="Landing sections">
          <a href="#tower" className="hover:text-white transition-colors py-2">
            The Tower
          </a>
          <a href="#economy" className="hover:text-white transition-colors py-2">
            Economy
          </a>
          <a href="#boss-brain" className="hover:text-white transition-colors py-2">
            Boss Brain
          </a>
          <Link href="/game/merchant#simulasi" className="text-frost hover:text-white transition-colors py-2">
            Market Sim
          </Link>
        </nav>

        <Link
          href="/game/start"
          className="min-h-[44px] px-4 py-2 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-colors elevation-panel"
        >
          Open Game
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </header>

      {/* Hero stage */}
      <div className="relative flex-1 w-full max-w-7xl mx-auto px-6 sm:px-10 py-8 grid grid-cols-1 lg:grid-cols-12 items-center gap-10">
        {/* Left: editorial typography (no eyebrow kicker above H1) */}
        <div className="relative z-10 lg:col-span-7 flex flex-col">
          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="font-serif font-bold text-white leading-[0.94] tracking-[0.06em] text-[clamp(3.25rem,9vw,7.5rem)]"
          >
            SPIRE<span className="text-solar">Fi</span>
          </motion.h1>

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22 }}
            className="mt-6 max-w-xl text-slate-200 text-base sm:text-lg leading-relaxed"
          >
            Signless dark-fantasy raid citadel on NEAR testnet. Three escalating boss floors,
            adaptive elemental defense, and deterministic jackpot settlement on-chain.
          </motion.p>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.34 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/game/start"
              className="min-h-[44px] px-6 py-3 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-colors elevation-panel"
            >
              Enter the Spire
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
            <Link
              href="/game/merchant#simulasi"
              className="min-h-[44px] px-5 py-3 rounded-lg border border-frost/40 bg-frost/10 hover:bg-frost/20 text-frost font-mono text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-colors"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              1-Week SIMULASI
            </Link>
            <a
              href="#tower"
              className="min-h-[44px] px-5 py-3 rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-slate-200 font-mono text-xs font-bold uppercase tracking-widest inline-flex items-center transition-colors"
            >
              Protocol Specs
            </a>
          </motion.div>

          {/* Compact protocol truth strip */}
          <motion.div
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-10 pt-5 border-t border-white/10 grid grid-cols-3 gap-4 max-w-lg font-mono"
          >
            <div>
              <span className="text-[11px] text-slate-400 block">Standard</span>
              <span className="text-xs font-bold text-slate-100">NEP-245 / NEP-171</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Auth Mode</span>
              <span className="text-xs font-bold text-jackpot">Signless Access Key</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Resistance Cap</span>
              <span className="text-xs font-bold text-frost font-mono-numbers">13,500 bps Pool</span>
            </div>
          </motion.div>
        </div>

        {/* Right: procedural obsidian monolith tower */}
        <div className="relative lg:col-span-5 h-[42vh] min-h-[300px] lg:h-[66vh]">
          <motion.svg
            initial={reduced ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewBox="0 0 400 560"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="towerGlowTop" cx="50%" cy="22%" r="42%">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#080B11" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="towerGlowMid" cx="35%" cy="54%" r="38%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#080B11" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="towerGlowVoid" cx="68%" cy="76%" r="36%">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#080B11" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="stoneFace" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#161D33" />
                <stop offset="100%" stopColor="#0F1424" />
              </linearGradient>
            </defs>

            <rect width="400" height="560" fill="url(#towerGlowTop)" />
            <rect width="400" height="560" fill="url(#towerGlowMid)" />
            <rect width="400" height="560" fill="url(#towerGlowVoid)" />

            {/* Star speckles */}
            {Array.from({ length: 24 }, (_, i) => (
              <circle
                key={i}
                cx={((i * 53) % 380) + 10}
                cy={((i * 97) % 240) + 12}
                r={(i % 3) * 0.4 + 0.45}
                fill="#E2E8F0"
                opacity={0.14 + (i % 4) * 0.06}
              />
            ))}

            {/* Tiered obsidian spire */}
            <g stroke="rgba(226,232,240,0.16)" strokeWidth="1">
              <polygon points="200,38 214,72 186,72" fill="#F59E0B" opacity="0.92" />
              <rect x="196" y="72" width="8" height="26" fill="#13192B" stroke="rgba(245,158,11,0.45)" />
              {/* Tier 3: Apex Void/Enrage */}
              <polygon points="200,98 232,120 232,190 168,190 168,120" fill="url(#stoneFace)" />
              <line x1="168" y1="140" x2="232" y2="140" stroke="rgba(239,68,68,0.45)" />
              {/* Tier 2: Frost Ward */}
              <polygon points="200,190 252,222 252,318 148,318 148,222" fill="url(#stoneFace)" />
              <line x1="148" y1="248" x2="252" y2="248" stroke="rgba(56,189,248,0.4)" />
              <line x1="148" y1="284" x2="252" y2="284" stroke="rgba(226,232,240,0.1)" />
              {/* Tier 1: Solar Foundation */}
              <polygon points="200,318 276,356 276,470 124,470 124,356" fill="url(#stoneFace)" />
              <line x1="124" y1="388" x2="276" y2="388" stroke="rgba(245,158,11,0.35)" />
              <line x1="124" y1="426" x2="276" y2="426" stroke="rgba(226,232,240,0.08)" />
              <line x1="124" y1="452" x2="276" y2="452" stroke="rgba(0,236,151,0.28)" />
              {/* Base wall + Citadel Gate */}
              <rect x="112" y="470" width="176" height="42" fill="#0F1424" stroke="rgba(226,232,240,0.14)" />
              <polygon points="200,480 220,512 180,512" fill="#080B11" stroke="rgba(245,158,11,0.5)" />
            </g>

            {/* Architectural meridian seam */}
            <line x1="200" y1="40" x2="200" y2="512" stroke="rgba(226,232,240,0.12)" strokeDasharray="3 6" />
          </motion.svg>

          {/* Drifting embers */}
          {!reduced && (
            <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
              {EMBERS.map((e, i) => (
                <motion.circle
                  key={i}
                  cx={`${e.x}%`}
                  cy={e.y0}
                  r={e.r}
                  fill={e.color}
                  opacity="0.45"
                  animate={{ cy: [e.y0, e.y0 - e.drift * 6 - 10], opacity: [0.1, 0.5, 0.1] }}
                  transition={{ duration: 7 + e.drift * 2, repeat: Infinity, delay: e.delay, ease: "easeInOut" }}
                />
              ))}
            </svg>
          )}
        </div>
      </div>

      {/* Bottom scroll cue */}
      <div className="relative z-10 pb-5 text-center font-mono text-xs tracking-[0.25em] uppercase text-slate-400">
        Scroll for Protocol Specs
      </div>
    </section>
  );
};
