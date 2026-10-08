"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Campo de estrellas + partículas en un canvas fijo detrás de toda la página.
 * - Estrellas pequeñas, escasas y de bajo contraste; parpadeo lento (4–9 s).
 * - Pocas partículas con tinte azul y deriva casi imperceptible (profundidad).
 * - ~30 cuadros por segundo, DPR limitado a 1.5, menos puntos en móvil.
 * - Pausa cuando la pestaña no está activa.
 * - prefers-reduced-motion o equipos de pocos núcleos: un solo cuadro estático.
 */
export function Starfield() {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const lowPower =
      typeof navigator !== "undefined" &&
      navigator.hardwareConcurrency &&
      navigator.hardwareConcurrency <= 2;
    const animate = !reduced && !lowPower;

    const FRAME = 1000 / 30;
    let width = 0;
    let height = 0;
    let stars = [];
    let motes = [];
    let rafId = null;
    let last = 0;

    const init = () => {
      const mobile = mobileQuery.matches;
      const area = width * height;
      const count = Math.round(
        Math.min(mobile ? 36 : 90, Math.max(24, area / (mobile ? 22000 : 16000))),
      );
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.4 + Math.random() * 0.7,
        a: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        speed: (Math.PI * 2) / (4000 + Math.random() * 5000),
        vy: 0.004 + Math.random() * 0.01,
      }));
      motes = Array.from({ length: mobile ? 4 : 8 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1.5 + Math.random(),
        a: 0.16 + Math.random() * 0.18,
        vx: (Math.random() - 0.5) * 0.03,
        vy: -(0.01 + Math.random() * 0.02),
      }));
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#f2f4f7";
      for (const s of stars) {
        const twinkle = animate ? 0.6 + 0.4 * Math.sin(t * s.speed + s.phase) : 1;
        ctx.globalAlpha = s.a * twinkle;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const m of motes) {
        const radius = m.r * 3;
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, radius);
        g.addColorStop(0, `rgba(127,211,255,${m.a})`);
        g.addColorStop(1, "rgba(127,211,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const tick = (t) => {
      rafId = requestAnimationFrame(tick);
      if (t - last < FRAME) return;
      const dt = Math.min(t - last, 100) / 16;
      last = t;
      for (const s of stars) {
        s.y -= s.vy * dt;
        if (s.y < -2) {
          s.y = height + 2;
          s.x = Math.random() * width;
        }
      }
      for (const m of motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.y < -12) {
          m.y = height + 12;
          m.x = Math.random() * width;
        }
        if (m.x < -12) m.x = width + 12;
        else if (m.x > width + 12) m.x = -12;
      }
      draw(t);
    };

    const start = () => {
      if (animate && rafId == null) {
        last = 0;
        rafId = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const size = (reinit) => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reinit) init();
      draw(performance.now());
    };

    // En móvil la barra del navegador cambia la altura al hacer scroll:
    // solo se regeneran los puntos si el cambio es grande.
    let lastW = 0;
    let lastH = 0;
    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const reinit = w !== lastW || Math.abs(h - lastH) > 160;
        lastW = w;
        lastH = h;
        size(reinit);
      }, 120);
    };

    lastW = window.innerWidth;
    lastH = window.innerHeight;
    size(true);
    start();

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="starfield pointer-events-none fixed inset-0 z-0"
    />
  );
}

export default Starfield;
