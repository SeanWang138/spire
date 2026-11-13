"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Coins,
  Flame,
  Hammer,
  ShieldCheck,
  Store,
  Swords,
  Vault,
} from "lucide-react";
import {
  SpireSurface,
  SpireTabs,
  SpireTabsList,
  SpireTabsTrigger,
  SpireTabsContent,
} from "@/components/ui/SpireUi";
import { FLOOR_TICKET_COST_NEAR } from "@/lib/spire/constants";
import { useMotionControl } from "@/lib/spire/motion";

type RoleTabId = "slayer" | "artisan" | "backer" | "investor";

const SPLIT_FLOWS = [
  {
    id: "jackpot",
    pct: 70,
    label: "Boss Jackpot Pool",
    color: "#00EC97",
    textClass: "text-jackpot",
    summary: "90% pro-rata to round damage dealt + 10% Executioner bonus. 10% drips up to the next floor on kill.",
    pathY: 58,
  },
  {
    id: "backer",
    pct: 15,
    label: "Backer Dividend Pool",
    color: "#A855F7",
    textClass: "text-purple-300",
    summary: "Streaming share yield for guild Backers (or rolls automatically into Boss Jackpot if zero shares exist).",
    pathY: 122,
  },
  {
    id: "buyback",
    pct: 10,
    label: "Boss Buyback Reserve",
    color: "#F2A63B",
    textClass: "text-solar",
    summary: "Accumulates per floor to fund 1.0x-4.0x scarce weapon bounties inside Boss Vault.",
    pathY: 186,
  },
  {
    id: "merchant",
    pct: 5,
    label: "NPC Merchant Liquidity",
    color: "#38BDF8",
    textClass: "text-frost",
    summary: "Tops up the town bazaar cash ledger above 1.00 NEAR so Artisans always find a liquid counter.",
    pathY: 250,
  },
] as const;

const ROLE_TABS: {
  id: RoleTabId;
  label: string;
  subtitle: string;
  ctaHref: string;
  ctaLabel: string;
  accentText: string;
  accentBorder: string;
  icon: React.ReactNode;
  highlights: { label: string; value: string }[];
  mechanics: string[];
  riskNotice?: string;
}[] = [
  {
    id: "slayer",
    label: "Slayer",
    subtitle: "Signless tactical combatant chasing proportional Jackpot and Conqueror NFT trophies.",
    ctaHref: "/game/raid",
    ctaLabel: "Enter Raid Arena",
    accentText: "text-solar",
    accentBorder: "border-solar/45",
    icon: <Swords className="w-4 h-4 text-solar" aria-hidden="true" />,
    highlights: [
      {
        label: "Entry Tickets",
        value: `${FLOOR_TICKET_COST_NEAR.map((v) => v.toFixed(2)).join(" / ")} N`,
      },
      { label: "Jackpot Payout", value: "90% Dmg + 10% Kill" },
      { label: "Combat Stances", value: "Aggressive · Feint · Pierce" },
    ],
    mechanics: [
      "Claim starter kit (4x Solar + 1x Frost) immune to Boss Tribute confiscation for zero-risk warmups.",
      "Chain 3 elemental attacks per strike turn: Aggressive (1.20x), Feint (tighter variance), or Pierce (-1,500 bps armor).",
      "Clear Floor 2 Frost Ward (30m) and Floor 3 Enrage (20m, +10% HP every 5m) to mint a dynamic NEP-171 Trophy.",
    ],
  },
  {
    id: "artisan",
    label: "Artisan",
    subtitle: "30-second resource gatherer, weapon smith, Altar reforger, and scarcity arbitrageur.",
    ctaHref: "/game/forge",
    ctaLabel: "Open Forge & Altar",
    accentText: "text-frost",
    accentBorder: "border-frost/45",
    icon: <Hammer className="w-4 h-4 text-frost" aria-hidden="true" />,
    highlights: [
      { label: "Craft Cost", value: "2 Ore + 3 Essence" },
      { label: "Gather Cadence", value: "+2 Unit / 30s (20/Epoch)" },
      { label: "Buyback Range", value: "1.0x - 4.0x Scarcity Quote" },
    ],
    mechanics: [
      "Gather Iron Ore and elemental Essences every 30 seconds without wallet popups using your session key.",
      "Mint tradable Solar, Frost, or scarce Void armaments at the Forge for exactly 2 Ore + 3 Essence.",
      "Burn surplus blades at the AI Altar (reforge_2_to_1 or AI-unlocked reforge_3_to_2) or sell non-starter weapons into 4.0x Boss Buybacks.",
    ],
  },
  {
    id: "backer",
    label: "Backer",
    subtitle: "Cycle underwriter funding Boss raids early for streaming 15% ticket dividends.",
    ctaHref: "/game/vault",
    ctaLabel: "Open Backer Vault",
    accentText: "text-purple-300",
    accentBorder: "border-void/45",
    icon: <Vault className="w-4 h-4 text-void" aria-hidden="true" />,
    highlights: [
      { label: "Share Price", value: "0.01 NEAR / Share" },
      { label: "Entry Window", value: "Boss HP >= 80%" },
      { label: "Stream Revenue", value: "15% of Every Raid Ticket" },
    ],
    mechanics: [
      "Acquire shares at 0.01 NEAR per share while floor Boss HP remains at or above 80%.",
      "Earn a pro-rata stream from 15% of every raid ticket paid during that active floor cycle.",
      "Collect accrued dividends continuously; principal shares unlock for full reclaim as soon as the floor Boss falls.",
    ],
    riskNotice:
      "Principal Cycle Risk: Backer share principal returns only upon Boss kill. If Floor 2 (30m) or Floor 3 (20m) expires unslain and resets, round principal is absorbed and the cycle advances.",
  },
  {
    id: "investor",
    label: "Merchant Investor",
    subtitle: "Bazaar liquidity backer keeping NPC trading open through heavy town selling waves.",
    ctaHref: "/game/merchant",
    ctaLabel: "Inspect NPC Bazaar",
    accentText: "text-jackpot",
    accentBorder: "border-jackpot/45",
    icon: <Store className="w-4 h-4 text-jackpot" aria-hidden="true" />,
    highlights: [
      { label: "Contract Method", value: "fund_merchant" },
      { label: "Open Threshold", value: ">= 1.00 NEAR Reserve" },
      { label: "Passive Inflow", value: "5% Tickets + 10% Spread" },
    ],
    mechanics: [
      "Inject NEAR directly into the town Merchant cash counter via fund_merchant without entering dungeon danger.",
      "Keep Bazaar trading unlocked above the 1.00 NEAR floor when Artisans cash out surplus materials simultaneously.",
      "Observe live 10% spread compounding alongside the automatic 5% cut routed from every raid ticket.",
    ],
  },
];

export const EconomyConduitPreview: React.FC = () => {
  const { paused, reducedMotion } = useMotionControl();
  const [selectedFloorIdx, setSelectedFloorIdx] = useState<0 | 1 | 2>(0);
  const [hoveredSplit, setHoveredSplit] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<RoleTabId>("slayer");

  const animateConduit = !paused && !reducedMotion;
  const ticketNear = FLOOR_TICKET_COST_NEAR[selectedFloorIdx];

  return (
    <section id="economy" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-parchment tracking-tight">
            Zero-Inflation Ticket Conduit &amp; Guild Roles
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-ash max-w-2xl leading-relaxed">
            Every NEAR entering the Spire comes from ticket sales and crafting demand rather than emission inflation, routed deterministically across four protocol ledgers.
          </p>
        </div>

        {/* Interactive Floor Ticket Selector */}
        <div
          className="inline-flex items-center gap-1.5 rounded-lg border border-brass/25 bg-panel-dark/90 p-1 self-start"
          role="group"
          aria-label="Inspect ticket split by Citadel floor"
        >
          {[0, 1, 2].map((idx) => {
            const active = selectedFloorIdx === idx;
            const cost = FLOOR_TICKET_COST_NEAR[idx];
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedFloorIdx(idx as 0 | 1 | 2)}
                aria-pressed={active}
                className={`min-h-[44px] px-3.5 py-2 rounded-md font-mono text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? "bg-solar/20 border border-solar/60 text-parchment"
                    : "text-ash hover:text-parchment border border-transparent"
                }`}
              >
                F{idx + 1} · {cost.toFixed(2)} N
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Live SVG Conduit Router (5 columns) */}
        <SpireSurface variant="stage" className="lg:col-span-5 p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-parchment">
                <Coins className="w-4 h-4 text-solar" aria-hidden="true" />
                <span>Floor {selectedFloorIdx + 1} Ticket Routing</span>
              </div>
              <span className="font-mono-numbers text-sm font-bold text-solar">
                {ticketNear.toFixed(2)} NEAR
              </span>
            </div>
            <p className="text-xs text-ash leading-relaxed">
              Deterministic 70 / 15 / 10 / 5 revenue conduit on every <code className="text-parchment">raid_attack</code> transaction.
            </p>
          </div>

          {/* Animated SVG Split Diagram */}
          <div className="relative w-full rounded-xl bg-[#07080E] border border-brass/15 p-3">
            <svg
              viewBox="0 0 420 296"
              className="w-full h-auto"
              role="img"
              aria-label="Interactive ticket revenue routing: 70 percent Boss Jackpot, 15 percent Backer Dividend, 10 percent Boss Buyback, 5 percent NPC Merchant"
            >
              <defs>
                <filter id="conduitGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Entry Node */}
              <rect
                x="10"
                y="120"
                width="96"
                height="64"
                rx="10"
                fill="#12131D"
                stroke="#E5A93B"
                strokeOpacity="0.65"
                strokeWidth="1.5"
              />
              <text x="58" y="146" textAnchor="middle" fill="#CEC4B3" fontSize="10" fontFamily="monospace">
                RAID TICKET
              </text>
              <text x="58" y="166" textAnchor="middle" fill="#F3EAD8" fontSize="14" fontWeight="bold" fontFamily="monospace">
                {ticketNear.toFixed(2)} N
              </text>

              {SPLIT_FLOWS.map((flow, index) => {
                const isActive = hoveredSplit === null || hoveredSplit === flow.id;
                const d = `M 106 152 C 165 152, 165 ${flow.pathY}, 224 ${flow.pathY}`;
                const pathId = `spire-conduit-${flow.id}`;
                const amountNear = (ticketNear * flow.pct) / 100;

                return (
                  <g
                    key={flow.id}
                    opacity={isActive ? 1 : 0.35}
                    onMouseEnter={() => setHoveredSplit(flow.id)}
                    onMouseLeave={() => setHoveredSplit(null)}
                    className="cursor-pointer transition-opacity duration-200"
                  >
                    <path
                      id={pathId}
                      d={d}
                      fill="none"
                      stroke={flow.color}
                      strokeWidth={flow.pct >= 70 ? "3" : "2"}
                      strokeOpacity="0.45"
                    />
                    {animateConduit && (
                      <circle r={flow.pct >= 70 ? "4" : "3"} fill={flow.color} filter="url(#conduitGlow)">
                        <animateMotion
                          dur={`${1.9 + index * 0.25}s`}
                          repeatCount="indefinite"
                          path={d}
                        />
                      </circle>
                    )}

                    {/* Destination Ledger Block */}
                    <rect
                      x="224"
                      y={flow.pathY - 24}
                      width="186"
                      height="48"
                      rx="8"
                      fill="#12131D"
                      stroke={flow.color}
                      strokeOpacity={hoveredSplit === flow.id ? "0.9" : "0.4"}
                      strokeWidth="1.25"
                    />
                    <text
                      x="236"
                      y={flow.pathY - 4}
                      fill="#F3EAD8"
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      {flow.label}
                    </text>
                    <text
                      x="236"
                      y={flow.pathY + 14}
                      fill={flow.color}
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {flow.pct}% · {amountNear.toFixed(4)} N
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="pt-2 border-t border-brass/15 text-xs text-ash leading-relaxed">
            {hoveredSplit
              ? SPLIT_FLOWS.find((f) => f.id === hoveredSplit)?.summary
              : "Hover any conduit channel above to inspect how ticket inflow funds PvE bounties, town liquidity, and Backer dividends."}
          </div>
        </SpireSurface>

        {/* Right: 4 Guild Economic Roles (7 columns, clean single container) */}
        <SpireSurface variant="surface" className="lg:col-span-7 p-6 flex flex-col justify-between">
          <SpireTabs
            value={activeRole}
            onValueChange={(v) => setActiveRole(v as RoleTabId)}
            className="flex flex-col h-full justify-between"
          >
            <div>
              <div className="flex flex-col gap-3 mb-5">
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-parchment">
                  Choose Your Role Inside the Spire
                </h3>
                <SpireTabsList aria-label="SpireFi Guild Roles" className="w-fit">
                  {ROLE_TABS.map((role) => (
                    <SpireTabsTrigger key={role.id} value={role.id} className="gap-1.5 whitespace-nowrap">
                      <span>{role.label}</span>
                    </SpireTabsTrigger>
                  ))}
                </SpireTabsList>
              </div>

              {ROLE_TABS.map((role) => (
                <SpireTabsContent key={role.id} value={role.id} className="space-y-5 focus:outline-none">
                  <motion.div
                    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-5"
                  >
                    <div className={`pt-4 border-t ${role.accentBorder}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {role.icon}
                        <span className={`font-serif text-xl font-bold ${role.accentText}`}>
                          {role.label}
                        </span>
                      </div>
                      <p className="text-sm text-ash leading-relaxed">{role.subtitle}</p>
                    </div>

                    {/* Highlights row — clean hairline separators, no nested bordered boxes */}
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-brass/15 bg-[#090A10]/80 px-4 rounded-lg">
                      {role.highlights.map((item) => (
                        <div key={item.label} className="flex flex-col gap-1">
                          <dt className="text-[11px] font-mono uppercase tracking-wider text-pewter">
                            {item.label}
                          </dt>
                          <dd className="font-mono-numbers text-sm font-bold text-parchment">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    {/* Mechanics list */}
                    <ul className="space-y-2.5 text-sm text-ash">
                      {role.mechanics.map((line) => (
                        <li key={line} className="flex items-start gap-2.5 leading-relaxed">
                          <ShieldCheck
                            className="w-4 h-4 text-brass shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>

                    {role.riskNotice && (
                      <div className="flex items-start gap-3 rounded-lg bg-hp/10 border-t border-hp/50 px-4 py-3 text-xs text-rose-100 leading-relaxed">
                        <AlertTriangle
                          className="w-4 h-4 text-hp shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{role.riskNotice}</span>
                      </div>
                    )}

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono text-xs text-pewter">
                        {role.id === "artisan" && "Starter kit attacks stay free · Crafting requires 2 Ore + 3 Essence"}
                        {role.id === "slayer" && "70% Ticket -> Jackpot · 90/10 Settlement Split"}
                        {role.id === "backer" && "0.01 NEAR / share · Active only while Boss HP >= 80%"}
                        {role.id === "investor" && "Keeps NPC Bazaar active >= 1.00 NEAR cash reserve"}
                      </span>

                      <Link
                        href={role.ctaHref}
                        className="rpg-sheen inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 text-oled font-bold text-xs uppercase tracking-wider border border-amber-300/60 hover:from-amber-300 hover:to-amber-500 transition-all"
                      >
                        <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{role.ctaLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </motion.div>
                </SpireTabsContent>
              ))}
            </div>
          </SpireTabs>
        </SpireSurface>
      </div>
    </section>
  );
};
