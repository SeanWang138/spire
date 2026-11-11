"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  History,
  ScrollText,
  Shield,
  Swords,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  get_balance,
  get_claimable,
  get_claimable_loot,
  get_backer,
  deposit,
  withdraw,
  claim_payout,
  claim_jackpot,
  claim_backer_dividend,
  back_boss_vault,
} from "@/lib/contract";
import { useContractView, useSessionAccount } from "@/lib/spire/hooks";
import { formatNearAmount } from "@/lib/utils/cn";
import { ELEMENT_NAMES, nearToYocto, yoctoToNear } from "@/lib/spire/constants";

const STORAGE_HISTORY_KEY = "spirefi_vault_history_v1";
const DEPOSIT_PRESETS: number[] = [1, 2, 5];

interface HistoryEntry {
  id: string;
  at: number;
  kind: "deposit" | "withdraw" | "claim" | "loot" | "back" | "dividend";
  detail: string;
}

export default function VaultPage() {
  const session = useSessionAccount();
  const accountId = session?.accountId ?? "";

  const balance = useContractView(
    async () => (accountId ? await get_balance(accountId) : null),
    [accountId]
  );

  const [depositNear, setDepositNear] = useState<number>(1);
  const [withdrawAll, setWithdrawAll] = useState(false);
  const [withdrawNear, setWithdrawNear] = useState<number>(0);
  const [claimFloor, setClaimFloor] = useState<number>(1);
  const [claimRound, setClaimRound] = useState<number>(1);
  const [claimableYocto, setClaimableYocto] = useState<string | null>(null);
  const [claimableError, setClaimableError] = useState<string | null>(null);
  const [claimLoot, setClaimLoot] = useState<[number, number, number] | null>(null);
  const [backFloor, setBackFloor] = useState<number>(1);
  const [backAmount, setBackAmount] = useState<number>(1);
  const [dividendFloor, setDividendFloor] = useState<number>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [txMessage, setTxMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const backer = useContractView(
    async () => (accountId ? await get_backer(dividendFloor, accountId) : null),
    [accountId, dividendFloor]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryEntry[]);
    } catch {
      // fresh history
    }
  }, []);

  const pushHistory = (kind: HistoryEntry["kind"], detail: string) => {
    setHistory((prev) => {
      const next = [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), kind, detail },
        ...prev,
      ].slice(0, 25);
      try {
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // storage full — history is best-effort
      }
      return next;
    });
  };

  const run = async (kind: string, action: () => Promise<unknown>, detail: string, reload?: () => void) => {
    setBusy(kind);
    setTxMessage(null);
    try {
      await action();
      pushHistory(kind as HistoryEntry["kind"], detail);
      setTxMessage(`Transaction sent: ${detail}`);
      balance.reload();
      reload?.();
    } catch (err) {
      setTxMessage(err instanceof Error ? err.message : "Transaction failed — check session key or network.");
    } finally {
      setBusy(null);
    }
  };

  const checkClaimable = async () => {
    setClaimableError(null);
    try {
      if (!accountId) return;
      const yocto = await get_claimable(accountId, claimFloor, claimRound);
      const loot = await get_claimable_loot(accountId, claimFloor, claimRound).catch(() => null);
      setClaimableYocto(yocto);
      setClaimLoot(loot);
    } catch {
      setClaimableYocto(null);
      setClaimLoot(null);
      setClaimableError("Unable to calculate claimable bounty. Contract unreachable.");
    }
  };

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <EmptyState title="No active session" hint="Enter your account name on the Title Screen to access the signless vault." />
      </div>
    );
  }

  const balanceYocto = balance.data ?? "0";
  const withdrawMax = yoctoToNear(balanceYocto);

  return (
    <div className="px-1 py-8 flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">Vault</h1>
        <p className="text-xs sm:text-sm font-mono text-slate-400 mt-1">
          Internal ledger. Deposits fund raid tickets, jackpot claims, and backer staking — entirely signless.
        </p>
      </div>

      {!balance.data ? (
        <EmptyState
          title="Vault balance unavailable"
          hint="Unable to retrieve vault balance from the network. Please reload or check your connection."
          onReload={balance.reload}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Balance + claims */}
          <div className="md:col-span-5 flex flex-col gap-3">
            <div className="rounded-xl bg-panel-card border border-jackpot/30 p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-jackpot" />
                <span className="text-xs uppercase font-bold tracking-widest font-mono text-slate-300">
                  Ledger Balance
                </span>
              </div>
              <div className="text-3xl font-black font-mono-numbers text-white">{formatNearAmount(balanceYocto, 4)}</div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                account <span className="text-slate-200">{accountId}</span>
              </div>
            </div>

            {/* Claim payout + loot */}
            <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl space-y-2.5">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold uppercase font-mono tracking-wide text-white">
                  Claim Round Rewards
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Floor</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={claimFloor}
                    onChange={(e) => setClaimFloor(Number(e.target.value))}
                    className="w-full mt-1 p-1.5 rounded bg-panel-dark border border-white/10 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Round</label>
                  <input
                    type="number"
                    min={1}
                    value={claimRound}
                    onChange={(e) => setClaimRound(Number(e.target.value))}
                    className="w-full mt-1 p-1.5 rounded bg-panel-dark border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={checkClaimable}
                className="w-full py-1.5 rounded bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-xs font-mono font-bold transition-colors"
              >
                Check Unclaimed Raid Rewards
              </button>
              <div className="text-[11px] font-mono leading-relaxed">
                {claimableYocto !== null ? (
                  <>
                    <span className="text-jackpot font-bold">
                      Payout: {formatNearAmount(claimableYocto)}
                    </span>
                    {claimLoot && (
                      <span className="block text-slate-400 mt-0.5">
                        Loot: {claimLoot.map((n, i) => `${n} ${ELEMENT_NAMES[i]}`).join(" · ")}
                      </span>
                    )}
                  </>
                ) : claimableError ? (
                  <span className="text-slate-400">{claimableError}</span>
                ) : (
                  <span className="text-slate-500">Not checked yet.</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    run("claim", () => claim_payout(claimFloor, claimRound), `Claim Round ${claimRound} Payout`)
                  }
                  disabled={busy !== null}
                  className="py-2 rounded-lg bg-jackpot/15 hover:bg-jackpot/25 border border-jackpot/40 text-jackpot text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                >
                  {busy === "claim" ? "Submitting..." : "Claim Payout"}
                </button>
                <button
                  onClick={() =>
                    run("claim-all", () => claim_jackpot(), "Claim All Recent Bounties")
                  }
                  disabled={busy !== null}
                  className="py-2 rounded-lg bg-solar/15 hover:bg-solar/25 border border-solar/40 text-solar text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                >
                  {busy === "claim-all" ? "Submitting..." : "Claim All"}
                </button>
              </div>
            </div>
          </div>

          {/* Panels: deposit / withdraw / backer / history */}
          <div className="md:col-span-7 flex flex-col gap-3">
            {/* Deposit */}
            <div className="rounded-xl bg-panel-card border border-emerald-400/30 p-4 shadow-xl space-y-2.5">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold uppercase font-mono tracking-wide text-white">Deposit</span>
                <span className="text-[10px] font-mono text-slate-400">Payable NEAR</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DEPOSIT_PRESETS.map((val) => (
                  <button
                    key={val}
                    onClick={() => setDepositNear(val)}
                    className={`py-1.5 rounded border text-xs font-bold transition-all ${
                      depositNear === val
                        ? "bg-emerald-400/20 border-emerald-400 text-emerald-400"
                        : "bg-panel-dark border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    {val} N
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={depositNear}
                onChange={(e) => setDepositNear(Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-panel-dark border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-400"
              />
              <button
                onClick={() =>
                  run("deposit", () => deposit(nearToYocto(depositNear)), `Deposit ${depositNear} NEAR`)
                }
                disabled={busy !== null || depositNear <= 0}
                className="w-full py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-oled text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40 active:scale-[0.99]"
              >
                {busy === "deposit" ? "Submitting..." : `Deposit ${depositNear} NEAR`}
              </button>
            </div>

            {/* Withdraw */}
            <div className="rounded-xl bg-panel-card border border-solar/30 p-4 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-solar" />
                  <span className="text-sm font-bold uppercase font-mono tracking-wide text-white">Withdraw</span>
                </div>
                <button
                  onClick={() => {
                    setWithdrawAll(true);
                    setWithdrawNear(withdrawMax);
                  }}
                  className="text-[11px] font-mono text-solar hover:underline"
                >
                  Max ({withdrawMax.toFixed(2)})
                </button>
              </div>
              <input
                type="number"
                min={0}
                max={withdrawMax}
                step={0.1}
                value={withdrawNear}
                onChange={(e) => {
                  setWithdrawAll(false);
                  setWithdrawNear(Number(e.target.value));
                }}
                disabled={withdrawAll}
                className="w-full p-2 rounded-lg bg-panel-dark border border-white/10 text-white text-sm focus:outline-none focus:border-solar disabled:opacity-50"
              />
              <label className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <input
                  type="checkbox"
                  checked={withdrawAll}
                  onChange={(e) => {
                    setWithdrawAll(e.target.checked);
                    if (e.target.checked) setWithdrawNear(withdrawMax);
                  }}
                  className="accent-solar"
                />
                Withdraw entire balance to wallet
              </label>
              <button
                onClick={() =>
                  run(
                    "withdraw",
                    () => withdraw(withdrawAll ? null : nearToYocto(withdrawNear)),
                    withdrawAll ? "Withdraw (Entire Balance)" : `Withdraw ${withdrawNear} NEAR`
                  )
                }
                disabled={busy !== null || (!withdrawAll && withdrawNear <= 0) || (!withdrawAll && withdrawNear > withdrawMax)}
                className="w-full py-2 rounded-lg bg-solar hover:bg-solar-dark text-oled text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40 active:scale-[0.99]"
              >
                {busy === "withdraw" ? "Submitting..." : "Withdraw"}
              </button>
            </div>

            {/* Backer: back_boss_vault + claim_backer_dividend */}
            <div className="rounded-xl bg-panel-card border border-frost/30 p-4 shadow-xl space-y-2.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-frost" />
                <span className="text-sm font-bold uppercase font-mono tracking-wide text-white">
                  Backer Vault
                </span>
                <span className="text-[10px] font-mono text-slate-400">15% tickets → dividends</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Floor</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={backFloor}
                    onChange={(e) => setBackFloor(Number(e.target.value))}
                    className="w-full mt-1 p-1.5 rounded bg-panel-dark border border-white/10 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Stake (NEAR)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={backAmount}
                    onChange={(e) => setBackAmount(Number(e.target.value))}
                    className="w-full mt-1 p-1.5 rounded bg-panel-dark border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>
              <div className="p-2 rounded bg-panel-dark border border-white/5 text-[11px] font-mono text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Shares (floor {dividendFloor})</span>
                  <span className="font-mono-numbers text-white font-bold">
                    {backer.data ? (Number(backer.data.shares) / 1e18).toFixed(2) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cycle</span>
                  <span className="font-mono-numbers text-frost font-bold">
                    {backer.data ? backer.data.current_cycle : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last claimed cycle</span>
                  <span className="font-mono-numbers text-slate-300">
                    {backer.data ? backer.data.last_claimed_cycle : "—"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    run(
                      "back",
                      () => back_boss_vault(backFloor, nearToYocto(backAmount)),
                      `Stake ${backAmount} NEAR on Floor ${backFloor}`
                    )
                  }
                  disabled={busy !== null || backAmount <= 0}
                  className="py-2 rounded-lg bg-frost hover:bg-frost-dark text-oled text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40 active:scale-[0.99]"
                >
                  {busy === "back" ? "Submitting..." : `Back ${backAmount} NEAR`}
                </button>
                <button
                  onClick={() =>
                    run(
                      "dividend",
                      () => claim_backer_dividend(dividendFloor, backer.data?.current_cycle ?? 0),
                      `Claim Dividends Floor ${dividendFloor}`
                    )
                  }
                  disabled={busy !== null || !backer.data || backer.data.shares === "0"}
                  className="py-2 rounded-lg bg-jackpot/15 hover:bg-jackpot/25 border border-jackpot/40 text-jackpot text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                >
                  {busy === "dividend" ? "Submitting..." : "Claim Dividend"}
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                <Swords className="w-3 h-3" />
                <span>
                  Dividends accrue from a 15% share of raid tickets on the floor you back, distributed proportionally per share.
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3].map((f) => (
                  <button
                    key={f}
                    onClick={() => setDividendFloor(f)}
                    className={`py-1 rounded border text-[11px] font-mono font-bold transition-all ${
                      dividendFloor === f
                        ? "bg-frost/20 border-frost text-frost"
                        : "bg-panel-dark border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    Floor {f}
                  </button>
                ))}
              </div>
            </div>

            {/* History */}
            <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl space-y-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-frost" />
                <span className="text-sm font-bold uppercase font-mono tracking-wide text-white">Vault Activity</span>
                <span className="text-[10px] font-mono text-slate-400">local // current browser session</span>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {history.length === 0 ? (
                  <div className="h-12 flex items-center justify-center text-xs font-mono text-slate-500">
                    No transactions in this vault yet.
                  </div>
                ) : (
                  history.map((h) => (
                    <div
                      key={h.id}
                      className="p-1.5 rounded bg-panel-dark border border-white/5 flex items-center justify-between text-[11px] font-mono"
                    >
                      <span className="text-slate-400">{new Date(h.at).toLocaleTimeString()}</span>
                      <span className="text-slate-200 font-bold">{h.detail}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {txMessage && (
              <div className="px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-[11px] font-mono text-slate-300">
                {txMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
