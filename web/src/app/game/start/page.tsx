"use client";

import React, { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import { SessionManager, SessionData } from "@/lib/near";
import {
  provision_account,
  account_exists,
  verify_account_key,
  claim_starter,
} from "@/lib/contract";
import { useSessionAccount } from "@/lib/spire/hooks";

const ACCOUNT_NAME_RE = /^[a-z0-9._-]{2,64}$/;

function generateGuestHandle(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `raider-${suffix}`;
}

async function claimStarterWithRetry(): Promise<"claimed" | "already"> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await claim_starter();
      return "claimed";
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("E_ALREADY_CLAIMED") || msg.includes("already")) {
        return "already";
      }
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

const ONBOARDING_STEPS = [
  {
    step: "01",
    title: "Town & Forge + Starter Kit",
    desc: "1-click onboarding claims 4x Solar, 1x Frost, 4 Iron Ore, and 3 each Essence before entering the Forge.",
    href: "/game/forge",
  },
  {
    step: "02",
    title: "Vault & Deposit NEAR",
    desc: "Deposit NEAR from your 0.60 NEAR testnet subaccount into the Citadel Ledger or back a floor jackpot.",
    href: "/game/vault",
  },
  {
    step: "03",
    title: "Read Resistance & Strike",
    desc: "Check adaptive Meta Radar and Floor 2 Frost Ward before attacking to avoid Tribute weapon seizure.",
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
  const [submittedSession, setSubmittedSession] = useState<SessionData | null>(null);
  const [provisionNote, setProvisionNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recoveryErrorMsg, setRecoveryErrorMsg] = useState<string | null>(null);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [showSecret, setShowSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Pre-fill a valid guest handle on client mount for true 1-click onboarding
  useEffect(() => {
    setNameInput((prev) => prev || generateGuestHandle());
  }, []);

  const cleanName = nameInput.trim();
  const nameValid = ACCOUNT_NAME_RE.test(cleanName);
  const fullAccountId = useMemo(
    () => (cleanName.endsWith(".spire.testnet") ? cleanName : `${cleanName}.spire.testnet`),
    [cleanName]
  );
  const activeSession = session ?? submittedSession;

  // Live debounced account availability check for new guest handle
  useEffect(() => {
    if (activeSession || !nameValid) {
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
      setErrorMsg("Enter 2 to 64 lowercase characters (letters, digits, dots, underscores, or hyphens).");
      return;
    }

    const targetAccountId = handleToUse.endsWith(".spire.testnet")
      ? handleToUse
      : `${handleToUse}.spire.testnet`;

    if (availability === "taken") {
      setErrorMsg(`"${targetAccountId}" is already taken on-chain (HTTP 409). Click Randomize or import your Recovery Key below.`);
      return;
    }

    setErrorMsg(null);
    setProvisionNote("Generating browser Ed25519 keypair and requesting 0.60 NEAR testnet subaccount...");
    setIsProvisioning(true);

    const mgr = SessionManager.getInstance();
    const next = mgr.createSession(targetAccountId);

    try {
      await provision_account(next.accountId, next.publicKey);
      mgr.markProvisioned(next.accountId);
      setSubmittedSession({ ...next, provision: "confirmed" });
      setProvisionNote("Subaccount funded (0.60 NEAR). Auto-claiming Starter Kit...");

      try {
        const claimStatus = await claimStarterWithRetry();
        setProvisionNote(
          claimStatus === "already"
            ? "Starter Kit already active. Entering Town & Forge..."
            : "Starter Kit claimed (4x Solar, 1x Frost, 4 Ore, 3 Essence each). Entering Town & Forge..."
        );
      } catch (claimErr: unknown) {
        const claimMsg = claimErr instanceof Error ? claimErr.message : String(claimErr);
        setProvisionNote(
          `Subaccount funded (0.60 NEAR), but Starter Kit auto-claim deferred (${claimMsg}). Entering Town & Forge where you can claim it directly...`
        );
      }

      router.push("/game/forge");
    } catch (err: unknown) {
      mgr.clearSession();
      setSubmittedSession(null);
      setProvisionNote(null);

      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("TESTNET_FAUCET_NOT_CONFIGURED") || msg.includes("503")) {
        setErrorMsg(
          "Guest faucet unavailable (HTTP 503: TESTNET_FAUCET_NOT_CONFIGURED). Configure NEAR_PARENT_PRIVATE_KEY on the server, or expand Import Recovery Key below for an existing subaccount."
        );
      } else if (msg.includes("ACCOUNT_EXISTS") || msg.includes("already exists") || msg.includes("409")) {
        setAvailability("taken");
        setErrorMsg(
          `"${next.accountId}" already exists on NEAR testnet (HTTP 409). Pick another handle, click Randomize, or expand Import Recovery Key below.`
        );
      } else {
        setErrorMsg(`Guest provisioning failed: ${msg}`);
      }
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleRecoveryImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecovering || isProvisioning) return;

    setRecoveryErrorMsg(null);
    const chosenName = recoveryAccountInput.trim() || cleanName;
    if (!ACCOUNT_NAME_RE.test(chosenName)) {
      setRecoveryErrorMsg("Enter a valid subaccount name (2 to 64 lowercase characters).");
      return;
    }

    const targetAccountId = chosenName.endsWith(".spire.testnet")
      ? chosenName
      : `${chosenName}.spire.testnet`;

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
          `Key does not match "${targetAccountId}" on NEAR testnet, or the account does not exist.`
        );
        return;
      }

      const mgr = SessionManager.getInstance();
      const imported = mgr.importSession(targetAccountId, trimmedSecret);
      setSubmittedSession(imported);
      setProvisionNote("Recovery key verified against NEAR testnet. Entering Town & Forge...");
      router.push("/game/forge");
    } catch (err: unknown) {
      setRecoveryErrorMsg(err instanceof Error ? err.message : "Recovery key import failed.");
    } finally {
      setIsRecovering(false);
    }
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
    <div className="flex flex-col gap-6">
      <div className="pb-5 border-b border-brass/15">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-parchment tracking-wide">
          {activeSession ? "Active Testnet Session" : "1-Click Citadel Start"}
        </h1>
        <p className="text-sm text-ash mt-1.5 max-w-2xl leading-relaxed">
          {activeSession
            ? "Your Ephemeral Testnet Session Subaccount is ready for popup-free crafting, bazaar trades, and boss raids."
            : "Launch a fresh Ephemeral Testnet Session Subaccount funded 0.60 NEAR via /api/accounts, auto-claim your Starter Kit, and enter Town & Forge in one click."}
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

                  <div className="flex items-center rounded-lg bg-panel-dark border border-brass/25 overflow-hidden focus-within:ring-2 focus-within:ring-solar focus-within:border-solar transition-colors">
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
                      maxLength={64}
                      autoComplete="username"
                      aria-describedby="account-format-hint"
                      className="flex-1 min-h-[44px] bg-transparent px-3.5 py-2.5 text-sm font-mono text-parchment placeholder-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-solar min-w-0"
                    />
                    <span className="px-3 py-3 text-xs font-mono text-ash bg-panel-card border-l border-brass/20 shrink-0">
                      .spire.testnet
                    </span>
                  </div>

                  <p
                    id="account-format-hint"
                    className={`mt-1.5 text-xs ${
                      cleanName.length > 0 && !nameValid ? "text-hp-text font-semibold" : "text-pewter"
                    }`}
                  >
                    2 to 64 lowercase letters, digits, dots, underscores, or hyphens.
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

                <div className="p-3.5 rounded-lg bg-panel-dark space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-mono text-frost font-semibold">
                    <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Ephemeral Testnet Session Subaccount (Testnet Only)</span>
                  </div>
                  <p className="text-ash leading-relaxed text-xs">
                    Generates a <code className="font-mono text-parchment">FullAccess</code> Ed25519 keypair stored in browser{" "}
                    <code className="font-mono text-parchment">localStorage</code> and funds a dedicated subaccount with{" "}
                    <strong className="text-parchment">0.60 NEAR</strong> via{" "}
                    <code className="font-mono text-parchment">/api/accounts</code> for popup-free gameplay on NEAR testnet.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!nameValid || isProvisioning || isRecovering || availability === "taken"}
                  className="rpg-sheen min-h-[48px] w-full py-3 px-4 rounded-lg bg-solar hover:bg-solar-dark text-oled font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
                >
                  <span>
                    {isProvisioning
                      ? "Creating Subaccount & Claiming Starter Kit..."
                      : "1-Click Guest Play & Claim Starter Kit"}
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
                    className="p-4 rounded-lg bg-panel-dark space-y-4"
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
                          placeholder="shadowknight"
                          autoComplete="username"
                          className="flex-1 min-h-[44px] bg-transparent px-3.5 py-2 text-xs font-mono text-parchment placeholder-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-solar min-w-0"
                        />
                        <span className="px-3 py-3 text-xs font-mono text-ash bg-panel-card border-l border-brass/20 shrink-0">
                          .spire.testnet
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
                    <span className="text-xs font-medium text-pewter block">Active Subaccount</span>
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

                <div className="engraved-rule" />

                <div className="px-4 py-3.5 rounded-lg bg-panel-dark flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-parchment inline-flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-solar" aria-hidden="true" />
                      Recovery Key
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
                  className="text-xs text-ash leading-relaxed"
                >
                  {provisionNote ??
                    "Ephemeral Testnet Session Subaccount active (FullAccess browser keypair funded 0.60 NEAR via /api/accounts, testnet only). Back up your Recovery Key above before clearing browser data."}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
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
                    <span>Enter Spire Raid</span>
                  </Link>
                </div>
              </div>

              <div className="pt-4 border-t border-brass/15 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-pewter">Switch identity or clear browser key</span>
                <button
                  type="button"
                  onClick={() => {
                    SessionManager.getInstance().clearSession();
                    setSubmittedSession(null);
                    setProvisionNote(null);
                    setErrorMsg(null);
                    setNameInput(generateGuestHandle());
                    setRecoveryAccountInput("");
                    setSecretKeyInput("");
                    setShowSecret(false);
                  }}
                  className="min-h-[44px] px-2 text-xs font-mono text-ash hover:text-hp-text transition-colors underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar rounded"
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
            <span>NEAR Protocol Testnet</span>
            <span>NEP-245 Multi-Token</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
