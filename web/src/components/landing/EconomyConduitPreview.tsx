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
    textColor: "#00EC97",
    textClass: "text-jackpot",
    summary: "90% pro-rata to round damage dealt + 10% Executioner bonus. 10% drips up to the next floor on kill.",
    pathY: 58,
  },
  {
    id: "backer",
    pct: 15,
    label: "Backer Dividend Pool",
    color: "#A855F7",
    textColor: "#D8B4FE",
    textClass: "text-void-text",
    summary: "Streaming share yield for guild Backers (or rolls automatically into Boss Jackpot if zero shares exist).",
    pathY: 122,
  },
  {
    id: "buyback",
    pct: 10,
    label: "Boss Buyback Reserve",
    color: "#F2A63B",
    textColor: "#F2A63B",
    textClass: "text-solar",
    summary: "Accumulates per floor to fund 1.0x-4.0x scarce weapon bounties inside Boss Vault.",
    pathY: 186,
  },
  {
    id: "merchant",
    pct: 5,
    label: "NPC Merchant Liquidity",
    color: "#38BDF8",
    textColor: "#38BDF8",
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
    subtitle: "Popup-free tactical combatant chasing proportional Jackpot and Conqueror NFT trophies.",
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
      "Gather Iron Ore and elemental Essences every 30 seconds popup-free via your 0.60 NEAR ephemeral testnet guest subaccount or wallet session.",
      "Mint tradeable Solar, Frost, or scarce Void armaments at the Forge for exactly 2 Ore + 3 Essence.",
      "Burn surplus blades at the Altar via reforge_2_to_1 anytime (or AI-unlocked reforge_3_to_2), or sell non-starter weapons into Boss Buybacks up to 4.0x.",
    ],
  },
  {
    id: "backer",
    label: "Backer",
    subtitle: "Round underwriter funding active Floor Jackpots for a pro-rata 15% ticket dividend stream.",
    ctaHref: "/game/vault",
    ctaLabel: "Open Backer Vault",
    accentText: "text-void-text",
    accentBorder: "border-void/45",
    icon: <Vault className="w-4 h-4 text-void" aria-hidden="true" />,
    highlights: [
      { label: "Capital Routing", value: "Funds Floor Jackpot" },
      { label: "Lock Window", value: "Until Boss Defeat" },
      { label: "Stream Revenue", value: "15% of Every Raid Ticket" },
    ],
    mechanics: [
      "Contribute NEAR directly into a Floor vault via back_boss_vault; your capital enters the Floor Jackpot immediately with no HP entry gate and no mid-cycle withdrawal.",
      "Earn a pro-rata stream from 15% of every raid ticket paid on that Floor across the active cycle.",
      "On Floors 2 & 3, timed-out rounds carry both the Jackpot and your shares forward without a 70% payout, keeping dividends active until Boss defeat.",
    ],
    riskNotice:
      "Jackpot Funding Risk: Backer capital enters the Floor Jackpot directly with no mid-cycle withdrawal and pays out to Raiders on Boss kill. Timed-out rounds carry Jackpot and shares forward without a 70% payout while 15% ticket dividends stream until Boss defeat.",
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
  const [focusedSplit, setFocusedSplit] = useState<string | null>(null);
  const [selectedSplit, setSelectedSplit] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<RoleTabId>("slayer");

  const animateConduit = !paused && !reducedMotion;
  const ticketNear = FLOOR_TICKET_COST_NEAR[selectedFloorIdx];
  const activeSplit = hoveredSplit ?? focusedSplit ?? selectedSplit;

  const handleSplitKeyDown = (flowId: string) => (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedSplit((prev) => (prev === flowId ? null : flowId));
    }
  };

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
          className="inline-flex items-center gap-2 rounded-lg border border-brass/25 bg-panel-dark/90 p-1 self-start"
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

          {/* Animated SVG Split Diagram (tonal surface without nested border) */}
          <div className="relative w-full rounded-xl bg-[#07080E] p-3">
            <svg
              viewBox="0 0 432 300"
              className="w-full h-auto"
              role="group"
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
                x="8"
                y="118"
                width="102"
                height="68"
                rx="10"
                fill="#12131D"
                stroke="#E5A93B"
                strokeOpacity="0.65"
                strokeWidth="1.5"
              />
              <text x="59" y="145" textAnchor="middle" fill="#CEC4B3" fontSize="12" fontFamily="monospace">
                RAID TICKET
              </text>
              <text x="59" y="168" textAnchor="middle" fill="#F3EAD8" fontSize="14" fontWeight="bold" fontFamily="monospace">
                {ticketNear.toFixed(2)} N
              </text>

              {SPLIT_FLOWS.map((flow, index) => {
                const isActive = activeSplit === null || activeSplit === flow.id;
                const isFocusedOrSelected = focusedSplit === flow.id || selectedSplit === flow.id;
                const d = `M 110 152 C 165 152, 165 ${flow.pathY}, 220 ${flow.pathY}`;
                const pathId = `spire-conduit-${flow.id}`;
                const amountNear = (ticketNear * flow.pct) / 100;

                return (
                  <g
                    key={flow.id}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selectedSplit === flow.id}
                    aria-label={`${flow.label}: ${flow.pct} percent (${amountNear.toFixed(4)} NEAR). ${flow.summary}`}
                    opacity={isActive ? 1 : 0.4}
                    onMouseEnter={() => setHoveredSplit(flow.id)}
                    onMouseLeave={() => setHoveredSplit(null)}
                    onFocus={() => setFocusedSplit(flow.id)}
                    onBlur={() => setFocusedSplit(null)}
                    onClick={() => setSelectedSplit((prev) => (prev === flow.id ? null : flow.id))}
                    onKeyDown={handleSplitKeyDown(flow.id)}
                    className="cursor-pointer transition-opacity duration-200 focus:outline-none"
                  >
                    <path
                      id={pathId}
                      d={d}
                      fill="none"
                      stroke={flow.color}
                      strokeWidth={flow.pct >= 70 ? "3" : "2"}
                      strokeOpacity="0.5"
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
                      x="220"
                      y={flow.pathY - 25}
                      width="202"
                      height="50"
                      rx="8"
                      fill="#12131D"
                      stroke={isFocusedOrSelected ? "#F3EAD8" : flow.color}
                      strokeOpacity={isFocusedOrSelected || hoveredSplit === flow.id ? "0.95" : "0.45"}
                      strokeWidth={isFocusedOrSelected ? "2" : "1.25"}
                    />
                    <text
                      x="232"
                      y={flow.pathY - 4}
                      fill="#F3EAD8"
                      fontSize="12"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      {flow.label}
                    </text>
                    <text
                      x="232"
                      y={flow.pathY + 15}
                      fill={flow.textColor}
                      fontSize="12"
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
            {activeSplit
              ? SPLIT_FLOWS.find((f) => f.id === activeSplit)?.summary
              : "Hover, focus, or select any conduit channel above to inspect how ticket inflow funds PvE bounties, town liquidity, and Backer dividends."}
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
                    <SpireTabsTrigger key={role.id} value={role.id} className="gap-2 whitespace-nowrap">
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

                    {/* Highlights row — tonal surface without nested bordered boxes */}
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 bg-[#090A10]/85 px-4 rounded-lg">
                      {role.highlights.map((item) => (
                        <div key={item.label} className="flex flex-col gap-1">
                          <dt className="text-xs font-mono uppercase tracking-wider text-pewter">
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
                            className={`w-4 h-4 shrink-0 mt-0.5 ${role.accentText}`}
                            aria-hidden="true"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>

                    {role.riskNotice && (
                      <div className="flex items-start gap-3 rounded-lg bg-red-950/55 px-4 py-3 text-xs text-hp-text leading-relaxed">
                        <AlertTriangle
                          className="w-4 h-4 text-hp-text shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{role.riskNotice}</span>
                      </div>
                    )}

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono text-xs text-pewter">
                        {role.id === "artisan" && "Starter kit attacks stay free · Crafting requires 2 Ore + 3 Essence"}
                        {role.id === "slayer" && "70% Ticket -> Jackpot · 90/10 Settlement Split"}
                        {role.id === "backer" && "Funds Floor Jackpot directly · 15% ticket dividends until Boss defeat"}
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
