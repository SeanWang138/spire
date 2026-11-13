"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

interface MotionContextValue {
  paused: boolean;
  setPaused: (v: boolean) => void;
  togglePaused: () => void;
  reducedMotion: boolean;
}

const MotionContext = createContext<MotionContextValue>({
  paused: false,
  setPaused: () => {},
  togglePaused: () => {},
  reducedMotion: false,
});

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [paused, setPausedState] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setPaused = useCallback((next: boolean) => {
    setPausedState(next);
  }, []);

  const togglePaused = useCallback(() => {
    setPausedState((prev) => !prev);
  }, []);

  return (
    <MotionContext.Provider
      value={{ paused, setPaused, togglePaused, reducedMotion }}
    >
      <Tooltip.Provider delayDuration={150} skipDelayDuration={250}>
        {children}
      </Tooltip.Provider>
    </MotionContext.Provider>
  );
};

export function useMotionControl(): MotionContextValue {
  return useContext(MotionContext);
}
