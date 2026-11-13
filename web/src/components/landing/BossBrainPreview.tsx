"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Cpu,
  Flame,
  Lock,
  ShieldCheck,
  Snowflake,
  Sparkles,
} from "lucide-react";
import {
  calculateAdaptiveResistance,
  MAX_SHIFT_BPS,
  TOTAL_RESISTANCE_BPS,
  TRIBUTE_THRESHOLD_BPS,
} from "@/lib/simulation/pricing";
import { SpireSlider, SpireSurface, SpireTooltip } from "@/components/ui/SpireUi";

interface BrainPreset {
  id: string;
  label: string;
  supplies: [number, number, number];
  bossName: string;
  buybackBps: [number, number, number];
  altarRecipe: "reforge_2_to_1" | "reforge_3_to_2";
  taunt: string;
  chatId: string;
  sigPrefix: string;
}

const PRESETS: BrainPreset[] = [
  {
    id: "starter",
    label: "Starter Skew (8/2/0)",
    supplies: [8, 2, 0],
    bossName: "Malakor, Solar Sentinel",
    buybackBps: [10000, 18500, 36000],
    altarRecipe: "reforge_2_to_1",
    taunt: "Ten thousand novices march in with borrowed Solar blades. My carapace drinks the glare while Void remains unseen.",
    chatId: "chat_tee_v3_starter_820",
    sigPrefix: "ed25519:7c9f...4b1a",
  },
  {
    id: "swarm",
    label: "Solar Swarm (80/20/10)",
    supplies: [80, 20, 10],
    bossName: "Valkyr, Glacial Warden",
    buybackBps: [10000, 24000, 40000],
    altarRecipe: "reforge_3_to_2",
    taunt: "Solar saturation triggers Tribute at 8,500 bps. Burn three crowded swords at the Altar or watch steel shatter!",
    chatId: "chat_tee_v3_swarm_802010",
    sigPrefix: "ed25519:a31e...9d82",
  },
  {
    id: "balanced",
    label: "Balanced Triad (45/45/45)",
    supplies: [45, 45, 45],
    bossName: "Kaelen, Void Sovereign",
    buybackBps: [16000, 16000, 16000],
    altarRecipe: "reforge_2_to_1",
    taunt: "Equilibrium holds the Bastion. No Tribute bites today, yet no single blade pierces unchecked.",
    chatId: "chat_tee_v3_triad_45",
    sigPrefix: "ed25519:f02c...19e4",
  },
];

const ELEMENTS = [
  { name: "Solar", color: "#F2A63B", textClass: "text-solar", icon: <Flame className="w-4 h-4 text-solar" aria-hidden="true" /> },
  { name: "Frost", color: "#38BDF8", textClass: "text-frost", icon: <Snowflake className="w-4 h-4 text-frost" aria-hidden="true" /> },
  { name: "Void", color: "#A855F7", textClass: "text-purple-300", icon: <Sparkles className="w-4 h-4 text-void" aria-hidden="true" /> },
] as const;

export const BossBrainPreview: React.FC = () => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("swarm");
  const [supplies, setSupplies] = useState<[number, number, number]>([80, 20, 10]);

  const resistance = useMemo(() => calculateAdaptiveResistance(supplies), [supplies]);
  const activePreset = PRESETS.find((p) => p.id === selectedPresetId) ?? PRESETS[1];

  const handlePreset = (preset: BrainPreset) => {
    setSelectedPresetId(preset.id);
    setSupplies([...preset.supplies]);
  };

  const updateSupply = (index: 0 | 1 | 2, val: number) => {
    setSelectedPresetId("custom");
    setSupplies((prev) => {
      const next: [number, number, number] = [...prev];
      next[index] = val;
      return next;
    });
  };

  const totalRes = resistance[0] + resistance[1] + resistance[2];
  const anyTributeRisk = resistance.some((r) => r >= TRIBUTE_THRESHOLD_BPS);
  const weakIdx = resistance.indexOf(Math.min(...resistance));

  return (
    <section id="boss-brain" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-parchment tracking-tight">
            Adaptive Meta Defense &amp; Verifiable AI Oracle
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-ash max-w-2xl leading-relaxed">
            Boss armor renormalizes deterministically on-chain across a strict 13,500 bps resistance pool, while NEAR AI TEE proposes buyback multipliers, Altar unlocks, and combat taunts within ironclad smart contract limits.
          </p>
        </div>

        <Link
          href="/game/ai"
          className="min-h-[44px] px-4 py-2 rounded-lg border border-brass/30 bg-panel-dark/90 text-xs font-mono font-bold text-parchment hover:border-solar/60 inline-flex items-center gap-2 self-start transition-colors"
        >
          <Brain className="w-4 h-4 text-void" aria-hidden="true" />
          <span>Inspect Live TEE Oracle</span>
          <ArrowRight className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Interactive Deterministic Resistance Lab (6 columns) */}
        <SpireSurface variant="stage" className="lg:col-span-6 p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-parchment">
                <Cpu className="w-4 h-4 text-solar" aria-hidden="true" />
                <span>On-Chain Resistance Lab</span>
              </div>
              <span className="font-mono-numbers text-xs text-pewter">
                Invariant Pool: {totalRes.toLocaleString("en-US")} / {TOTAL_RESISTANCE_BPS.toLocaleString("en-US")} bps
              </span>
            </div>

            {/* Scenario Presets */}
            <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Resistance simulation presets">
              {PRESETS.map((preset) => {
                const active = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePreset(preset)}
                    aria-pressed={active}
                    className={`min-h-[40px] px-3 py-1.5 rounded-md border font-mono text-xs font-semibold transition-all ${
                      active
                        ? "bg-solar/20 border-solar/70 text-parchment"
                        : "bg-[#090A10] border-brass/20 text-ash hover:border-brass/50 hover:text-parchment"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Interactive Sliders */}
            <div className="space-y-4">
              {ELEMENTS.map((el, idx) => {
                const i = idx as 0 | 1 | 2;
                const bps = resistance[i];
                const isTribute = bps >= TRIBUTE_THRESHOLD_BPS;
                const isWeakest = i === weakIdx;

                return (
                  <div key={el.name} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {el.icon}
                        <span className={`font-serif text-sm font-bold ${el.textClass}`}>
                          {el.name} Supply: {supplies[i]}
                        </span>
                        {isWeakest && (
                          <span className="px-2 py-0.5 rounded bg-jackpot/15 text-jackpot font-mono text-[11px] font-bold">
                            BOSS WEAK POINT
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-mono-numbers">
                        <span className="font-bold text-parchment">
                          {bps.toLocaleString("en-US")} bps
                        </span>
                        <span className="text-pewter">
                          ({(bps / 100).toFixed(1)}%)
                        </span>
                        {isTribute && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-hp/15 text-rose-200 font-mono text-[11px] font-bold">
                            <AlertTriangle className="w-3 h-3 text-hp" aria-hidden="true" />
                            TRIBUTE
                          </span>
                        )}
                      </div>
                    </div>

                    <SpireSlider
                      value={[supplies[i]]}
                      min={0}
                      max={120}
                      step={1}
                      accentColor={el.color}
                      ariaLabel={`${el.name} server weapon supply`}
                      onValueChange={(val) => updateSupply(i, val[0] ?? 0)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`rounded-lg px-4 py-3 text-xs leading-relaxed border-t ${
              anyTributeRisk
                ? "bg-hp/10 border-hp/60 text-rose-100"
                : "bg-[#090A10]/90 border-jackpot/50 text-ash"
            }`}
          >
            {anyTributeRisk ? (
              <span>
                <strong>Tribute Seizure Active (&ge; 7,000 bps):</strong> Crowded non-starter attacks carry a progressive confiscation risk. Reforge surplus steel into <strong>{ELEMENTS[weakIdx].name}</strong> or attack with Starter-Locked blades!
              </span>
            ) : (
              <span>
                <strong>Safe Meta Corridor (&lt; 7,000 bps):</strong> No element triggers Tribute seizure. Balanced guild composition keeps every attack intact.
              </span>
            )}
          </div>
        </SpireSurface>

        {/* Right: AI Proposes, Contract Validates (6 columns, clean single card) */}
        <SpireSurface variant="surface" className="lg:col-span-6 p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-parchment">
                AI Proposes, Smart Contract Validates
              </h3>
              <SpireTooltip content="Phala / NEAR AI TEE signs proposals off-chain via Ed25519; lib.rs rejects any out-of-range multiplier or unauthorized recipe.">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-purple-300 cursor-help">
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>TEE Ed25519 Gate</span>
                </span>
              </SpireTooltip>
            </div>

            <p className="text-sm text-ash leading-relaxed">
              The Keeper&apos;s off-chain intelligence never picks combat winners or alters your armor rolls arbitrarily. Every epoch decision passes through strict Rust bounds on NEAR:
            </p>

            {/* Clean flat rule table (no double card nesting) */}
            <dl className="divide-y divide-brass/15 bg-[#090A10]/85 rounded-lg px-4">
              <div className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <dt className="font-mono text-pewter uppercase">AI Buyback Multiplier</dt>
                <dd className="font-mono-numbers font-bold text-solar">
                  Clamped [10,000 - 40,000 bps] (1.0x - 4.0x)
                </dd>
              </div>
              <div className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <dt className="font-mono text-pewter uppercase">Altar Reforge Unlocks</dt>
                <dd className="font-mono font-bold text-frost">
                  reforge_2_to_1 / AI reforge_3_to_2
                </dd>
              </div>
              <div className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <dt className="font-mono text-pewter uppercase">Epoch Shift Guard</dt>
                <dd className="font-mono-numbers font-bold text-parchment">
                  Deterministic Math · Cap {MAX_SHIFT_BPS.toLocaleString("en-US")} bps / Epoch
                </dd>
              </div>
            </dl>
          </div>

          {/* Live Boss Voice Manuscript Transmission */}
          <div className="pt-4 border-t border-brass/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-serif text-sm font-bold text-parchment">
                {activePreset.bossName}
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px] text-pewter">
                <span>Altar: <strong className="text-frost">{activePreset.altarRecipe}</strong></span>
                <span>·</span>
                <span>Void Quote: <strong className="text-purple-300">{(activePreset.buybackBps[2] / 10000).toFixed(2)}x</strong></span>
              </div>
            </div>

            <blockquote className="font-lore italic text-lg sm:text-xl text-parchment leading-snug rounded-lg bg-[#090A10]/90 px-4 py-3">
              &ldquo;{activePreset.taunt}&rdquo;
            </blockquote>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[11px] text-pewter">
              <span className="inline-flex items-center gap-1.5 text-jackpot">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Verified {activePreset.sigPrefix}</span>
              </span>
              <span>chat_id: {activePreset.chatId}</span>
            </div>
          </div>
        </SpireSurface>
      </div>
    </section>
  );
};
