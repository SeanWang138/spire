"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Timer,
  Trophy,
  Lock,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Coins,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { BossArena, BOSS_PROFILES } from "@/components/center/BossArena";
import { LiveHpBar } from "@/components/center/LiveHpBar";
import { MetaRadar } from "@/components/center/MetaRadar";
import { TacticalCombatStance } from "@/components/center/TacticalCombatStance";
import { DamageLog, LogEntry } from "@/components/center/DamageLog";
import { JackpotCounter } from "@/components/center/JackpotCounter";
import { CitadelDiorama } from "@/components/three/CitadelDiorama";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  emptyInventory,
  get_tower,
  get_floor,
  get_meta,
  get_inventory,
  get_balance,
  get_damage,
  get_claimable,
  get_claimable_loot,
  attack,
  claim_payout,
  claim_jackpot,
  update_meta,
} from "@/lib/contract";
import type {
  ElementIndex,
  StanceIndex,
  FloorResponse,
} from "@/lib/contract";
import { useContractView, useSessionAccount } from "@/lib/spire/hooks";
import { useMotionControl } from "@/lib/spire/motion";
import {
  getEffectiveResistances,
  getFreeWeaponCounts,
  getWeaponTributeStatus,
} from "@/lib/combat-rules";
import {
  calculateRaidDamage,
  type TacticalStance,
} from "@/lib/simulation/pricing";
import {
  formatNearAmount,
  getExplorerTxUrl,
  parseYoctoSafe,
} from "@/lib/utils/cn";
import {
  FLOOR_COUNT,
  FLOOR_MAX_HP,
  FLOOR_TICKET_COST_NEAR,
  FROST_WARD_FLOOR,
  ENRAGE_FLOOR,
} from "@/lib/spire/constants";

interface CompletedRoundClaim {
  floor: number;
  round: number;
  damage: number;
  claimableYocto: string;
  claimableLoot: [number, number, number];
}

interface StatusBannerState {
  text: string;
  txHash?: string;
  isError?: boolean;
}

const STANCE_BY_ID: Record<number, TacticalStance> = {
  0: "aggressive",
  1: "feint",
  2: "pierce",
};

const MAX_RECENT_ROUNDS_SCAN = 25;

function formatRpcError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? fallback);
  if (/E_ROUND_LOCKED|locked/i.test(raw)) {
    return "This floor is still locked. Defeat the preceding floor first.";
  }
  if (/E_INSUFFICIENT_BALANCE|insufficient balance|not enough balance/i.test(raw)) {
    return "Ledger NEAR balance is below the floor ticket cost. Deposit NEAR in Vault first.";
  }
  if (/E_NO_WEAPON/i.test(raw)) {
    return "No weapon of the selected element is available in your arsenal.";
  }
  if (/E_SAME_EPOCH/i.test(raw)) {
    return "Epoch shift cooldown is still active on the contract.";
  }
  if (/E_NOTHING_TO_CLAIM/i.test(raw)) {
    return "No unclaimed payout or loot remains for that round.";
  }
  return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw || fallback;
}

export default function RaidPage() {
  const session = useSessionAccount();
  const accountId = session?.accountId ?? "";

  const tower = useContractView(get_tower, []);
  const meta = useContractView(get_meta, []);
  const inventory = useContractView(
    async () => (accountId ? await get_inventory(accountId) : null),
    [accountId]
  );
  const balance = useContractView(
    async () => (accountId ? await get_balance(accountId) : null),
    [accountId]
  );

  const [selectedFloor, setSelectedFloor] = useState(1);
  const [shockwaveSeq, setShockwaveSeq] = useState(0);
  const [lastDamage, setLastDamage] = useState<number | null>(null);
  const [busy, setBusy] = useState<"attack" | "claim" | "claimAll" | "meta" | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statusBanner, setStatusBanner] = useState<StatusBannerState | null>(null);

  const [completedRounds, setCompletedRounds] = useState<CompletedRoundClaim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [scanAllRounds, setScanAllRounds] = useState(false);
  const [claimRefreshSeq, setClaimRefreshSeq] = useState(0);
  const [highlightedRound, setHighlightedRound] = useState<{
    floor: number;
    round: number;
  } | null>(null);

  const floors = tower.data?.floors ?? [];
  const floorData: FloorResponse | undefined =
    floors.find((f) => f.floor === selectedFloor) ?? floors[0];
  const round = floorData?.round ?? 0;
  const activeFloor = floorData?.floor ?? selectedFloor;

  const damage = useContractView(
    async () =>
      accountId && floorData ? await get_damage(accountId, floorData.floor, round) : null,
    [accountId, floorData?.floor, round]
  );

  const { paused, reducedMotion } = useMotionControl();
  const disableMotion = paused || reducedMotion;

  const contractLive = Boolean(tower.data && meta.data);
  const baseResistances: [number, number, number] = meta.data?.resistance ?? [4500, 4500, 4500];
  const effectiveResistances = getEffectiveResistances(baseResistances, activeFloor);
  const isRoundExpired = Boolean(
    floorData &&
      (floorData.expired || (floorData.deadline_ns > 0 && floorData.time_left_ns === 0))
  );

  // Scan completed rounds (0 .. round - 1) on the selected floor for claimable NEAR payouts and seized weapon loot.
  useEffect(() => {
    if (!accountId || !floorData || floorData.round <= 0) {
      setCompletedRounds([]);
      setClaimsError(null);
      setLoadingClaims(false);
      return;
    }

    let cancelled = false;
    const targetFloor = floorData.floor;
    const totalCompleted = floorData.round;
    const minRound = scanAllRounds
      ? 0
      : Math.max(0, totalCompleted - MAX_RECENT_ROUNDS_SCAN);

    const loadCompletedClaims = async () => {
      setLoadingClaims(true);
      setClaimsError(null);
      try {
        const roundIndices: number[] = [];
        for (let r = totalCompleted - 1; r >= minRound; r -= 1) {
          roundIndices.push(r);
        }

        const results = await Promise.all(
          roundIndices.map(async (r): Promise<CompletedRoundClaim> => {
            const [dmg, claimableYocto, claimableLoot] = await Promise.all([
              get_damage(accountId, targetFloor, r).catch(() => 0),
              get_claimable(accountId, targetFloor, r).catch(() => "0"),
              get_claimable_loot(accountId, targetFloor, r).catch(
                (): [number, number, number] => [0, 0, 0]
              ),
            ]);
            return {
              floor: targetFloor,
              round: r,
              damage: dmg,
              claimableYocto,
              claimableLoot,
            };
          })
        );

        if (!cancelled) {
          setCompletedRounds(results);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setClaimsError(formatRpcError(err, "Unable to scan completed rounds for claims."));
        }
      } finally {
        if (!cancelled) {
          setLoadingClaims(false);
        }
      }
    };

    void loadCompletedClaims();

    return () => {
      cancelled = true;
    };
  }, [accountId, floorData?.floor, floorData?.round, scanAllRounds, claimRefreshSeq]);

  const pushLog = (entry: Omit<LogEntry, "id" | "timestamp">) => {
    setLogs((prev) =>
      [
        {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 30)
    );
  };

  const handleAttack = async (
    floor: number,
    weaponElement: ElementIndex,
    stances: [StanceIndex, StanceIndex, StanceIndex]
  ) => {
    if (!floorData || !session || busy) return;
    const preRound = floorData.round;
    const preHp = floorData.hp;
    const wasExpired = isRoundExpired;
    const currentInventory = inventory.data ?? emptyInventory();

    setBusy("attack");
    setStatusBanner(null);

    try {
      const res = await attack(floor, weaponElement, stances);
      const freeCounts = getFreeWeaponCounts(
        currentInventory.weapons,
        currentInventory.starter_locked
      );
      const totalWeaponsOverall =
        (currentInventory.weapons[0] ?? 0) +
        (currentInventory.weapons[1] ?? 0) +
        (currentInventory.weapons[2] ?? 0);
      const tribute = getWeaponTributeStatus({
        total: currentInventory.weapons[weaponElement] ?? 0,
        free: freeCounts[weaponElement] ?? 0,
        isOnlyWeapon: totalWeaponsOverall === 1,
        effectiveResBps: effectiveResistances[weaponElement],
        stance: STANCE_BY_ID[stances[0]],
      });

      let projected = 0;
      for (const sid of stances) {
        const calc = calculateRaidDamage(
          weaponElement,
          STANCE_BY_ID[sid],
          baseResistances[weaponElement],
          floor,
          (currentInventory.starter_locked[weaponElement] ?? 0) > 0
        );
        projected += calc.effectiveDamage;
      }

      if (!disableMotion) {
        setShockwaveSeq((s) => s + 1);
      }
      setLastDamage(projected);
      setTimeout(() => setLastDamage(null), 1400);

      let postFloor: FloorResponse | null = null;
      try {
        postFloor = await get_floor(floor);
      } catch {
        postFloor = null;
      }

      const roundAdvanced = Boolean(postFloor && postFloor.round > preRound);
      let unlockedReward = false;
      if (roundAdvanced) {
        const [claimable, claimableLoot] = await Promise.all([
          get_claimable(accountId, floor, preRound).catch(() => "0"),
          get_claimable_loot(accountId, floor, preRound).catch(
            (): [number, number, number] => [0, 0, 0]
          ),
        ]);
        const lootSum =
          (claimableLoot[0] ?? 0) + (claimableLoot[1] ?? 0) + (claimableLoot[2] ?? 0);
        unlockedReward = parseYoctoSafe(claimable) > 0n || lootSum > 0;
        if (unlockedReward) {
          setHighlightedRound({ floor, round: preRound });
        }
      }

      const bannerText = unlockedReward
        ? `Victory on Floor ${floor} Round ${preRound}. Reward unlocked in Completed Rounds below.`
        : roundAdvanced && wasExpired
          ? `Expired Round ${preRound} settled lazily. Floor ${floor} struck for ${projected} dmg.`
          : `Strike hit Floor ${floor} for ${projected} estimated damage.`;

      setStatusBanner({ text: bannerText, txHash: res.txHash });

      pushLog({
        accountId,
        element: (["solar", "frost", "void"] as const)[weaponElement],
        damage: projected,
        remainingHp: unlockedReward
          ? 0
          : postFloor
            ? postFloor.hp
            : Math.max(0, preHp - projected),
        isConfiscated: tribute.atRisk,
        note: unlockedReward
          ? `Boss defeated (Round ${preRound}); payout unlocked`
          : roundAdvanced && wasExpired
            ? `Expired Round ${preRound} settled lazily`
            : undefined,
        txHash: res.txHash,
      });

      tower.reload();
      if (inventory.data) inventory.reload();
      damage.reload();
      balance.reload();
      setClaimRefreshSeq((s) => s + 1);
    } catch (err: unknown) {
      setStatusBanner({
        text: formatRpcError(err, `Attack failed on Floor ${floor}.`),
        isError: true,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleClaimPayout = async (targetFloor: number, targetRound: number) => {
    if (!session || busy) return;
    setBusy("claim");
    setStatusBanner(null);

    try {
      const res = await claim_payout(targetFloor, targetRound);
      setStatusBanner({
        text: `Payout and loot claimed for Floor ${targetFloor} Round ${targetRound}.`,
        txHash: res.txHash,
      });
      setHighlightedRound((prev) =>
        prev && prev.floor === targetFloor && prev.round === targetRound ? null : prev
      );
      pushLog({
        accountId,
        element: "void",
        damage: 0,
        remainingHp: floorData?.hp ?? 0,
        note: `Claimed Floor ${targetFloor} Round ${targetRound} reward`,
        txHash: res.txHash,
      });
      damage.reload();
      inventory.reload();
      balance.reload();
      setClaimRefreshSeq((s) => s + 1);
    } catch (err: unknown) {
      setStatusBanner({
        text: formatRpcError(
          err,
          `Unable to claim Floor ${targetFloor} Round ${targetRound}.`
        ),
        isError: true,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleClaimAll = async () => {
    if (!session || busy) return;
    setBusy("claimAll");
    setStatusBanner(null);

    try {
      const res = await claim_jackpot();
      setStatusBanner({
        text: "All unclaimed round payouts and loot swept to your ledger and arsenal.",
        txHash: res.txHash,
      });
      setHighlightedRound(null);
      pushLog({
        accountId,
        element: "void",
        damage: 0,
        remainingHp: floorData?.hp ?? 0,
        note: "Swept all unclaimed floor payouts",
        txHash: res.txHash,
      });
      damage.reload();
      inventory.reload();
      balance.reload();
      setClaimRefreshSeq((s) => s + 1);
    } catch (err: unknown) {
      setStatusBanner({
        text: formatRpcError(err, "Failed to sweep unclaimed payouts."),
        isError: true,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateMeta = async () => {
    if (!session || busy) return;
    setBusy("meta");
    setStatusBanner(null);

    try {
      const res = await update_meta();
      setStatusBanner({
        text: "Epoch resistance shift submitted.",
        txHash: res.txHash,
      });
      meta.reload();
    } catch (err: unknown) {
      setStatusBanner({
        text: formatRpcError(err, "Epoch shift rejected by contract."),
        isError: true,
      });
    } finally {
      setBusy(null);
    }
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <EmptyState
          title="Signless session not started"
          hint="Create or unlock your Spire account on the Session Key screen first so your browser holds an active Function Call Key."
          actionHref="/game/start"
          actionLabel="Go to Session Key"
        />
      </div>
    );
  }

  if ((tower.loading || meta.loading) && !contractLive && !tower.error && !meta.error) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div
          role="status"
          aria-live="polite"
          className="panel-gothic p-6 flex items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-parchment font-display tracking-wide">
              Syncing Spire Raid Telemetry
            </h1>
            <p className="text-sm text-ash">
              Loading live tower floors and global epoch resistances from NEAR Testnet...
            </p>
          </div>
          <span className="text-xs font-mono text-brass uppercase tracking-wider shrink-0">
            Connecting
          </span>
        </div>
      </div>
    );
  }

  if (!contractLive || !floorData) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <EmptyState
          title="Boss arena unavailable"
          hint="Unable to connect to Boss Arena telemetry on NEAR Testnet. Check your connection or reload."
          onReload={() => {
            tower.reload();
            meta.reload();
          }}
        />
      </div>
    );
  }

  const playerDamage = damage.data ?? 0;
  const txLink = getExplorerTxUrl(statusBanner?.txHash);
  const dominantElement = effectiveResistances.indexOf(
    Math.max(...effectiveResistances)
  ) as ElementIndex;
  const bossProfile = BOSS_PROFILES[floorData.floor] ?? BOSS_PROFILES[1];
  const ledgerBalanceNear = formatNearAmount(balance.data ?? "0", 3);

  const actionableClaims = completedRounds.filter((entry) => {
    const lootTotal =
      (entry.claimableLoot[0] ?? 0) +
      (entry.claimableLoot[1] ?? 0) +
      (entry.claimableLoot[2] ?? 0);
    return (
      parseYoctoSafe(entry.claimableYocto) > 0n ||
      lootTotal > 0 ||
      (highlightedRound?.floor === entry.floor && highlightedRound?.round === entry.round)
    );
  });

  const participatedRounds = completedRounds.filter((entry) => entry.damage > 0);
  const topClaimable = actionableClaims[0] ?? null;

  return (
    <section className="flex flex-col gap-6">
      {/* Floating Damage Readout */}
      <AnimatePresence>
        {lastDamage !== null && !disableMotion && (
          <motion.div
            key="dmg"
            initial={{ opacity: 0, scale: 0.75, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: -18 }}
            exit={{ opacity: 0, scale: 0.9, y: -38 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            className="fixed top-24 left-1/2 z-50 -translate-x-1/2 font-mono text-4xl font-black text-solar pointer-events-none"
          >
            -{lastDamage} DMG
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Masthead: H1 precedes all H2 section headings in DOM order (no kickers above H1) */}
      <header className="panel-gothic px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-parchment font-display tracking-wide">
              Floor {floorData.floor}: {bossProfile.title}
            </h1>
            {isRoundExpired && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-solar/15 border border-solar/40 text-xs font-mono font-bold text-solar">
                <Timer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Round Expired · Settles Lazily on Next Strike
              </span>
            )}
            {!floorData.unlocked && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-brass/30 text-xs font-mono font-bold text-ash">
                <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Floor Locked
              </span>
            )}
          </div>
          <p className="text-sm text-ash">
            {bossProfile.subtitle} · Active Round{" "}
            <span className="font-mono font-mono-numbers text-parchment font-semibold">
              {round}
            </span>{" "}
            · Ledger Balance:{" "}
            <span className="font-mono font-mono-numbers text-frost font-semibold">
              {balance.loading ? "..." : ledgerBalanceNear}
            </span>
          </p>
        </div>

        {/* Floor Quick Switcher */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Floor selector">
          {Array.from({ length: FLOOR_COUNT }, (_, idx) => {
            const floorNum = idx + 1;
            const summary = floors.find((f) => f.floor === floorNum);
            const active = floorNum === floorData.floor;
            return (
              <button
                type="button"
                key={floorNum}
                onClick={() => setSelectedFloor(floorNum)}
                aria-pressed={active}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg border text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-colors ${
                  active
                    ? "bg-solar/15 border-solar text-parchment"
                    : "bg-panel-dark border-brass/25 text-ash hover:border-brass/50 hover:text-parchment"
                }`}
              >
                <span>Floor {floorNum}</span>
                {summary && !summary.unlocked && (
                  <Lock className="w-3.5 h-3.5 text-solar shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main 5/7 RPG Command & 3D Citadel Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive 3D Citadel Selector + Meta Radar */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="citadel-stage overflow-hidden">
            <CitadelDiorama
              mode="tactical"
              selectedFloor={floorData.floor}
              onSelectFloor={setSelectedFloor}
              floors={floors}
              dominantElement={dominantElement}
              shockwaveSeq={shockwaveSeq}
              className="w-full"
            />

            {/* Compact Floor Telemetry Index */}
            <div className="divide-y divide-brass/15 border-t border-brass/20 bg-oled/90">
              {floors.map((f) => {
                const idx = Math.min(Math.max(f.floor, 1), 3) - 1;
                const isActive = f.floor === floorData.floor;
                return (
                  <button
                    type="button"
                    key={f.floor}
                    onClick={() => setSelectedFloor(f.floor)}
                    aria-pressed={isActive}
                    className={`w-full min-h-[48px] px-4 py-2.5 text-left transition-colors flex items-center justify-between gap-2 ${
                      isActive
                        ? "bg-panel-elevated/90 text-parchment"
                        : "text-ash hover:bg-panel-dark/70 hover:text-parchment"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 font-mono text-xs">
                      <span
                        className={`font-bold uppercase tracking-wider ${
                          isActive ? "text-solar" : "text-parchment"
                        }`}
                      >
                        F{f.floor}
                      </span>
                      {!f.unlocked && (
                        <span className="inline-flex items-center gap-1 text-xs text-solar">
                          <Lock className="w-3.5 h-3.5" aria-hidden="true" /> Locked
                        </span>
                      )}
                      {f.floor === FROST_WARD_FLOOR && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-frost/10 text-frost border border-frost/25">
                          Ward
                        </span>
                      )}
                      {f.floor === ENRAGE_FLOOR && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-hp/15 text-hp-text border border-hp/30">
                          Enrage
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                      <span className="font-mono-numbers text-parchment font-bold">
                        {f.hp}/{FLOOR_MAX_HP[idx]} HP
                      </span>
                      <span className="font-mono-numbers text-frost">
                        {FLOOR_TICKET_COST_NEAR[idx].toFixed(2)} N
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <MetaRadar
            resistances={effectiveResistances}
            baseResistances={baseResistances}
            floor={floorData.floor}
            epoch={meta.data?.epoch}
            nextEpochInNs={meta.data?.next_epoch_in_ns}
            onUpdateMeta={handleUpdateMeta}
            updatingMeta={busy === "meta"}
          />
        </div>

        {/* Right Column: Boss Encounter Stage -> Completed Rounds Claims -> Bounty -> Command Deck -> Chronicle */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {statusBanner && (
            <div
              role={statusBanner.isError ? "alert" : "status"}
              aria-live={statusBanner.isError ? "assertive" : "polite"}
              className={`px-4 py-3 rounded-lg bg-panel-card border text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
                statusBanner.isError
                  ? "border-hp/50 text-hp-text"
                  : "border-jackpot/35 text-jackpot"
              }`}
            >
              <span className="inline-flex items-center gap-2 font-semibold min-w-0">
                {statusBanner.isError ? (
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
                <span>{statusBanner.text}</span>
              </span>
              {txLink && (
                <a
                  href={txLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-2 text-frost hover:underline inline-flex items-center gap-2 font-bold shrink-0"
                >
                  Inspect on NearBlocks
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          )}

          {/* Unified Boss Stage + HP Gauge */}
          <motion.div
            animate={
              shockwaveSeq > 0 && !disableMotion
                ? { x: [0, -5, 4, -2, 0] }
                : undefined
            }
            transition={{ duration: 0.24 }}
            className="citadel-stage overflow-hidden"
          >
            <BossArena
              floor={floorData.floor}
              dominantElement={dominantElement}
              expired={isRoundExpired}
              enrage={floorData.enrage}
              wardElement={floorData.ward_element}
              locked={!floorData.unlocked}
              lastDamage={lastDamage}
              strikeSeq={shockwaveSeq}
              round={round}
              headingLevel="h2"
            />
            <LiveHpBar
              currentHp={floorData.hp}
              maxHp={floorData.max_hp}
              floor={floorData.floor}
              timeLeftNs={floorData.deadline_ns > 0 ? floorData.time_left_ns : undefined}
              expired={isRoundExpired}
              enrage={floorData.enrage}
              wardElement={floorData.ward_element}
            />
          </motion.div>

          {/* Completed Rounds Claim Panel (scans prior rounds because settle_defeat auto-advances round) */}
          <section className="panel-gothic p-4 space-y-3" aria-labelledby="completed-rounds-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-jackpot shrink-0" aria-hidden="true" />
                <h2
                  id="completed-rounds-heading"
                  className="text-sm font-bold text-parchment font-display uppercase tracking-wider"
                >
                  Completed Rounds &amp; Claims
                </h2>
                <span className="text-xs font-mono text-ash font-mono-numbers">
                  ({round} completed)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {round > MAX_RECENT_ROUNDS_SCAN && !scanAllRounds && (
                  <button
                    type="button"
                    onClick={() => setScanAllRounds(true)}
                    disabled={loadingClaims}
                    className="min-h-[44px] px-3 py-2 rounded-lg border border-brass/30 bg-panel-dark hover:border-brass/60 text-xs font-mono font-semibold text-ash hover:text-parchment inline-flex items-center gap-2 transition-colors disabled:opacity-40"
                  >
                    <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                    Scan All {round} Rounds
                  </button>
                )}

                {actionableClaims.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClaimAll}
                    disabled={busy !== null}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg border border-jackpot/40 bg-jackpot/15 hover:bg-jackpot/25 text-xs font-mono font-bold text-jackpot uppercase tracking-wider inline-flex items-center gap-2 transition-colors disabled:opacity-40"
                  >
                    <Coins className="w-3.5 h-3.5" aria-hidden="true" />
                    {busy === "claimAll" ? "Sweeping..." : "Claim All Rounds"}
                  </button>
                )}
              </div>
            </div>

            {round === 0 && (
              <p className="text-xs text-ash leading-relaxed">
                Round 0 is still active on Floor {floorData.floor}. When the boss falls,
                the contract resets HP and advances to Round 1, unlocking claimable NEAR and
                tribute weapon loot here.
              </p>
            )}

            {round > 0 && loadingClaims && completedRounds.length === 0 && (
              <p className="text-xs font-mono text-ash py-2">
                Checking completed rounds on NEAR Testnet...
              </p>
            )}

            {claimsError && (
              <p role="alert" className="text-xs font-mono text-hp-text flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{claimsError}</span>
              </p>
            )}

            {round > 0 && actionableClaims.length > 0 && (
              <div className="divide-y divide-brass/15 border-t border-brass/20">
                {actionableClaims.map((item) => {
                  const lootS = item.claimableLoot[0] ?? 0;
                  const lootF = item.claimableLoot[1] ?? 0;
                  const lootV = item.claimableLoot[2] ?? 0;
                  const lootTotal = lootS + lootF + lootV;
                  const nearDisplay = formatNearAmount(item.claimableYocto, 4);
                  const isHighlighted =
                    highlightedRound?.floor === item.floor &&
                    highlightedRound?.round === item.round;

                  return (
                    <div
                      key={`${item.floor}-${item.round}`}
                      className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isHighlighted ? "bg-jackpot/5 px-2 -mx-2 rounded" : ""
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                          <span className="font-bold text-parchment">
                            Round {item.round}
                          </span>
                          {isHighlighted && (
                            <span className="px-2 py-0.5 rounded bg-jackpot/15 border border-jackpot/40 text-jackpot font-bold">
                              New Victory
                            </span>
                          )}
                          <span className="text-ash font-mono-numbers">
                            Logged Damage: {item.damage.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                          <span className="text-jackpot font-bold font-mono-numbers">
                            {nearDisplay} Claimable
                          </span>
                          {lootTotal > 0 && (
                            <span className="text-void-text font-semibold font-mono-numbers">
                              Tribute Loot: {lootS} Solar / {lootF} Frost / {lootV} Void
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleClaimPayout(item.floor, item.round)}
                        disabled={busy !== null}
                        className="min-h-[44px] px-4 py-2 rounded-lg bg-jackpot hover:bg-jackpot/90 text-oled text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 shrink-0"
                      >
                        <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                        {busy === "claim"
                          ? "Claiming..."
                          : lootTotal > 0
                            ? "Claim Payout & Loot"
                            : "Claim Payout"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {round > 0 && !loadingClaims && actionableClaims.length === 0 && (
              <div className="space-y-1.5 pt-1 border-t border-brass/15">
                <p className="text-xs text-ash">
                  No unclaimed rewards found across{" "}
                  {scanAllRounds ? round : Math.min(round, MAX_RECENT_ROUNDS_SCAN)} checked
                  completed round(s) on Floor {floorData.floor}.
                </p>
                {participatedRounds.length > 0 && (
                  <p className="text-xs font-mono text-ash">
                    Settled participation:{" "}
                    {participatedRounds
                      .slice(0, 4)
                      .map((r) => `R${r.round} (${r.damage} dmg)`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            )}
          </section>

          {isRoundExpired && (
            <div
              role="status"
              className="px-4 py-3 rounded-lg bg-panel-dark border border-solar/35 flex items-start gap-2.5 text-xs font-mono text-solar"
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed">
                Round {round} deadline elapsed. No separate resolve transaction is needed: your
                next <span className="font-bold text-parchment">Strike Boss</span> action
                settles the expired round lazily and opens the fresh round in the same call.
              </p>
            </div>
          )}

          <JackpotCounter
            jackpotYocto={floorData.jackpot ?? "0"}
            playerDamage={playerDamage}
            round={round}
            totalDamage={Number(floorData.total_damage ?? "0")}
            loot={floorData.loot}
            onClaimPayout={
              topClaimable
                ? () => handleClaimPayout(floorData.floor, topClaimable.round)
                : undefined
            }
            claimLabel={topClaimable ? `Claim Round ${topClaimable.round}` : undefined}
            disabled={busy !== null}
          />

          <TacticalCombatStance
            inventory={inventory.data ?? emptyInventory()}
            resistances={baseResistances}
            floor={floorData.floor}
            onAttack={handleAttack}
            disabled={busy !== null || !floorData.unlocked}
            ledgerBalanceYocto={balance.data}
            ledgerLoading={balance.loading}
            roundExpired={isRoundExpired}
            floorLocked={!floorData.unlocked}
            bossHp={floorData.hp}
          />

          <DamageLog logs={logs} />
        </div>
      </div>
    </section>
  );
}
