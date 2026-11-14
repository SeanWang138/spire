"use client";

import React, { useState } from "react";
import type { FloorResponse } from "@/lib/contract";

interface CitadelFallbackSvgProps {
  activeFloor?: number;
  onSelectFloor?: (floor: number) => void;
  floors?: FloorResponse[];
  className?: string;
}

export const CitadelFallbackSvg: React.FC<CitadelFallbackSvgProps> = ({
  activeFloor = 1,
  onSelectFloor,
  floors,
  className = "",
}) => {
  const [hoveredTier, setHoveredTier] = useState<number | null>(null);
  const f1 = floors?.find((f) => f.floor === 1);
  const f2 = floors?.find((f) => f.floor === 2);
  const f3 = floors?.find((f) => f.floor === 3);

  const focusTier = hoveredTier ?? activeFloor;
  const activeHex =
    focusTier === 3 ? "#A855F7" : focusTier === 2 ? "#38BDF8" : "#F2A63B";
  const isInteractive = Boolean(onSelectFloor);

  const handleTierKeyDown = (floor: number) => (e: React.KeyboardEvent<SVGGElement>) => {
    if (!onSelectFloor) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectFloor(floor);
    }
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-2 transition-all duration-300 ${className}`}
      onMouseLeave={() => setHoveredTier(null)}
    >
      <div className="relative flex items-center justify-center w-full max-w-[360px]">
        <svg
          viewBox="0 0 380 480"
          className="relative z-10 w-full h-auto"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role={isInteractive ? "group" : "img"}
          aria-label="Spire Citadel gothic three-tier sanctuary schematic"
        >
          <defs>
            <filter id="spireOpticalBloom" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={hoveredTier !== null ? "7" : "3.5"} result="blurWide" />
              <feGaussianBlur stdDeviation="1.8" result="blurCore" />
              <feMerge>
                <feMergeNode in="blurWide" />
                <feMergeNode in="blurCore" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="basaltTierGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1D1E2B" />
              <stop offset="55%" stopColor="#12131D" />
              <stop offset="100%" stopColor="#07070C" />
            </linearGradient>
            <radialGradient id="skyScatterGrad" cx="50%" cy="38%" r="55%">
              <stop offset="0%" stopColor={activeHex} stopOpacity={hoveredTier ? "0.34" : "0.18"} />
              <stop offset="65%" stopColor={activeHex} stopOpacity="0.05" />
              <stop offset="100%" stopColor="#06060A" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Radial Sky Scattering Corona */}
          <rect x="0" y="0" width="380" height="480" fill="url(#skyScatterGrad)" />

          {/* Obsidian Mountain Crag Horizon */}
          <path
            d="M0,480 L0,402 L58,364 L106,392 L152,370 L228,370 L276,396 L328,358 L380,398 L380,480 Z"
            fill="#0D0E16"
            stroke="rgba(229,169,59,0.18)"
            strokeWidth="1"
          />

          {/* Arcane Summoning Magic Circle */}
          <g filter="url(#spireOpticalBloom)" opacity={hoveredTier !== null ? 0.95 : 0.65}>
            <ellipse
              cx="190"
              cy="432"
              rx="145"
              ry="19"
              stroke={activeHex}
              strokeWidth="1.6"
              strokeDasharray="10 6"
            />
            <ellipse
              cx="190"
              cy="432"
              rx="112"
              ry="12"
              stroke="#E5A93B"
              strokeOpacity="0.55"
              strokeWidth="1"
            />
          </g>

          {/* Vertical Skyward Conduit */}
          <line
            x1="190"
            y1="422"
            x2="190"
            y2="34"
            stroke={activeHex}
            strokeOpacity={hoveredTier !== null ? 0.72 : 0.34}
            strokeWidth={hoveredTier !== null ? "2.6" : "1.4"}
            filter="url(#spireOpticalBloom)"
          />

          {/* Floor 1: Foundation Keep */}
          <g
            onMouseEnter={() => setHoveredTier(1)}
            onFocus={() => setHoveredTier(1)}
            onBlur={() => setHoveredTier(null)}
            onClick={() => onSelectFloor?.(1)}
            onKeyDown={handleTierKeyDown(1)}
            tabIndex={isInteractive ? 0 : undefined}
            role={isInteractive ? "button" : undefined}
            aria-label={isInteractive ? `Inspect Floor 1, Foundation Keep${f1 ? `, ${f1.hp} HP` : ""}` : undefined}
            aria-pressed={isInteractive ? activeFloor === 1 : undefined}
            className="cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-[#F2A63B]"
          >
            <polygon points="58,426 106,312 114,426" fill="#0F1018" stroke="rgba(229,169,59,0.22)" />
            <polygon points="322,426 274,312 266,426" fill="#0F1018" stroke="rgba(229,169,59,0.22)" />
            <polygon
              points="106,304 274,304 256,428 124,428"
              fill="url(#basaltTierGrad)"
              stroke={focusTier === 1 ? "#F2A63B" : "rgba(229,169,59,0.24)"}
              strokeWidth={focusTier === 1 ? "2" : "1.1"}
            />
            <rect x="150" y="346" width="8" height="44" fill="#FFE4A0" filter="url(#spireOpticalBloom)" />
            <rect x="186" y="338" width="8" height="52" fill="#FFE4A0" filter="url(#spireOpticalBloom)" />
            <rect x="222" y="346" width="8" height="44" fill="#FFE4A0" filter="url(#spireOpticalBloom)" />
            <text x="190" y="328" textAnchor="middle" fill="#F3EAD8" fontSize="12" fontFamily="ui-monospace, monospace" fontWeight="700">
              {f1 ? `F1 · ${f1.hp} HP` : "F1 · MALAKOR"}
            </text>
          </g>

          {/* Floor 2: Glacial Bastion */}
          <g
            onMouseEnter={() => setHoveredTier(2)}
            onFocus={() => setHoveredTier(2)}
            onBlur={() => setHoveredTier(null)}
            onClick={() => onSelectFloor?.(2)}
            onKeyDown={handleTierKeyDown(2)}
            tabIndex={isInteractive ? 0 : undefined}
            role={isInteractive ? "button" : undefined}
            aria-label={
              isInteractive
                ? `Inspect Floor 2, Glacial Bastion${f2 ? (f2.unlocked ? `, ${f2.hp} HP` : ", Locked") : ""}`
                : undefined
            }
            aria-pressed={isInteractive ? activeFloor === 2 : undefined}
            className="cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-[#38BDF8]"
          >
            <polygon
              points="126,192 254,192 242,300 138,300"
              fill="url(#basaltTierGrad)"
              stroke={focusTier === 2 ? "#38BDF8" : "rgba(229,169,59,0.22)"}
              strokeWidth={focusTier === 2 ? "2" : "1.1"}
            />
            <polygon points="112,250 124,178 134,258" fill="#151722" stroke="#38BDF8" strokeOpacity="0.7" />
            <polygon points="268,250 256,178 246,258" fill="#151722" stroke="#38BDF8" strokeOpacity="0.7" />
            <polygon points="190,234 198,252 190,272 182,252" fill="#BAE6FD" filter="url(#spireOpticalBloom)" />
            <text x="190" y="218" textAnchor="middle" fill="#BAE6FD" fontSize="12" fontFamily="ui-monospace, monospace" fontWeight="700">
              {f2 ? (f2.unlocked ? `F2 · ${f2.hp} HP` : "F2 · LOCKED") : "F2 · VALKYR"}
            </text>
          </g>

          {/* Floor 3: Void Apex Cathedral */}
          <g
            onMouseEnter={() => setHoveredTier(3)}
            onFocus={() => setHoveredTier(3)}
            onBlur={() => setHoveredTier(null)}
            onClick={() => onSelectFloor?.(3)}
            onKeyDown={handleTierKeyDown(3)}
            tabIndex={isInteractive ? 0 : undefined}
            role={isInteractive ? "button" : undefined}
            aria-label={
              isInteractive
                ? `Inspect Floor 3, Void Apex Sanctum${f3 ? (f3.unlocked ? `, ${f3.hp} HP` : ", Locked") : ""}`
                : undefined
            }
            aria-pressed={isInteractive ? activeFloor === 3 : undefined}
            className="cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-[#D8B4FE]"
          >
            <polygon
              points="152,88 228,88 220,188 160,188"
              fill="url(#basaltTierGrad)"
              stroke={focusTier === 3 ? "#A855F7" : "rgba(229,169,59,0.24)"}
              strokeWidth={focusTier === 3 ? "2" : "1.1"}
            />
            <polygon points="190,22 204,88 176,88" fill="#181926" stroke="#E5A93B" strokeWidth="1.2" />
            <polygon points="190,6 198,26 190,44 182,26" fill="#FFE4A0" filter="url(#spireOpticalBloom)" />
            <text x="190" y="144" textAnchor="middle" fill="#D8B4FE" fontSize="12" fontFamily="ui-monospace, monospace" fontWeight="700">
              {f3 ? (f3.unlocked ? `F3 · ${f3.hp} HP` : "F3 · LOCKED") : "F3 · KAELEN"}
            </text>
          </g>
        </svg>
      </div>

      {onSelectFloor && (
        <div className="mt-2 flex items-center gap-2" role="group" aria-label="Select citadel tier">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSelectFloor(n)}
              aria-pressed={activeFloor === n}
              className={`min-h-[44px] px-3.5 rounded-lg font-mono text-xs font-semibold transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar ${
                activeFloor === n
                  ? "bg-solar/20 border-solar text-parchment"
                  : "bg-panel-dark/90 border-brass/20 text-ash hover:border-brass/45"
              }`}
            >
              Floor {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
