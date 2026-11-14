"use client";

import React from "react";
import Link from "next/link";
import { Ghost, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  title: string;
  hint: string;
  onReload?: () => void;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}

/**
 * Honest "contract not reachable / session required" state. Used whenever a
 * contract view call fails or state is empty so misleading numbers never render.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  hint,
  onReload,
  actionHref,
  actionLabel,
  className = "",
}) => {
  return (
    <div
      className={`obsidian-surface p-8 flex flex-col items-center justify-center text-center gap-3 ${className}`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center ${
          onReload ? "bg-red-950/55 text-hp-text" : "bg-panel-dark text-ash"
        }`}
        aria-hidden="true"
      >
        <Ghost className="w-6 h-6" />
      </div>
      <h2 className="font-serif text-lg sm:text-xl font-bold text-parchment tracking-wide">
        {title}
      </h2>
      <p className="text-xs font-mono text-ash max-w-md leading-relaxed">
        {hint}
      </p>
      {(onReload || (actionHref && actionLabel)) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {onReload && (
            <button
              type="button"
              onClick={onReload}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-panel-elevated hover:bg-panel-card border border-brass/30 text-parchment text-xs font-mono font-semibold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar focus-visible:ring-offset-2 focus-visible:ring-offset-oled"
            >
              <RefreshCw className="w-3.5 h-3.5 text-frost" aria-hidden="true" />
              <span>Retry</span>
            </button>
          )}
          {actionHref && actionLabel && (
            <Link
              href={actionHref}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-solar/15 hover:bg-solar/25 border border-solar/45 text-solar text-xs font-mono font-semibold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar focus-visible:ring-offset-2 focus-visible:ring-offset-oled"
            >
              <span>{actionLabel}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
