"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Award,
  Coins,
  ExternalLink,
  Flame,
  History,
  RefreshCw,
  ScrollText,
  Shield,
  Trophy,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  type ChangeResult,
  type NftToken,
  get_balance,
  get_claimable,
  get_claimable_loot,
  get_backer,
  nft_total_supply,
  nft_token,
  deposit,
  withdraw,
  claim_payout,
  claim_jackpot,
  claim_backer_dividend,
  back_boss_vault,
  fund_jackpot,
} from "@/lib/contract";
import { useContractView, useSessionAccount } from "@/lib/spire/hooks";
import {
  formatNearAmount,
  getExplorerTxUrl,
  normalizeSvgDataUri,
} from "@/lib/utils/cn";
import {
  BACKER_SHARE_UNIT_NEAR,
  ELEMENT_NAMES,
  nearToYocto,
  yoctoToNear,
} from "@/lib/spire/constants";

const STORAGE_HISTORY_KEY = "spirefi_vault_history_v1";
const DEPOSIT_PRESETS: number[] = [1, 2, 5];

interface HistoryEntry {
  id: string;
  at: number;
  kind: "deposit" | "withdraw" | "claim" | "loot" | "back" | "dividend" | "fund";
  detail: string;
  txHash?: string;
}

interface TxFeedback {
  text: string;
  isError?: boolean;
  txHash?: string;
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
  const [fundFloor, setFundFloor] = useState<number>(1);
  const [fundAmount, setFundAmount] = useState<number>(0.5);
  const [nftRound, setNftRound] = useState<number>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxFeedback | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const backer = useContractView(
    async () => (accountId ? await get_backer(dividendFloor, accountId) : null),
    [accountId, dividendFloor]
  );

  const nftSupply = useContractView(nft_total_supply, []);
  const trophyTokenId = `spirefi-trophy-r${nftRound}-f3`;
  const trophyToken = useContractView<NftToken | null>(
    async () => await nft_token(trophyTokenId),
    [trophyTokenId]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryEntry[]);
    } catch {
      // ignore corrupted or unavailable local storage
    }
  }, []);

  const pushHistory = (
    kind: HistoryEntry["kind"],
    detail: string,
    txHash?: string
  ) => {
    setHistory((prev) => {
      const next: HistoryEntry[] = [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          at: Date.now(),
          kind,
          detail,
          txHash,
        },
        ...prev,
      ].slice(0, 25);
      try {
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // storage full: local log is best-effort
      }
      return next;
    });
  };

  const run = async (
    kind: HistoryEntry["kind"],
    action: () => Promise<ChangeResult>,
    detail: string,
    reload?: () => void
  ) => {
    setBusy(kind);
    setTxStatus(null);
    try {
      const res = await action();
      pushHistory(kind, detail, res.txHash);
      setTxStatus({
        text: `Transaction sent: ${detail}`,
        txHash: res.txHash,
      });
      balance.reload();
      reload?.();
    } catch (err) {
      setTxStatus({
        text:
          err instanceof Error
            ? err.message
            : "Transaction failed: check your session key or network.",
        isError: true,
      });
    } finally {
      setBusy(null);
    }
  };

  const checkClaimable = async () => {
    setClaimableError(null);
    try {
      if (!accountId) return;
      const yocto = await get_claimable(accountId, claimFloor, claimRound);
      const loot = await get_claimable_loot(accountId, claimFloor, claimRound).catch(
        () => null
      );
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
        <EmptyState
          title="No active session"
          hint="Enter your account name and authorize a session key on the Title Screen to access the signless vault."
          actionHref="/game/start"
          actionLabel="Go to Title Screen"
        />
      </div>
    );
  }

  const balanceYocto = balance.data ?? "0";
  const withdrawMax = yoctoToNear(balanceYocto);
  const shareCount = backer.data ? Number(backer.data.shares) : 0;
  const stakedWeightNear = Number.isFinite(shareCount)
    ? shareCount * BACKER_SHARE_UNIT_NEAR
    : 0;
  const txExplorerUrl = getExplorerTxUrl(txStatus?.txHash);
  const trophy = trophyToken.data;
  const trophySvgUri = normalizeSvgDataUri(trophy?.metadata?.media);

  return (
    <div className="px-1 py-6 sm:py-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">
            Vault &amp; Treasury
          </h1>
          <p className="text-xs sm:text-sm font-mono text-slate-300 mt-1">
            Internal ledger for signless raids, jackpot bounties, backer dividends, and Conqueror trophies.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            balance.reload();
            backer.reload();
            nftSupply.reload();
            trophyToken.reload();
          }}
          className="min-h-[44px] px-3.5 py-2 rounded-lg bg-panel-card hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-mono font-semibold flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-frost" aria-hidden="true" />
          Refresh Vault
        </button>
      </div>

      {txStatus && (
        <div
          aria-live="polite"
          className={`px-4 py-3 rounded-xl border text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
            txStatus.isError
              ? "bg-solar/10 border-solar/40 text-solar"
              : "bg-emerald-500/10 border-emerald-400/35 text-emerald-300"
          }`}
        >
          <span>{txStatus.text}</span>
          {txExplorerUrl && (
            <a
              href={txExplorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline font-bold text-white hover:text-jackpot"
            >
              View on NearBlocks
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {balance.error && !balance.data ? (
        <EmptyState
          title="Balance unavailable"
          hint="Failed to read get_balance from the contract."
          onReload={balance.reload}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Left rail: Ledger, Claims, Conqueror Trophy NFT Viewer */}
          <div className="md:col-span-5 flex flex-col gap-4">
            <section className="rounded-xl bg-panel-card border border-jackpot/30 p-5 elevation-panel">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-jackpot" aria-hidden="true" />
                <span className="text-xs uppercase font-bold tracking-widest font-mono text-slate-300">
                  Ledger Balance
                </span>
              </div>
              <div className="text-3xl font-black font-mono-numbers text-white">
                {formatNearAmount(balanceYocto, 4)}
              </div>
              <div className="text-xs font-mono text-slate-300 mt-1.5">
                Account <span className="text-white font-semibold">{accountId}</span>
              </div>
            </section>

            {/* Claim payout + loot */}
            <section className="rounded-xl bg-panel-card border border-white/10 p-5 elevation-panel space-y-3">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase font-mono tracking-wide text-white">
                  Claim Round Rewards
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                <div>
                  <label htmlFor="claim-floor" className="block text-[11px] text-slate-300 uppercase">
                    Floor
                  </label>
                  <input
                    id="claim-floor"
                    type="number"
                    min={1}
                    max={3}
                    value={claimFloor}
                    onChange={(e) =>
                      setClaimFloor(Math.min(3, Math.max(1, Number(e.target.value) || 1)))
                    }
                    className="w-full min-h-[44px] mt-1 px-2.5 py-2 rounded-lg bg-panel-dark border border-white/15 text-white font-mono-numbers"
                  />
                </div>
                <div>
                  <label htmlFor="claim-round" className="block text-[11px] text-slate-300 uppercase">
                    Round
                  </label>
                  <input
                    id="claim-round"
                    type="number"
                    min={1}
                    value={claimRound}
                    onChange={(e) => setClaimRound(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full min-h-[44px] mt-1 px-2.5 py-2 rounded-lg bg-panel-dark border border-white/15 text-white font-mono-numbers"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={checkClaimable}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-100 text-xs font-mono font-bold transition-colors"
              >
                Check Unclaimed Raid Rewards
              </button>
              <div className="pt-2 border-t border-white/10 text-xs font-mono leading-relaxed">
                {claimableYocto !== null ? (
                  <>
                    <span className="text-jackpot font-bold">
                      Payout: {formatNearAmount(claimableYocto, 4)}
                    </span>
                    {claimLoot && (
                      <span className="block text-slate-300 mt-0.5">
                        Loot: {claimLoot.map((n, i) => `${n} ${ELEMENT_NAMES[i]}`).join(", ")}
                      </span>
                    )}
                  </>
                ) : claimableError ? (
                  <span className="text-solar">{claimableError}</span>
                ) : (
                  <span className="text-slate-400">Not checked yet for Floor {claimFloor}, Round {claimRound}.</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    run(
                      "claim",
                      () => claim_payout(claimFloor, claimRound),
                      `Claim Floor ${claimFloor} Round ${claimRound} Payout`
                    )
                  }
                  disabled={busy !== null}
                  className="min-h-[44px] py-2 px-3 rounded-lg bg-jackpot/15 hover:bg-jackpot/25 border border-jackpot/40 text-jackpot text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                >
                  {busy === "claim" ? "Submitting..." : "Claim Payout"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run("loot", () => claim_jackpot(), "Claim All Recent Bounties")
                  }
                  disabled={busy !== null}
                  className="min-h-[44px] py-2 px-3 rounded-lg bg-solar/15 hover:bg-solar/25 border border-solar/40 text-solar text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                >
                  {busy === "loot" ? "Submitting..." : "Claim All"}
                </button>
              </div>
            </section>

            {/* On-Chain Conqueror Trophy NFT Viewer */}
            <section className="rounded-xl bg-panel-card border border-jackpot/25 p-5 elevation-panel space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-jackpot" aria-hidden="true" />
                  <h2 className="text-sm font-bold uppercase font-mono tracking-wide text-white">
                    Conqueror Trophy NFTs
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-jackpot bg-jackpot/10 border border-jackpot/30 px-2 py-0.5 rounded">
                  Minted: {nftSupply.data ?? "0"}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-300 leading-relaxed">
                NEP-171 trophies with on-chain SVG art are minted to the killing striker when Floor 3 is cleared.
              </p>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="nft-round-input" className="block text-[11px] font-mono text-slate-300 uppercase">
                    Inspect Floor 3 Round
                  </label>
                  <input
                    id="nft-round-input"
                    type="number"
                    min={1}
                    value={nftRound}
                    onChange={(e) => setNftRound(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full min-h-[44px] mt-1 px-2.5 py-2 rounded-lg bg-panel-dark border border-white/15 text-white text-xs font-mono-numbers"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => trophyToken.reload()}
                  className="min-h-[44px] px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-100 text-xs font-mono font-semibold"
                >
                  Load
                </button>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Token ID</span>
                  <span className="text-slate-200 font-semibold">{trophyTokenId}</span>
                </div>

                {trophyToken.loading ? (
                  <p className="text-xs font-mono text-slate-300 py-4 text-center">
                    Loading NEP-171 metadata...
                  </p>
                ) : trophy ? (
                  <div className="space-y-2.5">
                    {trophySvgUri ? (
                      <div className="overflow-hidden rounded-lg border border-white/10 bg-oled">
                        <img
                          src={trophySvgUri}
                          alt={trophy.metadata?.title ?? `Conqueror Trophy ${trophy.token_id}`}
                          className="w-full h-auto max-h-56 object-contain mx-auto block"
                        />
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs font-mono text-slate-400 bg-panel-dark rounded-lg">
                        On-chain SVG artwork not attached to this token.
                      </div>
                    )}
                    <div className="divide-y divide-white/10 text-xs font-mono">
                      <div className="py-1.5 flex items-center justify-between gap-2">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-jackpot" aria-hidden="true" />
                          Title
                        </span>
                        <span className="text-white font-bold text-right">
                          {trophy.metadata?.title ?? trophy.token_id}
                        </span>
                      </div>
                      <div className="py-1.5 flex items-center justify-between gap-2">
                        <span className="text-slate-400">Owner</span>
                        <span className="text-frost font-semibold text-right truncate max-w-[65%]">
                          {trophy.owner_id}
                        </span>
                      </div>
                      {trophy.metadata?.description && (
                        <p className="pt-2 text-[11px] text-slate-300 leading-relaxed">
                          {trophy.metadata.description}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-mono text-slate-400 py-3">
                    No Conqueror NFT minted yet for {trophyTokenId}. Defeat Floor 3 Boss Kaelen in that round to mint one.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Right rail: Deposit, Withdraw, Backer Vault, Fund Jackpot, Activity */}
          <div className="md:col-span-7 flex flex-col gap-4">
            {/* Deposit & Withdraw split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Deposit */}
              <section className="rounded-xl bg-panel-card border border-emerald-400/30 p-5 elevation-panel space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    <h2 className="text-sm font-bold uppercase font-mono tracking-wide text-white">
                      Deposit
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-300">Payable NEAR</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {DEPOSIT_PRESETS.map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setDepositNear(val)}
                      className={`min-h-[44px] py-2 rounded-lg border text-xs font-mono font-bold transition-colors ${
                        depositNear === val
                          ? "bg-emerald-400/20 border-emerald-400 text-emerald-300"
                          : "bg-panel-dark border-white/10 text-slate-300 hover:text-white"
                      }`}
                    >
                      {val} N
                    </button>
                  ))}
                </div>
                <div>
                  <label htmlFor="deposit-amount" className="block text-[11px] font-mono text-slate-300 uppercase mb-1">
                    Amount (NEAR)
                  </label>
                  <input
                    id="deposit-amount"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={depositNear}
                    onChange={(e) => setDepositNear(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-white text-sm font-mono-numbers"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    run(
                      "deposit",
                      () => deposit(nearToYocto(depositNear)),
                      `Deposit ${depositNear} NEAR`
                    )
                  }
                  disabled={busy !== null || depositNear <= 0 || Number.isNaN(depositNear)}
                  className="w-full min-h-[44px] py-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-oled text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                >
                  {busy === "deposit" ? "Submitting..." : `Deposit ${depositNear} NEAR`}
                </button>
              </section>

              {/* Withdraw */}
              <section className="rounded-xl bg-panel-card border border-solar/30 p-5 elevation-panel space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="w-4 h-4 text-solar" aria-hidden="true" />
                    <h2 className="text-sm font-bold uppercase font-mono tracking-wide text-white">
                      Withdraw
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawAll(true);
                      setWithdrawNear(withdrawMax);
                    }}
                    className="min-h-[44px] px-2 text-[11px] font-mono font-semibold text-solar hover:underline"
                  >
                    Max ({withdrawMax.toFixed(2)} N)
                  </button>
                </div>
                <div>
                  <label htmlFor="withdraw-amount" className="block text-[11px] font-mono text-slate-300 uppercase mb-1">
                    Amount (NEAR)
                  </label>
                  <input
                    id="withdraw-amount"
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
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-white text-sm font-mono-numbers disabled:opacity-50"
                  />
                </div>
                <label
                  htmlFor="withdraw-all"
                  className="flex items-center gap-2 min-h-[44px] text-xs font-mono text-slate-300 cursor-pointer"
                >
                  <input
                    id="withdraw-all"
                    type="checkbox"
                    checked={withdrawAll}
                    onChange={(e) => {
                      setWithdrawAll(e.target.checked);
                      if (e.target.checked) setWithdrawNear(withdrawMax);
                    }}
                    className="w-4 h-4 accent-solar"
                  />
                  Withdraw entire ledger balance to wallet
                </label>
                <button
                  type="button"
                  onClick={() =>
                    run(
                      "withdraw",
                      () => withdraw(withdrawAll ? null : nearToYocto(withdrawNear)),
                      withdrawAll ? "Withdraw Entire Balance" : `Withdraw ${withdrawNear} NEAR`
                    )
                  }
                  disabled={
                    busy !== null ||
                    (!withdrawAll && (withdrawNear <= 0 || withdrawNear > withdrawMax || Number.isNaN(withdrawNear)))
                  }
                  className="w-full min-h-[44px] py-2.5 rounded-lg bg-solar hover:bg-solar-dark text-oled text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                >
                  {busy === "withdraw" ? "Submitting..." : "Withdraw"}
                </button>
              </section>
            </div>

            {/* Backer: back_boss_vault + claim_backer_dividend */}
            <section className="rounded-xl bg-panel-card border border-frost/30 p-5 elevation-panel space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-frost" aria-hidden="true" />
                  <h2 className="text-sm font-bold uppercase font-mono tracking-wide text-white">
                    Backer Vault
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-frost">
                  15% of raid tickets fund floor dividends
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                <div>
                  <label htmlFor="back-floor" className="block text-[11px] text-slate-300 uppercase">
                    Floor
                  </label>
                  <input
                    id="back-floor"
                    type="number"
                    min={1}
                    max={3}
                    value={backFloor}
                    onChange={(e) =>
                      setBackFloor(Math.min(3, Math.max(1, Number(e.target.value) || 1)))
                    }
                    className="w-full min-h-[44px] mt-1 px-2.5 py-2 rounded-lg bg-panel-dark border border-white/15 text-white font-mono-numbers"
                  />
                </div>
                <div>
                  <label htmlFor="back-amount" className="block text-[11px] text-slate-300 uppercase">
                    Stake (NEAR)
                  </label>
                  <input
                    id="back-amount"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={backAmount}
                    onChange={(e) => setBackAmount(Number(e.target.value))}
                    className="w-full min-h-[44px] mt-1 px-2.5 py-2 rounded-lg bg-panel-dark border border-white/15 text-white font-mono-numbers"
                  />
                </div>
              </div>

              {/* Flat hairline ledger breakdown (no nested bordered box) */}
              <div className="pt-2 border-t border-white/10 divide-y divide-white/5 text-xs font-mono text-slate-300">
                <div className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-slate-400">
                    Shares on Floor {dividendFloor} ({BACKER_SHARE_UNIT_NEAR} N/share)
                  </span>
                  <span className="font-mono-numbers text-white font-bold">
                    {backer.data
                      ? `${shareCount.toLocaleString()} shares (${stakedWeightNear.toFixed(2)} N weight)`
                      : "Pending"}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-slate-400">Current cycle</span>
                  <span className="font-mono-numbers text-frost font-bold">
                    {backer.data ? backer.data.current_cycle : "Pending"}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-slate-400">Last claimed cycle</span>
                  <span className="font-mono-numbers text-slate-200">
                    {backer.data ? backer.data.last_claimed_cycle : "Pending"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((f) => (
                  <button
                    type="button"
                    key={f}
                    onClick={() => setDividendFloor(f)}
                    className={`min-h-[44px] py-2 rounded-lg border text-xs font-mono font-bold transition-colors ${
                      dividendFloor === f
                        ? "bg-frost/20 border-frost text-frost"
                        : "bg-panel-dark border-white/10 text-slate-300 hover:text-white"
                    }`}
                  >
                    Floor {f}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    run(
                      "back",
                      () => back_boss_vault(backFloor, nearToYocto(backAmount)),
                      `Back ${backAmount} NEAR on Floor ${backFloor}`,
                      backer.reload
                    )
                  }
                  disabled={busy !== null || backAmount <= 0 || Number.isNaN(backAmount)}
                  className="min-h-[44px] py-2.5 px-3 rounded-lg bg-frost hover:bg-frost-dark text-oled text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                >
                  {busy === "back" ? "Submitting..." : `Back ${backAmount} NEAR`}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(
                      "dividend",
                      () => claim_backer_dividend(dividendFloor, backer.data?.current_cycle ?? 0),
                      `Claim Dividends Floor ${dividendFloor}`,
                      backer.reload
                    )
                  }
                  disabled={busy !== null || !backer.data || backer.data.shares === "0"}
                  className="min-h-[44px] py-2.5 px-3 rounded-lg bg-jackpot/15 hover:bg-jackpot/25 border border-jackpot/40 text-jackpot text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                >
                  {busy === "dividend" ? "Submitting..." : "Claim Dividend"}
                </button>
              </div>

              <p className="text-[11px] font-mono text-slate-300 leading-relaxed pt-1 border-t border-white/10">
                Non-refundable principal disclosure: NEAR committed via Back Boss Vault remains in the floor reserve to guarantee AI buybacks and earn perpetual 15% ticket dividends. Principal cannot be unstaked.
              </p>
            </section>

            {/* Fund Jackpot */}
            <section className="rounded-xl bg-panel-card border border-jackpot/25 p-5 elevation-panel space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-jackpot" aria-hidden="true" />
                  <h2 className="text-sm font-bold uppercase font-mono tracking-wide text-white">
                    Fund Floor Jackpot
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-300">Sponsor Bounty Pool</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono items-end">
                <div>
                  <label htmlFor="fund-floor" className="block text-[11px] text-slate-300 uppercase">
                    Target Floor
                  </label>
                  <select
                    id="fund-floor"
                    value={fundFloor}
                    onChange={(e) => setFundFloor(Number(e.target.value))}
                    className="w-full min-h-[44px] mt-1 px-2.5 py-2 rounded-lg bg-panel-dark border border-white/15 text-white"
                  >
                    <option value={1}>Floor 1</option>
                    <option value={2}>Floor 2</option>
                    <option value={3}>Floor 3</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="fund-amount" className="block text-[11px] text-slate-300 uppercase">
                    Sponsor (NEAR)
                  </label>
                  <input
                    id="fund-amount"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={fundAmount}
                    onChange={(e) => setFundAmount(Number(e.target.value))}
                    className="w-full min-h-[44px] mt-1 px-2.5 py-2 rounded-lg bg-panel-dark border border-white/15 text-white font-mono-numbers"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    run(
                      "fund",
                      () => fund_jackpot(fundFloor, nearToYocto(fundAmount)),
                      `Fund Floor ${fundFloor} Jackpot (+${fundAmount} NEAR)`
                    )
                  }
                  disabled={busy !== null || fundAmount <= 0 || Number.isNaN(fundAmount)}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-jackpot/20 hover:bg-jackpot/30 border border-jackpot/40 text-jackpot text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                >
                  {busy === "fund" ? "Submitting..." : "Sponsor"}
                </button>
              </div>
            </section>

            {/* History */}
            <section className="rounded-xl bg-panel-card border border-white/10 p-5 elevation-panel space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-frost" aria-hidden="true" />
                  <h2 className="text-sm font-bold uppercase font-mono tracking-wide text-white">
                    Vault Activity
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Local session log
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-white/10">
                {history.length === 0 ? (
                  <div className="py-4 text-center text-xs font-mono text-slate-400">
                    No transactions recorded in this browser session yet.
                  </div>
                ) : (
                  history.map((h) => {
                    const url = getExplorerTxUrl(h.txHash);
                    return (
                      <div
                        key={h.id}
                        className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-slate-400">
                            {new Date(h.at).toLocaleTimeString()}
                          </span>
                          <span className="text-slate-100 font-semibold">{h.detail}</span>
                        </div>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-frost hover:underline"
                          >
                            Explorer
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
