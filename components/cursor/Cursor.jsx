"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const INTERACTIVE =
  "a, button, [role='button'], input, textarea, select, summary, label, [data-cursor='active']";
const MAGNET_RANGE = 6; // px máximos de atracción

/**
 * Halo de cursor en escritorio. No sustituye al cursor del sistema: es un
 * anillo que lo acompaña con interpolación, crece sobre elementos
 * interactivos y atrae ligeramente los botones marcados con [data-magnetic].
 * Solo (pointer: fine) y sin prefers-reduced-motion.
 */
export function Cursor() {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const halo = ref.current;
    if (!halo || reduced) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let rafId = null;
    let magnet = null;

    const loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      halo.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      rafId = requestAnimationFrame(loop);
    };

    const releaseMagnet = () => {
      if (magnet) {
        magnet.style.transform = "";
        magnet = null;
      }
    };

    const onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      halo.classList.add("is-visible");

      const target = e.target instanceof Element ? e.target : null;
      const interactive = target ? target.closest(INTERACTIVE) : null;
      halo.classList.toggle("is-active", Boolean(interactive));

      const m = target ? target.closest("[data-magnetic]") : null;
      if (m !== magnet) releaseMagnet();
      if (m) {
        magnet = m;
        const r = m.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        m.style.transform = `translate(${dx * MAGNET_RANGE}px, ${dy * MAGNET_RANGE}px)`;
      }
    };

    const onLeave = () => {
      halo.classList.remove("is-visible");
      releaseMagnet();
    };
    const onEnter = () => halo.classList.add("is-visible");
    const onDown = () => halo.classList.add("is-text");
    const onUp = () => halo.classList.remove("is-text");

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      releaseMagnet();
    };
  }, [reduced]);

  return <div ref={ref} aria-hidden="true" className="cursor-halo" />;
}

export default Cursor;
