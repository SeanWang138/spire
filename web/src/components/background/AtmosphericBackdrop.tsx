"use client";

import React, { useEffect, useRef } from "react";
import { useMotionControl } from "@/lib/spire/motion";

export type ElementalTheme = "solar" | "frost" | "void";

interface AtmosphericBackdropProps {
  element?: ElementalTheme;
  intensity?: "vista" | "workspace";
  hoverBoost?: number;
  className?: string;
}

interface Mote {
  x: number;
  y: number;
  vy: number;
  vx: number;
  size: number;
  alpha: number;
  depth: number;
  phase: number;
  hueIndex: 0 | 1;
}

const ELEMENT_PALETTES: Record<
  ElementalTheme,
  {
    nebulaA: [number, number, number];
    nebulaB: [number, number, number];
    ray: [number, number, number];
    motePrimary: string;
    moteSecondary: string;
  }
> = {
  solar: {
    nebulaA: [242, 166, 59],
    nebulaB: [180, 83, 9],
    ray: [242, 166, 59],
    motePrimary: "242, 166, 59",
    moteSecondary: "255, 228, 160",
  },
  frost: {
    nebulaA: [56, 189, 248],
    nebulaB: [30, 64, 175],
    ray: [56, 189, 248],
    motePrimary: "56, 189, 248",
    moteSecondary: "186, 230, 253",
  },
  void: {
    nebulaA: [168, 85, 247],
    nebulaB: [109, 40, 217],
    ray: [168, 85, 247],
    motePrimary: "168, 85, 247",
    moteSecondary: "233, 213, 255",
  },
};

export const AtmosphericBackdrop: React.FC<AtmosphericBackdropProps> = ({
  element = "solar",
  intensity = "workspace",
  hoverBoost = 0,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const horizonFarRef = useRef<SVGSVGElement | null>(null);
  const horizonNearRef = useRef<SVGSVGElement | null>(null);

  const { paused, reducedMotion } = useMotionControl();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const elementRef = useRef<ElementalTheme>(element);
  elementRef.current = element;
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;
  const hoverBoostRef = useRef(hoverBoost);
  hoverBoostRef.current = hoverBoost;

  const pointerRef = useRef<{ x: number; y: number; tx: number; ty: number }>({
    x: 0.5,
    y: 0.4,
    tx: 0.5,
    ty: 0.4,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    let width = 0;
    let height = 0;
    let rafId = 0;

    const motes: Mote[] = Array.from({ length: 76 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vy: 0.00016 + Math.random() * 0.00042,
      vx: (Math.random() - 0.5) * 0.00012,
      size: 0.9 + Math.random() * 2.0,
      alpha: 0.25 + Math.random() * 0.55,
      depth: 0.45 + Math.random() * 0.85,
      phase: Math.random() * Math.PI * 2,
      hueIndex: Math.random() > 0.3 ? 0 : 1,
    }));

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };

    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.tx = e.clientX / Math.max(1, window.innerWidth);
      pointerRef.current.ty = e.clientY / Math.max(1, window.innerHeight);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    let time = 0;
    let smoothBoost = 0;

    const renderFrame = () => {
      rafId = requestAnimationFrame(renderFrame);

      const freeze = pausedRef.current || reducedMotionRef.current;
      const isVista = intensityRef.current === "vista";
      const pal = ELEMENT_PALETTES[elementRef.current];

      smoothBoost += (hoverBoostRef.current - smoothBoost) * 0.06;
      pointerRef.current.x += (pointerRef.current.tx - pointerRef.current.x) * 0.05;
      pointerRef.current.y += (pointerRef.current.ty - pointerRef.current.y) * 0.05;

      if (!freeze) {
        time += 0.016 * (1 + smoothBoost * 0.65);
      }

      const pxOffset = (pointerRef.current.x - 0.5) * 14;
      const scrollY = isVista ? Math.min(window.scrollY || 0, 800) : 0;
      if (horizonFarRef.current) {
        horizonFarRef.current.style.transform = `translate3d(${(-pxOffset * 0.4).toFixed(1)}px, ${(scrollY * 0.04).toFixed(1)}px, 0)`;
      }
      if (horizonNearRef.current) {
        horizonNearRef.current.style.transform = `translate3d(${(-pxOffset).toFixed(1)}px, ${(scrollY * 0.02).toFixed(1)}px, 0)`;
      }

      const cw = canvas.width;
      const ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      const baseVis = isVista ? 1.0 : 0.62;

      // Volcanic Obsidian Twilight Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, ch);
      skyGrad.addColorStop(0, "#050509");
      skyGrad.addColorStop(0.55, "#0B0A11");
      skyGrad.addColorStop(1, "#06060A");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, cw, ch);

      // Warm dusk atmospheric ember glow
      const driftX = (0.68 + Math.sin(time * 0.14) * 0.03) * cw;
      const driftY = (0.32 + Math.cos(time * 0.11) * 0.03) * ch;
      const nebA = ctx.createRadialGradient(driftX, driftY, 12, driftX, driftY, cw * 0.46);
      nebA.addColorStop(
        0,
        `rgba(${pal.nebulaA[0]}, ${pal.nebulaA[1]}, ${pal.nebulaA[2]}, ${(0.11 + smoothBoost * 0.12) * baseVis})`
      );
      nebA.addColorStop(
        0.55,
        `rgba(${pal.nebulaB[0]}, ${pal.nebulaB[1]}, ${pal.nebulaB[2]}, ${(0.06 + smoothBoost * 0.05) * baseVis})`
      );
      nebA.addColorStop(1, "rgba(6, 6, 10, 0)");
      ctx.fillStyle = nebA;
      ctx.fillRect(0, 0, cw, ch);

      // Sanctum Diagonal Volumetric God Rays
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const rx = cw * (0.28 + i * 0.17) + Math.sin(time * 0.16 + i) * (18 * dpr);
        const rayW = (48 + i * 16) * dpr;
        const grad = ctx.createLinearGradient(rx, 0, rx - cw * 0.11, ch * 0.82);
        const alpha = (0.02 + Math.sin(time * 0.4 + i * 1.3) * 0.008 + smoothBoost * 0.02) * baseVis;
        grad.addColorStop(0, `rgba(${pal.ray[0]}, ${pal.ray[1]}, ${pal.ray[2]}, ${Math.max(0.01, alpha)})`);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        ctx.lineTo(rx + rayW, 0);
        ctx.lineTo(rx - cw * 0.1 + rayW * 1.45, ch * 0.85);
        ctx.lineTo(rx - cw * 0.1, ch * 0.85);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Ascending Ember / Frost / Void Spores
      for (const m of motes) {
        if (!freeze) {
          m.y -= m.vy * (1 + smoothBoost) * m.depth;
          m.x += m.vx + Math.sin(time * 0.65 + m.phase) * 0.00007;
          if (m.y < -0.04) {
            m.y = 1.04;
            m.x = Math.random();
          }
          if (m.x < -0.05) m.x = 1.05;
          if (m.x > 1.05) m.x = -0.05;
        }

        const mx = (m.x + (pointerRef.current.x - 0.5) * -0.015 * m.depth) * cw;
        const my = m.y * ch;
        const twinkle = 0.68 + 0.32 * Math.sin(time * 1.6 + m.phase);
        const rgb = m.hueIndex === 0 ? pal.motePrimary : pal.moteSecondary;
        const a = Math.min(0.85, m.alpha * twinkle * (0.78 + smoothBoost * 0.45) * baseVis);

        ctx.fillStyle = `rgba(${rgb}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(mx, my, m.size * dpr * m.depth, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      <svg
        ref={horizonFarRef}
        viewBox="0 0 1440 240"
        preserveAspectRatio="none"
        className="absolute inset-x-[-24px] bottom-0 w-[calc(100%+48px)] h-[150px] sm:h-[190px] opacity-85 transition-transform duration-300 ease-out"
      >
        <defs>
          <linearGradient id="farBasaltGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#171622" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#06060A" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path
          d="M0,240 L0,165 L95,112 L155,138 L225,84 L265,108 L365,158 L475,78 L525,106 L615,62 L660,104 L760,152 L880,102 L970,66 L1020,96 L1125,52 L1185,96 L1285,134 L1370,74 L1440,118 L1440,240 Z"
          fill="url(#farBasaltGrad)"
        />
      </svg>

      <svg
        ref={horizonNearRef}
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        className="absolute inset-x-[-24px] bottom-0 w-[calc(100%+48px)] h-[96px] sm:h-[128px] opacity-95 transition-transform duration-200 ease-out"
      >
        <defs>
          <linearGradient id="nearBasaltGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D0E14" />
            <stop offset="100%" stopColor="#06060A" />
          </linearGradient>
        </defs>
        <path
          d="M0,160 L0,118 L140,86 L270,126 L410,92 L560,136 L735,98 L890,138 L1075,88 L1240,128 L1375,86 L1440,112 L1440,160 Z"
          fill="url(#nearBasaltGrad)"
        />
      </svg>
    </div>
  );
};
