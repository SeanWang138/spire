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
} from "lucide-react";
import { VolumetricCanvas, ElementalTheme } from "@/components/canvas/VolumetricCanvas";
import { useSessionAccount, useContractView } from "@/lib/spire/hooks";
import { get_balance, get_meta } from "@/lib/contract";
import { formatNearAmount, getExplorerTxUrl } from "@/lib/utils/cn";
import { SessionManager } from "@/lib/near";

const NAV_ITEMS = [
  { href: "/game/raid", label: "Raid", hint: "Boss tower", icon: <Swords className="w-4 h-4" /> },
  { href: "/game/forge", label: "Forge", hint: "Gather & craft", icon: <Hammer className="w-4 h-4" /> },
  { href: "/game/merchant", label: "Merchant", hint: "Market & sim", icon: <Store className="w-4 h-4" /> },
  { href: "/game/vault", label: "Vault", hint: "Ledger & NFTs", icon: <Vault className="w-4 h-4" /> },
  { href: "/game/ai", label: "Boss Brain", hint: "TEE oracle", icon: <BrainCircuit className="w-4 h-4" /> },
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
      <VolumetricCanvas element={element} className="opacity-55" />

      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-oled/90 backdrop-blur-md px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="min-h-[44px] flex items-center gap-2.5 group shrink-0"
              aria-label="SpireFi home"
            >
              <div className="w-8 h-8 rounded border border-white/20 bg-panel-card flex items-center justify-center text-solar group-hover:border-solar/60 transition-colors">
                <Shield className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="font-serif text-base font-bold tracking-widest text-slate-100 group-hover:text-solar transition-colors">
                SPIRE<span className="text-solar">Fi</span>
              </span>
            </Link>

            {lastTx && explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-jackpot/30 bg-jackpot/10 text-jackpot text-[11px] font-mono hover:bg-jackpot/20 transition-colors"
                title={`View ${lastTx.method} on NearBlocks testnet`}
              >
                <span className="truncate max-w-[140px]">
                  {lastTx.method}: {lastTx.txHash.slice(0, 8)}...
                </span>
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Ledger balance */}
            <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-slate-300">
              <span className="text-slate-400">Ledger</span>
              <span className={`font-mono-numbers font-bold ${session ? "text-jackpot" : "text-slate-400"}`}>
                {session ? formatNearAmount(balance ?? "0") : "0.00 NEAR"}
              </span>
            </div>

            {/* Epoch */}
            <div className="hidden md:flex items-center font-mono text-xs text-slate-300">
              <span className="px-2.5 py-1 rounded border border-white/10 bg-white/5">
                Epoch{" "}
                <span className="font-mono-numbers text-frost font-bold">
                  {meta ? meta.epoch : "..."}
                </span>
              </span>
            </div>

            {/* Account or Signless Setup */}
            {session ? (
              <span
                className="hidden lg:inline-flex items-center px-2.5 py-1 rounded border border-white/10 bg-white/5 max-w-[175px] truncate text-xs font-mono text-slate-300"
                title={session.accountId}
              >
                {session.accountId}
              </span>
            ) : (
              <Link
                href="/game/start"
                className="min-h-[44px] px-3 rounded-lg border border-solar/40 bg-solar/15 hover:bg-solar/25 text-solar text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                Connect
              </Link>
            )}

            <button
              type="button"
              onClick={handleLogout}
              disabled={!session}
              className="min-h-[44px] px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-hp/20 hover:text-hp hover:border-hp/40 text-slate-200 text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 max-w-7xl mx-auto w-full flex items-stretch px-3 sm:px-4">
        {/* Desktop Sidebar navigation */}
        <nav
          className="hidden md:flex flex-col gap-1.5 py-6 pr-4 border-r border-white/10 w-44 flex-shrink-0"
          aria-label="Game navigation"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`min-h-[44px] px-3 py-2 rounded-lg font-mono flex items-center gap-2.5 transition-colors border ${
                  isActive
                    ? "bg-panel-card text-solar border-solar/40"
                    : "text-slate-300 hover:text-white hover:bg-white/[0.03] border-transparent"
                }`}
              >
                {item.icon}
                <span className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
                  <span className="text-[11px] text-slate-400 font-sans normal-case">{item.hint}</span>
                </span>
              </Link>
            );
          })}

          <div className="mt-auto pt-4 border-t border-white/10">
            <Link
              href="/game/start"
              aria-current={pathname === "/game/start" ? "page" : undefined}
              className={`min-h-[44px] px-3 py-2 rounded-lg font-mono text-xs flex items-center gap-2 border transition-colors ${
                pathname === "/game/start"
                  ? "bg-panel-card text-frost border-frost/40"
                  : "text-slate-300 hover:text-white border-transparent hover:bg-white/[0.03]"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Session Key</span>
            </Link>
          </div>
        </nav>

        {/* Solid Mobile tab bar (non-blurred so top header stays the sole glass surface) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-panel-dark border-t border-white/15">
          <nav className="flex items-stretch" aria-label="Game navigation mobile">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex-1 min-h-[52px] py-2 flex flex-col items-center justify-center gap-1 font-mono text-[11px] font-semibold tracking-wide transition-colors border-t-2 ${
                    isActive
                      ? "text-solar border-solar bg-panel-card/60"
                      : "text-slate-300 border-transparent hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Tab content with AnimatePresence fade + small slide */}
        <main className="relative flex-1 min-w-0 pb-20 md:pb-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={reduced ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
