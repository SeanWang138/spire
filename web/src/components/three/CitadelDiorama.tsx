"use client";

import dynamic from "next/dynamic";
import type { SpireCitadel3DProps } from "./SpireCitadel3D";
import { CitadelFallbackSvg } from "./CitadelFallbackSvg";

export const CitadelDiorama = dynamic<SpireCitadel3DProps>(
  () => import("./SpireCitadel3D").then((mod) => mod.SpireCitadel3D),
  {
    ssr: false,
    loading: () => <CitadelFallbackSvg className="h-full min-h-[380px]" />,
  }
);
