import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-oled text-parchment flex items-center justify-center px-4 py-12"
    >
      <section className="obsidian-surface max-w-lg w-full p-8 text-center space-y-4">
        <h1 className="font-serif text-3xl font-bold text-parchment tracking-wide">
          404 · Chamber Not Found
        </h1>
        <p className="text-sm text-ash leading-relaxed">
          No citadel chamber exists at this path. Return to the main sanctuary or launch a
          1-click testnet raider session.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/game/forge"
            className="min-h-[44px] px-5 py-2.5 rounded-lg bg-solar text-oled font-mono font-bold text-xs uppercase tracking-wider inline-flex items-center hover:bg-solar/90 transition-colors"
          >
            Enter Town &amp; Forge
          </Link>
          <Link
            href="/"
            className="min-h-[44px] px-4 py-2.5 rounded-lg border border-brass/35 bg-panel-elevated text-parchment font-mono font-semibold text-xs uppercase tracking-wider inline-flex items-center hover:border-solar/60 transition-colors"
          >
            Sanctuary Home
          </Link>
        </div>
      </section>
    </main>
  );
}
