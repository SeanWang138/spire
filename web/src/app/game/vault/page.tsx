"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Award,
  CheckCircle2,
  Coins,
  ExternalLink,
  Gift,
  History,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
} from "lucide-react";
import {
  back_boss_vault,
  batchMap,
  claim_backer_dividend,
  claim_jackpot,
  claim_payout,
  deposit,
  fund_jackpot,
  get_backer,
  get_claimable,
  get_claimable_loot,
  get_tower,
  nearToYocto,
  nft_token,
  nft_total_supply,
  withdraw,
  yoctoToNear,
  type ChangeResult,
  type FloorResponse,
  type NftToken,
} from "@/lib/contract";
import { formatContractErrorMessage } from "@/lib/errors";
import {
  BACKER_SHARE_UNIT_NEAR,
  ELEMENT_NAMES,
  SPLIT_BACKER_BPS,
  SPLIT_BUYBACK_BPS,
  SPLIT_JACKPOT_BPS,
  SPLIT_MERCHANT_BPS,
} from "@/lib/spire/constants";
import { useContractView } from "@/lib/spire/hooks";
import { useSpireTelemetry } from "@/lib/spire/telemetry";
import {
  formatNearAmount,
  getExplorerTxUrl,
  normalizeSvgDataUri,
  parseYoctoSafe,
} from "@/lib/utils/cn";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  SpireTabs,
  SpireTabsContent,
  SpireTabsList,
  SpireTabsTrigger,
  SpireTooltip,
} from "@/components/ui/SpireUi";

const STORAGE_HISTORY_KEY = "spirefi.vault.history.v1";
const SHARE_UNIT_YOCTO = 10_000_000_000_000_000n; // 1e-8 NEAR per backer share (Jalur A)
const SMALL_WEIGHT_THRESHOLD_YOCTO = 10_000_000_000_000_000_000_000n; // 0.01 NEAR
const MAX_SCAN_ROUNDS_PER_FLOOR = 6;
const GAS_TANK_RESERVE_NEAR = 0.1;

const CONTROL_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar focus-visible:ring-offset-2 focus-visible:ring-offset-oled";

const FLOOR_LABELS: Record<number, string> = {
  1: "Floor 1: Ember Bastion",
  2: "Floor 2: Frost Ward",
  3: "Floor 3: Void Sanctum",
};

type VaultTab = "payouts" | "pouch" | "backer" | "trophies";

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

interface DiscoveredClaim {
  floor: number;
  round: number;
  payoutYocto: string;
  loot: [number, number, number];
}

function formatBackerShareNear(
  sharesRaw: string | number | bigint | null | undefined
): string {
  const shares = parseYoctoSafe(sharesRaw);
  if (shares === 0n) return formatNearAmount(0n, 4);
  const weightYocto = shares * SHARE_UNIT_YOCTO;
  const decimals = weightYocto < SMALL_WEIGHT_THRESHOLD_YOCTO ? 8 : 4;
  return formatNearAmount(weightYocto, decimals);
}

function parseNonNegativeInt(raw: string, fallback = 0): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function clampFloor(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.min(3, Math.max(1, Math.trunc(raw)));
}

function hasLoot(loot: [number, number, number] | null | undefined): boolean {
  if (!loot) return false;
  return loot[0] + loot[1] + loot[2] > 0;
}

export default function VaultPage() {
  const { session, pouchYocto, pouchLoading, gasTankYocto, reloadBalance } =
    useSpireTelemetry();
  const accountId = session?.accountId ?? "";
  const historyStorageKey = accountId
    ? `${STORAGE_HISTORY_KEY}:${accountId}`
    : STORAGE_HISTORY_KEY;

  const [activeTab, setActiveTab] = useState<VaultTab>("pouch");
  const tabTouchedRef = useRef(false);
  const urlTabProvidedRef = useRef(false);

  const tower = useContractView(get_tower, []);

  // Unified floor selector for Floor Backer (stake + share view + dividend claim)
  const [selectedBackerFloor, setSelectedBackerFloor] = useState<number>(1);
  const [backAmount, setBackAmount] = useState<number>(0.15);

  // Pouch deposit / withdraw / jackpot sponsor state
  const [depositNear, setDepositNear] = useState<number>(0.15);
  const [withdrawAll, setWithdrawAll] = useState(false);
  const [withdrawNear, setWithdrawNear] = useState<number>(0);
  const [fundFloor, setFundFloor] = useState<number>(1);
  const [fundAmount, setFundAmount] = useState<number>(0.15);

  // Payouts & Loot state (supports Round 0!)
  const [claimFloor, setClaimFloor] = useState<number>(1);
  const [claimRound, setClaimRound] = useState<number>(0);
  const claimRoundTouchedRef = useRef(false);
  const [claimableYocto, setClaimableYocto] = useState<string | null>(null);
  const [claimableError, setClaimableError] = useState<string | null>(null);
  const [claimLoot, setClaimLoot] = useState<[number, number, number] | null>(
    null
  );

  // Auto-Discovery Claim Scanner state
  const [discoveredClaims, setDiscoveredClaims] = useState<DiscoveredClaim[]>(
    []
  );
  const [scanSummary, setScanSummary] = useState<string>(
    "Waiting for tower telemetry..."
  );
  const [scanningClaims, setScanningClaims] = useState(false);
  const [scanAllRounds, setScanAllRounds] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanGenRef = useRef(0);

  // Trophy NFT viewer state (supports Round 0!)
  const [nftRound, setNftRound] = useState<number>(0);
  const nftRoundTouchedRef = useRef(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxFeedback | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const backer = useContractView(
    async () =>
      accountId ? await get_backer(selectedBackerFloor, accountId) : null,
    [accountId, selectedBackerFloor]
  );

  const nftSupply = useContractView(nft_total_supply, []);
  const trophyTokenId = `spirefi-trophy-r${nftRound}-f3`;
  const trophyToken = useContractView<NftToken | null>(
    async () => await nft_token(trophyTokenId),
    [trophyTokenId]
  );

  const floorsByNumber = useMemo(() => {
    const map = new Map<number, FloorResponse>();
    for (const fl of tower.data?.floors ?? []) {
      map.set(fl.floor, fl);
    }
    return map;
  }, [tower.data]);

  const selectedClaimFloorData = floorsByNumber.get(claimFloor);
  const selectedBackerFloorData = floorsByNumber.get(selectedBackerFloor);
  const floor3Data = floorsByNumber.get(3);

  // Auto-default claimRound and nftRound to latest completed round (including Round 0!)
  useEffect(() => {
    if (!tower.data) return;
    if (!claimRoundTouchedRef.current) {
      const fl = floorsByNumber.get(claimFloor);
      setClaimRound(Math.max(0, (fl?.round ?? 1) - 1));
    }
    if (!nftRoundTouchedRef.current) {
      const f3 = floorsByNumber.get(3);
      setNftRound(Math.max(0, (f3?.round ?? 1) - 1));
    }
  }, [tower.data, floorsByNumber, claimFloor]);

  // Respect ?tab= query param without triggering Next.js static prerender Suspense constraints
  useEffect(() => {
    if (typeof window === "undefined") return;
    const param = new URLSearchParams(window.location.search).get("tab");
    if (
      param === "payouts" ||
      param === "pouch" ||
      param === "backer" ||
      param === "trophies"
    ) {
      urlTabProvidedRef.current = true;
      tabTouchedRef.current = true;
      setActiveTab(param);
    }
  }, []);

  // Load persisted local history scoped per account
  useEffect(() => {
    if (!accountId) {
      setHistory([]);
      return;
    }
    try {
      const raw = localStorage.getItem(historyStorageKey);
      setHistory(raw ? (JSON.parse(raw) as HistoryEntry[]) : []);
    } catch {
      setHistory([]);
    }
  }, [accountId, historyStorageKey]);

  const runClaimScan = useCallback(
    async (maxRoundsOverride?: number) => {
      if (!accountId || !tower.data) return;
      const gen = ++scanGenRef.current;
      const MAX_FULL_SCAN_ROUNDS = 120;
      const scanWindow =
        maxRoundsOverride ??
        (scanAllRounds ? MAX_FULL_SCAN_ROUNDS : MAX_SCAN_ROUNDS_PER_FLOOR);
      setScanningClaims(true);
      setScanError(null);

      try {
        const targets: Array<{ floor: number; round: number }> = [];
        const scannedNotes: string[] = [];

        for (const fl of tower.data.floors) {
          const latestCompleted = fl.round - 1;
          if (latestCompleted >= 0) {
            const startRound = Math.max(0, latestCompleted - (scanWindow - 1));
            for (let r = startRound; r <= latestCompleted; r += 1) {
              targets.push({ floor: fl.floor, round: r });
            }
            scannedNotes.push(
              `F${fl.floor} R${startRound}${latestCompleted > startRound ? `-${latestCompleted}` : ""}`
            );
          } else if (fl.hp === 0) {
            targets.push({ floor: fl.floor, round: 0 });
            scannedNotes.push(`F${fl.floor} R0`);
          } else {
            scannedNotes.push(`F${fl.floor} R0 open`);
          }
        }

        if (targets.length === 0) {
          if (scanGenRef.current === gen) {
            setDiscoveredClaims([]);
            setScanSummary(
              `No completed rounds yet (${scannedNotes.join(", ")}).`
            );
            if (!urlTabProvidedRef.current && !tabTouchedRef.current) {
              setActiveTab("pouch");
            }
          }
          return;
        }

        const results = await batchMap(
          targets,
          6,
          async ({ floor, round }) => {
            try {
              const [payoutYocto, loot] = await Promise.all([
                get_claimable(accountId, floor, round),
                get_claimable_loot(accountId, floor, round),
              ]);
              return { status: "fulfilled" as const, value: { floor, round, payoutYocto, loot } };
            } catch (reason) {
              return { status: "rejected" as const, reason };
            }
          }
        );

        if (scanGenRef.current !== gen) return;

        const found: DiscoveredClaim[] = [];
        let failedChecks = 0;

        for (const res of results) {
          if (res.status === "fulfilled") {
            const item = res.value;
            if (parseYoctoSafe(item.payoutYocto) > 0n || hasLoot(item.loot)) {
              found.push(item);
            }
          } else {
            failedChecks += 1;
          }
        }

        setDiscoveredClaims(found);
        if (!urlTabProvidedRef.current && !tabTouchedRef.current) {
          setActiveTab(found.length > 0 ? "payouts" : "pouch");
        }
        if (failedChecks > 0 && found.length === 0) {
          setScanError(
            `Scanned ${targets.length} round(s), but ${failedChecks} RPC check(s) failed. Retry scan.`
          );
        }
        setScanSummary(`Scanned ${scannedNotes.join(" | ")}`);
      } catch (err) {
        if (scanGenRef.current === gen) {
          setScanError(formatContractErrorMessage(err));
        }
      } finally {
        if (scanGenRef.current === gen) {
          setScanningClaims(false);
        }
      }
    },
    [accountId, scanAllRounds, tower.data]
  );

  useEffect(() => {
    void runClaimScan();
  }, [runClaimScan]);

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
        localStorage.setItem(historyStorageKey, JSON.stringify(next));
      } catch {
        // storage full: local log is best-effort
      }
      return next;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(historyStorageKey);
    } catch {
      // ignore storage unavailability
    }
  };

  const refreshAllVaultData = useCallback(() => {
    reloadBalance();
    tower.reload();
    backer.reload();
    nftSupply.reload();
    trophyToken.reload();
    void runClaimScan();
  }, [reloadBalance, tower, backer, nftSupply, trophyToken, runClaimScan]);

  const run = async (
    kind: HistoryEntry["kind"],
    action: () => Promise<ChangeResult>,
    detail: string,
    afterSuccess?: () => void
  ) => {
    setBusy(kind);
    setTxStatus(null);
    try {
      const res = await action();
      pushHistory(kind, detail, res.txHash);
      setTxStatus({
        text: `Confirmed: ${detail}`,
        txHash: res.txHash,
      });
      refreshAllVaultData();
      afterSuccess?.();
    } catch (err) {
      setTxStatus({
        text: formatContractErrorMessage(err),
        isError: true,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleCheckClaimable = async () => {
    if (!accountId) return;
    setBusy("check");
    setClaimableError(null);
    try {
      const [amount, loot] = await Promise.all([
        get_claimable(accountId, claimFloor, claimRound),
        get_claimable_loot(accountId, claimFloor, claimRound),
      ]);
      setClaimableYocto(amount);
      setClaimLoot(loot);
    } catch (err) {
      setClaimableError(formatContractErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <EmptyState
          headingAs="h1"
          title="No active guest session"
          hint="Launch a 1-click guest subaccount on the Start screen to manage your Citadel Pouch, raid bounties, and trophies."
          actionHref="/game/start"
          actionLabel="Go to Title Screen"
        />
      </div>
    );
  }

  const balanceYocto = pouchYocto ?? "0";
  const withdrawMax = yoctoToNear(balanceYocto);
  const gasTankNear =
    gasTankYocto !== null ? yoctoToNear(gasTankYocto) : null;
  const maxSafeDepositNear =
    gasTankNear !== null
      ? Math.max(
          0,
          Math.floor((gasTankNear - GAS_TANK_RESERVE_NEAR) * 100) / 100
        )
      : null;
  const depositExceedsReserve =
    maxSafeDepositNear !== null && depositNear > maxSafeDepositNear;
  const hasClaimableRewards = discoveredClaims.length > 0;
  const manualHasClaimable =
    claimableYocto !== null &&
    (parseYoctoSafe(claimableYocto) > 0n || hasLoot(claimLoot));
  const hasOlderRounds = (tower.data?.floors ?? []).some(
    (fl) => fl.round > MAX_SCAN_ROUNDS_PER_FLOOR
  );
  const totalDiscoveredNearYocto = discoveredClaims.reduce(
    (sum, item) => sum + parseYoctoSafe(item.payoutYocto),
    0n
  );
  const totalDiscoveredEssence = discoveredClaims.reduce(
    (sum, item) => sum + item.loot[0] + item.loot[1] + item.loot[2],
    0
  );

  const backerSharesFormatted = formatBackerShareNear(backer.data?.shares);
  const yourSharesBig = parseYoctoSafe(backer.data?.shares);
  const floorTotalSharesBig = parseYoctoSafe(
    selectedBackerFloorData?.backer_total_shares
  );
  const sharePercentText =
    floorTotalSharesBig > 0n
      ? (Number((yourSharesBig * 10_000n) / floorTotalSharesBig) / 100).toFixed(2)
      : "0.00";
  const floor3CompletedRounds = Math.max(0, (floor3Data?.round ?? 1) - 1);
  const recentFloor3Rounds = Array.from(
    { length: Math.min(6, floor3CompletedRounds + 1) },
    (_, idx) => idx
  );

  const txExplorerUrl = getExplorerTxUrl(txStatus?.txHash);
  const trophy = trophyToken.data;
  const trophySvgUri = normalizeSvgDataUri(trophy?.metadata?.media);
  const shareUnitText = BACKER_SHARE_UNIT_NEAR.toExponential(0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-brass/15">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-parchment tracking-wide">
            Vault &amp; Treasury
          </h1>
          <p className="text-sm text-ash mt-1.5 max-w-2xl leading-relaxed">
            Manage signless raid balances, auto-discovered payouts, Floor Backer dividends, and Floor 3 Conqueror NFTs.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAllVaultData}
          disabled={scanningClaims || busy !== null}
          className={`min-h-[44px] px-4 py-2 rounded-lg bg-panel-card hover:bg-white/10 border border-white/15 text-parchment text-xs font-mono font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50 ${CONTROL_RING}`}
        >
          <RefreshCw
            className={`w-4 h-4 text-frost ${scanningClaims ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh Vault
        </button>
      </header>

      {txStatus && (
        <div
          aria-live="polite"
          className={`px-4 py-3 rounded-xl border text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
            txStatus.isError
              ? "bg-hp/10 border-hp/40 text-hp-text"
              : "bg-jackpot/10 border-jackpot/35 text-jackpot"
          }`}
        >
          <span>{txStatus.text}</span>
          {txExplorerUrl && (
            <a
              href={txExplorerUrl}
              target="_blank"
              rel="noreferrer"
              className={`min-h-[44px] inline-flex items-center gap-1.5 px-2 underline font-bold text-parchment hover:text-jackpot ${CONTROL_RING}`}
            >
              View on NearBlocks
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {!pouchLoading && pouchYocto === null && tower.error && !tower.data ? (
        <EmptyState
          title="Vault ledger unavailable"
          hint="Failed to read get_balance from the SpireFi contract. Check testnet RPC connectivity and retry."
          onReload={refreshAllVaultData}
        />
      ) : (
        <>
          {/* Live Treasury Overview Strip */}
          <section
            aria-label="Treasury overview"
            className="citadel-stage border-t-jackpot/40 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <button
              type="button"
              onClick={() => {
                tabTouchedRef.current = true;
                setActiveTab("payouts");
              }}
              className={`min-h-[44px] text-left rounded-lg bg-panel-dark/75 hover:bg-panel-elevated/80 p-3.5 transition-colors flex flex-col justify-between gap-1 ${CONTROL_RING}`}
            >
              <span className="text-xs font-mono text-ash inline-flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-jackpot shrink-0" aria-hidden="true" />
                Unclaimed Bounties
              </span>
              <span className="text-xl font-bold font-mono-numbers text-parchment">
                {scanningClaims
                  ? "Scanning..."
                  : formatNearAmount(totalDiscoveredNearYocto, 4)}
              </span>
              <span className="text-xs font-mono text-pewter">
                {discoveredClaims.length} round(s), {totalDiscoveredEssence} seized weapon loot
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                tabTouchedRef.current = true;
                setActiveTab("pouch");
              }}
              className={`min-h-[44px] text-left rounded-lg bg-panel-dark/75 hover:bg-panel-elevated/80 p-3.5 transition-colors flex flex-col justify-between gap-1 ${CONTROL_RING}`}
            >
              <span className="text-xs font-mono text-ash inline-flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-solar shrink-0" aria-hidden="true" />
                Citadel Pouch
              </span>
              <span className="text-xl font-bold font-mono-numbers text-parchment">
                {pouchLoading && pouchYocto === null
                  ? "..."
                  : formatNearAmount(balanceYocto, 4)}
              </span>
              <span className="text-xs font-mono text-pewter truncate">
                {accountId}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("backer")}
              className={`min-h-[44px] text-left rounded-lg bg-panel-dark/75 hover:bg-panel-elevated/80 p-3.5 transition-colors flex flex-col justify-between gap-1 ${CONTROL_RING}`}
            >
              <span className="text-xs font-mono text-ash inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-frost shrink-0" aria-hidden="true" />
                Floor {selectedBackerFloor} Stake
              </span>
              <span className="text-xl font-bold font-mono-numbers text-parchment">
                {backerSharesFormatted}
              </span>
              <span className="text-xs font-mono text-pewter">
                {sharePercentText}% of pool (Cycle {backer.data?.current_cycle ?? 0})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                tabTouchedRef.current = true;
                setActiveTab("trophies");
              }}
              className={`min-h-[44px] text-left rounded-lg bg-panel-dark/75 hover:bg-panel-elevated/80 p-3.5 transition-colors flex flex-col justify-between gap-1 ${CONTROL_RING}`}
            >
              <span className="text-xs font-mono text-ash inline-flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-jackpot shrink-0" aria-hidden="true" />
                Relic Trophies
              </span>
              <span className="text-xl font-bold font-mono-numbers text-parchment">
                {nftSupply.data ?? "0"} Minted
              </span>
              <span className="text-xs font-mono text-pewter">
                Viewing {trophyTokenId}
              </span>
            </button>
          </section>

          <SpireTabs
            value={activeTab}
            onValueChange={(val) => {
              tabTouchedRef.current = true;
              setActiveTab(val as VaultTab);
            }}
            className="flex flex-col gap-5"
          >
            <SpireTabsList
              aria-label="Vault sections"
              className="w-full sm:w-auto gap-2"
            >
              <SpireTabsTrigger value="payouts" className={CONTROL_RING}>
                Payouts &amp; Loot
              </SpireTabsTrigger>
              <SpireTabsTrigger value="pouch" className={CONTROL_RING}>
                Citadel Pouch
              </SpireTabsTrigger>
              <SpireTabsTrigger value="backer" className={CONTROL_RING}>
                Floor Backer
              </SpireTabsTrigger>
              <SpireTabsTrigger value="trophies" className={CONTROL_RING}>
                Relic Trophies
              </SpireTabsTrigger>
            </SpireTabsList>

            {/* TAB 1: PAYOUTS & LOOT */}
            <SpireTabsContent value="payouts" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* 1-Click Auto-Discovery Claim Scanner */}
                <section className="lg:col-span-7 obsidian-surface border-t-jackpot/40 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-jackpot shrink-0" aria-hidden="true" />
                      <h2 className="font-serif text-lg font-bold text-parchment">
                        Auto-Discovered Rewards
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void runClaimScan()}
                        disabled={scanningClaims || busy !== null}
                        className={`min-h-[44px] px-3.5 py-2 rounded-lg bg-panel-dark hover:bg-white/10 text-parchment text-xs font-mono font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50 ${CONTROL_RING}`}
                      >
                        {scanningClaims ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-frost" aria-hidden="true" />
                        ) : (
                          <Search className="w-3.5 h-3.5 text-frost" aria-hidden="true" />
                        )}
                        Rescan Recent
                      </button>
                      {hasOlderRounds && !scanAllRounds && (
                        <button
                          type="button"
                          onClick={() => {
                            setScanAllRounds(true);
                            void runClaimScan(10_000);
                          }}
                          disabled={scanningClaims || busy !== null}
                          className={`min-h-[44px] px-3.5 py-2 rounded-lg bg-panel-dark/70 hover:bg-white/10 border border-white/10 text-ash hover:text-parchment text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 ${CONTROL_RING}`}
                        >
                          Scan All
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-ash leading-relaxed">
                    Scans recent completed rounds (up to last {MAX_SCAN_ROUNDS_PER_FLOOR} per floor) across Floors 1 to 3 for unclaimed NEAR jackpots and seized weapon loot.
                  </p>

                  <div className="rounded-lg bg-panel-dark/75 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-pewter">
                        Total Ready to Sweep ({scanSummary})
                      </div>
                      <div className="text-2xl font-bold font-mono-numbers text-jackpot">
                        {formatNearAmount(totalDiscoveredNearYocto, 4)}
                      </div>
                      <div className="text-xs font-mono text-ash">
                        Seized weapon loot: {totalDiscoveredEssence} units across{" "}
                        {discoveredClaims.length} completed round(s)
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        run(
                          "loot",
                          () => claim_jackpot(),
                          "1-Click Claim All Recent Bounties & Loot"
                        )
                      }
                      disabled={
                        busy !== null || scanningClaims || !hasClaimableRewards
                      }
                      className={`min-h-[44px] px-4 py-2.5 rounded-lg bg-jackpot text-oled font-mono font-bold text-xs uppercase tracking-wider hover:bg-jackpot/90 transition-colors inline-flex items-center gap-2 disabled:opacity-45 ${CONTROL_RING}`}
                    >
                      <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                      {busy === "loot"
                        ? "Claiming..."
                        : discoveredClaims.length > 0
                          ? `1-Click Claim (${discoveredClaims.length})`
                          : "No Rewards Ready"}
                    </button>
                  </div>

                  {scanError && (
                    <div
                      role="alert"
                      className="rounded-lg bg-solar/10 px-3.5 py-2.5 text-xs font-mono text-solar"
                    >
                      {scanError}
                    </div>
                  )}

                  {discoveredClaims.length > 0 ? (
                    <ul className="divide-y divide-white/10 rounded-lg bg-panel-dark/60">
                      {discoveredClaims.map((entry) => (
                        <li
                          key={`${entry.floor}-${entry.round}`}
                          className="p-3.5 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold text-parchment font-mono">
                              Floor {entry.floor}, Round {entry.round}
                            </div>
                            <div className="text-xs font-mono text-ash">
                              Payout:{" "}
                              <span className="text-jackpot font-semibold font-mono-numbers">
                                {formatNearAmount(entry.payoutYocto, 4)}
                              </span>{" "}
                              | Loot: S {entry.loot[0]} / F {entry.loot[1]} / V{" "}
                              {entry.loot[2]}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                claimRoundTouchedRef.current = true;
                                setClaimFloor(entry.floor);
                                setClaimRound(entry.round);
                                setClaimableYocto(entry.payoutYocto);
                                setClaimLoot(entry.loot);
                              }}
                              className={`min-h-[44px] px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-parchment text-xs font-mono font-semibold transition-colors ${CONTROL_RING}`}
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                run(
                                  "claim",
                                  () => claim_payout(entry.floor, entry.round),
                                  `Claim Floor ${entry.floor} Round ${entry.round} Payout`
                                )
                              }
                              disabled={busy !== null}
                              className={`min-h-[44px] px-3.5 py-2 rounded-lg bg-solar/20 hover:bg-solar/30 text-solar text-xs font-mono font-bold transition-colors disabled:opacity-45 ${CONTROL_RING}`}
                            >
                              Claim F{entry.floor} R{entry.round}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-lg bg-panel-dark/50 px-4 py-4 text-xs font-mono text-ash flex items-center gap-2">
                      <CheckCircle2
                        className="w-4 h-4 text-jackpot shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        {scanningClaims
                          ? "Scanning your historical raid participation across Floors 1 to 3..."
                          : "No pending payouts or loot found in completed rounds. Defeat a floor boss to unlock Round payouts."}
                      </span>
                    </div>
                  )}
                </section>

                {/* Manual Floor & Round Inspector (supports Round 0!) */}
                <section className="lg:col-span-5 obsidian-surface border-t-solar/35 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-serif text-lg font-bold text-parchment">
                      Manual Round Lookup
                    </h2>
                    <SpireTooltip
                      triggerLabel="Explain round numbering and claim methods"
                      content="Rounds start at 0 on each floor. When Floor 1 completes its first boss defeat, Round 0 payouts become claimable and the floor advances to Round 1."
                    >
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-pewter px-2">
                        <Info className="w-3.5 h-3.5" aria-hidden="true" />
                        Starts at R0
                      </span>
                    </SpireTooltip>
                  </div>

                  <p className="text-xs text-ash leading-relaxed">
                    Query any specific floor and round (starting at Round 0) to inspect your exact jackpot payout and seized weapon loot before claiming.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="claim-floor"
                        className="block text-xs font-mono text-ash mb-1.5"
                      >
                        Floor (1 to 3)
                      </label>
                      <input
                        id="claim-floor"
                        type="number"
                        min={1}
                        max={3}
                        value={claimFloor}
                        onChange={(e) => {
                          claimRoundTouchedRef.current = false;
                          setClaimableYocto(null);
                          setClaimLoot(null);
                          setClaimableError(null);
                          setClaimFloor(
                            clampFloor(Number.parseInt(e.target.value, 10) || 1)
                          );
                        }}
                        className={`w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-parchment placeholder-ink text-sm font-mono-numbers ${CONTROL_RING}`}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="claim-round"
                        className="block text-xs font-mono text-ash mb-1.5"
                      >
                        Round (min 0)
                      </label>
                      <input
                        id="claim-round"
                        type="number"
                        min={0}
                        value={claimRound}
                        onChange={(e) => {
                          claimRoundTouchedRef.current = true;
                          setClaimableYocto(null);
                          setClaimLoot(null);
                          setClaimableError(null);
                          setClaimRound(parseNonNegativeInt(e.target.value, 0));
                        }}
                        className={`w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-parchment placeholder-ink text-sm font-mono-numbers ${CONTROL_RING}`}
                      />
                    </div>
                  </div>

                  {selectedClaimFloorData && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-pewter">
                      <span>
                        Live Floor {claimFloor} is on Round{" "}
                        {selectedClaimFloorData.round}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          claimRoundTouchedRef.current = true;
                          setClaimableYocto(null);
                          setClaimLoot(null);
                          setClaimableError(null);
                          setClaimRound(0);
                        }}
                        className={`min-h-[44px] px-2.5 rounded-lg bg-panel-dark hover:bg-white/10 text-parchment font-mono text-xs ${CONTROL_RING}`}
                      >
                        Jump to R0
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleCheckClaimable()}
                    disabled={busy !== null}
                    className={`w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-parchment text-xs font-mono font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-45 ${CONTROL_RING}`}
                  >
                    <Search className="w-4 h-4 text-frost" aria-hidden="true" />
                    {busy === "check" ? "Checking..." : "Check Round Payout & Loot"}
                  </button>

                  <div className="rounded-lg bg-panel-dark/75 p-3.5 text-xs font-mono space-y-1">
                    {claimableYocto !== null ? (
                      <>
                        <div className="text-jackpot font-semibold font-mono-numbers">
                          Claimable Payout:{" "}
                          {formatNearAmount(claimableYocto, 4)}
                        </div>
                        {claimLoot && (
                          <div className="text-ash">
                            Seized Weapon Loot: Solar {claimLoot[0]}, Frost{" "}
                            {claimLoot[1]}, Void {claimLoot[2]}
                          </div>
                        )}
                      </>
                    ) : claimableError ? (
                      <span className="text-hp-text">{claimableError}</span>
                    ) : (
                      <span className="text-ash">
                        Ready to check Floor {claimFloor}, Round {claimRound}.
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        run(
                          "claim",
                          () => claim_payout(claimFloor, claimRound),
                          `Claim Floor ${claimFloor} Round ${claimRound} Payout`
                        )
                      }
                      disabled={busy !== null || !manualHasClaimable}
                      className={`min-h-[44px] py-2 px-3 rounded-lg bg-jackpot/15 hover:bg-jackpot/25 border border-jackpot/40 text-jackpot text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40 ${CONTROL_RING}`}
                    >
                      {busy === "claim" ? "Submitting..." : "Claim Payout"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        run(
                          "loot",
                          () => claim_jackpot(),
                          "Claim All Recent Bounties"
                        )
                      }
                      disabled={busy !== null || !hasClaimableRewards}
                      className={`min-h-[44px] py-2 px-3 rounded-lg bg-solar/15 hover:bg-solar/25 border border-solar/40 text-solar text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40 ${CONTROL_RING}`}
                    >
                      {busy === "loot" ? "Submitting..." : "Claim All"}
                    </button>
                  </div>
                </section>
              </div>

              {/* Recent Treasury Activity Log */}
              <section className="obsidian-surface p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-pewter" aria-hidden="true" />
                    <h2 className="font-serif text-base font-bold text-parchment">
                      Local Session Treasury Log
                    </h2>
                  </div>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className={`min-h-[44px] px-3 py-1.5 rounded-lg bg-panel-dark hover:bg-white/10 text-ash text-xs font-mono ${CONTROL_RING}`}
                    >
                      Clear Log
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <p className="text-xs font-mono text-pewter">
                    Transactions executed from this Vault tab are recorded locally with NearBlocks verification links.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {history.map((item) => {
                      const itemUrl = getExplorerTxUrl(item.txHash);
                      return (
                        <li
                          key={item.id}
                          className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="uppercase px-2 py-0.5 rounded bg-panel-dark text-frost shrink-0">
                              {item.kind}
                            </span>
                            <span className="text-parchment truncate">
                              {item.detail}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-pewter">
                              {new Date(item.at).toLocaleTimeString()}
                            </span>
                            {itemUrl && (
                              <a
                                href={itemUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`min-h-[44px] inline-flex items-center gap-1 text-jackpot hover:underline ${CONTROL_RING}`}
                              >
                                Explorer
                                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </SpireTabsContent>

            {/* TAB 2: CITADEL POUCH */}
            <SpireTabsContent value="pouch" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Deposit & Withdraw */}
                <section className="lg:col-span-7 obsidian-surface border-t-solar/40 p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-solar shrink-0" aria-hidden="true" />
                      <h2 className="font-serif text-lg font-bold text-parchment">
                        Citadel Pouch Ledger
                      </h2>
                    </div>
                    <span className="text-sm font-mono-numbers font-bold text-jackpot">
                      {formatNearAmount(balanceYocto, 4)} available
                    </span>
                  </div>

                  <p className="text-xs text-ash leading-relaxed">
                    Your Citadel Pouch funds signless raid tickets and NPC Merchant orders without interrupting combat. Deposit from or withdraw back to your NEAR session account at any time.
                  </p>

                  {/* Deposit block */}
                  <div className="rounded-lg bg-panel-dark/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="deposit-amount"
                        className="text-xs font-mono font-semibold text-parchment inline-flex items-center gap-1.5"
                      >
                        <ArrowDownToLine
                          className="w-3.5 h-3.5 text-jackpot"
                          aria-hidden="true"
                        />
                        Deposit NEAR into Pouch
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[0.05, 0.15, 0.25].map((amt) => {
                          const unsafe =
                            maxSafeDepositNear !== null && amt > maxSafeDepositNear;
                          return (
                            <button
                              key={amt}
                              type="button"
                              disabled={unsafe}
                              onClick={() => setDepositNear(amt)}
                              className={`min-h-[44px] px-3 py-1 rounded-lg bg-panel-elevated hover:bg-white/10 text-parchment text-xs font-mono-numbers disabled:opacity-40 ${CONTROL_RING}`}
                            >
                              {amt} NEAR
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          disabled={maxSafeDepositNear === null || maxSafeDepositNear <= 0}
                          onClick={() => {
                            if (maxSafeDepositNear !== null && maxSafeDepositNear > 0) {
                              setDepositNear(maxSafeDepositNear);
                            }
                          }}
                          className={`min-h-[44px] px-3 py-1 rounded-lg bg-jackpot/15 hover:bg-jackpot/25 border border-jackpot/30 text-jackpot text-xs font-mono disabled:opacity-40 ${CONTROL_RING}`}
                        >
                          Max Safe
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-mono text-pewter">
                      Silent Gas Tank:{" "}
                      <span className="text-parchment font-mono-numbers">
                        {gasTankNear !== null
                          ? `${gasTankNear.toFixed(4)} NEAR`
                          : "checking..."}
                      </span>{" "}
                      — keeps {GAS_TANK_RESERVE_NEAR.toFixed(2)} NEAR reserved for signless transactions.
                    </p>

                    {depositExceedsReserve && (
                      <p className="text-xs font-mono text-solar">
                        Lower deposit to{" "}
                        <span className="font-semibold">
                          {maxSafeDepositNear?.toFixed(2)} NEAR
                        </span>{" "}
                        or less so your Silent Gas Tank retains {GAS_TANK_RESERVE_NEAR.toFixed(2)} NEAR.
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="deposit-amount"
                        type="number"
                        min={0.01}
                        step={0.05}
                        placeholder="0.15"
                        value={depositNear}
                        onChange={(e) =>
                          setDepositNear(Math.max(0, Number(e.target.value)))
                        }
                        className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-oled border border-white/15 text-parchment placeholder-ink text-sm font-mono-numbers ${CONTROL_RING}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            "deposit",
                            () => deposit(nearToYocto(depositNear)),
                            `Deposit ${depositNear} NEAR to Citadel Pouch`
                          )
                        }
                        disabled={
                          busy !== null || depositNear <= 0 || depositExceedsReserve
                        }
                        className={`min-h-[44px] px-5 py-2 rounded-lg bg-solar text-oled font-mono font-bold text-xs uppercase tracking-wider hover:bg-solar/90 transition-colors disabled:opacity-40 ${CONTROL_RING}`}
                      >
                        {busy === "deposit" ? "Depositing..." : "Deposit NEAR"}
                      </button>
                    </div>
                  </div>

                  {/* Withdraw block */}
                  <div className="rounded-lg bg-panel-dark/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="withdraw-amount"
                        className="text-xs font-mono font-semibold text-parchment inline-flex items-center gap-1.5"
                      >
                        <ArrowUpFromLine
                          className="w-3.5 h-3.5 text-frost"
                          aria-hidden="true"
                        />
                        Withdraw to NEAR Account
                      </label>
                      <button
                        id="withdraw-all"
                        type="button"
                        aria-pressed={withdrawAll}
                        onClick={() => setWithdrawAll((prev) => !prev)}
                        className={`min-h-[44px] px-3.5 py-2 rounded-lg border text-xs font-mono font-semibold inline-flex items-center gap-2 transition-colors ${
                          withdrawAll
                            ? "bg-frost/20 border-frost text-parchment"
                            : "bg-panel-elevated border-white/15 text-ash hover:text-parchment"
                        } ${CONTROL_RING}`}
                      >
                        <span>Withdraw Full Balance</span>
                        <span className="font-mono-numbers text-frost">
                          ({withdrawMax.toFixed(4)})
                        </span>
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="withdraw-amount"
                        type="number"
                        min={0}
                        step={0.05}
                        placeholder="0.10"
                        disabled={withdrawAll}
                        value={withdrawAll ? withdrawMax.toFixed(4) : withdrawNear}
                        onChange={(e) =>
                          setWithdrawNear(Math.max(0, Number(e.target.value)))
                        }
                        className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-oled border border-white/15 text-parchment placeholder-ink text-sm font-mono-numbers disabled:opacity-55 ${CONTROL_RING}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            "withdraw",
                            () =>
                              withdraw(
                                withdrawAll ? null : nearToYocto(withdrawNear)
                              ),
                            withdrawAll
                              ? "Withdraw entire Citadel Pouch balance"
                              : `Withdraw ${withdrawNear} NEAR from Citadel Pouch`
                          )
                        }
                        disabled={
                          busy !== null ||
                          (!withdrawAll && withdrawNear <= 0) ||
                          parseYoctoSafe(balanceYocto) === 0n
                        }
                        className={`min-h-[44px] px-5 py-2 rounded-lg bg-frost/20 hover:bg-frost/30 border border-frost/40 text-parchment font-mono font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-40 ${CONTROL_RING}`}
                      >
                        {busy === "withdraw" ? "Withdrawing..." : "Withdraw"}
                      </button>
                    </div>
                  </div>
                </section>

                {/* Sponsor Floor Jackpot */}
                <section className="lg:col-span-5 obsidian-surface border-t-jackpot/35 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-jackpot shrink-0" aria-hidden="true" />
                    <h2 className="font-serif text-lg font-bold text-parchment">
                      Sponsor Floor Jackpot
                    </h2>
                  </div>

                  <p className="text-xs text-ash leading-relaxed">
                    Add non-dilutive NEAR directly to a floor jackpot to attract raiders. Unlike backing, sponsorship earns zero dividends or share minting.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="fund-floor"
                        className="block text-xs font-mono text-ash mb-1.5"
                      >
                        Target Floor
                      </label>
                      <select
                        id="fund-floor"
                        value={fundFloor}
                        onChange={(e) =>
                          setFundFloor(clampFloor(Number(e.target.value)))
                        }
                        className={`w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-parchment text-sm font-mono ${CONTROL_RING}`}
                      >
                        {[1, 2, 3].map((f) => {
                          const fl = floorsByNumber.get(f);
                          return (
                            <option key={f} value={f}>
                              Floor {f} ({fl ? formatNearAmount(fl.jackpot, 2) : "..."})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="fund-amount"
                        className="block text-xs font-mono text-ash mb-1.5"
                      >
                        Sponsor Amount (NEAR)
                      </label>
                      <input
                        id="fund-amount"
                        type="number"
                        min={0.05}
                        step={0.05}
                        placeholder="0.25"
                        value={fundAmount}
                        onChange={(e) =>
                          setFundAmount(Math.max(0, Number(e.target.value)))
                        }
                        className={`w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-parchment placeholder-ink text-sm font-mono-numbers ${CONTROL_RING}`}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      run(
                        "fund",
                        () => fund_jackpot(fundFloor, nearToYocto(fundAmount)),
                        `Sponsor Floor ${fundFloor} Jackpot with ${fundAmount} NEAR`
                      )
                    }
                    disabled={busy !== null || fundAmount <= 0}
                    className={`w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-jackpot/15 hover:bg-jackpot/25 border border-jackpot/40 text-jackpot font-mono font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-40 ${CONTROL_RING}`}
                  >
                    {busy === "fund" ? "Sponsoring..." : "Sponsor Jackpot"}
                  </button>
                </section>
              </div>
            </SpireTabsContent>

            {/* TAB 3: FLOOR BACKER (UNIFIED selectedBackerFloor) */}
            <SpireTabsContent value="backer" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <section className="lg:col-span-6 obsidian-surface border-t-frost/40 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className="w-5 h-5 text-frost shrink-0"
                        aria-hidden="true"
                      />
                      <h2 className="font-serif text-lg font-bold text-parchment">
                        Back Floor Boss Vault
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-frost">
                      15% Ticket Fee Share
                    </span>
                  </div>

                  <p className="text-xs text-ash leading-relaxed">
                    Principal attached via Floor Backing is{" "}
                    <strong className="text-parchment">locked permanently (non-withdrawable)</strong>{" "}
                    into the floor jackpot to attract raiders (no minimum HP gate). Until the boss
                    is defeated, you earn pro-rata dividends from{" "}
                    {(SPLIT_BACKER_BPS / 100).toFixed(0)}% of every raid ticket sold on that
                    floor. If a round expires, the jackpot and active backer cycle carry forward to
                    the next round without a 70% payout.
                  </p>

                  <div>
                    <label
                      htmlFor="back-floor"
                      className="block text-xs font-mono text-ash mb-1.5"
                    >
                      Unified Backer Floor
                    </label>
                    <select
                      id="back-floor"
                      value={selectedBackerFloor}
                      onChange={(e) =>
                        setSelectedBackerFloor(clampFloor(Number(e.target.value)))
                      }
                      className={`w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-parchment text-sm font-mono ${CONTROL_RING}`}
                    >
                      {[1, 2, 3].map((f) => {
                        const fl = floorsByNumber.get(f);
                        return (
                          <option key={f} value={f}>
                            {FLOOR_LABELS[f]} | R{fl?.round ?? 0} | Cycle{" "}
                            {fl?.backer_cycle ?? 0} | Jackpot{" "}
                            {fl ? formatNearAmount(fl.jackpot, 2) : "0.00 NEAR"}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="back-amount"
                      className="block text-xs font-mono text-ash mb-1.5"
                    >
                      Stake Amount (NEAR) | 1 share = {shareUnitText} NEAR
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="back-amount"
                        type="number"
                        min={0.05}
                        step={0.05}
                        placeholder="0.25"
                        value={backAmount}
                        onChange={(e) =>
                          setBackAmount(Math.max(0, Number(e.target.value)))
                        }
                        className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-parchment placeholder-ink text-sm font-mono-numbers ${CONTROL_RING}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            "back",
                            () =>
                              back_boss_vault(
                                selectedBackerFloor,
                                nearToYocto(backAmount)
                              ),
                            `Back Floor ${selectedBackerFloor} Vault with ${backAmount} NEAR`
                          )
                        }
                        disabled={busy !== null || backAmount <= 0}
                        className={`min-h-[44px] px-5 py-2 rounded-lg bg-frost text-oled font-mono font-bold text-xs uppercase tracking-wider hover:bg-frost/90 transition-colors disabled:opacity-40 ${CONTROL_RING}`}
                      >
                        {busy === "back"
                          ? "Backing..."
                          : `Back Floor ${selectedBackerFloor}`}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-panel-dark/65 p-3.5 text-xs font-mono text-pewter space-y-1">
                    <div>
                      Ticket Split: {(SPLIT_JACKPOT_BPS / 100).toFixed(0)}% Jackpot /{" "}
                      {(SPLIT_BACKER_BPS / 100).toFixed(0)}% Backers /{" "}
                      {(SPLIT_BUYBACK_BPS / 100).toFixed(0)}% Buyback /{" "}
                      {(SPLIT_MERCHANT_BPS / 100).toFixed(0)}% Merchant
                    </div>
                  </div>
                </section>

                {/* Live Share Position & Dividend Claim on SAME selectedBackerFloor */}
                <section className="lg:col-span-6 obsidian-surface border-t-jackpot/35 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-serif text-lg font-bold text-parchment">
                      Floor {selectedBackerFloor} Backer Ledger
                    </h2>
                    <span className="text-xs font-mono text-jackpot">
                      Cycle {backer.data?.current_cycle ?? selectedBackerFloorData?.backer_cycle ?? 0}
                    </span>
                  </div>

                  {backer.error && !backer.data ? (
                    <div className="rounded-lg bg-hp/10 border border-hp/30 px-4 py-3 text-xs font-mono text-hp-text">
                      Failed to load get_backer for Floor {selectedBackerFloor}.
                    </div>
                  ) : (
                    <dl className="divide-y divide-white/10 rounded-lg bg-panel-dark/70 px-4 text-xs font-mono">
                      <div className="py-3 flex items-center justify-between gap-2">
                        <dt className="text-ash">Your Staked Weight</dt>
                        <dd className="text-parchment font-bold font-mono-numbers">
                          {backerSharesFormatted} ({sharePercentText}%)
                        </dd>
                      </div>
                      <div className="py-3 flex items-center justify-between gap-2">
                        <dt className="text-ash">Raw Backer Shares</dt>
                        <dd className="text-parchment font-mono-numbers">
                          {Number(backer.data?.shares ?? 0).toLocaleString()} shares
                        </dd>
                      </div>
                      <div className="py-3 flex items-center justify-between gap-2">
                        <dt className="text-ash">Floor Dividend Pool</dt>
                        <dd className="text-jackpot font-semibold font-mono-numbers">
                          {selectedBackerFloorData
                            ? formatNearAmount(selectedBackerFloorData.dividend_pool, 4)
                            : "0.0000 NEAR"}
                        </dd>
                      </div>
                      <div className="py-3 flex items-center justify-between gap-2">
                        <dt className="text-ash">Total Floor Shares</dt>
                        <dd className="text-ash font-mono-numbers">
                          {formatBackerShareNear(
                            selectedBackerFloorData?.backer_total_shares
                          )}
                        </dd>
                      </div>
                      <div className="py-3 flex items-center justify-between gap-2">
                        <dt className="text-ash">Join / Last Claimed Cycle</dt>
                        <dd className="text-parchment font-mono-numbers">
                          Cycle {backer.data?.join_cycle ?? 0} / Cycle{" "}
                          {backer.data?.last_claimed_cycle ?? 0}
                        </dd>
                      </div>
                    </dl>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      run(
                        "dividend",
                        () =>
                          claim_backer_dividend(
                            selectedBackerFloor,
                            backer.data?.current_cycle ?? 0
                          ),
                        `Claim Floor ${selectedBackerFloor} Cycle ${backer.data?.current_cycle ?? 0} Dividend`
                      )
                    }
                    disabled={busy !== null || yourSharesBig === 0n}
                    className={`w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-jackpot/15 hover:bg-jackpot/25 border border-jackpot/40 text-jackpot font-mono font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-40 ${CONTROL_RING}`}
                  >
                    {busy === "dividend"
                      ? "Claiming Dividend..."
                      : `Claim Floor ${selectedBackerFloor} Dividend`}
                  </button>
                </section>
              </div>
            </SpireTabsContent>

            {/* TAB 4: RELIC TROPHIES (supports Round 0 / spirefi-trophy-r0-f3!) */}
            <SpireTabsContent value="trophies" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <section className="lg:col-span-5 obsidian-surface border-t-jackpot/40 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-jackpot shrink-0" aria-hidden="true" />
                      <h2 className="font-serif text-lg font-bold text-parchment">
                        Conqueror Trophy Inspector
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-jackpot font-semibold">
                      Minted: {nftSupply.data ?? "0"}
                    </span>
                  </div>

                  <p className="text-xs text-ash leading-relaxed">
                    NEP-171 trophies with on-chain SVG artwork are minted to the killing-blow striker whenever Floor 3 is cleared. Floor rounds begin at Round 0 (token ID spirefi-trophy-r0-f3).
                  </p>

                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label
                        htmlFor="nft-round-input"
                        className="block text-xs font-mono text-ash mb-1.5"
                      >
                        Inspect Floor 3 Round (min 0)
                      </label>
                      <input
                        id="nft-round-input"
                        type="number"
                        min={0}
                        value={nftRound}
                        onChange={(e) => {
                          nftRoundTouchedRef.current = true;
                          setNftRound(parseNonNegativeInt(e.target.value, 0));
                        }}
                        className={`w-full min-h-[44px] px-3 py-2 rounded-lg bg-panel-dark border border-white/15 text-parchment placeholder-ink text-sm font-mono-numbers ${CONTROL_RING}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => trophyToken.reload()}
                      className={`min-h-[44px] px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-parchment text-xs font-mono font-semibold ${CONTROL_RING}`}
                    >
                      Load NFT
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recentFloor3Rounds.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          nftRoundTouchedRef.current = true;
                          setNftRound(r);
                        }}
                        aria-pressed={nftRound === r}
                        className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${
                          nftRound === r
                            ? "bg-jackpot/20 text-jackpot border border-jackpot/50"
                            : "bg-panel-dark hover:bg-white/10 text-ash"
                        } ${CONTROL_RING}`}
                      >
                        r{r}-f3
                      </button>
                    ))}
                  </div>
                </section>

                <section className="lg:col-span-7 obsidian-surface p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                    <span className="text-xs font-mono text-ash">Token ID</span>
                    <span className="text-sm font-mono font-bold text-parchment">
                      {trophyTokenId}
                    </span>
                  </div>

                  {trophyToken.loading ? (
                    <div className="py-10 text-center text-xs font-mono text-ash">
                      Loading NEP-171 metadata for {trophyTokenId}...
                    </div>
                  ) : trophy ? (
                    <div className="space-y-4">
                      {trophySvgUri ? (
                        <div className="overflow-hidden rounded-xl bg-gradient-to-b from-[#1A1612] to-[#06060A] p-4">
                          <img
                            src={trophySvgUri}
                            alt={
                              trophy.metadata?.title ??
                              `Conqueror Trophy ${trophy.token_id}`
                            }
                            className="w-full h-auto max-h-64 object-contain mx-auto block"
                          />
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs font-mono text-ash bg-panel-dark rounded-lg">
                          No on-chain SVG artwork attached to {trophy.token_id}.
                        </div>
                      )}

                      <dl className="divide-y divide-white/10 text-xs font-mono">
                        <div className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                          <dt className="text-ash">Title</dt>
                          <dd className="text-parchment font-semibold">
                            {trophy.metadata?.title ?? trophy.token_id}
                          </dd>
                        </div>
                        <div className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                          <dt className="text-ash">Owner</dt>
                          <dd className="text-jackpot font-semibold break-all">
                            {trophy.owner_id}
                          </dd>
                        </div>
                        {trophy.metadata?.description && (
                          <div className="py-2.5 space-y-1">
                            <dt className="text-ash">Inscription</dt>
                            <dd className="text-parchment leading-relaxed">
                              {trophy.metadata.description}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-2 bg-panel-dark/65 rounded-lg px-4">
                      <p className="text-sm font-semibold text-parchment">
                        {trophyTokenId} has not been minted yet
                      </p>
                      <p className="text-xs font-mono text-ash max-w-md mx-auto leading-relaxed">
                        Defeat the Floor 3 boss in Round {nftRound} to mint {trophyTokenId} directly to the final striker, then claim {ELEMENT_NAMES.join(" / ")} seized weapon rewards under Payouts &amp; Loot.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </SpireTabsContent>
          </SpireTabs>
        </>
      )}
    </div>
  );
}
