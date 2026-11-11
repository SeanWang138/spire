"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Coins, Timer, Trophy } from "lucide-react";
import { BossArena } from "@/components/center/BossArena";
import { LiveHpBar } from "@/components/center/LiveHpBar";
import { MetaRadar } from "@/components/center/MetaRadar";
import { TacticalCombatStance } from "@/components/center/TacticalCombatStance";
import { DamageLog, LogEntry } from "@/components/center/DamageLog";
import { JackpotCounter } from "@/components/center/JackpotCounter";
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
import { FLOOR_MAX_HP, FLOOR_TICKET_COST_NEAR, FROST_WARD_FLOOR, ENRAGE_FLOOR } from "@/lib/spire/constants";

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
  const [shakeSeq, setShakeSeq] = useState(0);
  const [lastDamage, setLastDamage] = useState<number | null>(null);
  const [busy, setBusy] = useState<"attack" | "claim" | "resolve" | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

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
      await attack(floor, weaponElement, stances);
      // Visual feedback: deterministic midpoint mirror of the contract math.
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
      if (!reduced) setShakeSeq((s) => s + 1);
      setLastDamage(projected);
      setTimeout(() => setLastDamage(null), 1400);
      pushLog({
        accountId,
        element: (["solar", "frost", "void"] as const)[weaponElement],
        damage: projected,
        remainingHp: Math.max(0, floorData.hp - projected),
        isConfiscated: resistances[weaponElement] >= 7000,
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
      await claim_payout(floorData.floor, round);
      damage.reload();
      pushLog({
        accountId,
        element: "void",
        damage: 0,
        remainingHp: 0,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleResolveExpired = async () => {
    if (!floorData || !session || busy) return;
    setBusy("resolve");
    try {
      await resolve_expired(floorData.floor);
      tower.reload();
    } finally {
      setBusy(null);
    }
  };

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <EmptyState
          title="Signless session not started"
          hint="Create your Spire account on the title screen first: your Function Call Key is generated in the browser, no wallet popups."
        />
        <div className="mt-3 text-center">
          <Link
            href="/game/start"
            className="px-4 py-2 rounded-lg bg-solar hover:bg-solar-dark text-oled text-xs font-mono font-bold uppercase tracking-wider transition-colors"
          >
            To Title Screen
          </Link>
        </div>
      </div>
    );
  }

  if (!contractLive || !floorData) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <EmptyState
          title="Boss arena unavailable"
          hint={
            tower.error || meta.error
              ? "Unable to connect to the Boss Arena telemetry on NEAR Testnet. Please verify your connection or reload."
              : "Loading arena..."
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
  const floorLabel = Math.min(Math.max(floorData.floor, 1), 3);

  return (
    <motion.section
      key={shakeSeq}
      animate={{ x: [0, -5, 5, -2, 0] }}
      transition={{ duration: 0.3 }}
      className="px-1 py-6 flex flex-col gap-4"
    >
      {/* Damage number pop */}
      <AnimatePresence>
        {lastDamage !== null && (
          <motion.div
            key="dmg"
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: -18 }}
            exit={{ opacity: 0, scale: 0.9, y: -40 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="fixed top-24 left-1/2 z-50 -translate-x-1/2 font-mono text-4xl font-black text-solar drop-shadow-lg pointer-events-none"
          >
            -{lastDamage} DMG
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floor picker — get_tower() returns all 3 parallel floors */}
      <div className="grid grid-cols-3 gap-2">
        {floors.length > 0
          ? floors.map((f) => {
              const idx = Math.min(Math.max(f.floor, 1), 3) - 1;
              const isActive = f.floor === floorData.floor;
              return (
                <button
                  key={f.floor}
                  onClick={() => setSelectedFloor(f.floor)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isActive
                      ? "bg-panel-card border-solar/50 shadow-lg shadow-solar/10"
                      : "bg-panel-dark border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className={`font-bold uppercase tracking-wider ${isActive ? "text-solar" : "text-slate-300"}`}>
                      Floor {f.floor}
                    </span>
                    {f.expired && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Timer className="w-3 h-3" /> expired
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400">
                    HP{" "}
                    <span className="font-mono-numbers text-white font-bold">
                      {f.hp}/{FLOOR_MAX_HP[idx]}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Ticket{" "}
                    <span className="font-mono-numbers text-frost font-bold">
                      {FLOOR_TICKET_COST_NEAR[idx].toFixed(2)} NEAR
                    </span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    {f.floor === FROST_WARD_FLOOR && (
                      <span className="text-[9px] px-1 rounded bg-frost/10 text-frost border border-frost/20">Frost Ward</span>
                    )}
                    {f.floor === ENRAGE_FLOOR && (
                      <span className="text-[9px] px-1 rounded bg-hp/10 text-hp border border-hp/20">Enrage</span>
                    )}
                  </div>
                </button>
              );
            })
          : [1, 2, 3].map((n) => (
              <div key={n} className="p-3 rounded-xl bg-panel-dark border border-white/10 opacity-50">
                <span className="text-xs font-mono font-bold text-slate-500">Floor {n}</span>
              </div>
            ))}
      </div>

      {/* Boss down / expired action strip */}
      {bossDown && (
        <div className="p-3 rounded-xl bg-jackpot/10 border border-jackpot/40 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono text-jackpot font-bold">
            <Trophy className="w-4 h-4" />
            Boss down on floor {floorData.floor} — round {round}. Claim your payout (damage:{" "}
            <span className="font-mono-numbers">{playerDamage}</span>).
          </div>
          <button
            onClick={handleClaimPayout}
            disabled={busy !== null || playerDamage === 0}
            className="px-4 py-1.5 rounded-lg bg-jackpot hover:bg-jackpot/90 text-oled text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40 active:scale-95"
          >
            {busy === "claim" ? "Sending…" : "Claim Payout"}
          </button>
        </div>
      )}
      {floorData.expired && !bossDown && (
        <div className="p-3 rounded-xl bg-panel-dark border border-hp/40 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono text-hp font-bold">
            <Timer className="w-4 h-4" />
            Deadline for round {round} missed — anyone can resolve this round.
          </div>
          <button
            onClick={handleResolveExpired}
            disabled={busy !== null}
            className="px-4 py-1.5 rounded-lg bg-hp hover:bg-hp/80 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40 active:scale-95"
          >
            {busy === "resolve" ? "Mengirim…" : "Resolve Expired"}
          </button>
        </div>
      )}

      {/* Top: arena & live bars / jackpot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 flex flex-col gap-3">
          <BossArena
            floor={floorData.floor}
            dominantElement={resistances.indexOf(Math.max(...resistances)) as ElementIndex}
            expired={floorData.expired}
            enrage={floorData.enrage}
            wardElement={floorData.ward_element}
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
        </div>
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="rounded-xl bg-panel-card border border-white/10 p-4 shadow-xl flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-400">
              <Coins className="w-4 h-4 text-jackpot" />
              <span>Round damage-mu</span>
            </div>
            <span className="font-mono-numbers text-white font-bold text-base">{playerDamage}</span>
          </div>
          <JackpotCounter
            jackpotYocto={floorData.jackpot ?? "0"}
            playerDamage={playerDamage}
            totalDamage={Number(floorData.total_damage ?? "0")}
            onClaimPayout={handleClaimPayout}
            disabled={busy !== null || playerDamage === 0 || !bossDown}
          />
        </div>
      </div>

      {/* Bottom: combat planner / meta radar + damage feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8">
          <TacticalCombatStance
            inventory={inventory.data ?? emptyInventory()}
            resistances={resistances}
            floor={floorData.floor}
            onAttack={handleAttack}
            disabled={busy !== null || bossDown || floorData.expired}
          />
        </div>
        <div className="lg:col-span-4 flex flex-col gap-3">
          <MetaRadar resistances={resistances} />
        </div>
      </div>

      <div>
        <DamageLog logs={logs} />
      </div>
    </motion.section>
  );
}
