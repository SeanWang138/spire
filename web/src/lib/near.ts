/**
 * SpireFi — Signless Session Manager & NEAR Client.
 *
 * Manages the player's ephemeral Function Call Access Key stored in
 * localStorage (`spire_session_v3`). Contract read/write traffic goes through
 * the typed adapter in lib/contract.ts.
 */

import { KeyPair } from "near-api-js";

export const NETWORK_ID = "testnet";

export const RPC_ENDPOINTS = [
  "https://rpc.testnet.fastnear.com",
  "https://test.rpc.fastnear.com",
  "https://rpc.testnet.near.org",
];

export const STORAGE_SESSION_KEY = "spire_session_v3";

export interface SessionData {
  accountId: string;
  publicKey: string;
  secretKey: string;
  createdAt: number;
  allowanceNear: number;
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
   * Creates a fresh Function Call Key pair in the browser and stores it as
   * the active signless session. `provision` starts as "pending"; the login
   * page flips it to "confirmed" once the relayer acknowledges the account.
   */
  public createSession(accountId: string): SessionData {
    const keyPair = KeyPair.fromRandom("ed25519");
    const cleanId = accountId.trim() || "player.spire.testnet";
    const session: SessionData = {
      accountId: cleanId,
      publicKey: keyPair.getPublicKey().toString(),
      secretKey: keyPair.toString(),
      createdAt: Date.now(),
      allowanceNear: 1.0,
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

  public clearSession(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      this.notifySessionChanged();
    }
  }
}
