/**
 * SpireFi — Ephemeral Testnet Session Subaccount & NEAR Client.
 *
 * Manages an Ephemeral Testnet Session Subaccount (`FullAccess` browser
 * ed25519 keypair stored in localStorage `spire_session_v3`, funded ~0.60 NEAR
 * via `/api/accounts` for zero-popup signless transactions on testnet — NOT a
 * restricted Function Call Access Key with a 1.0 NEAR allowance). Contract
 * read/write traffic goes through the typed adapter in lib/contract.ts.
 */

import { KeyPair } from "near-api-js";

export const NETWORK_ID = "testnet";

export const GUEST_PARENT_ACCOUNT =
  process.env.NEXT_PUBLIC_GUEST_PARENT_ACCOUNT ||
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  "spire.testnet";

export const GUEST_ACCOUNT_SUFFIX = `.${GUEST_PARENT_ACCOUNT}`;

export const RPC_ENDPOINTS = [
  "https://rpc.testnet.fastnear.com",
  "https://test.rpc.fastnear.com",
  "https://rpc.testnet.near.org",
];

/**
 * Returns the prioritized RPC endpoints for the current runtime.
 * In the browser, routes through the same-origin `/api/rpc` Next.js gateway
 * first to eliminate cross-origin 429 CORS errors and coalesce concurrent views.
 */
export function getActiveRpcEndpoints(): string[] {
  if (typeof window !== "undefined" && window.location?.origin) {
    return [`${window.location.origin}/api/rpc`, ...RPC_ENDPOINTS];
  }
  return RPC_ENDPOINTS;
}

export const STORAGE_SESSION_KEY = "spire_session_v3";

export interface SessionData {
  accountId: string;
  publicKey: string;
  secretKey: string;
  createdAt: number;
  /** Initial subaccount gas/play budget in NEAR (~0.60 NEAR funded via /api/accounts). */
  allowanceNear: number;
  /** Testnet guest sessions use a browser-held FullAccess keypair on a dedicated subaccount. */
  keyMode?: "ephemeral-full-access";
  /**
   * Account lifecycle at the relayer: "pending" = draft saved locally while
   * the relayer has not yet provisioned `<name>.spire.testnet`.
   */
  provision?: "pending" | "confirmed";
}

export class SessionManager {
  private static instance: SessionManager;

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public getSession(): SessionData | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  private notifySessionChanged(): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("spire:session-changed"));
    }
  }

  /**
   * Creates a fresh Ephemeral Testnet Session Subaccount keypair (`FullAccess`,
   * funded ~0.60 NEAR via `/api/accounts`) in the browser for zero-popup
   * testnet play. `provision` starts as "pending"; the start page flips it to
   * "confirmed" once the relayer acknowledges the account.
   */
  public createSession(accountId: string): SessionData {
    const keyPair = KeyPair.fromRandom("ed25519");
    const cleanId = accountId.trim() || `player${GUEST_ACCOUNT_SUFFIX}`;
    const session: SessionData = {
      accountId: cleanId,
      publicKey: keyPair.getPublicKey().toString(),
      secretKey: keyPair.toString(),
      createdAt: Date.now(),
      allowanceNear: 0.6,
      keyMode: "ephemeral-full-access",
      provision: "pending",
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    }
    this.notifySessionChanged();
    return session;
  }

  public markProvisioned(accountId: string): void {
    const session = this.getSession();
    if (session && session.accountId === accountId) {
      session.provision = "confirmed";
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      this.notifySessionChanged();
    }
  }

  /** Stores the keypair draft locally without a relayer acknowledgment. */
  public saveDraft(session: SessionData): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      this.notifySessionChanged();
    }
  }

  /**
   * Restores an existing on-chain account session from a user-supplied
   * Recovery / Secret Key (`ed25519:...`). Throws if the key format is invalid.
   */
  public importSession(accountId: string, secretKey: string): SessionData {
    const trimmedKey = secretKey.trim();
    const keyPair = KeyPair.fromString(
      trimmedKey as Parameters<typeof KeyPair.fromString>[0]
    );
    const cleanId = accountId.trim();
    const session: SessionData = {
      accountId: cleanId,
      publicKey: keyPair.getPublicKey().toString(),
      secretKey: trimmedKey,
      createdAt: Date.now(),
      allowanceNear: 0.6,
      keyMode: "ephemeral-full-access",
      provision: "confirmed",
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    }
    this.notifySessionChanged();
    return session;
  }

  public clearSession(): void {
    if (typeof window !== "undefined") {
      const current = this.getSession();
      localStorage.removeItem(STORAGE_SESSION_KEY);
      if (current?.accountId) {
        localStorage.removeItem(`spirefi.vault.history.v1:${current.accountId}`);
        localStorage.removeItem(`spirefi.raid.log.v1:${current.accountId}`);
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`spire_gather:${current.accountId}:`)) {
            localStorage.removeItem(key);
          }
        }
      }
      this.notifySessionChanged();
    }
  }
}
