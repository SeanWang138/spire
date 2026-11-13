"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { KeyPair } from "near-api-js";
import {
  Swords,
  Hourglass,
  ShieldCheck,
  KeyRound,
  ChevronRight,
  Hammer,
  Vault,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
} from "lucide-react";
import { SessionManager, SessionData } from "@/lib/near";
import {
  provision_account,
  account_exists,
  verify_account_key,
} from "@/lib/contract";
import { useSessionAccount } from "@/lib/spire/hooks";

const ACCOUNT_NAME_RE = /^[a-z0-9._-]{2,64}$/;

// Procedural guild filigree crest
export function SpireCrest({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="100"
        cy="100"
        r="88"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="4 4"
        className="text-slate-500"
      />
      <circle
        cx="100"
        cy="100"
        r="76"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-slate-400"
      />
      <path
        d="M 50 140 C 35 100, 30 60, 60 30 C 80 50, 75 80, 100 100 C 125 80, 120 50, 140 30 C 170 60, 165 100, 150 140 Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="rgba(15, 20, 36, 0.75)"
        className="text-slate-200"
      />
      <path
        d="M 100 18 L 108 85 L 104 175 L 100 185 L 96 175 L 92 85 Z"
        fill="currentColor"
        className="text-slate-100"
      />
      <line x1="100" y1="22" x2="100" y2="180" stroke="#080B11" strokeWidth="1.5" />
      <path
        d="M 45 80 C 65 85, 85 95, 100 115 C 115 95, 135 85, 155 80"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-slate-400"
      />
      <path
        d="M 40 105 C 65 108, 85 118, 100 135 C 115 118, 135 108, 160 105"
        stroke="currentColor"
        strokeWidth="1.2"
        className="text-slate-500"
      />
      <polygon points="100,82 110,95 100,108 90,95" fill="#F59E0B" />
      <path
        d="M 70 160 L 100 178 L 130 160"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="text-slate-300"
      />
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
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [nameInput, setNameInput] = useState("");
  const [secretKeyInput, setSecretKeyInput] = useState("");
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [submittedSession, setSubmittedSession] = useState<SessionData | null>(null);
  const [provisionNote, setProvisionNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [showSecret, setShowSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const cleanName = nameInput.trim();
  const nameValid = ACCOUNT_NAME_RE.test(cleanName);
  const fullAccountId = useMemo(
    () => (cleanName.endsWith(".spire.testnet") ? cleanName : `${cleanName}.spire.testnet`),
    [cleanName]
  );
  const activeSession = session ?? submittedSession;

  // Live debounced account availability check for Sign Up mode
  useEffect(() => {
    if (activeSession || authMode !== "signup" || !nameValid) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const exists = await account_exists(fullAccountId);
        if (!cancelled) {
          setAvailability(exists ? "taken" : "available");
        }
      } catch {
        if (!cancelled) setAvailability("idle");
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSession, authMode, nameValid, fullAccountId]);

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
    setErrorMsg(null);
    setProvisionNote(null);
    setIsProvisioning(true);
    const mgr = SessionManager.getInstance();

    if (authMode === "login") {
      try {
        const trimmedSecret = secretKeyInput.trim();
        if (!trimmedSecret) {
          setErrorMsg("Please enter your Recovery Key (ed25519:...).");
          setIsProvisioning(false);
          return;
        }
        let derivedPub = "";
        try {
          const kp = KeyPair.fromString(
            trimmedSecret as Parameters<typeof KeyPair.fromString>[0]
          );
          derivedPub = kp.getPublicKey().toString();
        } catch {
          setErrorMsg("Invalid Recovery Key format. Expected ed25519:...");
          setIsProvisioning(false);
          return;
        }

        const isValid = await verify_account_key(fullAccountId, derivedPub);
        if (!isValid) {
          setErrorMsg(
            `Key does not match "${fullAccountId}" on-chain, or the account does not exist.`
          );
          setIsProvisioning(false);
          return;
        }

        const imported = mgr.importSession(fullAccountId, trimmedSecret);
        setSubmittedSession(imported);
        setProvisionNote("Recovery key verified against NEAR testnet and bound to this browser.");
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Login failed.");
      }
      setIsProvisioning(false);
      return;
    }

    // Sign Up (Create New Account)
    if (availability === "taken") {
      setErrorMsg(`"${fullAccountId}" is already registered. Switch to Login to import your key.`);
      setIsProvisioning(false);
      return;
    }

    const next = mgr.createSession(fullAccountId);
    try {
      await provision_account(next.accountId, next.publicKey);
      mgr.markProvisioned(next.accountId);
      setSubmittedSession(next);
      setProvisionNote("Account provisioned on NEAR testnet with Function Call Access Key.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("ACCOUNT_EXISTS") || msg.includes("already exists")) {
        mgr.clearSession();
        setSubmittedSession(null);
        setErrorMsg(`"${next.accountId}" is already taken on-chain. Switch to Login or pick a new name.`);
      } else {
        mgr.saveDraft(next);
        setSubmittedSession(next);
        setProvisionNote(
          "Relayer unreachable right now. Local Function Call Keypair is saved and polling for provisioning."
        );
      }
    }
    setIsProvisioning(false);
  };

  const handleCopyKey = async (secretKey: string) => {
    try {
      await navigator.clipboard.writeText(secretKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } catch {
      // Clipboard blocked in restricted browser contexts
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-10">
      {/* Guild crest & title */}
      <div className="flex flex-col items-center max-w-2xl w-full text-center mb-8">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 flex items-center justify-center text-slate-200">
          <SpireCrest className="w-full h-full" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-serif tracking-[0.12em] font-bold text-white mb-2">
          SPIRE<span className="text-solar">Fi</span>
        </h1>
        <p className="text-sm font-mono text-slate-300 max-w-lg leading-relaxed">
          Forge a signless NEAR testnet citadel identity for instant raid strikes, crafting, and market swaps.
        </p>
      </div>

      {/* Main 2-column Obsidian Initiation Gate + Quest Briefing */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="lg:col-span-6 citadel-stage p-5 sm:p-6"
        >
          {!activeSession ? (
            <form onSubmit={handleEnter} className="flex flex-col gap-4">
              {/* Mode Switcher: Sign Up vs Login (Key) */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-oled border border-white/10" role="tablist" aria-label="Session authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "signup"}
                  onClick={() => {
                    setAuthMode("signup");
                    setErrorMsg(null);
                  }}
                  className={`min-h-[44px] py-2 px-3 rounded-md text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    authMode === "signup"
                      ? "bg-solar text-oled"
                      : "text-slate-300 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>New Raider</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "login"}
                  onClick={() => {
                    setAuthMode("login");
                    setErrorMsg(null);
                  }}
                  className={`min-h-[44px] py-2 px-3 rounded-md text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    authMode === "login"
                      ? "bg-frost text-oled"
                      : "text-slate-300 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Recovery Key</span>
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="spire-account-input"
                    className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200"
                  >
                    Citadel Account Name
                  </label>
                  {authMode === "signup" && nameValid && availability !== "idle" && (
                    <span
                      className={`text-xs font-mono font-bold ${
                        availability === "available"
                          ? "text-jackpot"
                          : availability === "taken"
                          ? "text-hp"
                          : "text-slate-300"
                      }`}
                    >
                      {availability === "checking"
                        ? "Checking..."
                        : availability === "available"
                        ? "Available"
                        : "Already taken"}
                    </span>
                  )}
                </div>

                <div className="flex items-center rounded-lg bg-oled border border-white/15 overflow-hidden focus-within:border-frost transition-colors">
                  <input
                    id="spire-account-input"
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value.toLowerCase());
                      setErrorMsg(null);
                    }}
                    placeholder="shadowknight"
                    minLength={2}
                    maxLength={64}
                    autoComplete="username"
                    aria-describedby="account-format-hint"
                    className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none min-w-0"
                  />
                  <span className="px-3 py-3 text-xs font-mono text-slate-300 bg-panel-dark border-l border-white/10 shrink-0">
                    .spire.testnet
                  </span>
                </div>

                <p
                  id="account-format-hint"
                  className={`mt-1.5 text-xs font-mono ${
                    cleanName.length > 0 && !nameValid ? "text-hp font-semibold" : "text-slate-400"
                  }`}
                >
                  2 to 64 characters using lowercase letters, digits, dots, underscores, or hyphens.
                </p>

                {authMode === "signup" && availability === "taken" && (
                  <p className="mt-2 text-xs font-mono text-solar leading-relaxed">
                    This account already exists on-chain. Pick another name or{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        setErrorMsg(null);
                      }}
                      className="underline font-bold text-frost hover:text-white"
                    >
                      switch to Recovery Key login
                    </button>
                    .
                  </p>
                )}
              </div>

              {authMode === "login" && (
                <div>
                  <label
                    htmlFor="spire-recovery-key"
                    className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 block mb-1.5"
                  >
                    Recovery / Secret Key
                  </label>
                  <input
                    id="spire-recovery-key"
                    type="password"
                    value={secretKeyInput}
                    onChange={(e) => {
                      setSecretKeyInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="ed25519:..."
                    autoComplete="off"
                    className="w-full rounded-lg bg-oled border border-white/15 px-3 py-3 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-frost transition-colors"
                  />
                </div>
              )}

              {errorMsg && (
                <p
                  role="alert"
                  className="text-xs font-mono text-hp bg-hp/10 border border-hp/30 rounded-lg px-3 py-2.5 leading-relaxed"
                >
                  {errorMsg}
                </p>
              )}

              <div className="pt-3 border-t border-white/10 text-xs font-mono text-slate-300 space-y-1.5">
                <div className="flex items-center gap-2 text-frost font-semibold">
                  <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {authMode === "signup"
                      ? "Browser Function Call Access Key"
                      : "On-Chain Ed25519 Key Verification"}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed font-sans text-xs">
                  {authMode === "signup" ? (
                    <>
                      Generates an Ed25519 keypair in localStorage scoped strictly to gameplay methods on{" "}
                      <code className="font-mono text-slate-100">spire.testnet</code> (1.0 NEAR gas allowance). No wallet extension popups during raids or bazaar trades.
                    </>
                  ) : (
                    <>
                      Verifies your saved Recovery Key against NEAR Testnet{" "}
                      <code className="font-mono text-slate-100">view_access_key_list</code> before restoring your local raiding session.
                    </>
                  )}
                </p>
              </div>

              <button
                type="submit"
                disabled={
                  !nameValid ||
                  isProvisioning ||
                  (authMode === "signup" && availability === "taken") ||
                  (authMode === "login" && !secretKeyInput.trim())
                }
                className={`min-h-[44px] w-full py-3 rounded-lg font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  authMode === "signup"
                    ? "bg-solar hover:bg-solar-dark text-oled"
                    : "bg-frost hover:bg-frost-dark text-oled"
                }`}
              >
                <span>
                  {isProvisioning
                    ? authMode === "signup"
                      ? "Provisioning Session..."
                      : "Verifying Key..."
                    : authMode === "signup"
                    ? "Create Signless Session"
                    : "Unlock & Login to Spire"}
                </span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs font-mono border-b border-white/10 pb-3">
                <span className="text-slate-400">Active Identity</span>
                <span className="text-white font-bold break-all text-right">{activeSession.accountId}</span>
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

              {/* Recovery Key Backup Compartment */}
              <div className="p-3 rounded-lg bg-oled border border-white/10 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 inline-flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
                    Recovery Key
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowSecret((v) => !v)}
                      className="min-h-[44px] min-w-[44px] px-2 rounded border border-white/10 bg-panel-dark text-slate-300 hover:text-white inline-flex items-center justify-center transition-colors"
                      aria-label={showSecret ? "Hide recovery key" : "Reveal recovery key"}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(activeSession.secretKey)}
                      className="min-h-[44px] px-3 rounded border border-white/10 bg-panel-dark hover:bg-white/10 text-xs font-mono text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                    >
                      {copiedKey ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-jackpot" aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Copy Key</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-xs font-mono text-slate-300 break-all select-all">
                  {showSecret
                    ? activeSession.secretKey
                    : "ed25519:****************************************"}
                </div>
              </div>

              <p
                role="status"
                aria-live="polite"
                className="text-xs font-mono text-slate-300 leading-relaxed"
              >
                {provisionNote ??
                  (activeSession.provision === "confirmed"
                    ? "Function Call Access Key is live in localStorage. Back up your Recovery Key above to sign in from another device."
                    : "Keypair saved locally in browser storage. Background polling checks every 5s for relayer account creation.")}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                  setErrorMsg(null);
                  setNameInput("");
                  setSecretKeyInput("");
                  setShowSecret(false);
                }}
                className="min-h-[44px] text-xs font-mono text-slate-400 hover:text-hp transition-colors underline underline-offset-4 self-start"
              >
                Revoke local session &amp; switch account
              </button>
            </div>
          )}
        </motion.div>

        {/* Right column: Game Loop Briefing */}
        <div className="lg:col-span-6 obsidian-surface p-5 sm:p-6">
          <h2 className="font-serif text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Vault className="w-4 h-4 text-solar" aria-hidden="true" />
            Adventurer Progression Rite
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
                    className="inline-flex items-center min-h-[44px] text-xs font-mono text-frost hover:underline"
                  >
                    Open {item.href.replace("/game/", "")} &rarr;
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-10 text-center text-xs font-mono text-slate-400">
        NEAR Protocol Testnet // NEP-245 Multi-Token &amp; Signless Combat
      </div>
    </div>
  );
}
