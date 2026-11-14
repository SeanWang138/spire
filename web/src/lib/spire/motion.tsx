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
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [osReducedMotion, setOsReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setOsReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => {
      setOsReducedMotion(e.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setPaused = useCallback((next: boolean) => {
    setUserPaused(next);
  }, []);

  const togglePaused = useCallback(() => {
    setUserPaused((prev) => !(prev !== null ? prev : osReducedMotion));
  }, [osReducedMotion]);

  // Respect prefers-reduced-motion by pausing ambient motion until the user clicks Resume FX.
  const paused = userPaused !== null ? userPaused : osReducedMotion;
  const reducedMotion = userPaused === false ? false : osReducedMotion;

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
