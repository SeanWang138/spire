"use client";

import React from "react";
import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-oled text-parchment min-h-screen flex items-center justify-center px-4 py-12 font-sans">
        <main className="obsidian-surface max-w-lg w-full p-8 text-center space-y-4">
          <h1 className="font-serif text-2xl font-bold text-parchment tracking-wide">
            SpireFi Shell Recovery
          </h1>
          <p className="text-sm text-ash leading-relaxed">
            A critical rendering error occurred. Reload the interface or return to the
            landing sanctuary.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-solar text-oled font-mono font-bold text-xs uppercase tracking-wider"
            >
              Reload Shell
            </button>
            <Link
              href="/"
              className="min-h-[44px] px-4 py-2 rounded-lg border border-brass/35 bg-panel-elevated text-parchment font-mono font-semibold text-xs uppercase tracking-wider inline-flex items-center"
            >
              Landing Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}

