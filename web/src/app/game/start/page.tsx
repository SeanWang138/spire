"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Swords, Hourglass, ShieldCheck, KeyRound, ChevronRight, Copy, Check, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { KeyPair } from "near-api-js";
import { SessionManager, SessionData } from "@/lib/near";
import { provision_account, account_exists, verify_account_key } from "@/lib/contract";
import { useSessionAccount } from "@/lib/spire/hooks";

const ACCOUNT_NAME_RE = /^[a-z0-9._-]{2,64}$/;

// Procedural crest (guild-style filigree, inline SVG — no external assets).
export function SpireCrest({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" className="text-slate-500" />
      <circle cx="100" cy="100" r="76" stroke="currentColor" strokeWidth="1.5" className="text-slate-400" />
      <path
        d="M 50 140 C 35 100, 30 60, 60 30 C 80 50, 75 80, 100 100 C 125 80, 120 50, 140 30 C 170 60, 165 100, 150 140 Z"
        stroke="currentColor" strokeWidth="2" fill="rgba(15, 20, 36, 0.6)" className="text-slate-200"
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

export default function StartPage() {
  const router = useRouter();
  const session = useSessionAccount();
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [nameInput, setNameInput] = useState("");
  const [secretKeyInput, setSecretKeyInput] = useState("");
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [submittedSession, setSubmittedSession] = useState<SessionData | null>(null);
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

  // Provision poller: while the account is still "pending", check on-chain existence
  // every 5s (max ~3 min). Flips the session to "confirmed" once the relayer has
  // created the subaccount with the browser's Function Call Key.
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
        // RPC hiccup — keep polling.
      }
    }, 5000);
    return () => clearInterval(id);
  }, [activeSession?.accountId, activeSession?.provision]);

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameValid || isProvisioning) return;
    setErrorMsg(null);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("ACCOUNT_EXISTS") || msg.includes("already exists")) {
        mgr.clearSession();
        setSubmittedSession(null);
        setErrorMsg(`"${next.accountId}" is already taken on-chain. Switch to Login or pick a new name.`);
      } else {
        // Relayer not reachable / route not deployed yet: keep the draft locally
        // and surface a clear "awaiting provision" status instead of a hard error.
        mgr.saveDraft(next);
        setSubmittedSession(next);
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
      // Fallback ignored
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-53px)] flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
      {/* Crest & wordmark */}
      <div className="flex flex-col items-center max-w-2xl w-full text-center mb-10">
        <div className="relative w-32 h-32 mb-6 flex items-center justify-center text-slate-300">
          <SpireCrest className="w-full h-full" />
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif tracking-[0.2em] font-bold text-white mb-3">
          SPIREFi
        </h1>
        <p className="text-sm md:text-base font-mono tracking-widest text-slate-300 uppercase max-w-lg">
          A dark-fantasy raid citadel // every floor adapts to the crowd
        </p>
      </div>

      {/* Login bridge / session card */}
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        className="w-full max-w-md flex flex-col gap-3 z-10"
      >
        {!activeSession ? (
          <form
            onSubmit={handleEnter}
            className="p-5 rounded-xl bg-panel-dark/90 border border-white/10 elevation-panel flex flex-col gap-3"
          >
            {/* Mode Switcher: Sign Up vs Login */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-panel-card border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setErrorMsg(null);
                }}
                className={`py-2 px-3 rounded-md text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                  authMode === "signup"
                    ? "bg-solar text-oled shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setErrorMsg(null);
                }}
                className={`py-2 px-3 rounded-md text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                  authMode === "login"
                    ? "bg-frost text-oled shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login (Key)</span>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
                  Account name
                </span>
                {authMode === "signup" && nameValid && availability !== "idle" && (
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      availability === "available"
                        ? "text-jackpot"
                        : availability === "taken"
                        ? "text-hp"
                        : "text-slate-400"
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
              <div className="flex items-center rounded-lg bg-panel-card border border-white/10 overflow-hidden focus-within:border-frost transition-colors">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value.toLowerCase());
                    setErrorMsg(null);
                  }}
                  placeholder="shadowknight"
                  minLength={2}
                  maxLength={32}
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm font-mono text-white focus:outline-none"
                  aria-label="Account name"
                />
                <span className="px-3 text-xs font-mono text-slate-500 border-l border-white/10">
                  .spire.testnet
                </span>
              </div>
              {cleanName.length > 0 && !nameValid && (
                <p className="mt-1.5 text-[11px] font-mono text-hp">
                  2–32 characters, only [a-z 0-9 . _ -]
                </p>
              )}
              {authMode === "signup" && availability === "taken" && (
                <p className="mt-1.5 text-[11px] font-mono text-amber-400">
                  This account already exists on-chain. Choose another name or{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setErrorMsg(null);
                    }}
                    className="underline font-bold text-frost hover:text-white"
                  >
                    Login with Recovery Key
                  </button>
                  .
                </p>
              )}
            </div>

            {authMode === "login" && (
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Recovery / Secret Key
                </span>
                <input
                  type="password"
                  value={secretKeyInput}
                  onChange={(e) => {
                    setSecretKeyInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="ed25519:..."
                  className="w-full rounded-lg bg-panel-card border border-white/10 px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-frost transition-colors"
                  aria-label="Recovery Key"
                />
              </div>
            )}

            {errorMsg && (
              <p className="text-[11px] font-mono text-hp bg-hp/10 border border-hp/20 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            {/* Function Call Key info */}
            <div className="p-2.5 rounded-lg bg-panel-card border border-white/5 text-[11px] font-mono text-slate-400 flex items-start gap-2">
              <KeyRound className="w-3.5 h-3.5 text-frost mt-0.5 flex-shrink-0" />
              <span>
                {authMode === "signup" ? (
                  <>
                    A <span className="text-slate-200">Function Call Key</span> pair is generated in
                    your browser — raids and trades run signless, with no wallet popups.
                  </>
                ) : (
                  <>
                    Enter the <span className="text-slate-200">Recovery Key</span> saved when you
                    created your account. Your key is verified directly against NEAR Testnet.
                  </>
                )}
              </span>
            </div>

            <button
              type="submit"
              disabled={
                !nameValid ||
                isProvisioning ||
                (authMode === "signup" && availability === "taken") ||
                (authMode === "login" && !secretKeyInput.trim())
              }
              className={`w-full py-3 rounded-lg font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg active:scale-[0.99] ${
                authMode === "signup"
                  ? "bg-solar hover:bg-solar-dark text-oled shadow-solar/20"
                  : "bg-frost hover:bg-frost/90 text-oled shadow-frost/20"
              }`}
            >
              <span>
                {isProvisioning
                  ? authMode === "signup"
                    ? "Provisioning account..."
                    : "Verifying key..."
                  : authMode === "signup"
                  ? "Create Raider Account"
                  : "Login to Spire"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="p-5 rounded-xl bg-panel-dark/90 border border-white/10 elevation-panel flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Account</span>
              <span className="text-white font-bold">{activeSession.accountId}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Status</span>
              {activeSession.provision === "confirmed" ? (
                <span className="text-jackpot font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Active // ready to raid
                </span>
              ) : (
                <span className="text-frost font-bold flex items-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "3s" }} />
                  Waiting for account provisioning…
                </span>
              )}
            </div>

            {/* Recovery Key Backup Box */}
            <div className="p-2.5 rounded-lg bg-panel-card border border-white/10 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-solar" />
                  Recovery Key (save for login on other devices)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="text-slate-400 hover:text-white p-1"
                    title={showSecret ? "Hide key" : "Reveal key"}
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyKey(activeSession.secretKey)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="w-3 h-3 text-jackpot" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="text-[11px] font-mono text-slate-300 break-all select-all">
                {showSecret
                  ? activeSession.secretKey
                  : "ed25519:••••••••••••••••••••••••••••••••••••••••"}
              </div>
            </div>

            <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
              {activeSession.provision === "confirmed"
                ? "Your testnet account is active. Keep your Recovery Key safe if you plan to log in from another browser."
                : "The keypair draft is stored locally; the relayer has not confirmed account creation yet. Status flips automatically once the relayer provisions this account."}
            </p>
            <Link
              href="/game/raid"
              className="w-full py-3 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-solar/20 active:scale-[0.99]"
            >
              <Swords className="w-4 h-4" />
              <span>Enter the Spire</span>
            </Link>
            <button
              onClick={() => {
                SessionManager.getInstance().clearSession();
                setSubmittedSession(null);
                setNameInput("");
                setSecretKeyInput("");
                setShowSecret(false);
              }}
              className="text-[11px] font-mono text-slate-500 hover:text-hp transition-colors underline underline-offset-2"
            >
              sign out: use a different account
            </button>
          </div>
        )}
      </motion.div>

      {/* Bottom hint line */}
      <div className="mt-12 text-center text-xs font-mono text-slate-400">
        NEAR Protocol Testnet // Signless Function Call Combat
      </div>
    </div>
  );
}
