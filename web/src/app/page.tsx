import Link from "next/link";
import {
  BrainCircuit,
  Coins,
  Hammer,
  Heart,
  Lock,
  Shield,
  Swords,
  Store,
  TowerControl,
  TrendingUp,
  Vault as VaultIcon,
} from "lucide-react";
import { LandingHero } from "@/components/landing/LandingHero";
import {
  FLOOR_MAX_HP,
  FLOOR_TICKET_COST_NEAR,
  FROST_WARD_FLOOR,
  ENRAGE_FLOOR,
  SPLIT_BACKER_BPS,
  SPLIT_BUYBACK_BPS,
  SPLIT_JACKPOT_BPS,
  SPLIT_MERCHANT_BPS,
  BUYBACK_MIN_BPS,
  BUYBACK_MAX_BPS,
  TRIBUTE_THRESHOLD_BPS,
  MERCHANT_BASE_PRICE_NEAR,
  STARTER_WEAPONS,
  STARTER_ORE,
  STARTER_ESSENCE,
  GATHER_AMOUNT,
} from "@/lib/spire/constants";

// Static spec only — the landing page never talks to the contract.

const FLOORS = [
  {
    n: 1,
    hp: FLOOR_MAX_HP[0],
    ticket: FLOOR_TICKET_COST_NEAR[0],
    name: "Foundation Floor",
    modifier: null as string | null,
    deadline: "No deadline",
    accent: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  {
    n: 2,
    hp: FLOOR_MAX_HP[1],
    ticket: FLOOR_TICKET_COST_NEAR[1],
    name: "Warded Floor",
    modifier: "Frost Ward — +1500 bps effective resistance vs Frost strikes",
    deadline: "30 min deadline",
    accent: "text-frost",
    border: "border-frost/30",
  },
  {
    n: 3,
    hp: FLOOR_MAX_HP[2],
    ticket: FLOOR_TICKET_COST_NEAR[2],
    name: "Enrage Floor",
    modifier: "Enrage — boss regenerates 10% max HP every 5 minutes",
    deadline: "20 min deadline",
    accent: "text-hp",
    border: "border-hp/30",
  },
];

const ECONOMY_ROLES = [
  {
    icon: <Swords className="w-5 h-5 text-solar" />,
    role: "Raider",
    body: "Buy a raid ticket from the internal ledger, pick one weapon element and three stances — Aggressive, Feint or Pierce. Damage above the tribute threshold risks weapon confiscation.",
  },
  {
    icon: <Hammer className="w-5 h-5 text-frost" />,
    role: "Pengrajin (Artisan)",
    body: `Claim the starter kit (${STARTER_WEAPONS[0]}× solar / ${STARTER_WEAPONS[1]}× frost / ${STARTER_WEAPONS[2]}× void + ${STARTER_ORE} ore + ${STARTER_ESSENCE} essence), gather ${GATHER_AMOUNT} units per node, craft elemental weapons and trade them through the NPC merchant's bonding curve.`,
  },
  {
    icon: <Shield className="w-5 h-5 text-jackpot" />,
    role: "Backer",
    body: `Back a floor's Boss Vault with NEAR. Every ticket on that floor routes ${SPLIT_BACKER_BPS / 100}% straight into the backer dividend pool — claimable per cycle, proportional to your shares.`,
  },
];

const PILLARS = [
  {
    icon: <Swords className="w-5 h-5 text-solar" />,
    title: "Sentinel",
    body: "Three parallel floors with per-floor deadlines, jackpot drip (10% rolls down on defeat) and deterministic 90/10 payout splits between the proportional damage pool and the last attacker.",
  },
  {
    icon: <BrainCircuit className="w-5 h-5 text-frost" />,
    title: "Boss Brain",
    body: "A TEE-signed AI proposal sets per-element buyback multipliers and activates altar recipes. The contract verifies the Ed25519 signature before any state shift — the AI proposes, the chain disposes.",
  },
  {
    icon: <Shield className="w-5 h-5 text-jackpot" />,
    title: "Backer",
    body: "The Boss Vault holds backer stakes per floor. Backers earn ticket dividends every cycle, while their stake deepens the buyback reserve that keeps weapon liquidity alive.",
  },
];

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-10">
      <p className="font-mono text-[11px] tracking-[0.3em] text-slate-500 uppercase mb-3">
        {eyebrow}
      </p>
      <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-wide">
        {title}
      </h2>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-oled text-slate-200">
      <LandingHero />

      {/* The Tower */}
      <section id="tower" className="w-full px-6 sm:px-10 py-20 max-w-7xl mx-auto border-t border-white/5">
        <SectionHeading eyebrow="Spec // tower floors" title="The Tower" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FLOORS.map((floor) => (
            <div
              key={floor.n}
              className={`p-6 rounded-xl bg-panel-dark border ${floor.border} elevation-panel flex flex-col gap-4`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TowerControl className={`w-5 h-5 ${floor.accent}`} />
                  <span className="font-mono text-sm font-bold uppercase tracking-widest text-white">
                    Floor {floor.n}
                  </span>
                </div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-400">
                  {floor.deadline}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <Heart className={`w-4 h-4 ${floor.accent} self-center`} />
                <span className={`text-3xl font-black font-mono-numbers ${floor.accent}`}>
                  {floor.hp}
                </span>
                <span className="text-xs font-mono text-slate-500 uppercase">Boss HP</span>
              </div>
              <div className="flex items-baseline gap-2">
                <Coins className="w-4 h-4 text-solar self-center" />
                <span className="text-2xl font-bold font-mono-numbers text-solar">
                  {floor.ticket.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-500 uppercase">NEAR ticket</span>
              </div>
              {floor.modifier ? (
                <p className="text-[11px] font-mono text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                  {floor.modifier}
                </p>
              ) : (
                <p className="text-[11px] font-mono text-slate-500 leading-relaxed border-t border-white/5 pt-3">
                  Standard encounter — a clean arena to learn the stance cadence.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* The Economy */}
      <section id="economy" className="w-full px-6 sm:px-10 py-20 max-w-7xl mx-auto border-t border-white/5">
        <SectionHeading eyebrow="Spec // roles & flows" title="The Economy" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {ECONOMY_ROLES.map((role) => (
            <div
              key={role.role}
              className="p-6 rounded-xl bg-panel-dark border border-white/10 elevation-panel flex flex-col gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-panel-card border border-white/10 flex items-center justify-center">
                {role.icon}
              </div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-white">
                {role.role}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{role.body}</p>
            </div>
          ))}
        </div>

        {/* Ticket split bar — straight from the contract constants */}
        <div className="rounded-xl bg-panel-card border border-white/10 p-5 elevation-panel">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-300">
              Where every ticket goes
            </span>
            <span className="font-mono text-[11px] text-slate-500">deterministic bps split</span>
          </div>
          <div className="h-4 rounded-full overflow-hidden bg-panel-dark flex border border-white/10 p-0.5">
            <div style={{ width: `${SPLIT_JACKPOT_BPS / 100}%` }} className="h-full bg-jackpot" title={`Jackpot ${SPLIT_JACKPOT_BPS / 100}%`} />
            <div style={{ width: `${SPLIT_BACKER_BPS / 100}%` }} className="h-full bg-frost" title={`Backers ${SPLIT_BACKER_BPS / 100}%`} />
            <div style={{ width: `${SPLIT_BUYBACK_BPS / 100}%` }} className="h-full bg-void" title={`Buyback ${SPLIT_BUYBACK_BPS / 100}%`} />
            <div style={{ width: `${SPLIT_MERCHANT_BPS / 100}%` }} className="h-full bg-solar" title={`Merchant ${SPLIT_MERCHANT_BPS / 100}%`} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px] font-mono">
            <div className="p-2 rounded bg-panel-dark border border-jackpot/20 flex justify-between">
              <span className="text-slate-400">Jackpot</span>
              <span className="font-bold text-jackpot">{SPLIT_JACKPOT_BPS / 100}%</span>
            </div>
            <div className="p-2 rounded bg-panel-dark border border-frost/20 flex justify-between">
              <span className="text-slate-400">Backers</span>
              <span className="font-bold text-frost">{SPLIT_BACKER_BPS / 100}%</span>
            </div>
            <div className="p-2 rounded bg-panel-dark border border-void/20 flex justify-between">
              <span className="text-slate-400">Buyback</span>
              <span className="font-bold text-void">{SPLIT_BUYBACK_BPS / 100}%</span>
            </div>
            <div className="p-2 rounded bg-panel-dark border border-solar/20 flex justify-between">
              <span className="text-slate-400">Merchant</span>
              <span className="font-bold text-solar">{SPLIT_MERCHANT_BPS / 100}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* The Boss Brain */}
      <section id="boss-brain" className="w-full px-6 sm:px-10 py-20 max-w-7xl mx-auto border-t border-white/5">
        <SectionHeading eyebrow="Spec // AI TEE" title="The Boss Brain" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col gap-4">
            <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
              An off-chain AI enclave watches the tower and signs one canonical proposal per
              epoch: per-element buyback multipliers, an optional taunt for the raid log, and
              the altar recipe it wants to activate. The relayer posts
              <span className="font-mono text-frost"> apply_ai_proposal </span>
              with the payload, chat id and Ed25519 signature — the contract verifies the
              pinned TEE key on-chain before accepting anything.
            </p>
            <div className="p-3 rounded-lg bg-panel-dark border border-frost/30 font-mono text-[11px] text-frost overflow-x-auto">
              spire/floor={"{floor}"}/epoch={"{epoch}"}/buyback={"{m0}-{m1}-{m2}"}/recipe={"{recipe|none}"}/nonce={"{nonce}"}
            </div>
            <p className="text-[11px] font-mono text-slate-500">
              The exact message bytes the enclave signs. One format, no fallbacks — a tampered
              proposal is rejected on-chain, not trusted.
            </p>
          </div>
          <div className="lg:col-span-5 grid grid-cols-1 gap-3">
            <div className="p-4 rounded-xl bg-panel-card border border-void/30 flex items-start gap-3">
              <TrendingUp className="w-4 h-4 text-void mt-0.5" />
              <div>
                <span className="text-xs font-bold uppercase font-mono tracking-wide text-white block">
                  Buyback multiplier
                </span>
                <p className="text-[11px] font-mono text-slate-400 leading-relaxed mt-1">
                  Clamped between {(BUYBACK_MIN_BPS / 100).toFixed(0)}× base and{" "}
                  {(BUYBACK_MAX_BPS / 100).toFixed(0)}× base per element — the AI decides which
                  weapons the boss overpays for this epoch.
                </p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-panel-card border border-frost/30 flex items-start gap-3">
              <Lock className="w-4 h-4 text-frost mt-0.5" />
              <div>
                <span className="text-xs font-bold uppercase font-mono tracking-wide text-white block">
                  Altar recipe
                </span>
                <p className="text-[11px] font-mono text-slate-400 leading-relaxed mt-1">
                  Reforge transmutations (2→1 / 3→2) only unlock while the Boss Brain keeps the
                  recipe active. No recipe, no transmutation.
                </p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-panel-card border border-hp/30 flex items-start gap-3">
              <BrainCircuit className="w-4 h-4 text-hp mt-0.5" />
              <div>
                <span className="text-xs font-bold uppercase font-mono tracking-wide text-white block">
                  Taunt
                </span>
                <p className="text-[11px] font-mono text-slate-400 leading-relaxed mt-1">
                  Optional signed trash-talk stored with the proposal and surfaced in the Boss
                  Brain console.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Vault */}
      <section id="vault" className="w-full px-6 sm:px-10 py-20 max-w-7xl mx-auto border-t border-white/5">
        <SectionHeading eyebrow="Spec // internal ledger" title="The Vault" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-xl bg-panel-dark border border-jackpot/30 elevation-panel flex flex-col gap-3">
            <Coins className="w-5 h-5 text-jackpot" />
            <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-white">
              Deposit & Withdraw
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              The internal ledger holds your raid funds off the wire: deposit NEAR in, withdraw
              out (or everything at once with a null amount), and spend tickets signlessly.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-panel-dark border border-solar/30 elevation-panel flex flex-col gap-3">
            <VaultIcon className="w-5 h-5 text-solar" />
            <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-white">
              Jackpot claims
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              When a floor boss falls, the round&apos;s jackpot is split proportionally by damage
              with a 10% last-strike bonus. Claim per (floor, round) — unclaimed pots wait in the
              ledger, they never vanish.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-panel-dark border border-frost/30 elevation-panel flex flex-col gap-3">
            <Store className="w-5 h-5 text-frost" />
            <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-white">
              Merchant float
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              A base price of {MERCHANT_BASE_PRICE_NEAR.toFixed(2)} NEAR on a stock-target curve
              of 100 units, with a 10% two-way spread. The merchant closes automatically when its
              cash reserve drops under 1.0 NEAR.
            </p>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-panel-dark border border-white/10 text-[11px] font-mono text-slate-500">
          Tribute hazard: strike an element at resistance ≥ {TRIBUTE_THRESHOLD_BPS} bps and the
          boss confiscates your weapon — unless it is starter-locked.
        </div>
      </section>

      {/* The Spire — tail pillars */}
      <section id="spire" className="w-full px-6 sm:px-10 py-20 max-w-7xl mx-auto border-t border-white/5">
        <SectionHeading eyebrow="Architecture" title="SpireFi" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="p-6 rounded-xl bg-panel-card border border-white/10 elevation-panel flex flex-col gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-panel-dark border border-white/10 flex items-center justify-center">
                {pillar.icon}
              </div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-white">
                {pillar.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA + footer */}
      <section className="w-full px-6 sm:px-10 py-24 max-w-7xl mx-auto border-t border-white/5 text-center flex flex-col items-center gap-6">
        <h2 className="font-serif text-3xl sm:text-5xl font-bold text-white tracking-[0.08em]">
          The spire is waiting
        </h2>
        <p className="text-slate-400 text-sm max-w-lg font-mono">
          Create your <span className="text-slate-200">&lt;name&gt;.spire.testnet</span> signless
          session and take your first swing — the starter kit is free to claim.
        </p>
        <Link
          href="/game/start"
          className="px-8 py-3.5 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono text-xs font-bold uppercase tracking-widest transition-colors shadow-lg shadow-solar/20"
        >
          Enter the Spire
        </Link>

        <footer className="mt-10 pt-6 border-t border-white/5 w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-600">
          <span>SpireFi — NEAR Testnet</span>
          <span>v3.1 · signless Function Call combat · adaptive resistance</span>
        </footer>
      </section>
    </div>
  );
}
