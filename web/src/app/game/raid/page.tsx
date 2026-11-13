"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Timer, Trophy, Lock, ExternalLink } from "lucide-react";
import { BossArena } from "@/components/center/BossArena";
import { LiveHpBar } from "@/components/center/LiveHpBar";
import { MetaRadar } from "@/components/center/MetaRadar";
import { TacticalCombatStance } from "@/components/center/TacticalCombatStance";
import { DamageLog, LogEntry } from "@/components/center/DamageLog";
import { JackpotCounter } from "@/components/center/JackpotCounter";
import { CitadelDiorama } from "@/components/three/CitadelDiorama";
import { EmptyState } from "@/components/shared/EmptyState";
import { emptyInventory } from "@/lib/contract";
import {
  get_tower,
  get_meta,
  get_inventory,
  get_damage,
  attack,
  claim_payout,
  resolve_expired,
  update_meta,
} from "@/lib/contract";
import type {
  ElementIndex,
  StanceIndex,
  FloorResponse,
} from "@/lib/contract";
import { useContractView, useSessionAccount } from "@/lib/spire/hooks";
import {
  calculateRaidDamage,
  type TacticalStance,
} from "@/lib/simulation/pricing";
import { getExplorerTxUrl } from "@/lib/utils/cn";
import {
  FLOOR_MAX_HP,
  FLOOR_TICKET_COST_NEAR,
  FROST_WARD_FLOOR,
  ENRAGE_FLOOR,
} from "@/lib/spire/constants";

export default function RaidPage() {
  const session = useSessionAccount();
  const accountId = session?.accountId ?? "";

  const tower = useContractView(get_tower, []);
  const meta = useContractView(get_meta, []);
  const inventory = useContractView(
    async () => (accountId ? await get_inventory(accountId) : null),
    [accountId]
  );

  const [selectedFloor, setSelectedFloor] = useState(1);
  const [shockwaveSeq, setShockwaveSeq] = useState(0);
  const [lastDamage, setLastDamage] = useState<number | null>(null);
  const [busy, setBusy] = useState<"attack" | "claim" | "resolve" | "meta" | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statusBanner, setStatusBanner] = useState<{ text: string; txHash?: string } | null>(null);

  const floors = tower.data?.floors ?? [];
  const floorData: FloorResponse | undefined =
    floors.find((f) => f.floor === selectedFloor) ?? floors[0];
  const round = floorData?.round ?? 0;

  const damage = useContractView(
    async () =>
      accountId && floorData ? await get_damage(accountId, floorData.floor, round) : null,
    [accountId, floorData?.floor, round]
  );

  const reduced = useReducedMotion();
  const contractLive = Boolean(tower.data && meta.data);
  const resistances = meta.data?.resistance ?? [4500, 4500, 4500];

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
    if (!floorData || !session) return;
    setBusy("attack");
    try {
      const res = await attack(floor, weaponElement, stances);
      const STANCE_BY_ID: Record<number, TacticalStance> = {
        0: "aggressive",
        1: "feint",
        2: "pierce",
      };
      let projected = 0;
      for (const sid of stances) {
        const calc = calculateRaidDamage(
          weaponElement,
          STANCE_BY_ID[sid],
          resistances[weaponElement],
          floor,
          (inventory.data?.starter_locked[weaponElement] ?? 0) > 0
        );
        projected += calc.effectiveDamage;
      }
      if (!reduced) {
        setShockwaveSeq((s) => s + 1);
      }
      setLastDamage(projected);
      setTimeout(() => setLastDamage(null), 1400);
      setStatusBanner({ text: `Strike sent to Floor ${floor}`, txHash: res.txHash });
      pushLog({
        accountId,
        element: (["solar", "frost", "void"] as const)[weaponElement],
        damage: projected,
        remainingHp: Math.max(0, floorData.hp - projected),
        isConfiscated:
          resistances[weaponElement] >= 7000 &&
          (inventory.data?.starter_locked[weaponElement] ?? 0) === 0,
        txHash: res.txHash,
      });
      tower.reload();
      if (inventory.data) inventory.reload();
      damage.reload();
    } finally {
      setBusy(null);
    }
  };

  const handleClaimPayout = async () => {
    if (!floorData || !session || busy) return;
    setBusy("claim");
    try {
      const res = await claim_payout(floorData.floor, round);
      setStatusBanner({
        text: `Payout claimed for Floor ${floorData.floor} Round ${round}`,
        txHash: res.txHash,
      });
      damage.reload();
      pushLog({
        accountId,
        element: "void",
        damage: 0,
        remainingHp: floorData.hp,
        note: "Jackpot payout claimed",
        txHash: res.txHash,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleResolveExpired = async () => {
    if (!floorData || !session || busy) return;
    setBusy("resolve");
    try {
      const res = await resolve_expired(floorData.floor);
      setStatusBanner({
        text: `Resolved expired Floor ${floorData.floor} round`,
        txHash: res.txHash,
      });
      tower.reload();
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateMeta = async () => {
    if (!session || busy) return;
    setBusy("meta");
    try {
      const res = await update_meta();
      setStatusBanner({ text: "Epoch resistance shift submitted", txHash: res.txHash });
      meta.reload();
    } finally {
      setBusy(null);
    }
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <EmptyState
          title="Signless session not started"
          hint="Create or unlock your Spire account on the Session Key screen first so your browser holds an active Function Call Key."
          actionHref="/game/start"
          actionLabel="Go to Session Key"
        />
      </div>
    );
  }

  if (!contractLive || !floorData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <EmptyState
          title="Boss arena unavailable"
          hint={
            tower.error || meta.error
              ? "Unable to connect to Boss Arena telemetry on NEAR Testnet. Check your connection or reload."
              : "Loading live floor and meta resistance data..."
          }
          onReload={() => {
            tower.reload();
            meta.reload();
          }}
        />
      </div>
    );
  }

  const bossDown = floorData.hp === 0;
  const playerDamage = damage.data ?? 0;
  const txLink = getExplorerTxUrl(statusBanner?.txHash);
  const dominantElement = resistances.indexOf(Math.max(...resistances)) as ElementIndex;

  return (
    <section className="px-1 py-6 flex flex-col gap-5">
      {/* Floating Damage Readout */}
      <AnimatePresence>
        {lastDamage !== null && !reduced && (
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

      {/* Main 5/7 RPG Command & 3D Citadel Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Persistent Interactive 3D Citadel Selector + Elemental Radar */}
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
                    className={`w-full min-h-[48px] px-4 py-2.5 text-left transition-colors flex items-center justify-between gap-3 ${
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
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                          <Lock className="w-3 h-3" aria-hidden="true" /> Locked
                        </span>
                      )}
                      {f.floor === FROST_WARD_FLOOR && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-frost/10 text-frost border border-frost/25">
                          Ward
                        </span>
                      )}
                      {f.floor === ENRAGE_FLOOR && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-hp/10 text-hp border border-hp/25">
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
            resistances={resistances}
            epoch={meta.data?.epoch}
            nextEpochInNs={meta.data?.next_epoch_in_ns}
            onUpdateMeta={handleUpdateMeta}
            updatingMeta={busy === "meta"}
          />
        </div>

        {/* Right Column: Boss Encounter Stage -> Bounty -> Tactical Combo -> Chronicle */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {statusBanner && (
            <div
              role="status"
              aria-live="polite"
              className="px-4 py-2.5 rounded-lg bg-panel-card border border-jackpot/30 text-xs font-mono flex flex-wrap items-center justify-between gap-2"
            >
              <span className="text-jackpot font-semibold">{statusBanner.text}</span>
              {txLink && (
                <a
                  href={txLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-frost hover:underline inline-flex items-center gap-1 font-bold"
                >
                  Inspect on NearBlocks <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          )}

          {bossDown && (
            <div className="p-3.5 rounded-xl bg-jackpot/10 border border-jackpot/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-jackpot font-bold">
                <Trophy className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Boss defeated on Floor {floorData.floor} (Round {round}). Logged damage:{" "}
                  <span className="font-mono-numbers">{playerDamage}</span>.
                </span>
              </div>
              <button
                type="button"
                onClick={handleClaimPayout}
                disabled={busy !== null || playerDamage === 0}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-jackpot hover:bg-jackpot/90 text-oled text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
              >
                {busy === "claim" ? "Claiming..." : "Claim Payout"}
              </button>
            </div>
          )}

          {floorData.expired && !bossDown && (
            <div className="p-3.5 rounded-xl bg-panel-dark border border-hp/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-hp font-bold">
                <Timer className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Deadline for Round {round} expired. Trigger settlement to reset the arena.
                </span>
              </div>
              <button
                type="button"
                onClick={handleResolveExpired}
                disabled={busy !== null}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-hp hover:bg-hp/85 text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
              >
                {busy === "resolve" ? "Resolving..." : "Resolve Expired"}
              </button>
            </div>
          )}

          {/* Unified Boss Stage + HP Gauge */}
          <motion.div
            animate={
              shockwaveSeq > 0 && !reduced
                ? { x: [0, -5, 4, -2, 0] }
                : undefined
            }
            transition={{ duration: 0.24 }}
            className="citadel-stage overflow-hidden"
          >
            <BossArena
              floor={floorData.floor}
              dominantElement={dominantElement}
              expired={floorData.expired}
              enrage={floorData.enrage}
              wardElement={floorData.ward_element}
              locked={!floorData.unlocked}
              lastDamage={lastDamage}
              strikeSeq={shockwaveSeq}
            />
            <LiveHpBar
              currentHp={floorData.hp}
              maxHp={floorData.max_hp}
              floor={floorData.floor}
              timeLeftNs={floorData.deadline_ns > 0 ? floorData.time_left_ns : undefined}
              expired={floorData.expired}
              enrage={floorData.enrage}
              wardElement={floorData.ward_element}
            />
          </motion.div>

          <JackpotCounter
            jackpotYocto={floorData.jackpot ?? "0"}
            playerDamage={playerDamage}
            round={round}
            totalDamage={Number(floorData.total_damage ?? "0")}
            loot={floorData.loot}
            onClaimPayout={handleClaimPayout}
            disabled={busy !== null || playerDamage === 0 || !bossDown}
          />

          <TacticalCombatStance
            inventory={inventory.data ?? emptyInventory()}
            resistances={resistances}
            floor={floorData.floor}
            onAttack={handleAttack}
            disabled={busy !== null || bossDown || floorData.expired || !floorData.unlocked}
          />

          <DamageLog logs={logs} />
        </div>
      </div>
    </section>
  );
}
