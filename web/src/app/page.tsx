import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  Flame,
  ShieldAlert,
  Snowflake,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { LandingHeader, LandingHero } from "@/components/landing/LandingHero";
import { ProtocolLoopChronicle } from "@/components/landing/ProtocolLoopChronicle";
import { EconomyConduitPreview } from "@/components/landing/EconomyConduitPreview";
import { BossBrainPreview } from "@/components/landing/BossBrainPreview";
import { SpireSurface } from "@/components/ui/SpireUi";
import { FLOOR_MAX_HP, FLOOR_TICKET_COST_NEAR } from "@/lib/spire/constants";

const FLOORS = [
  {
    floor: 1,
    roman: "I",
    title: "Malakor, Solar Sentinel",
    tierName: "Foundation Keep",
    hp: FLOOR_MAX_HP[0],
    ticket: FLOOR_TICKET_COST_NEAR[0],
    rule: "Open entry round with zero expiration deadline. Ideal ground to sharpen your 3-turn Stance rotation and stack early Jackpot share.",
    dripNote: "On kill: 10% Jackpot drips upward into Floor 2",
    accentText: "text-solar",
    accentBorder: "border-solar/50",
    icon: <Flame className="w-5 h-5 text-solar" aria-hidden="true" />,
  },
  {
    floor: 2,
    roman: "II",
    title: "Valkyr, Glacial Warden",
    tierName: "Glacial Bastion",
    hp: FLOOR_MAX_HP[1],
    ticket: FLOOR_TICKET_COST_NEAR[1],
    rule: "Frost Ward adds +1,500 bps Frost armor inside a strict 30-minute raid clock. On timeout, the jackpot carries forward into the next round while Backers retain shares across rounds.",
    dripNote: "Unlocks Floor 3 on kill · 10% drips upward",
    accentText: "text-frost",
    accentBorder: "border-frost/50",
    icon: <Snowflake className="w-5 h-5 text-frost" aria-hidden="true" />,
  },
  {
    floor: 3,
    roman: "III",
    title: "Kaelen, Void Sovereign",
    tierName: "Void Apex Sanctum",
    hp: FLOOR_MAX_HP[2],
    ticket: FLOOR_TICKET_COST_NEAR[2],
    rule: "Enrages (+10% max HP every 5 idle minutes) inside a 20-minute window. On timeout, jackpot carries forward; defeat mints a dynamic NEP-171 Conqueror SVG Trophy.",
    dripNote: "Apex Prize · Conqueror NFT Trophy & Bounty",
    accentText: "text-void-text",
    accentBorder: "border-void/55",
    icon: <Sparkles className="w-5 h-5 text-void" aria-hidden="true" />,
  },
] as const;

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-oled text-parchment overflow-x-hidden">
      <LandingHeader />

      <main id="main-content" className="relative z-10">
        {/* Full-Bleed WebGL Citadel Hero Panorama */}
        <LandingHero showHeader={false} />

        {/* Three-Cadence RPG Loop Chronicle (30s / 5m / Session) */}
        <ProtocolLoopChronicle />

        <div className="max-w-7xl mx-auto px-4 sm:px-6" aria-hidden="true">
          <div className="engraved-rule w-full" />
        </div>

        {/* Section 3: Three-Floor Citadel Ascension & Upward Jackpot Drip */}
        <section id="tower" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-parchment tracking-tight">
                Three-Floor Citadel Ascension
              </h2>
              <p className="mt-2.5 text-sm sm:text-base text-ash max-w-[65ch] leading-relaxed">
                Every cleared Boss feeds 10% of its defeated bounty upward into the floor above, escalating stakes from no-timer Keep raids to Enraging apex hunts.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 font-mono text-xs text-jackpot px-4 py-2 rounded-lg bg-panel-dark/90 border border-jackpot/30 self-start">
              <ArrowUp className="w-4 h-4" aria-hidden="true" />
              <span>10% Upward Jackpot Drip Per Floor</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {FLOORS.map((f) => (
              <SpireSurface
                key={f.floor}
                variant="stage"
                className={`p-6 border-t ${f.accentBorder} flex flex-col justify-between gap-5`}
              >
                <div>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-parchment mb-2 text-balance">
                    Floor {f.roman}: {f.title}
                  </h3>

                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      {f.icon}
                      <span className={`font-mono text-xs font-bold uppercase tracking-wider ${f.accentText}`}>
                        {f.tierName}
                      </span>
                    </div>
                    <span className="font-mono-numbers text-xs font-bold text-parchment">
                      {f.ticket.toFixed(2)} N
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono-numbers text-xs text-pewter mb-4">
                    <span>HP: <strong className="text-parchment">{f.hp.toLocaleString("en-US")}</strong></span>
                    <span>·</span>
                    <span>{f.floor === 1 ? "Open Clock" : f.floor === 2 ? "30m Deadline" : "20m Enrage"}</span>
                  </div>

                  <p className="text-sm text-ash leading-relaxed">{f.rule}</p>
                </div>

                <div className="pt-4 border-t border-brass/15 flex items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-jackpot">{f.dripNote}</span>
                  <Link
                    href="/game/raid"
                    aria-label={`Scout Floor ${f.roman}: ${f.title}`}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-lg text-parchment hover:text-solar transition-colors font-bold shrink-0"
                  >
                    <span>Scout</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </SpireSurface>
            ))}
          </div>

          {/* Tribute Seizure Guard Callout */}
          <SpireSurface variant="chamfer" className="mt-8 p-6 border-t border-hp/45">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-start gap-3.5">
                <ShieldAlert className="w-6 h-6 text-hp-text shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-parchment">
                    Tribute Seizure Guard &amp; Starter Immunity
                  </h3>
                  <p className="mt-1 text-sm text-ash leading-relaxed max-w-[52ch] text-pretty">
                    Pressing any saturated element at or above <strong>7,000 bps</strong> resistance risks having crafted non-starter weapons confiscated by the Boss Vault. Starter Kit blades (4x Solar, 1x Frost) are strictly immune to confiscation, giving newcomers a risk-free learning path.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs shrink-0 text-hp-text">
                <AlertTriangle className="w-4 h-4 text-hp-text" aria-hidden="true" />
                <span>Threshold: 7,000 bps</span>
              </div>
            </div>
          </SpireSurface>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6" aria-hidden="true">
          <div className="engraved-rule w-full" />
        </div>

        {/* Section 4: Zero-Inflation Ticket Economy & 4 Guild Roles */}
        <EconomyConduitPreview />

        <div className="max-w-7xl mx-auto px-4 sm:px-6" aria-hidden="true">
          <div className="engraved-rule w-full" />
        </div>

        {/* Section 5: Adaptive Meta Defense & Verifiable AI Oracle */}
        <BossBrainPreview />

        {/* Sanctuary Portal CTA Footer */}
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20">
          <SpireSurface variant="chamfer" className="p-8 sm:p-10 border-t border-solar/45">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-parchment text-balance">
                  Enter the Spire or Replay a Full Week in Seconds
                </h2>
                <p className="mt-2 font-lore italic text-lg sm:text-xl text-ash leading-snug text-pretty">
                  &ldquo;Simulate 168 market hours offline with the deterministic engine, or jump straight into NEAR testnet via a 1-click 0.60 NEAR ephemeral guest subaccount.&rdquo;
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link
                  href="/game/start"
                  className="rpg-sheen inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300/60 text-oled font-bold text-sm uppercase tracking-wider hover:from-amber-300 hover:to-amber-500 transition-all"
                >
                  <span>Play Now (1 Click)</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>

                <Link
                  href="/game/ai#time-warp"
                  className="rpg-sheen inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-lg bg-panel-dark border border-frost/45 text-frost hover:bg-frost/15 hover:border-frost/75 font-mono text-xs font-bold uppercase tracking-wider transition-all"
                >
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  <span>Run 1-Week Market Sim</span>
                </Link>
              </div>
            </div>
          </SpireSurface>
        </section>
      </main>
    </div>
  );
}
