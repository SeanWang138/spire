"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LogOut,
  Swords,
  Hammer,
  Store,
  Vault,
  BrainCircuit,
  Shield,
  ExternalLink,
  KeyRound,
  Pause,
  Play,
} from "lucide-react";
import { AtmosphericBackdrop, type ElementalTheme } from "@/components/background/AtmosphericBackdrop";
import { useMotionControl } from "@/lib/spire/motion";
import { useSessionAccount, useContractView } from "@/lib/spire/hooks";
import { get_balance, get_meta } from "@/lib/contract";
import { formatNearAmount, getExplorerTxUrl } from "@/lib/utils/cn";
import { SessionManager } from "@/lib/near";

const NAV_ITEMS = [
  { step: "01", href: "/game/start", label: "Session Key", mobileLabel: "Key", hint: "Signless identity", icon: <KeyRound className="w-4 h-4" /> },
  { step: "02", href: "/game/forge", label: "Forge & Altar", mobileLabel: "Forge", hint: "Gather & craft", icon: <Hammer className="w-4 h-4" /> },
  { step: "03", href: "/game/merchant", label: "Merchant", mobileLabel: "Market", hint: "Bazaar & bonding", icon: <Store className="w-4 h-4" /> },
  { step: "04", href: "/game/raid", label: "Boss Raid", mobileLabel: "Raid", hint: "3-floor tower", icon: <Swords className="w-4 h-4" /> },
  { step: "05", href: "/game/vault", label: "Backing Vault", mobileLabel: "Vault", hint: "Ledger & NFTs", icon: <Vault className="w-4 h-4" /> },
  { step: "06", href: "/game/ai", label: "Boss Brain", mobileLabel: "Oracle", hint: "TEE meta oracle", icon: <BrainCircuit className="w-4 h-4" /> },
];

interface RecentTx {
  method: string;
  txHash: string;
}

/**
 * Game shell: obsidian sticky header (brand, last tx receipt, ledger balance,
 * epoch, account, logout) + desktop rail & solid mobile tab bar (>=44px targets).
 */
export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSessionAccount();
  const { paused, togglePaused } = useMotionControl();
  const reduced = useReducedMotion();

  const { data: balance } = useContractView(
    async () => (session ? get_balance(session.accountId) : null),
    [session?.accountId]
  );
  const { data: meta } = useContractView(get_meta, []);

  const [lastTx, setLastTx] = useState<RecentTx | null>(null);
  useEffect(() => {
    const onTx = (ev: Event) => {
      const detail = (ev as CustomEvent<{ method: string; txHash: string }>).detail;
      if (detail?.txHash) {
        setLastTx({ method: detail.method, txHash: detail.txHash });
      }
    };
    window.addEventListener("spire:tx", onTx);
    return () => window.removeEventListener("spire:tx", onTx);
  }, []);

  // Ambient canvas follows the active page element tint.
  const [element, setElement] = useState<ElementalTheme>("solar");
  useEffect(() => {
    const map: Record<string, ElementalTheme> = {
      "/game/start": "solar",
      "/game/raid": "void",
      "/game/forge": "solar",
      "/game/merchant": "solar",
      "/game/vault": "frost",
      "/game/ai": "frost",
    };
    const next = Object.keys(map)
      .filter((k) => pathname?.startsWith(k))
      .map((k) => map[k])[0];
    if (next) setElement(next);
  }, [pathname]);

  const handleLogout = () => {
    SessionManager.getInstance().clearSession();
    router.push("/");
  };

  const explorerUrl = getExplorerTxUrl(lastTx?.txHash);

  return (
    <div className="relative min-h-screen flex flex-col">
      <AtmosphericBackdrop element={element} intensity="workspace" />

      <header className="sticky top-0 z-40 w-full border-b border-brass/15 bg-[#06070C]/90 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto w-full flex items-stretch">
          <div className="md:w-60 shrink-0 px-4 py-2 md:border-r md:border-brass/15 flex items-center">
            <Link
              href="/"
              className="min-h-[44px] md:px-3 flex items-center gap-2.5 group shrink-0"
              aria-label="SpireFi home"
            >
              <div className="w-8 h-8 rounded-lg border border-solar/45 bg-panel-card flex items-center justify-center text-solar group-hover:border-solar transition-colors">
                <Shield className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="font-serif text-base font-bold tracking-widest text-parchment group-hover:text-solar transition-colors">
                SPIRE<span className="text-solar">FI</span>
              </span>
            </Link>
          </div>

          <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-2 flex items-center">
            <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex items-center gap-3 font-mono text-xs text-ash">
                  <span>
                    Epoch{" "}
                    <span className="font-mono-numbers text-frost font-bold">
                      {meta ? meta.epoch : "..."}
                    </span>
                  </span>
                  <span className="text-white/20" aria-hidden="true">/</span>
                  <span>
                    Ledger{" "}
                    <span className="font-mono-numbers font-bold text-jackpot">
                      {session ? formatNearAmount(balance ?? "0") : "0.00 NEAR"}
                    </span>
                  </span>
                </div>

                {lastTx && explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-jackpot/30 bg-jackpot/10 text-jackpot text-xs font-mono hover:bg-jackpot/20 transition-colors"
                    title={`View ${lastTx.method} on NearBlocks testnet`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-jackpot" />
                    <span className="truncate max-w-[140px]">
                      {lastTx.method}: {lastTx.txHash.slice(0, 8)}...
                    </span>
                    <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={togglePaused}
                  aria-pressed={paused}
                  aria-label={paused ? "Resume 3D and background animations" : "Pause 3D and background animations"}
                  title={paused ? "Resume animations" : "Pause animations"}
                  className="min-h-[44px] min-w-[44px] px-2.5 rounded-lg text-pewter hover:text-parchment hover:bg-white/[0.04] inline-flex items-center justify-center gap-1.5 text-xs font-mono transition-colors"
                >
                  {paused ? <Play className="w-3.5 h-3.5 text-solar" /> : <Pause className="w-3.5 h-3.5 text-frost" />}
                  <span className="hidden lg:inline">{paused ? "Resume FX" : "Pause FX"}</span>
                </button>

                <span className="hidden sm:block h-4 w-px bg-white/10" aria-hidden="true" />

                {session ? (
                  <Link
                    href="/game/start"
                    className="hidden lg:inline-flex items-center gap-2 min-h-[40px] px-3 py-1 rounded-lg border border-white/10 bg-panel-card/80 hover:border-brass/40 max-w-[260px] text-xs font-mono text-parchment transition-colors"
                    title={`${session.accountId} — Manage session key`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-jackpot shrink-0" aria-hidden="true" />
                    <span className="truncate">{session.accountId}</span>
                  </Link>
                ) : (
                  <Link
                    href="/game/start"
                    className="rpg-sheen min-h-[44px] px-3 rounded-lg border border-solar/40 bg-solar/15 hover:bg-solar/25 text-amber-200 text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                    Connect
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={!session}
                  className="min-h-[44px] px-2.5 rounded-lg border border-transparent hover:border-hp/35 hover:bg-hp/15 text-ash hover:text-hp text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 max-w-[1400px] mx-auto w-full flex items-stretch">
        <nav
          className="hidden md:flex flex-col justify-between py-6 px-4 border-r border-brass/15 w-60 flex-shrink-0"
          aria-label="Game navigation"
        >
          <div className="space-y-1.5">
            <div className="px-3 pb-2 text-xs font-mono font-semibold uppercase tracking-widest text-pewter">
              Citadel Flow
            </div>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative min-h-[48px] px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors border ${
                    isActive
                      ? "text-parchment border-solar/45"
                      : "text-ash hover:text-parchment hover:bg-panel-elevated/60 border-transparent"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="gameNavActive"
                      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 28 }}
                      className="absolute inset-0 rounded-lg bg-panel-elevated/95 -z-10"
                    />
                  )}
                  <span className={`font-mono font-mono-numbers text-xs font-bold w-5 shrink-0 ${isActive ? "text-solar" : "text-pewter"}`}>
                    {item.step}
                  </span>
                  <span className={`shrink-0 ${isActive ? "text-solar" : "text-pewter"}`}>{item.icon}</span>
                  <span className="flex flex-col leading-tight min-w-0">
                    <span className="text-xs font-semibold truncate">{item.label}</span>
                    <span className="text-xs text-pewter truncate">{item.hint}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-brass/15 px-3 text-xs">
            <div className="flex items-center gap-2 font-mono text-xs text-parchment font-semibold">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${session ? "bg-jackpot" : "bg-pewter"}`}
                aria-hidden="true"
              />
              <span>{session ? "Signless Key Active" : "Session Required"}</span>
            </div>
            <p className="text-xs text-pewter mt-1 leading-relaxed">
              {session ? "NEAR Testnet local keypair verified." : "Provision an access key on step 01."}
            </p>
          </div>
        </nav>

        {/* Solid Mobile tab bar (non-blurred so top header stays the sole glass surface) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-panel-dark border-t border-brass/25">
          <nav className="grid grid-cols-6 items-stretch" aria-label="Game navigation mobile">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`min-h-[52px] py-2 px-1 flex flex-col items-center justify-center gap-1 font-mono text-xs font-semibold tracking-wide transition-colors border-t-2 ${
                    isActive
                      ? "text-solar border-solar bg-panel-card/80"
                      : "text-ash border-transparent hover:text-parchment"
                  }`}
                >
                  {item.icon}
                  <span className="truncate max-w-full">{item.mobileLabel}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Unified Workspace Frame (consistent 16px/24px/32px horizontal & vertical gutters) */}
        <main className="relative flex-1 min-w-0 px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:py-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={reduced ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full max-w-[1200px] mx-auto w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
