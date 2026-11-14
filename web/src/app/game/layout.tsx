"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LogOut,
  Swords,
  Hammer,
  Vault,
  BrainCircuit,
  Shield,
  ExternalLink,
  KeyRound,
  Pause,
  Play,
  User,
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronRight,
  ShieldCheck,
  Hourglass,
} from "lucide-react";
import { AtmosphericBackdrop, type ElementalTheme } from "@/components/background/AtmosphericBackdrop";
import { useMotionControl } from "@/lib/spire/motion";
import { useSessionAccount, useContractView } from "@/lib/spire/hooks";
import { get_balance, get_meta } from "@/lib/contract";
import { formatNearAmount, getExplorerTxUrl } from "@/lib/utils/cn";
import { SessionManager } from "@/lib/near";

const NAV_ITEMS = [
  {
    step: "1.",
    href: "/game/forge",
    label: "Town & Forge",
    mobileLabel: "Forge",
    hint: "Craft, gather & bazaar",
    icon: <Hammer className="w-4 h-4 shrink-0" aria-hidden="true" />,
    matches: ["/game/forge", "/game/merchant"],
  },
  {
    step: "2.",
    href: "/game/raid",
    label: "Spire Raid",
    mobileLabel: "Raid",
    hint: "3-floor boss arena",
    icon: <Swords className="w-4 h-4 shrink-0" aria-hidden="true" />,
    matches: ["/game/raid"],
  },
  {
    step: "3.",
    href: "/game/vault",
    label: "Vault & Trophies",
    mobileLabel: "Vault",
    hint: "Payouts, backers & NFTs",
    icon: <Vault className="w-4 h-4 shrink-0" aria-hidden="true" />,
    matches: ["/game/vault"],
  },
  {
    step: "4.",
    href: "/game/ai",
    label: "Proof & Lab",
    mobileLabel: "Lab",
    hint: "AI oracle & time-warp",
    icon: <BrainCircuit className="w-4 h-4 shrink-0" aria-hidden="true" />,
    matches: ["/game/ai"],
  },
];

interface RecentTx {
  method: string;
  txHash: string;
}

/**
 * Game shell: obsidian sticky header (brand, epoch/ledger telemetry,
 * adventurer account chip opening the Account & Recovery Drawer, accessible logout)
 * + 4-Hub sidebar rail & mobile bottom tab bar (>=48px touch targets).
 */
export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSessionAccount();
  const { paused, togglePaused } = useMotionControl();
  const reduced = useReducedMotion();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showDrawerKey, setShowDrawerKey] = useState(false);
  const [copiedDrawerKey, setCopiedDrawerKey] = useState(false);

  const { data: balance, reload: reloadBalance } = useContractView(
    async () => (session ? get_balance(session.accountId) : null),
    [session?.accountId]
  );
  const { data: meta, reload: reloadMeta } = useContractView(get_meta, []);

  const [lastTx, setLastTx] = useState<RecentTx | null>(null);
  useEffect(() => {
    const onTx = (ev: Event) => {
      const detail = (ev as CustomEvent<{ method: string; txHash: string }>).detail;
      if (detail?.txHash) {
        setLastTx({ method: detail.method, txHash: detail.txHash });
      }
      reloadBalance();
      reloadMeta();
    };
    window.addEventListener("spire:tx", onTx);
    return () => window.removeEventListener("spire:tx", onTx);
  }, [reloadBalance, reloadMeta]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
    setShowDrawerKey(false);
  }, [pathname]);

  // Escape closes Account & Recovery Drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  // Ambient canvas follows active hub element tint.
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

  const handleLogout = useCallback(() => {
    SessionManager.getInstance().clearSession();
    setDrawerOpen(false);
    router.push("/");
  }, [router]);

  const handleCopyDrawerKey = async () => {
    if (!session?.secretKey) return;
    try {
      await navigator.clipboard.writeText(session.secretKey);
      setCopiedDrawerKey(true);
      setTimeout(() => setCopiedDrawerKey(false), 2500);
    } catch {
      // Clipboard blocked in restricted contexts
    }
  };

  const explorerUrl = getExplorerTxUrl(lastTx?.txHash);

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden">
      <AtmosphericBackdrop element={element} intensity="workspace" />

      <header className="sticky top-0 z-40 w-full border-b border-brass/15 bg-oled/90 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto w-full flex items-stretch">
          <div className="md:w-64 shrink-0 px-2.5 sm:px-4 py-2 md:border-r md:border-brass/15 flex items-center">
            <Link
              href="/"
              className="min-h-[44px] md:px-2 flex items-center gap-2 group shrink-0 whitespace-nowrap rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
              aria-label="SpireFi home"
            >
              <div className="w-8 h-8 rounded-lg border border-solar/45 bg-panel-card flex items-center justify-center text-solar group-hover:border-solar transition-colors shrink-0">
                <Shield className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="font-serif text-sm sm:text-base font-bold tracking-widest text-parchment group-hover:text-solar transition-colors">
                SPIRE<span className="text-solar">FI</span>
              </span>
            </Link>
          </div>

          <div className="flex-1 min-w-0 px-2.5 sm:px-6 lg:px-8 py-2 flex items-center">
            <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between gap-2 sm:gap-4 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex items-center gap-3 font-mono text-xs text-ash whitespace-nowrap">
                  <span>
                    Epoch{" "}
                    <span className="font-mono-numbers text-frost font-bold">
                      {meta ? meta.epoch : "..."}
                    </span>
                  </span>
                  <span className="text-pewter" aria-hidden="true">/</span>
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
                    className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-jackpot/30 bg-jackpot/10 text-jackpot text-xs font-mono hover:bg-jackpot/20 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                    title={`View ${lastTx.method} on NearBlocks testnet`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-jackpot shrink-0" aria-hidden="true" />
                    <span className="truncate max-w-[140px]">
                      {lastTx.method}: {lastTx.txHash.slice(0, 8)}...
                    </span>
                    <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={togglePaused}
                  aria-pressed={paused}
                  aria-label={paused ? "Resume 3D and background animations" : "Pause 3D and background animations"}
                  title={paused ? "Resume animations" : "Pause animations"}
                  className="min-h-[44px] min-w-[44px] px-2.5 rounded-lg text-ash hover:text-parchment hover:bg-panel-elevated/80 inline-flex items-center justify-center gap-1.5 text-xs font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                >
                  {paused ? (
                    <Play className="w-3.5 h-3.5 text-solar shrink-0" aria-hidden="true" />
                  ) : (
                    <Pause className="w-3.5 h-3.5 text-frost shrink-0" aria-hidden="true" />
                  )}
                  <span className="hidden lg:inline">{paused ? "Resume FX" : "Pause FX"}</span>
                </button>

                <span className="hidden sm:block h-4 w-px bg-brass/20" aria-hidden="true" />

                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-expanded={drawerOpen}
                  aria-controls="account-recovery-drawer"
                  aria-label={session ? `Adventurer account ${session.accountId}` : "Open guest access and recovery"}
                  className="min-h-[44px] px-2.5 sm:px-3 py-1.5 rounded-lg border border-brass/25 bg-panel-card hover:border-solar/50 hover:bg-panel-elevated text-xs font-mono text-parchment inline-flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap max-w-[132px] sm:max-w-[230px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                >
                  {session ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-jackpot shrink-0" aria-hidden="true" />
                      <span className="truncate">{session.accountId}</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5 text-solar shrink-0" aria-hidden="true" />
                      <span className="truncate text-solar font-semibold">1-Click Play</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={!session}
                  aria-label="Log out"
                  title="Log out and clear browser session"
                  className="hidden sm:inline-flex min-h-[44px] min-w-[44px] px-2.5 rounded-lg border border-transparent hover:border-hp/35 hover:bg-hp/15 text-ash hover:text-hp-text text-xs font-mono font-semibold items-center justify-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 max-w-[1440px] mx-auto w-full flex items-stretch">
        <nav
          className="hidden md:flex flex-col justify-between py-6 px-4 border-r border-brass/15 w-64 shrink-0"
          aria-label="Game hubs navigation"
        >
          <div className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const isActive = item.matches.some((m) => pathname?.startsWith(m));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative min-h-[48px] px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
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
                  <span className={`font-mono font-mono-numbers text-xs font-bold shrink-0 ${isActive ? "text-solar" : "text-pewter"}`}>
                    {item.step}
                  </span>
                  <span className={`shrink-0 ${isActive ? "text-solar" : "text-pewter"}`}>{item.icon}</span>
                  <span className="flex flex-col leading-tight min-w-0">
                    <span className="text-xs font-semibold whitespace-nowrap truncate">{item.label}</span>
                    <span className="text-xs text-pewter truncate">{item.hint}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-brass/15 space-y-3">
            <div className="px-1">
              <div className="flex items-center gap-2 font-mono text-xs text-parchment font-semibold">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${session ? "bg-jackpot" : "bg-pewter"}`}
                  aria-hidden="true"
                />
                <span>{session ? "Testnet Session Ready" : "Guest Access Open"}</span>
              </div>
              <p className="text-xs text-pewter mt-1 leading-relaxed">
                {session
                  ? "Ephemeral FullAccess subaccount stored locally."
                  : "Launch a 0.60 NEAR testnet subaccount in one click."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-brass/25 bg-panel-card hover:border-solar/45 hover:bg-panel-elevated text-xs font-mono text-parchment flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
            >
              <span className="inline-flex items-center gap-2 truncate">
                <User className="w-3.5 h-3.5 text-solar shrink-0" aria-hidden="true" />
                <span className="truncate">Account &amp; Recovery</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-pewter shrink-0" aria-hidden="true" />
            </button>
          </div>
        </nav>

        {/* Solid Mobile bottom tab bar (>=48px touch targets, gap-2) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-panel-dark border-t border-brass/25 px-2 py-1.5">
          <nav className="grid grid-cols-4 gap-2 items-stretch" aria-label="Game hubs mobile navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = item.matches.some((m) => pathname?.startsWith(m));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`min-h-[48px] py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-1 font-mono text-xs font-semibold tracking-wide whitespace-nowrap transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
                    isActive
                      ? "text-solar border-solar/45 bg-panel-card"
                      : "text-ash border-transparent hover:text-parchment hover:bg-panel-elevated/50"
                  }`}
                >
                  {item.icon}
                  <span className="truncate max-w-full">{item.mobileLabel}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Unified Workspace Main Landmark */}
        <main
          id="main-content"
          tabIndex={-1}
          className="relative flex-1 min-w-0 px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:py-8 focus:outline-none"
        >
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

      {/* Account & Recovery Drawer (solid panel-dark so header remains sole glass element) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-oled/75"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            id="account-recovery-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-drawer-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md h-full bg-panel-dark border-l border-brass/25 p-5 sm:p-6 flex flex-col justify-between gap-6 overflow-y-auto"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-brass/15">
                <h2 id="account-drawer-title" className="font-serif text-xl font-bold text-parchment">
                  Account &amp; Recovery
                </h2>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close account and recovery drawer"
                  className="min-h-[44px] min-w-[44px] rounded-lg bg-panel-card hover:bg-panel-elevated text-ash hover:text-parchment inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {session ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-panel-card space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs text-pewter block">Active Subaccount</span>
                        <span className="font-mono text-sm font-bold text-parchment break-all block mt-0.5">
                          {session.accountId}
                        </span>
                      </div>
                      {session.provision === "confirmed" ? (
                        <span className="px-2.5 py-1 rounded bg-jackpot/10 border border-jackpot/30 text-jackpot font-mono text-xs font-semibold inline-flex items-center gap-1.5 shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          Confirmed
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-frost/10 border border-frost/30 text-frost font-mono text-xs font-semibold inline-flex items-center gap-1.5 shrink-0">
                          <Hourglass className="w-3.5 h-3.5" aria-hidden="true" />
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="pt-3 border-t border-brass/15 flex items-center justify-between text-xs font-mono">
                      <span className="text-ash">Citadel Ledger</span>
                      <span className="font-mono-numbers font-bold text-jackpot">
                        {formatNearAmount(balance ?? "0", 4)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-panel-card space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-parchment inline-flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
                        Recovery Key
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDrawerKey((v) => !v)}
                          aria-label={showDrawerKey ? "Hide recovery key" : "Reveal recovery key"}
                          className="min-h-[44px] min-w-[44px] px-2.5 rounded-lg bg-panel-elevated hover:bg-panel-elevated/80 text-ash hover:text-parchment inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                        >
                          {showDrawerKey ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyDrawerKey}
                          className="min-h-[44px] px-3 rounded-lg bg-panel-elevated hover:bg-panel-elevated/80 text-xs font-mono text-parchment inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                        >
                          {copiedDrawerKey ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-jackpot" aria-hidden="true" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-ash break-all select-all">
                      {showDrawerKey
                        ? session.secretKey
                        : "ed25519:****************************************"}
                    </div>
                  </div>

                  <p className="text-xs text-ash leading-relaxed">
                    Ephemeral Testnet Session Subaccount: browser-held{" "}
                    <code className="font-mono text-parchment">FullAccess</code> Ed25519 keypair funded 0.60 NEAR via{" "}
                    <code className="font-mono text-parchment">/api/accounts</code> on NEAR testnet only.
                  </p>

                  <div className="flex flex-col gap-2 pt-1">
                    <Link
                      href="/game/start"
                      onClick={() => setDrawerOpen(false)}
                      className="min-h-[44px] px-4 py-2.5 rounded-lg bg-solar/15 hover:bg-solar/25 border border-solar/40 text-solar text-xs font-mono font-bold flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                    >
                      <span>Switch Account or Import Key</span>
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    <Link
                      href="/game/vault"
                      onClick={() => setDrawerOpen(false)}
                      className="min-h-[44px] px-4 py-2.5 rounded-lg bg-panel-card hover:bg-panel-elevated border border-brass/25 text-parchment text-xs font-mono font-semibold flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                    >
                      <span>Deposit or Withdraw in Vault</span>
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-ash leading-relaxed">
                    No Ephemeral Testnet Session Subaccount is active in this browser yet. Create one in 1 click (funded 0.60 NEAR on testnet) or import an existing Recovery Key.
                  </p>
                  <Link
                    href="/game/start"
                    onClick={() => setDrawerOpen(false)}
                    className="rpg-sheen min-h-[44px] w-full px-4 py-3 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                  >
                    <KeyRound className="w-4 h-4" aria-hidden="true" />
                    <span>Open 1-Click Start &amp; Recovery</span>
                  </Link>
                </div>
              )}
            </div>

            {session && (
              <div className="pt-4 border-t border-brass/15">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-[44px] w-full px-4 py-2.5 rounded-lg border border-hp/35 bg-hp/15 hover:bg-hp/25 text-hp-text text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span>Clear Local Session &amp; Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
