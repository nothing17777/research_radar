"use client";

import { useEffect, useRef } from "react";

interface Glint {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
}

const GLOW_LAG = 0.08;
const GLOW_RADIUS = 220;

export function RippleCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const glints: Glint[] = [];
    const glow = { x: width / 2, y: height / 2 };
    let pointer: { x: number; y: number } | null = null;

    function onPointerMove(e: PointerEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function onPointerLeave() {
      pointer = null;
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);

    let frame: number;

    function tick() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "screen";

      if (pointer) {
        glow.x += (pointer.x - glow.x) * GLOW_LAG;
        glow.y += (pointer.y - glow.y) * GLOW_LAG;

        const ambient = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, GLOW_RADIUS);
        ambient.addColorStop(0, "rgba(255, 255, 255, 0.22)");
        ambient.addColorStop(0.5, "rgba(191, 233, 255, 0.1)");
        ambient.addColorStop(1, "rgba(191, 233, 255, 0)");
        ctx.fillStyle = ambient;
        ctx.fillRect(0, 0, width, height);

        if (Math.random() < 0.5 && glints.length < 24) {
          glints.push({
            x: glow.x + (Math.random() - 0.5) * GLOW_RADIUS,
            y: glow.y + (Math.random() - 0.5) * GLOW_RADIUS,
            life: 0,
            maxLife: 20 + Math.random() * 25,
            size: 0.6 + Math.random() * 1.4,
          });
        }
      }

      for (let i = glints.length - 1; i >= 0; i--) {
        const g = glints[i];
        g.life += 1;
        if (g.life > g.maxLife) {
          glints.splice(i, 1);
          continue;
        }
        const t = g.life / g.maxLife;
        const alpha = Math.sin(t * Math.PI) * 0.9;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.arc(g.x, g.y, g.size, 0, Math.PI * 2);
        ctx.fill();
      }

      frame = requestAnimationFrame(tick);
    }

    if (!reduceMotion) {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
