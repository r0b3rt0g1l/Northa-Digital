"use client";

import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const GLASS = ".glass, .glass-strong";

/**
 * Hace que el reflejo especular del vidrio (globals.css, `::after`) siga al
 * puntero: escribe --mx/--my en la pieza de vidrio bajo el cursor.
 * Sin re-render, un solo listener delegado, solo punteros finos.
 */
export function GlassPointer() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let current = null;
    let rafId = null;
    let pending = null;

    const apply = () => {
      rafId = null;
      if (!pending) return;
      const { el, x, y } = pending;
      pending = null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      el.style.setProperty("--mx", `${((x - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((y - r.top) / r.height) * 100}%`);
    };

    const clear = (el) => {
      if (!el) return;
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
    };

    const onMove = (e) => {
      const target = e.target instanceof Element ? e.target.closest(GLASS) : null;
      if (target !== current) {
        clear(current);
        current = target;
      }
      if (!current) return;
      pending = { el: current, x: e.clientX, y: e.clientY };
      if (rafId == null) rafId = requestAnimationFrame(apply);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (rafId != null) cancelAnimationFrame(rafId);
      clear(current);
    };
  }, [reduced]);

  return null;
}

export default GlassPointer;
