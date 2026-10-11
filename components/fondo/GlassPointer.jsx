"use client";

import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const SUPERFICIES = ".glass, .glass-strong, .card";

/**
 * Hace que el reflejo del vidrio y el brillo de las tarjetas mate sigan al
 * puntero: escribe --mx/--my en la superficie bajo el cursor. Si la
 * superficie lleva [data-tilt="grados"], también escribe --rx/--ry para que
 * se incline hacia el puntero. Un solo listener delegado, un cuadro por
 * evento como máximo, solo ratón.
 */
export function GlassPointer() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let actual = null;
    let rafId = null;
    let pendiente = null;

    const aplicar = () => {
      rafId = null;
      if (!pendiente) return;
      const { el, x, y } = pendiente;
      pendiente = null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (x - r.left) / r.width;
      const py = (y - r.top) / r.height;
      el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      const tilt = Number(el.dataset.tilt);
      if (tilt) {
        el.style.setProperty("--ry", `${((px - 0.5) * 2 * tilt).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-(py - 0.5) * 2 * tilt).toFixed(2)}deg`);
      }
    };

    const limpiar = (el) => {
      el?.style.removeProperty("--mx");
      el?.style.removeProperty("--my");
      el?.style.removeProperty("--rx");
      el?.style.removeProperty("--ry");
    };

    const onMove = (e) => {
      if (e.pointerType !== "mouse") return;
      const target = e.target instanceof Element ? e.target.closest(SUPERFICIES) : null;
      if (target !== actual) {
        limpiar(actual);
        actual = target;
      }
      if (!actual) return;
      pendiente = { el: actual, x: e.clientX, y: e.clientY };
      if (rafId == null) rafId = requestAnimationFrame(aplicar);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (rafId != null) cancelAnimationFrame(rafId);
      limpiar(actual);
    };
  }, [reduced]);

  return null;
}

export default GlassPointer;
