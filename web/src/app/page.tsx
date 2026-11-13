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
import { LandingHero } from "@/components/landing/LandingHero";
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
    rule: "Frost Ward adds +1,500 bps Frost armor inside a strict 30-minute raid clock. Backers take cycle expiration risk if unslain.",
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
    rule: "Enrages (+10% max HP every 5 idle minutes) inside a 20-minute window. Defeat mints a dynamic NEP-171 Conqueror SVG Trophy.",
    dripNote: "Apex Prize · Conqueror NFT Trophy & Bounty",
    accentText: "text-purple-300",
    accentBorder: "border-void/55",
    icon: <Sparkles className="w-5 h-5 text-void" aria-hidden="true" />,
  },
] as const;

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-oled text-parchment overflow-x-hidden">
      {/* Full-Bleed WebGL Citadel Hero Panorama */}
      <LandingHero />

      <main className="relative z-10">
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
              <p className="mt-2.5 text-sm sm:text-base text-ash max-w-2xl leading-relaxed">
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
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      {f.icon}
                      <span className={`font-mono text-xs font-bold uppercase tracking-wider ${f.accentText}`}>
                        Floor {f.roman} · {f.tierName}
                      </span>
                    </div>
                    <span className="font-mono-numbers text-xs font-bold text-parchment">
                      {f.ticket.toFixed(2)} N
                    </span>
                  </div>

                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-parchment mb-2">
                    {f.title}
                  </h3>

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
                    className="inline-flex items-center gap-1 text-parchment hover:text-solar transition-colors font-bold"
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
                <ShieldAlert className="w-6 h-6 text-hp shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-parchment">
                    Tribute Seizure Guard &amp; Starter Immunity
                  </h3>
                  <p className="mt-1 text-sm text-ash leading-relaxed max-w-3xl">
                    Pressing any saturated element at or above <strong>7,000 bps</strong> resistance risks having crafted non-starter weapons confiscated by the Boss Vault. Starter Kit blades (4x Solar, 1x Frost) are strictly immune to confiscation, giving newcomers a risk-free learning path.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs shrink-0 text-rose-200 px-3.5 py-2 rounded-lg bg-hp/15">
                <AlertTriangle className="w-4 h-4 text-hp" aria-hidden="true" />
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

        {/* Section 5: Adaptive Meta Defense & Verifiable AI TEE Oracle */}
        <BossBrainPreview />

        {/* Sanctuary Portal CTA Footer */}
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20">
          <SpireSurface variant="chamfer" className="p-8 sm:p-10 border-t border-solar/45">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-parchment">
                  Enter the Citadel or Replay a Full Week in Seconds
                </h2>
                <p className="mt-2 font-lore italic text-lg sm:text-xl text-ash leading-snug">
                  &ldquo;Test the deterministic economy offline across 168 simulated hours, or step straight into the NEAR testnet vault without a single wallet popup.&rdquo;
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link
                  href="/game/start"
                  className="rpg-sheen inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300/60 text-oled font-bold text-sm uppercase tracking-wider hover:from-amber-300 hover:to-amber-500 transition-all"
                >
                  <span>Enter the Spire</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>

                <Link
                  href="/game/merchant#simulasi"
                  className="rpg-sheen inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-lg bg-panel-dark border border-frost/45 text-frost hover:bg-frost/15 hover:border-frost/75 font-mono text-xs font-bold uppercase tracking-wider transition-all"
                >
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  <span>Watch 1-Week Simulasi</span>
                </Link>
              </div>
            </div>
          </SpireSurface>
        </section>
      </main>
    </div>
  );
}
