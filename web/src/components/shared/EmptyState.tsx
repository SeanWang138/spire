"use client";

import React from "react";
import { Ghost, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  title: string;
  hint: string;
  onReload?: () => void;
  className?: string;
}

/**
 * Clean "contract not reachable / not yet provisioned" state. Used whenever a
 * contract view call fails so no fake-looking data ever renders.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  hint,
  onReload,
  className = "",
}) => {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-panel-dark p-8 flex flex-col items-center justify-center text-center gap-3 ${className}`}
    >
      <Ghost className="w-8 h-8 text-slate-500" />
      <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border border-white/10 text-slate-400">
        Contract Unreachable
      </span>
      <h3 className="font-serif text-lg font-bold text-white tracking-wide">{title}</h3>
      <p className="text-xs font-mono text-slate-400 max-w-sm leading-relaxed">{hint}</p>
      {onReload && (
        <button
          onClick={onReload}
          className="mt-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
};
