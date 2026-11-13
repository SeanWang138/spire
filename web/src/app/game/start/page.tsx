"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Swords,
  Hourglass,
  ShieldCheck,
  KeyRound,
  ChevronRight,
  Hammer,
  Vault,
  CheckCircle2,
} from "lucide-react";
import { SessionManager, SessionData } from "@/lib/near";
import { provision_account, account_exists } from "@/lib/contract";
import { useSessionAccount } from "@/lib/spire/hooks";

const ACCOUNT_NAME_RE = /^[a-z0-9._-]{2,32}$/;

// Procedural guild filigree crest
export function SpireCrest({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" className="text-slate-500" />
      <circle cx="100" cy="100" r="76" stroke="currentColor" strokeWidth="1.5" className="text-slate-400" />
      <path
        d="M 50 140 C 35 100, 30 60, 60 30 C 80 50, 75 80, 100 100 C 125 80, 120 50, 140 30 C 170 60, 165 100, 150 140 Z"
        stroke="currentColor" strokeWidth="2" fill="rgba(15, 20, 36, 0.7)" className="text-slate-200"
      />
      <path d="M 100 18 L 108 85 L 104 175 L 100 185 L 96 175 L 92 85 Z" fill="currentColor" className="text-slate-100" />
      <line x1="100" y1="22" x2="100" y2="180" stroke="#080B11" strokeWidth="1.5" />
      <path d="M 45 80 C 65 85, 85 95, 100 115 C 115 95, 135 85, 155 80" stroke="currentColor" strokeWidth="1.5" className="text-slate-400" />
      <path d="M 40 105 C 65 108, 85 118, 100 135 C 115 118, 135 108, 160 105" stroke="currentColor" strokeWidth="1.2" className="text-slate-500" />
      <polygon points="100,82 110,95 100,108 90,95" fill="#F59E0B" />
      <path d="M 70 160 L 100 178 L 130 160" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-slate-300" />
    </svg>
  );
}

const ONBOARDING_STEPS = [
  {
    step: "01",
    title: "Claim Free Starter Arsenal",
    desc: "Receive 4x Solar, 1x Frost weapons plus Ore and Essence in the Forge without spending NEAR.",
    href: "/game/forge",
  },
  {
    step: "02",
    title: "Seed Your Internal Ledger",
    desc: "Deposit NEAR once in the Vault, or back a floor's liquidity pool to earn ticket dividends.",
    href: "/game/vault",
  },
  {
    step: "03",
    title: "Read Resistance & Strike",
    desc: "Check live Meta Radar resistance before attacking Floor 1 to avoid Tribute weapon confiscation.",
    href: "/game/raid",
  },
];

export default function StartPage() {
  const reduced = useReducedMotion();
  const session = useSessionAccount();
  const [nameInput, setNameInput] = useState("");
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [submittedSession, setSubmittedSession] = useState<SessionData | null>(null);
  const [provisionNote, setProvisionNote] = useState<string | null>(null);

  const cleanName = nameInput.trim();
  const nameValid = ACCOUNT_NAME_RE.test(cleanName);
  const fullAccountId = useMemo(() => `${cleanName}.spire.testnet`, [cleanName]);
  const activeSession = session ?? submittedSession;

  // Poll NEAR RPC every 5s while session is pending relayer provisioning
  useEffect(() => {
    if (!activeSession || activeSession.provision === "confirmed") return;
    const accountId = activeSession.accountId;
    let attempts = 0;
    const id = setInterval(async () => {
      attempts += 1;
      if (attempts > 36) {
        clearInterval(id);
        return;
      }
      try {
        if (await account_exists(accountId)) {
          SessionManager.getInstance().markProvisioned(accountId);
          clearInterval(id);
        }
      } catch {
        // Retry next interval if testnet RPC glitches
      }
    }, 5000);
    return () => clearInterval(id);
  }, [activeSession?.accountId, activeSession?.provision]);

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameValid || isProvisioning) return;
    setIsProvisioning(true);
    setProvisionNote(null);
    const mgr = SessionManager.getInstance();
    const next = mgr.createSession(fullAccountId);

    try {
      await provision_account(next.accountId, next.publicKey);
      mgr.markProvisioned(next.accountId);
      setProvisionNote("Account provisioned on NEAR testnet with Function Call Access Key.");
    } catch {
      mgr.saveDraft(next);
      setProvisionNote(
        "Relayer unreachable right now. Local Function Call Keypair is saved and polling for provisioning."
      );
    }
    setSubmittedSession(next);
    setIsProvisioning(false);
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-12">
      {/* Guild crest & title */}
      <div className="flex flex-col items-center max-w-2xl w-full text-center mb-8">
        <div className="relative w-28 h-28 mb-4 flex items-center justify-center text-slate-300">
          <SpireCrest className="w-full h-full" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-serif tracking-[0.14em] font-bold text-white mb-2">
          SPIRE<span className="text-solar">Fi</span>
        </h1>
        <p className="text-sm font-mono text-slate-300 max-w-lg">
          Provision a signless NEAR testnet session key for instant raid strikes, crafting, and market swaps.
        </p>
      </div>

      {/* Main 2-column briefing + session desk */}
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="lg:col-span-6 rounded-xl bg-panel-dark border border-white/10 elevation-panel p-6"
        >
          {!activeSession ? (
            <form onSubmit={handleEnter} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="spire-account-input"
                  className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 block mb-1.5"
                >
                  Choose Citadel Account Name
                </label>
                <div className="flex items-center rounded-lg bg-oled border border-white/15 overflow-hidden focus-within:border-frost transition-colors">
                  <input
                    id="spire-account-input"
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value.toLowerCase())}
                    placeholder="shadowknight"
                    minLength={2}
                    maxLength={32}
                    autoComplete="username"
                    aria-describedby="account-format-hint"
                    className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none min-w-0"
                  />
                  <span className="px-3 py-3 text-xs font-mono text-slate-300 bg-panel-card border-l border-white/10 shrink-0">
                    .spire.testnet
                  </span>
                </div>
                <p
                  id="account-format-hint"
                  className={`mt-1.5 text-xs font-mono ${
                    cleanName.length > 0 && !nameValid ? "text-hp font-semibold" : "text-slate-400"
                  }`}
                >
                  2 to 32 characters using lowercase letters, digits, dots, underscores, or hyphens.
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 text-xs font-mono text-slate-300 space-y-2">
                <div className="flex items-center gap-2 text-frost font-semibold">
                  <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Browser Function Call Access Key</span>
                </div>
                <p className="text-slate-300 leading-relaxed font-sans text-xs">
                  Generates an Ed25519 keypair in localStorage scoped strictly to gameplay methods on{" "}
                  <code className="font-mono text-slate-100">spire.testnet</code> (1.0 NEAR gas allowance). No wallet extension popups during raids or bazaar trades.
                </p>
              </div>

              <button
                type="submit"
                disabled={!nameValid || isProvisioning}
                className="min-h-[44px] w-full py-3 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{isProvisioning ? "Provisioning Session..." : "Create Signless Session"}</span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs font-mono border-b border-white/10 pb-3">
                <span className="text-slate-400">Active Identity</span>
                <span className="text-white font-bold">{activeSession.accountId}</span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Relayer Status</span>
                {activeSession.provision === "confirmed" ? (
                  <span className="text-jackpot font-bold inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Confirmed on Testnet
                  </span>
                ) : (
                  <span className="text-frost font-bold inline-flex items-center gap-1.5">
                    <Hourglass className="w-4 h-4" aria-hidden="true" /> Awaiting Relayer Confirmation
                  </span>
                )}
              </div>

              <p
                role="status"
                aria-live="polite"
                className="text-xs font-mono text-slate-300 leading-relaxed"
              >
                {provisionNote ??
                  (activeSession.provision === "confirmed"
                    ? "Function Call Access Key is live in localStorage. You can sign raid strikes and trades directly."
                    : "Keypair saved locally in browser storage. Background polling checks every 5s for relayer account creation.")}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <Link
                  href="/game/forge"
                  className="min-h-[44px] py-2.5 px-4 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  <Hammer className="w-4 h-4" aria-hidden="true" />
                  1. Starter Forge
                </Link>
                <Link
                  href="/game/raid"
                  className="min-h-[44px] py-2.5 px-4 rounded-lg border border-frost/40 bg-frost/10 hover:bg-frost/20 text-frost font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  <Swords className="w-4 h-4" aria-hidden="true" />
                  Enter Raid Arena
                </Link>
              </div>

              <button
                type="button"
                onClick={() => {
                  SessionManager.getInstance().clearSession();
                  setSubmittedSession(null);
                  setProvisionNote(null);
                  setNameInput("");
                }}
                className="min-h-[44px] text-xs font-mono text-slate-400 hover:text-hp transition-colors underline underline-offset-4 self-start"
              >
                Revoke key &amp; switch account
              </button>
            </div>
          )}
        </motion.div>

        {/* Right column: Game Loop Checklist */}
        <div className="lg:col-span-6 rounded-xl bg-panel-card border border-white/10 elevation-panel p-6">
          <h2 className="font-serif text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Vault className="w-4 h-4 text-solar" aria-hidden="true" />
            First-Run Protocol Checklist
          </h2>
          <ol className="divide-y divide-white/10">
            {ONBOARDING_STEPS.map((item) => (
              <li key={item.step} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-solar shrink-0 mt-0.5">{item.step}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.desc}</p>
                  <Link
                    href={item.href}
                    className="inline-block mt-1.5 text-xs font-mono text-frost hover:underline"
                  >
                    Open {item.href.replace("/game/", "")} &rarr;
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="mt-10 text-center text-xs font-mono text-slate-400">
        NEAR Protocol Testnet // NEP-245 Multi-Token &amp; Signless Combat
      </div>
    </div>
  );
}
