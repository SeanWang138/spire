"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { KeyPair } from "near-api-js";
import {
  Swords,
  Hourglass,
  ShieldCheck,
  KeyRound,
  ChevronRight,
  ChevronDown,
  Hammer,
  Vault,
  Copy,
  Check,
  Eye,
  EyeOff,
  LogIn,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { GUEST_ACCOUNT_SUFFIX, SessionManager, SessionData } from "@/lib/near";
import {
  provision_account,
  account_exists,
  verify_account_key,
  claim_starter,
  deposit,
} from "@/lib/contract";
import { formatContractErrorMessage } from "@/lib/errors";
import { useSessionAccount } from "@/lib/spire/hooks";

const ACCOUNT_NAME_RE = /^[a-z0-9][a-z0-9_-]{1,30}$/;
const AUTO_POUCH_DEPOSIT_YOCTO = "350000000000000000000000"; // 0.35 NEAR playable Pouch

function generateGuestHandle(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `raider-${suffix}`;
}

async function retryPropagation<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (
        attempt < 2 &&
        (msg.includes("AccessKeyNotFound") ||
          msg.includes("does not exist") ||
          msg.includes("UnknownAccount"))
      ) {
        await new Promise((r) => setTimeout(r, 900));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function claimStarterWithRetry(): Promise<"claimed" | "already"> {
  try {
    await retryPropagation(() => claim_starter());
    return "claimed";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("E_ALREADY_CLAIMED") || msg.includes("already")) {
      return "already";
    }
    throw err;
  }
}

const ONBOARDING_STEPS = [
  {
    step: "01",
    title: "1-Click Walletless Setup",
    desc: "Auto-claims Starter Weapons (4x Solar, 1x Frost) & loads 0.35 NEAR into your Citadel Pouch (~0.245 NEAR stays reserved silently for gas).",
    href: "/game/forge",
  },
  {
    step: "02",
    title: "Forge & Npc Bazaar",
    desc: "Harvest ore/essence every 30s, craft Void blades, or trade materials directly against the supply-driven NPC Merchant curve.",
    href: "/game/merchant",
  },
  {
    step: "03",
    title: "Co-op Raid & Vault",
    desc: "Read Meta Radar + Floor 2 Frost Ward, coordinate co-op boss kills, and sweep jackpots or backer dividends in Vault.",
    href: "/game/raid",
  },
];

export default function StartPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const session = useSessionAccount();

  const [nameInput, setNameInput] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryAccountInput, setRecoveryAccountInput] = useState("");
  const [secretKeyInput, setSecretKeyInput] = useState("");

  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [retryingSetup, setRetryingSetup] = useState(false);
  const [deferredSetup, setDeferredSetup] = useState<{
    starter: boolean;
    deposit: boolean;
  } | null>(null);
  const [submittedSession, setSubmittedSession] = useState<SessionData | null>(null);
  const [provisionNote, setProvisionNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recoveryErrorMsg, setRecoveryErrorMsg] = useState<string | null>(null);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [showSecret, setShowSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setNameInput((prev) => prev || generateGuestHandle());
  }, []);

  const stripKnownSuffix = (raw: string) => {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.endsWith(GUEST_ACCOUNT_SUFFIX)) {
      return trimmed.slice(0, -GUEST_ACCOUNT_SUFFIX.length);
    }
    return trimmed.replace(/(\.faucet)?\.spire\.testnet$/, "");
  };

  const cleanName = stripKnownSuffix(nameInput);
  const nameValid = ACCOUNT_NAME_RE.test(cleanName);
  const fullAccountId = useMemo(
    () => (cleanName ? `${cleanName}${GUEST_ACCOUNT_SUFFIX}` : ""),
    [cleanName]
  );
  const activeSession = session ?? submittedSession;

  // Live debounced account availability check for new guest handle
  useEffect(() => {
    if (activeSession || !nameValid || !fullAccountId) {
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
  }, [activeSession, nameValid, fullAccountId]);

  const handleGuestOneClick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProvisioning || isRecovering) return;

    const handleToUse = cleanName || generateGuestHandle();
    if (!ACCOUNT_NAME_RE.test(handleToUse)) {
      setErrorMsg("Enter 2 to 31 lowercase letters, digits, underscores, or hyphens.");
      return;
    }

    const targetAccountId = `${handleToUse}${GUEST_ACCOUNT_SUFFIX}`;
    if (availability === "taken") {
      setErrorMsg(`"${targetAccountId}" is already taken on-chain. Click Randomize or import your Recovery Key below.`);
      return;
    }

    setErrorMsg(null);
    setDeferredSetup(null);
    setProvisionNote("Step 1/3 — Forging walletless guest subaccount (0.60 NEAR grant)...");
    setIsProvisioning(true);

    const mgr = SessionManager.getInstance();
    const next = mgr.createSession(targetAccountId);

    try {
      await provision_account(next.accountId, next.publicKey);
      mgr.markProvisioned(next.accountId);
      setSubmittedSession({ ...next, provision: "confirmed" });

      let starterNote = "Starter Kit ready";
      let starterOk = true;
      try {
        setProvisionNote("Step 2/3 — Claiming Starter Relics (4x Solar, 1x Frost, 4 Ore)...");
        const claimStatus = await claimStarterWithRetry();
        starterNote =
          claimStatus === "already"
            ? "Starter Kit already active"
            : "Starter Kit claimed (4x Solar, 1x Frost, 4 Ore, 3 each Essence)";
      } catch (claimErr: unknown) {
        starterOk = false;
        starterNote = `Starter claim deferred (${formatContractErrorMessage(claimErr)})`;
      }

      let pouchNote = "0.35 NEAR loaded into Citadel Pouch (~0.245 NEAR silent gas tank)";
      let depositOk = true;
      try {
        setProvisionNote("Step 3/3 — Stocking 0.35 NEAR into your Citadel Pouch for instant Raid & Bazaar play...");
        await retryPropagation(() => deposit(AUTO_POUCH_DEPOSIT_YOCTO));
      } catch (depErr: unknown) {
        depositOk = false;
        pouchNote = `Auto-deposit deferred (${formatContractErrorMessage(depErr)}) — click Retry Setup below`;
      }

      setDeferredSetup(!starterOk || !depositOk ? { starter: !starterOk, deposit: !depositOk } : null);
      setProvisionNote(`${starterNote} · ${pouchNote}. Save your Recovery Key above or launch straight in.`);
    } catch (err: unknown) {
      mgr.clearSession();
      setSubmittedSession(null);
      setDeferredSetup(null);
      setProvisionNote(null);

      const formatted = formatContractErrorMessage(err);
      if (formatted.toLowerCase().includes("already taken")) {
        setAvailability("taken");
      }
      setErrorMsg(formatted);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleRetryDeferredSetup = async () => {
    if (!deferredSetup || retryingSetup) return;
    setRetryingSetup(true);
    setErrorMsg(null);
    let starterOk = !deferredSetup.starter;
    let depositOk = !deferredSetup.deposit;
    const notes: string[] = [];

    try {
      if (deferredSetup.starter) {
        try {
          const claimStatus = await claimStarterWithRetry();
          starterOk = true;
          notes.push(claimStatus === "already" ? "Starter Kit already active" : "Starter Kit claimed");
        } catch (err: unknown) {
          notes.push(`Starter retry failed (${formatContractErrorMessage(err)})`);
        }
      }
      if (deferredSetup.deposit) {
        try {
          await retryPropagation(() => deposit(AUTO_POUCH_DEPOSIT_YOCTO));
          depositOk = true;
          notes.push("0.35 NEAR loaded into Citadel Pouch");
        } catch (err: unknown) {
          notes.push(`Deposit retry failed (${formatContractErrorMessage(err)})`);
        }
      }
      setDeferredSetup(!starterOk || !depositOk ? { starter: !starterOk, deposit: !depositOk } : null);
      setProvisionNote(notes.join(" · "));
    } finally {
      setRetryingSetup(false);
    }
  };

  const handleRecoveryImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecovering || isProvisioning) return;

    setRecoveryErrorMsg(null);
    const rawRecovery = recoveryAccountInput.trim().toLowerCase();
    let targetAccountId = "";
    if (rawRecovery.endsWith(".testnet") || rawRecovery.endsWith(".near")) {
      targetAccountId = rawRecovery;
    } else {
      const chosenName = stripKnownSuffix(rawRecovery || cleanName);
      if (!ACCOUNT_NAME_RE.test(chosenName)) {
        setRecoveryErrorMsg("Enter a valid subaccount handle (2 to 31 lowercase letters, digits, hyphens, or underscores).");
        return;
      }
      targetAccountId = `${chosenName}${GUEST_ACCOUNT_SUFFIX}`;
    }
    const trimmedSecret = secretKeyInput.trim();
    if (!trimmedSecret) {
      setRecoveryErrorMsg("Enter your Recovery Key (ed25519:...).");
      return;
    }

    setIsRecovering(true);
    try {
      let derivedPub = "";
      try {
        const kp = KeyPair.fromString(
          trimmedSecret as Parameters<typeof KeyPair.fromString>[0]
        );
        derivedPub = kp.getPublicKey().toString();
      } catch {
        setRecoveryErrorMsg("Invalid Recovery Key format. Expected ed25519:...");
        return;
      }

      const isValid = await verify_account_key(targetAccountId, derivedPub);
      if (!isValid) {
        setRecoveryErrorMsg(
          `Key does not match "${targetAccountId}" on NEAR Testnet, or the account does not exist.`
        );
        return;
      }

      const mgr = SessionManager.getInstance();
      const imported = mgr.importSession(targetAccountId, trimmedSecret);
      setSubmittedSession(imported);
      setProvisionNote("Recovery key verified against NEAR Testnet. Entering Town & Forge...");
      router.push("/game/forge");
    } catch (err: unknown) {
      setRecoveryErrorMsg(formatContractErrorMessage(err));
    } finally {
      setIsRecovering(false);
    }
  };

  const handleCopyKey = async (secretKey: string) => {
    try {
      await navigator.clipboard.writeText(secretKey);
      setCopiedKey(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedKey(false), 2500);
    } catch {
      // Clipboard blocked in restricted browser contexts
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="pb-5 border-b border-brass/15">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-parchment tracking-wide">
          {activeSession ? "Raider Identity Ready" : "1-Click Citadel Start"}
        </h1>
        <p className="text-sm text-ash mt-1.5 max-w-[65ch] leading-relaxed">
          {activeSession
            ? "Your walletless NEAR Testnet subaccount is funded and ready for zero-popup forging, bazaar bartering, and co-op boss raids."
            : "Spawn a NEAR Testnet subaccount, auto-claim starter weapons, and pre-load 0.35 NEAR into your Citadel Pouch in one click — no external wallet or seed prompts."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="lg:col-span-7 citadel-stage p-5 sm:p-6 flex flex-col justify-between gap-5"
        >
          {!activeSession ? (
            <div className="flex flex-col gap-5">
              {/* Primary 1-Click Guest Onboarding Form */}
              <form onSubmit={handleGuestOneClick} className="flex flex-col gap-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="spire-account-input"
                      className="text-xs font-mono font-bold uppercase tracking-wider text-parchment"
                    >
                      Guest Raider Handle
                    </label>
                    <div className="flex items-center gap-2">
                      {nameValid && availability !== "idle" && (
                        <span
                          className={`text-xs font-mono font-bold ${
                            availability === "available"
                              ? "text-jackpot"
                              : availability === "taken"
                              ? "text-hp-text"
                              : "text-ash"
                          }`}
                        >
                          {availability === "checking"
                            ? "Checking..."
                            : availability === "available"
                            ? "Available"
                            : "Already taken"}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setNameInput(generateGuestHandle());
                          setErrorMsg(null);
                        }}
                        className="min-h-[44px] px-3 rounded-lg bg-panel-dark hover:bg-panel-elevated border border-brass/20 text-xs font-mono text-ash hover:text-parchment inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Randomize</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <input
                      id="spire-account-input"
                      type="text"
                      value={nameInput}
                      onChange={(e) => {
                        setNameInput(e.target.value.toLowerCase());
                        setErrorMsg(null);
                      }}
                      placeholder="raider-shadow"
                      minLength={2}
                      maxLength={31}
                      autoComplete="username"
                      aria-describedby="account-format-hint"
                      className="flex-1 min-h-[44px] rounded-lg bg-panel-dark border border-brass/25 focus:border-solar px-3.5 py-2.5 text-sm font-mono text-parchment placeholder-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-solar min-w-0 transition-colors"
                    />
                    <span className="text-xs font-mono text-ash shrink-0">
                      {GUEST_ACCOUNT_SUFFIX}
                    </span>
                  </div>

                  <p
                    id="account-format-hint"
                    className={`mt-1.5 text-xs ${
                      cleanName.length > 0 && !nameValid ? "text-hp-text font-semibold" : "text-pewter"
                    }`}
                  >
                    2 to 31 lowercase letters, digits, underscores, or hyphens.
                  </p>
                </div>

                {errorMsg && (
                  <p
                    role="alert"
                    className="text-xs font-mono text-hp-text bg-hp/15 border border-hp/40 rounded-lg px-3.5 py-3 leading-relaxed"
                  >
                    {errorMsg}
                  </p>
                )}

                {provisionNote && !errorMsg && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="text-xs font-mono text-frost bg-frost/10 border border-frost/30 rounded-lg px-3.5 py-2.5 leading-relaxed"
                  >
                    {provisionNote}
                  </p>
                )}

                <div className="pt-3 border-t border-brass/15 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-mono text-frost font-semibold">
                    <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Zero-Popup NEAR Testnet Account (No External Wallet)</span>
                  </div>
                  <p className="text-ash leading-relaxed text-xs max-w-[65ch]">
                    Generates a local Ed25519 keypair funded <strong className="text-parchment">0.60 NEAR</strong>: auto-deposits{" "}
                    <strong className="text-jackpot">0.35 NEAR</strong> into your playable{" "}
                    <strong className="text-parchment">Citadel Pouch</strong> and keeps{" "}
                    <strong className="text-frost">~0.245 NEAR</strong> silently reserved for gas fees.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!nameValid || isProvisioning || isRecovering || availability === "taken"}
                  className="rpg-sheen min-h-[48px] w-full py-3 px-4 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                >
                  <span>
                    {isProvisioning
                      ? "Forging Account & Stocking 0.35 NEAR Pouch..."
                      : "Enter Citadel (1-Click Walletless Play)"}
                  </span>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>

              <div className="engraved-rule" />

              {/* Secondary Accordion: Import Existing Recovery Key */}
              <div className="space-y-3">
                <button
                  type="button"
                  aria-expanded={recoveryOpen}
                  aria-controls="recovery-key-accordion"
                  onClick={() => {
                    setRecoveryOpen((v) => !v);
                    setRecoveryErrorMsg(null);
                  }}
                  className="min-h-[44px] w-full px-3.5 py-2.5 rounded-lg bg-panel-dark hover:bg-panel-elevated text-xs font-mono font-semibold text-ash hover:text-parchment flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                >
                  <span className="inline-flex items-center gap-2">
                    <LogIn className="w-4 h-4 text-frost shrink-0" aria-hidden="true" />
                    <span>Already have a subaccount? Import Recovery Key</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${recoveryOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {recoveryOpen && (
                  <form
                    id="recovery-key-accordion"
                    onSubmit={handleRecoveryImport}
                    className="pt-4 border-t border-brass/15 space-y-4"
                  >
                    <div>
                      <label
                        htmlFor="spire-recovery-account"
                        className="text-xs font-mono font-bold uppercase tracking-wider text-parchment block mb-1.5"
                      >
                        Existing Account Name
                      </label>
                      <div className="flex items-center rounded-lg bg-oled border border-brass/25 overflow-hidden focus-within:ring-2 focus-within:ring-solar focus-within:border-solar">
                        <input
                          id="spire-recovery-account"
                          type="text"
                          value={recoveryAccountInput}
                          onChange={(e) => {
                            setRecoveryAccountInput(e.target.value.toLowerCase());
                            setRecoveryErrorMsg(null);
                          }}
                          placeholder={`raider-ad90z (or full .testnet)`}
                          autoComplete="username"
                          className="flex-1 min-h-[44px] bg-transparent px-3.5 py-2 text-xs font-mono text-parchment placeholder-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-solar min-w-0"
                        />
                        <span className="px-3 py-3 text-xs font-mono text-ash bg-panel-card border-l border-brass/20 shrink-0">
                          {GUEST_ACCOUNT_SUFFIX}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="spire-recovery-key"
                        className="text-xs font-mono font-bold uppercase tracking-wider text-parchment block mb-1.5"
                      >
                        Recovery / Secret Key
                      </label>
                      <input
                        id="spire-recovery-key"
                        type="password"
                        value={secretKeyInput}
                        onChange={(e) => {
                          setSecretKeyInput(e.target.value);
                          setRecoveryErrorMsg(null);
                        }}
                        placeholder="ed25519:..."
                        autoComplete="off"
                        className="w-full min-h-[44px] rounded-lg bg-oled border border-brass/25 px-3.5 py-2.5 text-xs font-mono text-parchment placeholder-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                      />
                    </div>

                    {recoveryErrorMsg && (
                      <p
                        role="alert"
                        className="text-xs font-mono text-hp-text bg-hp/15 border border-hp/40 rounded-lg px-3 py-2.5 leading-relaxed"
                      >
                        {recoveryErrorMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isRecovering || isProvisioning || !secretKeyInput.trim()}
                      className="min-h-[44px] w-full py-2.5 px-4 rounded-lg bg-frost hover:bg-frost-dark text-oled font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                    >
                      <span>
                        {isRecovering ? "Verifying On-Chain Key..." : "Verify Key & Enter Town & Forge"}
                      </span>
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-between gap-5 h-full">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-pewter block">Active Guest Subaccount</span>
                    <span className="font-mono text-base sm:text-lg font-bold text-parchment break-all mt-0.5 block">
                      {activeSession.accountId}
                    </span>
                  </div>
                  {activeSession.provision === "confirmed" ? (
                    <span className="px-2.5 py-1 rounded-md bg-jackpot/10 border border-jackpot/30 text-jackpot font-mono text-xs font-semibold inline-flex items-center gap-1.5 shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      Confirmed on Testnet
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-frost/10 border border-frost/30 text-frost font-mono text-xs font-semibold inline-flex items-center gap-1.5 shrink-0">
                      <Hourglass className="w-3.5 h-3.5" aria-hidden="true" />
                      Awaiting Confirmation
                    </span>
                  )}
                </div>

                <div className="py-3.5 border-y border-brass/15 flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-parchment inline-flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
                      Recovery Key (Optional Backup)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSecret((v) => !v)}
                        className="min-h-[44px] min-w-[44px] px-2.5 rounded-md bg-panel-elevated hover:bg-panel-elevated/80 text-ash hover:text-parchment inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                        aria-label={showSecret ? "Hide recovery key" : "Reveal recovery key"}
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyKey(activeSession.secretKey)}
                        className="min-h-[44px] px-3 rounded-md bg-panel-elevated hover:bg-panel-elevated/80 text-xs font-mono text-parchment inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
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
                  <div className="text-xs font-mono text-ash break-all select-all">
                    {showSecret
                      ? activeSession.secretKey
                      : "ed25519:****************************************"}
                  </div>
                </div>

                <p
                  role="status"
                  aria-live="polite"
                  className="text-xs text-ash leading-relaxed max-w-[65ch]"
                >
                  {provisionNote ??
                    "Walletless NEAR Testnet subaccount active (0.35 NEAR loaded into Citadel Pouch + ~0.245 NEAR silent gas tank). No external wallet needed."}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {isProvisioning ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="min-h-[44px] w-full py-2.5 px-4 rounded-lg border border-frost/35 bg-frost/10 text-frost font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                      <span>Completing Starter Kit &amp; 0.35 NEAR Pouch Deposit...</span>
                    </div>
                  ) : (
                    <>
                      {(deferredSetup?.starter || deferredSetup?.deposit) && (
                        <button
                          type="button"
                          onClick={handleRetryDeferredSetup}
                          disabled={retryingSetup}
                          className="min-h-[44px] w-full py-2.5 px-4 rounded-lg border border-solar/45 bg-solar/15 hover:bg-solar/25 text-solar font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                        >
                          {retryingSetup ? (
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                          ) : (
                            <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                          )}
                          <span>
                            {retryingSetup
                              ? "Retrying Starter & Deposit..."
                              : "1-Click Complete Starter & Deposit 0.35 NEAR"}
                          </span>
                        </button>
                      )}
                      <Link
                        href="/game/forge"
                        className="rpg-sheen min-h-[44px] flex-1 sm:flex-initial py-2.5 px-5 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                      >
                        <Hammer className="w-4 h-4" aria-hidden="true" />
                        <span>Enter Town &amp; Forge</span>
                      </Link>
                      <Link
                        href="/game/raid"
                        className="min-h-[44px] flex-1 sm:flex-initial py-2.5 px-5 rounded-lg border border-frost/35 bg-frost/10 hover:bg-frost/20 text-frost font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                      >
                        <Swords className="w-4 h-4" aria-hidden="true" />
                        <span>Go Straight to Raid</span>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-brass/15 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-pewter">Switch identity or clear browser key</span>
                <button
                  type="button"
                  disabled={isProvisioning}
                  onClick={() => {
                    SessionManager.getInstance().clearSession();
                    setSubmittedSession(null);
                    setDeferredSetup(null);
                    setProvisionNote(null);
                    setErrorMsg(null);
                    setNameInput(generateGuestHandle());
                    setRecoveryAccountInput("");
                    setSecretKeyInput("");
                    setShowSecret(false);
                  }}
                  className="min-h-[44px] px-2 text-xs font-mono text-ash hover:text-hp-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar rounded"
                >
                  Revoke local session &amp; switch account
                </button>
              </div>
            </div>
          )}
        </motion.div>

        <aside className="lg:col-span-5 obsidian-surface p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-parchment flex items-center gap-2">
              <Vault className="w-4 h-4 text-solar" aria-hidden="true" />
              Adventurer Loop
            </h2>
            <ol className="divide-y divide-brass/15 mt-4">
              {ONBOARDING_STEPS.map((item) => (
                <li key={item.step} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-mono-numbers text-xs font-bold text-solar shrink-0">
                        {item.step}
                      </span>
                      <h3 className="text-sm font-semibold text-parchment truncate">{item.title}</h3>
                    </div>
                    <Link
                      href={item.href}
                      className="inline-flex items-center min-h-[44px] px-2 -mr-2 text-xs font-mono font-semibold text-frost hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar rounded"
                    >
                      {item.href.replace("/game/", "")}
                    </Link>
                  </div>
                  <p className="text-xs text-ash leading-relaxed pl-6 mt-0.5">{item.desc}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="pt-4 border-t border-brass/15 flex items-center justify-between text-xs font-mono text-pewter">
            <span>NEAR Testnet · Walletless</span>
            <span>NEP-245 Multi-Token</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
