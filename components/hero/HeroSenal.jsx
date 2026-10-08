"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * La señal: un punto de luz con destello de ocho puntas (la estrella polar
 * de Northa), un halo que respira, un pulso que se expande y tres anillos.
 * Parallax ligero por capas con el puntero en escritorio. Las animaciones se
 * pausan cuando el hero sale de pantalla. Decorativa.
 */
export function HeroSenal() {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const section = root.closest("section") ?? root;

    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      root.classList.toggle("is-paused", !visible);
    });
    io.observe(section);

    if (reduced || !window.matchMedia("(pointer: fine)").matches) {
      return () => io.disconnect();
    }

    const capas = Array.from(root.querySelectorAll("[data-depth]")).map((el) => ({
      el,
      depth: Number(el.dataset.depth) || 0,
    }));
    let px = 0;
    let py = 0;
    let rafId = null;

    const pintar = () => {
      rafId = null;
      for (const { el, depth } of capas) {
        el.style.translate = `${(px * 10 * depth).toFixed(1)}px ${(py * 8 * depth).toFixed(1)}px`;
      }
    };
    const onMove = (e) => {
      if (!visible || e.pointerType !== "mouse") return;
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      if (rafId == null) rafId = requestAnimationFrame(pintar);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      if (rafId != null) cancelAnimationFrame(rafId);
      for (const { el } of capas) el.style.translate = "";
    };
  }, [reduced]);

  return (
    <div ref={ref} aria-hidden="true" className="senal hero-in shrink-0">
      <div data-depth="0.35" className="senal-capa absolute inset-0">
        <span className="senal-anillo a3 absolute left-1/2 top-1/2" />
        <span className="senal-anillo a2 absolute left-1/2 top-1/2" />
      </div>
      <div data-depth="0.7" className="senal-capa absolute inset-0">
        <span className="senal-anillo a1 absolute left-1/2 top-1/2" />
        <span className="senal-pulso absolute left-1/2 top-1/2" />
        <span className="senal-pulso p2 absolute left-1/2 top-1/2" />
      </div>
      <div data-depth="1.1" className="senal-capa absolute inset-0">
        <span className="senal-halo absolute left-1/2 top-1/2" />
        <span className="senal-destello absolute left-1/2 top-1/2">
          <span className="h" />
          <span className="v" />
          <span className="d1" />
          <span className="d2" />
        </span>
        <span className="senal-nucleo absolute left-1/2 top-1/2" />
      </div>
    </div>
  );
}

export default HeroSenal;
