"use client";

import React from "react";
import { AtmosphericBackdrop, type ElementalTheme } from "@/components/background/AtmosphericBackdrop";

export type { ElementalTheme };

interface VolumetricCanvasProps {
  element?: ElementalTheme;
  activeElement?: ElementalTheme;
  className?: string;
}

export const VolumetricCanvas: React.FC<VolumetricCanvasProps> = ({
  element,
  activeElement,
  className = "",
}) => {
  return (
    <AtmosphericBackdrop
      element={activeElement ?? element ?? "solar"}
      intensity="workspace"
      className={className}
    />
  );
};
