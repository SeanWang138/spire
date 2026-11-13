"use client";

import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils/cn";

export function SpireSurface({
  variant = "surface",
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "surface" | "chamfer" | "stage";
}) {
  const variantClass =
    variant === "chamfer"
      ? "obsidian-chamfer"
      : variant === "stage"
      ? "citadel-stage"
      : "obsidian-surface";

  return (
    <div className={cn(variantClass, className)} {...props}>
      {children}
    </div>
  );
}

export function SpireButton({
  variant = "gold",
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "gold" | "frost" | "void" | "crimson" | "ghost";
}) {
  const styles: Record<string, string> = {
    gold: "bg-gradient-to-b from-amber-400 to-amber-600 text-oled border-amber-300/60 hover:from-amber-300 hover:to-amber-500",
    frost: "bg-frost/15 text-frost border-frost/45 hover:bg-frost/25",
    void: "bg-void/15 text-purple-200 border-void/45 hover:bg-void/25",
    crimson: "bg-hp/15 text-rose-200 border-hp/45 hover:bg-hp/25",
    ghost: "bg-panel-dark/90 text-ash border-brass/25 hover:bg-panel-elevated hover:border-brass/50 hover:text-parchment",
  };

  return (
    <button
      className={cn(
        "rpg-sheen inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all duration-150 disabled:opacity-45 disabled:pointer-events-none active:scale-[0.98]",
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SpireTooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-lg border border-brass/30 bg-[#0B0B11]/95 px-3.5 py-2.5 text-xs text-parchment shadow-xl backdrop-blur-md"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-[#0B0B11]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const SpireTabs = TabsPrimitive.Root;

export function SpireTabsList({
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-brass/20 bg-oled/90 p-1",
        className
      )}
      {...props}
    />
  );
}

export function SpireTabsTrigger({
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "min-h-[44px] px-3.5 py-2 rounded-md text-xs font-semibold text-ash transition-all hover:text-parchment data-[state=active]:bg-solar/20 data-[state=active]:text-parchment data-[state=active]:border data-[state=active]:border-solar/50",
        className
      )}
      {...props}
    />
  );
}

export const SpireTabsContent = TabsPrimitive.Content;

export function SpireSlider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  accentColor = "#F2A63B",
  ariaLabel,
  className = "",
}: {
  value: number[];
  onValueChange: (val: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  accentColor?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      className={cn(
        "relative flex items-center select-none touch-none w-full min-h-[36px] cursor-pointer",
        className
      )}
    >
      <SliderPrimitive.Track className="relative grow h-2.5 rounded-full bg-white/10 overflow-hidden">
        <SliderPrimitive.Range
          className="absolute h-full rounded-full"
          style={{ backgroundColor: accentColor }}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block w-5 h-5 rounded-full bg-parchment border-2 shadow-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar"
        style={{ borderColor: accentColor }}
      />
    </SliderPrimitive.Root>
  );
}
