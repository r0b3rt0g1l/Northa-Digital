"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Composición abstracta del hero: una forma luminosa, dos anillos finos y
 * tres planos de vidrio en capas. Responde al puntero con un parallax muy
 * ligero (±8 px, por capa) y al scroll (desplazamiento mínimo) en escritorio.
 * Decorativa (aria-hidden). prefers-reduced-motion → estática.
 */
export function HeroVisual() {
  const rootRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const layers = Array.from(root.querySelectorAll("[data-depth]")).map((el) => ({
      el,
      depth: Number(el.dataset.depth) || 0,
    }));

    let px = 0;
    let py = 0;
    let sy = 0;
    let rafId = null;

    const render = () => {
      rafId = null;
      for (const { el, depth } of layers) {
        const x = px * 8 * depth;
        const y = py * 8 * depth - sy * 0.06 * depth;
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }
    };
    const schedule = () => {
      if (rafId == null) rafId = requestAnimationFrame(render);
    };
    const onMove = (e) => {
      px = (e.clientX / window.innerWidth - 0.5) * 2;
      py = (e.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };
    const onScroll = () => {
      sy = Math.min(window.scrollY, 600);
      schedule();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
      for (const { el } of layers) el.style.transform = "";
    };
  }, [reduced]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="relative mx-auto h-[300px] w-full max-w-[560px] sm:h-[380px] lg:h-[520px]"
    >
      {/* Forma luminosa */}
      <div
        data-depth="0.4"
        className="absolute left-1/2 top-1/2 h-[58%] w-[58%] rounded-full bg-[radial-gradient(circle_at_40%_35%,rgba(127,211,255,0.55),rgba(79,140,255,0.35)_40%,rgba(79,140,255,0)_72%)] blur-xl"
        style={{ translate: "-50% -50%" }}
      />
      {/* Anillos */}
      <div
        data-depth="0.6"
        className="absolute left-1/2 top-1/2 h-[80%] w-[80%] rounded-full border border-white/[0.06]"
        style={{ translate: "-50% -50%" }}
      />
      <div
        data-depth="0.3"
        className="absolute left-1/2 top-1/2 h-[108%] w-[108%] rounded-full border border-white/[0.04]"
        style={{ translate: "-50% -50%" }}
      />
      {/* Planos de vidrio */}
      <div
        data-depth="0.8"
        className="glass absolute left-[14%] top-[22%] h-[38%] w-[56%] rounded-[20px]"
        style={{ rotate: "-8deg" }}
      />
      <div
        data-depth="1.1"
        className="glass absolute left-[27%] top-[36%] h-[38%] w-[56%] rounded-[20px] bg-[rgba(18,21,28,0.6)]"
        style={{ rotate: "-3deg" }}
      />
      <div
        data-depth="1.5"
        className="glass-strong absolute left-[40%] top-[50%] flex h-[38%] w-[56%] flex-col gap-2.5 rounded-[20px] p-5"
        style={{ rotate: "3deg" }}
      >
        <span className="h-2 w-[44%] rounded bg-white/[0.22]" />
        <span className="h-2 w-[70%] rounded bg-white/[0.12]" />
        <span className="h-2 w-[58%] rounded bg-white/[0.12]" />
        <span className="mt-auto h-7 w-24 rounded-full bg-accent/90" />
      </div>
    </div>
  );
}

export default HeroVisual;
