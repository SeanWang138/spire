"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SpireFi ErrorBoundary]", error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-oled text-parchment flex items-center justify-center px-4 py-12"
    >
      <section className="obsidian-surface max-w-lg w-full p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-hp/15 border border-hp/40 flex items-center justify-center text-hp-text">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-parchment tracking-wide">
          Sanctum Interrupted
        </h1>
        <p className="text-sm text-ash leading-relaxed">
          An unexpected interface error interrupted this chamber. Your on-chain NEAR
          Testnet progress and guest subaccount remain intact.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-solar text-oled font-mono font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-solar/90 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry Chamber</span>
          </button>
          <Link
            href="/game/forge"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-brass/35 bg-panel-elevated text-parchment font-mono font-semibold text-xs uppercase tracking-wider inline-flex items-center hover:border-solar/60 transition-colors"
          >
            Return to Town &amp; Forge
          </Link>
        </div>
      </section>
    </main>
  );
}

