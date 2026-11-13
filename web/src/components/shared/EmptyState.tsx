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
 * Clean "contract not reachable / not yet provisioned" state. Used whenever a
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
      className={`rounded-xl border border-white/10 bg-panel-dark elevation-panel p-8 flex flex-col items-center justify-center text-center gap-3 ${className}`}
    >
      <Ghost className="w-8 h-8 text-slate-400" aria-hidden="true" />
      <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded border border-white/10 text-slate-300 bg-white/[0.03]">
        Contract Unreachable
      </span>
      <h3 className="font-serif text-lg font-bold text-white tracking-wide">{title}</h3>
      <p className="text-xs font-mono text-slate-300 max-w-sm leading-relaxed">{hint}</p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {onReload && (
          <button
            type="button"
            onClick={onReload}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Retry
          </button>
        )}
        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-solar/15 hover:bg-solar/25 border border-solar/40 text-solar text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
};
