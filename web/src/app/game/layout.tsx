"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Swords, Hammer, Store, Vault, BrainCircuit, Shield } from "lucide-react";
import { VolumetricCanvas, ElementalTheme } from "@/components/canvas/VolumetricCanvas";
import { useSessionAccount, useContractView } from "@/lib/spire/hooks";
import { get_balance, get_meta } from "@/lib/contract";
import { formatNearAmount } from "@/lib/utils/cn";
import { SessionManager } from "@/lib/near";

const NAV_ITEMS = [
  { href: "/game/raid", label: "Raid", icon: <Swords className="w-3.5 h-3.5" /> },
  { href: "/game/forge", label: "Forge", icon: <Hammer className="w-3.5 h-3.5" /> },
  { href: "/game/merchant", label: "Merchant", icon: <Store className="w-3.5 h-3.5" /> },
  { href: "/game/vault", label: "Vault", icon: <Vault className="w-3.5 h-3.5" /> },
  { href: "/game/ai", label: "Boss Brain", icon: <BrainCircuit className="w-3.5 h-3.5" /> },
];

/**
 * Game shell: header (logo, ledger balance, epoch, logout) + sidebar navigation
 * (Forge / Merchant / Raid / Vault / Boss Brain). Tab switches animate with a
 * small fade + slide through AnimatePresence — nothing flashy.
 */
export default function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSessionAccount();

  const { data: balance } = useContractView(
    async () => (session ? get_balance(session.accountId) : null),
    [session?.accountId]
  );
  const { data: meta } = useContractView(get_meta, []);

  // Ambient canvas follows the active page's element tint.
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

  return (
    <div className="relative min-h-screen flex flex-col">
      <VolumetricCanvas element={element} className="opacity-60" />

      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-oled/90 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/game/start"
            className="flex items-center gap-2 group focus:outline-none"
            aria-label="SpireFi title screen"
          >
            <div className="w-7 h-7 rounded border border-white/20 bg-panel-card flex items-center justify-center text-solar group-hover:border-solar/60 transition-colors">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-mono text-sm font-black tracking-widest text-slate-100 group-hover:text-solar transition-colors">
              SPIREFi
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Ledger balance */}
            <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-slate-400">
              <span className={`font-mono-numbers font-bold ${session ? "text-jackpot" : "text-slate-500"}`}>
                {session ? formatNearAmount(balance ?? "0") : "—"}
              </span>
            </div>
            {/* Epoch */}
            <div className="hidden md:flex items-center font-mono text-[11px] text-slate-400">
              <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5">
                epoch{" "}
                <span className="font-mono-numbers text-frost font-bold">
                  {meta ? meta.epoch : "—"}
                </span>
              </span>
            </div>
            {/* Account + logout */}
            <span className="hidden lg:inline px-2 py-0.5 rounded border border-white/10 bg-white/5 max-w-[160px] truncate text-[11px] font-mono text-slate-400">
              {session ? session.accountId : "no session"}
            </span>
            <button
              onClick={handleLogout}
              disabled={!session}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-hp/20 hover:text-hp text-slate-300 text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 max-w-7xl mx-auto w-full flex items-stretch px-2 sm:px-4">
        {/* Sidebar navigation */}
        <nav
          className="hidden md:flex flex-col gap-1 py-6 pr-4 border-r border-white/5 w-40 flex-shrink-0"
          aria-label="Game navigation"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 transition-all ${
                  isActive
                    ? "bg-panel-card text-solar border border-solar/40"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile tab bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-oled/95 backdrop-blur-md border-t border-white/10">
          <nav className="flex items-stretch" aria-label="Game navigation mobile">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider transition-colors ${
                    isActive ? "text-solar" : "text-slate-500"
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
        <main className="relative flex-1 min-w-0 pb-16 md:pb-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
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
