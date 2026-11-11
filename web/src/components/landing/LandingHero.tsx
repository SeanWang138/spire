"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Editorial dark-fantasy hero: procedural tiered tower silhouette + elemental
// auroras (solar/frost/void) drawn in SVG — no external assets, no hotlinking.
const EMBERS = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 37 + 13) % 100,
  y0: 62 + ((i * 17) % 38),
  drift: 2 + (i % 5),
  delay: (i % 9) * 0.7,
  r: 0.5 + (i % 3) * 0.35,
  color: ["#F59E0B", "#38BDF8", "#A855F7"][i % 3],
}));

export const LandingHero: React.FC = () => {
  const reduced = useReducedMotion();

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Top nav */}
      <header className="relative z-20 w-full px-6 sm:px-10 py-5 flex items-center justify-between">
        <span className="font-mono text-sm font-black tracking-[0.3em] text-slate-100">SPIREFi</span>
        <Link
          href="/game/start"
          className="px-4 py-2 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors shadow-lg shadow-solar/20"
        >
          Open Game
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Hero stage */}
      <div className="relative flex-1 w-full max-w-7xl mx-auto px-6 sm:px-10 grid grid-cols-1 lg:grid-cols-12 items-center gap-8">
        {/* Left: editorial typography overlay */}
        <div className="relative z-10 lg:col-span-7 flex flex-col">
          <motion.p
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-mono text-[11px] sm:text-xs tracking-[0.35em] text-frost uppercase mb-5"
          >
            NEAR Protocol // Testnet // Dark-Fantasy GameFi
          </motion.p>

          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="font-serif font-bold text-white leading-[0.95] tracking-[0.08em] text-[clamp(3.5rem,10vw,8.5rem)] select-none"
          >
            SPIRE
            <span className="text-solar">Fi</span>
          </motion.h1>

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 max-w-xl text-slate-300 text-sm sm:text-base leading-relaxed"
          >
            AI-Powered Dark-Fantasy Raid Tower on NEAR. Three floors, three stances,
            one adaptive Boss Brain — raid signless and split the jackpot on-chain.
          </motion.p>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.42 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/game/start"
              className="px-6 py-3 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono text-xs font-bold uppercase tracking-widest transition-colors shadow-lg shadow-solar/20"
            >
              Enter the Spire
            </Link>
            <Link
              href="#protocol"
              className="px-6 py-3 rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-slate-200 font-mono text-xs font-bold uppercase tracking-widest transition-colors"
            >
              Protocol
            </Link>
          </motion.div>

          {/* Mono meta strip */}
          <motion.div
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-12 flex flex-wrap gap-x-6 gap-y-1 text-[11px] font-mono text-slate-500 uppercase tracking-wider"
          >
            <span>Signless Function Call Combat</span>
            <span>Adaptive Resistance</span>
            <span>On-chain Trophy</span>
          </motion.div>
        </div>

        {/* Right: procedural tower */}
        <div className="relative lg:col-span-5 h-[46vh] min-h-[320px] lg:h-[70vh]">
          <motion.svg
            initial={reduced ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.25 }}
            viewBox="0 0 400 560"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <filter id="auroraBlur" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="38" />
              </filter>
              <linearGradient id="stoneFace" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#13192B" />
                <stop offset="100%" stopColor="#0F1424" />
              </linearGradient>
            </defs>

            {/* Elemental auroras behind the tower */}
            <ellipse cx="200" cy="120" rx="150" ry="90" fill="#F59E0B" opacity="0.16" filter="url(#auroraBlur)" />
            <ellipse cx="120" cy="300" rx="130" ry="95" fill="#38BDF8" opacity="0.14" filter="url(#auroraBlur)" />
            <ellipse cx="290" cy="430" rx="120" ry="90" fill="#A855F7" opacity="0.16" filter="url(#auroraBlur)" />

            {/* Star speckles */}
            {Array.from({ length: 26 }, (_, i) => (
              <circle
                key={i}
                cx={((i * 53) % 380) + 8}
                cy={((i * 97) % 250) + 10}
                r={(i % 3) * 0.4 + 0.4}
                fill="#E2E8F0"
                opacity={0.12 + (i % 4) * 0.06}
              />
            ))}

            {/* Tiered spire silhouette */}
            <g stroke="rgba(226,232,240,0.14)" strokeWidth="1">
              {/* Apex beacon */}
              <polygon points="200,38 214,72 186,72" fill="#F59E0B" opacity="0.9" />
              <rect x="196" y="72" width="8" height="26" fill="#13192B" stroke="rgba(245,158,11,0.35)" />
              {/* Tier 3 */}
              <polygon points="200,98 232,120 232,190 168,190 168,120" fill="url(#stoneFace)" />
              <line x1="168" y1="140" x2="232" y2="140" stroke="rgba(56,189,248,0.25)" />
              {/* Tier 2 */}
              <polygon points="200,190 252,222 252,318 148,318 148,222" fill="url(#stoneFace)" />
              <line x1="148" y1="248" x2="252" y2="248" stroke="rgba(168,85,247,0.28)" />
              <line x1="148" y1="284" x2="252" y2="284" stroke="rgba(226,232,240,0.08)" />
              {/* Tier 1 */}
              <polygon points="200,318 276,356 276,470 124,470 124,356" fill="url(#stoneFace)" />
              <line x1="124" y1="388" x2="276" y2="388" stroke="rgba(245,158,11,0.22)" />
              <line x1="124" y1="426" x2="276" y2="426" stroke="rgba(226,232,240,0.07)" />
              <line x1="124" y1="452" x2="276" y2="452" stroke="rgba(56,189,248,0.18)" />
              {/* Base wall */}
              <rect x="112" y="470" width="176" height="42" fill="#0F1424" stroke="rgba(226,232,240,0.10)" />
              {/* Gate */}
              <polygon points="200,482 218,512 182,512" fill="#080B11" stroke="rgba(245,158,11,0.4)" />
            </g>

            {/* Filigree vertical seam */}
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
                  opacity="0.5"
                  animate={{ cy: [e.y0, e.y0 - e.drift * 6 - 10], opacity: [0.1, 0.5, 0.1] }}
                  transition={{ duration: 7 + e.drift * 2, repeat: Infinity, delay: e.delay, ease: "easeInOut" }}
                />
              ))}
            </svg>
          )}
        </div>
      </div>

      {/* Bottom scroll hint */}
      <div className="relative z-10 pb-6 text-center font-mono text-[10px] tracking-[0.4em] uppercase text-slate-500">
        Scroll
      </div>
    </section>
  );
};
