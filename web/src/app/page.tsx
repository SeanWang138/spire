import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Coins,
  Hammer,
  Lock,
  Play,
  Shield,
  Store,
  Swords,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { LandingHero } from "@/components/landing/LandingHero";
import {
  FLOOR_MAX_HP,
  FLOOR_TICKET_COST_NEAR,
  SPLIT_BACKER_BPS,
  SPLIT_BUYBACK_BPS,
  SPLIT_JACKPOT_BPS,
  SPLIT_MERCHANT_BPS,
  BUYBACK_MIN_BPS,
  BUYBACK_MAX_BPS,
  TRIBUTE_THRESHOLD_BPS,
  MERCHANT_BASE_PRICE_NEAR,
  MERCHANT_TARGET_STOCK,
  MERCHANT_MIN_CASH_NEAR,
  STARTER_WEAPONS,
  STARTER_ORE,
  STARTER_ESSENCE,
  GATHER_AMOUNT,
  CRAFT_ORE_COST,
  CRAFT_ESSENCE_COST,
} from "@/lib/spire/constants";

// Static protocol specification — renders at build/request time with zero contract dependency.

const FLOORS = [
  {
    n: 3,
    tierLabel: "SUMMIT · ENRAGE",
    boss: "Kaelen, Void Sovereign",
    hp: FLOOR_MAX_HP[2],
    ticket: FLOOR_TICKET_COST_NEAR[2],
    modifier: "Boss regenerates 10% max HP every 5 minutes + mints Conqueror NEP-171 Trophy on kill.",
    deadline: "20 min round timer",
    accent: "text-hp",
    border: "border-hp/30",
    badge: "bg-hp/15 text-hp border-hp/30",
    widthClass: "lg:w-[82%]",
  },
  {
    n: 2,
    tierLabel: "MID CITADEL · FROST WARD",
    boss: "Valkyr, Glacial Warden",
    hp: FLOOR_MAX_HP[1],
    ticket: FLOOR_TICKET_COST_NEAR[1],
    modifier: "Frost Ward adds +1,500 bps effective resistance against Frost strikes.",
    deadline: "30 min round timer",
    accent: "text-frost",
    border: "border-frost/30",
    badge: "bg-frost/15 text-frost border-frost/30",
    widthClass: "lg:w-[91%]",
  },
  {
    n: 1,
    tierLabel: "FOUNDATION · UNLOCKED",
    boss: "Malakor, Solar Sentinel",
    hp: FLOOR_MAX_HP[0],
    ticket: FLOOR_TICKET_COST_NEAR[0],
    modifier: "Open arena for stance cadence calibration and first jackpot splits.",
    deadline: "No round deadline",
    accent: "text-solar",
    border: "border-solar/30",
    badge: "bg-solar/15 text-solar border-solar/30",
    widthClass: "lg:w-full",
  },
];

const ECONOMY_ROLES = [
  {
    icon: <Swords className="w-5 h-5 text-solar" aria-hidden="true" />,
    role: "Raider",
    metric: "3 Stances · Signless",
    body: "Enter with internal NEAR ledger tickets. Choose Aggressive (+20% damage), Feint (10000-11000 bps steady roll), or Pierce (-1500 bps armor bypass) while dodging Boss Tribute confiscations.",
  },
  {
    icon: <Hammer className="w-5 h-5 text-frost" aria-hidden="true" />,
    role: "Artisan & Blacksmith",
    metric: `${CRAFT_ORE_COST} Ore + ${CRAFT_ESSENCE_COST} Essence`,
    body: `Claim a starter kit (${STARTER_WEAPONS[0]}x Solar, ${STARTER_WEAPONS[1]}x Frost, ${STARTER_ORE} Ore, ${STARTER_ESSENCE} Essence), gather +${GATHER_AMOUNT} units per node (30s cooldown), forge NEP-245 weapons, or trade the Merchant curve.`,
  },
  {
    icon: <Shield className="w-5 h-5 text-jackpot" aria-hidden="true" />,
    role: "Vault Backer",
    metric: `${SPLIT_BACKER_BPS / 100}% Ticket Flow`,
    body: "Back a specific floor's Boss Vault in NEAR. Every raid ticket purchased on that floor routes dividends into the backer pool for cycle-by-cycle claiming, deepening buyback liquidity.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-oled text-slate-200">
      <LandingHero />

      {/* Section 1: Stepped Citadel Elevation */}
      <section id="tower" className="w-full px-6 sm:px-10 py-20 max-w-7xl mx-auto border-t border-white/10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-wide">
            Three-Floor Ascension
          </h2>
          <p className="text-xs font-mono text-slate-300 max-w-md">
            10% of each defeated floor&apos;s jackpot drips upward to seed the next tier. All floors run parallel rounds.
          </p>
        </div>

        <div className="flex flex-col items-end gap-4">
          {FLOORS.map((floor) => (
            <div
              key={floor.n}
              className={`w-full ${floor.widthClass} rounded-xl bg-panel-dark border ${floor.border} elevation-panel p-5 sm:p-6 transition-colors hover:border-white/20`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${floor.badge}`}>
                      Floor {floor.n}
                    </span>
                    <span className="text-xs font-mono text-slate-300 uppercase tracking-wider">
                      {floor.tierLabel}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{floor.deadline}</span>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-white">{floor.boss}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{floor.modifier}</p>
                </div>

                <div className="flex items-center gap-6 sm:gap-8 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/10">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 uppercase block">Boss HP</span>
                    <span className={`text-2xl font-bold font-mono-numbers ${floor.accent}`}>
                      {floor.hp.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 uppercase block">Raid Ticket</span>
                    <span className="text-2xl font-bold font-mono-numbers text-solar">
                      {floor.ticket.toFixed(2)} NEAR
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 px-4 py-3 rounded-lg bg-panel-dark border border-hp/30 text-xs font-mono text-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-hp">Tribute Rule:</strong> Striking an element whose on-chain resistance is at or above{" "}
            <span className="font-mono-numbers font-bold text-white">{TRIBUTE_THRESHOLD_BPS} bps</span> confiscates your weapon unless it is starter-locked.
          </span>
          <Link href="/game/raid" className="text-solar hover:underline font-bold">
            Inspect Live Radar &rarr;
          </Link>
        </div>
      </section>

      {/* Section 2: Circular Game Economy */}
      <section id="economy" className="w-full px-6 sm:px-10 py-20 max-w-7xl mx-auto border-t border-white/10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-wide">
            Circular Economy &amp; Ticket Routing
          </h2>
          <span className="text-xs font-mono text-slate-300">
            Deterministic bps split locked in contract constants
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Roles ledger list */}
          <div className="lg:col-span-6 rounded-xl bg-panel-dark border border-white/10 elevation-panel divide-y divide-white/10">
            {ECONOMY_ROLES.map((item) => (
              <div key={item.role} className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-panel-elevated flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-serif text-lg font-bold text-white">{item.role}</h3>
                    <span className="text-xs font-mono text-slate-300 font-semibold">{item.metric}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Ticket split breakdown + Crafting spec (no nested rounded bordered cards) */}
          <div className="lg:col-span-6 rounded-xl bg-panel-card border border-white/10 elevation-panel p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
                  Per-Ticket NEAR Allocation
                </span>
                <span className="font-mono text-xs font-bold text-jackpot font-mono-numbers">100% On-Chain</span>
              </div>

              <div className="h-5 rounded-full overflow-hidden bg-oled flex border border-white/10">
                <div
                  style={{ width: `${SPLIT_JACKPOT_BPS / 100}%` }}
                  className="h-full bg-jackpot"
                  title={`Jackpot ${SPLIT_JACKPOT_BPS / 100}%`}
                />
                <div
                  style={{ width: `${SPLIT_BACKER_BPS / 100}%` }}
                  className="h-full bg-frost"
                  title={`Backers ${SPLIT_BACKER_BPS / 100}%`}
                />
                <div
                  style={{ width: `${SPLIT_BUYBACK_BPS / 100}%` }}
                  className="h-full bg-void"
                  title={`Buyback ${SPLIT_BUYBACK_BPS / 100}%`}
                />
                <div
                  style={{ width: `${SPLIT_MERCHANT_BPS / 100}%` }}
                  className="h-full bg-solar"
                  title={`Merchant ${SPLIT_MERCHANT_BPS / 100}%`}
                />
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-white/10 font-mono">
                <div>
                  <dt className="text-xs text-slate-400">Jackpot Pool</dt>
                  <dd className="text-lg font-bold text-jackpot font-mono-numbers">{SPLIT_JACKPOT_BPS / 100}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Vault Backers</dt>
                  <dd className="text-lg font-bold text-frost font-mono-numbers">{SPLIT_BACKER_BPS / 100}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Boss Buyback</dt>
                  <dd className="text-lg font-bold text-void font-mono-numbers">{SPLIT_BUYBACK_BPS / 100}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">NPC Float</dt>
                  <dd className="text-lg font-bold text-solar font-mono-numbers">{SPLIT_MERCHANT_BPS / 100}%</dd>
                </div>
              </dl>
            </div>

            <div className="pt-5 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold uppercase tracking-wider">Payout &amp; Supply Rules</span>
                <span className="text-slate-400">Verified in contract/src/lib.rs</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Boss defeat payouts settle 90% proportionally by total damage plus 10% directly to the killing strike. Unclaimed rewards wait safely in the internal ledger across epochs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: AI Boss Brain & Market Simulation */}
      <section id="boss-brain" className="w-full px-6 sm:px-10 py-20 max-w-7xl mx-auto border-t border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Verifiable AI Enclave */}
          <div className="lg:col-span-6 space-y-5">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-wide">
              TEE Boss Brain &amp; Ed25519 Verification
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Every epoch, an enclave agent reads tower supply skew and signs one deterministic proposal.
              Before mutating any multiplier or altar transmutation, the NEAR contract verifies the Ed25519 signature against its pinned TEE key.
            </p>

            <div className="p-4 rounded-lg bg-panel-dark border border-frost/30 font-mono text-xs text-frost overflow-x-auto">
              spire/floor={"{floor}"}/epoch={"{epoch}"}/buyback={"{m0}-{m1}-{m2}"}/recipe={"{recipe|none}"}/nonce={"{nonce}"}
            </div>

            <div className="rounded-xl bg-panel-dark border border-white/10 divide-y divide-white/10 font-mono text-xs">
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-white font-bold">
                  <TrendingUp className="w-4 h-4 text-void" aria-hidden="true" />
                  <span>Buyback Multipliers</span>
                </div>
                <span className="text-slate-300 text-right">
                  {BUYBACK_MIN_BPS / 10000}.0x to {BUYBACK_MAX_BPS / 10000}.0x per element
                </span>
              </div>
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Lock className="w-4 h-4 text-frost" aria-hidden="true" />
                  <span>Altar Transmutations</span>
                </div>
                <span className="text-slate-300 text-right">
                  2-to-1 / 3-to-2 gated by AI &amp; &ge;50% supply share
                </span>
              </div>
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-white font-bold">
                  <BrainCircuit className="w-4 h-4 text-hp" aria-hidden="true" />
                  <span>Canonical Taunt</span>
                </div>
                <span className="text-slate-300 text-right">
                  Signed payload stored &amp; displayed in Arena
                </span>
              </div>
            </div>
          </div>

          {/* Right: Vault, NPC Bonding Curve & SIMULASI CTA */}
          <div className="lg:col-span-6 rounded-xl bg-panel-card border border-white/10 elevation-panel p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-2xl font-bold text-white">NPC Bazaar &amp; Trophy Vault</h3>
              <Link
                href="/game/merchant#simulasi"
                className="min-h-[44px] px-4 py-2 rounded-lg bg-frost/15 hover:bg-frost/25 border border-frost/40 text-frost font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                Open SIMULASI
              </Link>
            </div>

            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <div className="flex items-start gap-3">
                <Store className="w-5 h-5 text-solar shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  <strong className="text-white">Bonding-Curve Merchant:</strong> Starts at{" "}
                  <span className="font-mono font-mono-numbers text-solar">{MERCHANT_BASE_PRICE_NEAR.toFixed(2)} NEAR</span>{" "}
                  around a {MERCHANT_TARGET_STOCK}-unit stock target with a 10% spread. Every quote carries an explicit mathematical reason, and the bazaar halts below{" "}
                  <span className="font-mono font-mono-numbers text-hp">{MERCHANT_MIN_CASH_NEAR.toFixed(1)} NEAR</span>{" "}
                  cash reserve until funded.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Trophy className="w-5 h-5 text-jackpot shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  <strong className="text-white">On-Chain Conqueror NFTs:</strong> Defeating Floor 3 mints a dynamic NEP-171/NEP-177 SVG trophy encoding the final round resistance, jackpot won, and killer account ID directly in contract storage.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Coins className="w-5 h-5 text-frost shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  <strong className="text-white">1-Week Fast-Forward Workbench:</strong> Stress-test 168 hours of raids, merchant bank runs, and adaptive boss resistance shifts inside a 60-second client simulation labeled{" "}
                  <span className="font-mono font-bold text-frost">SIMULASI</span>.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-wrap gap-3">
              <Link
                href="/game/merchant#simulasi"
                className="min-h-[44px] px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-colors"
              >
                Run Market Simulation
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/game/vault"
                className="min-h-[44px] px-4 py-2 rounded-lg border border-white/10 hover:border-white/25 text-slate-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center transition-colors"
              >
                View Vault &amp; Trophies
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA + Footer */}
      <section className="w-full px-6 sm:px-10 py-20 max-w-7xl mx-auto border-t border-white/10 text-center flex flex-col items-center gap-5">
        <h2 className="font-serif text-3xl sm:text-5xl font-bold text-white tracking-wide">
          Step Into the Obsidian Citadel
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-lg">
          Provision a signless <span className="font-mono text-white">&lt;name&gt;.spire.testnet</span> session key and claim your starter kit for free.
        </p>
        <Link
          href="/game/start"
          className="min-h-[44px] px-8 py-3.5 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-colors elevation-panel"
        >
          Enter the Spire
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>

        <footer className="mt-12 pt-6 border-t border-white/10 w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <span>SpireFi on NEAR Testnet</span>
          <span>v3.1 · Signless Function Call Combat · Adaptive Resistance</span>
        </footer>
      </section>
    </div>
  );
}
