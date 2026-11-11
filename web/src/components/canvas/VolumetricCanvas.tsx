"use client";

import React, { useEffect, useRef } from "react";

export type ElementalTheme = "solar" | "frost" | "void";

export interface VolumetricCanvasProps {
  element?: ElementalTheme;
  activeElement?: ElementalTheme;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  alpha: number;
  baseAlpha: number;
  phase: number;
  swaySpeed: number;
  swayDist: number;
}

const ELEMENT_RGB: Record<ElementalTheme, [number, number, number]> = {
  solar: [245, 158, 11],  // #F59E0B
  frost: [56, 189, 248],  // #38BDF8
  void: [168, 85, 247],   // #A855F7
};

export const VolumetricCanvas: React.FC<VolumetricCanvasProps> = ({
  element,
  activeElement,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentTheme: ElementalTheme = activeElement ?? element ?? "solar";
  const targetRgbRef = useRef<[number, number, number]>(
    ELEMENT_RGB[currentTheme] || ELEMENT_RGB.solar
  );

  useEffect(() => {
    targetRgbRef.current = ELEMENT_RGB[currentTheme] || ELEMENT_RGB.solar;
  }, [currentTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Mouse / Cursor position with inertia
    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = width / 2;
    let targetMouseY = height / 2;
    let mouseActive = false;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
      mouseActive = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        targetMouseX = e.touches[0].clientX;
        targetMouseY = e.touches[0].clientY;
        mouseActive = true;
      }
    };

    const handleMouseLeave = () => {
      mouseActive = false;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave, { passive: true });

    // Handle Resize
    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    window.addEventListener("resize", handleResize);

    // Pre-allocated Particle Pool (Strictly 80 Particles for 0-allocation loop)
    const PARTICLE_COUNT = 80;
    const particles: Particle[] = new Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = Math.random() * 2.2 + 0.8;
      const alpha = Math.random() * 0.6 + 0.2;
      particles[i] = {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(Math.random() * 0.7 + 0.3), // Steady upward drift
        radius,
        baseRadius: radius,
        alpha,
        baseAlpha: alpha,
        phase: Math.random() * Math.PI * 2,
        swaySpeed: Math.random() * 0.02 + 0.01,
        swayDist: Math.random() * 1.5 + 0.5,
      };
    }

    // Volumetric Rays configuration (7 zenith rays)
    const RAY_COUNT = 7;
    const rays = Array.from({ length: RAY_COUNT }, (_, idx) => ({
      angle: -0.45 + (idx / (RAY_COUNT - 1)) * 0.9,
      width: Math.random() * 90 + 60,
      speed: (Math.random() - 0.5) * 0.0006,
      intensity: Math.random() * 0.08 + 0.04,
      phase: (idx / RAY_COUNT) * Math.PI * 2,
    }));

    // Dynamic Color LERP state
    const currentRgb: [number, number, number] = [...targetRgbRef.current];
    let lastTime = performance.now();

    // Check user preference for reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Render loop
    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Smooth color interpolation towards target element
      const targetRgb = targetRgbRef.current;
      const lerpSpeed = 3.0 * dt;
      currentRgb[0] += (targetRgb[0] - currentRgb[0]) * lerpSpeed;
      currentRgb[1] += (targetRgb[1] - currentRgb[1]) * lerpSpeed;
      currentRgb[2] += (targetRgb[2] - currentRgb[2]) * lerpSpeed;

      const r = Math.round(currentRgb[0]);
      const g = Math.round(currentRgb[1]);
      const b = Math.round(currentRgb[2]);

      // Mouse smoothing
      mouseX += (targetMouseX - mouseX) * 0.1;
      mouseY += (targetMouseY - mouseY) * 0.1;

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // --- LAYER 1: Deep Zenith Ambient Gradient ---
      const zenithY = -40;
      const zenithX = width * 0.5;
      const ambientGrad = ctx.createRadialGradient(
        zenithX,
        zenithY,
        10,
        zenithX,
        height * 0.4,
        Math.max(width, height)
      );
      ambientGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.14)`);
      ambientGrad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.05)`);
      ambientGrad.addColorStop(0.8, "rgba(8, 11, 17, 0)");
      ambientGrad.addColorStop(1, "rgba(8, 11, 17, 0)");

      ctx.fillStyle = ambientGrad;
      ctx.fillRect(0, 0, width, height);

      // --- LAYER 2: Volumetric God-Rays with "screen" blending ---
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < RAY_COUNT; i++) {
        const ray = rays[i];
        if (!prefersReducedMotion) {
          ray.phase += dt * 0.4;
        }
        const pulse = Math.sin(ray.phase) * 0.03 + ray.intensity;
        const currentAngle = ray.angle + Math.sin(time * ray.speed + i) * 0.08;

        const rayLength = height * 1.4;
        const endX = zenithX + Math.sin(currentAngle) * rayLength;
        const endY = zenithY + Math.cos(currentAngle) * rayLength;

        const rayGrad = ctx.createLinearGradient(zenithX, zenithY, endX, endY);
        rayGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${pulse * 1.5})`);
        rayGrad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${pulse * 0.8})`);
        rayGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(zenithX, zenithY);
        ctx.lineTo(endX - ray.width, endY);
        ctx.lineTo(endX + ray.width, endY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // --- LAYER 3: 80 Pre-allocated Floating Spores / Embers ---
      ctx.save();
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          p.phase += p.swaySpeed;
          p.y += p.vy;
          p.x += p.vx + Math.sin(p.phase) * p.swayDist * 0.2;

          // Cursor interactive repulsion and swirl
          if (mouseActive) {
            const dx = p.x - mouseX;
            const dy = p.y - mouseY;
            const distSq = dx * dx + dy * dy;
            const repulseRadius = 140;

            if (distSq < repulseRadius * repulseRadius && distSq > 1) {
              const dist = Math.sqrt(distSq);
              const force = (1 - dist / repulseRadius) * 2.5;
              // Radial push
              p.x += (dx / dist) * force;
              p.y += (dy / dist) * force;
              // Subtle vortex swirl
              p.x += (-dy / dist) * force * 0.4;
              p.y += (dx / dist) * force * 0.4;
            }
          }

          // Wrap particles seamlessly
          if (p.y < -20) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
          if (p.x < -20) p.x = width + 10;
          if (p.x > width + 20) p.x = -10;
        }

        // Draw particle ember
        const emberAlpha = p.baseAlpha * (0.8 + 0.2 * Math.sin(p.phase * 2));
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${emberAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    // Pause animation when tab is inactive to preserve resources
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      aria-hidden="true"
    />
  );
};
