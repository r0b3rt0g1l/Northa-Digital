"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const INTERACTIVO =
  "a, button, [role='button'], input, textarea, select, summary, label, [data-cursor='active']";
const IMAN = 5; // px máximos de atracción por eje

/**
 * Halo de cursor en escritorio. No sustituye al cursor del sistema: lo
 * acompaña con un retraso suave, crece sobre lo interactivo y atrae un poco
 * los botones marcados con [data-magnetic]. El bucle solo corre mientras hay
 * movimiento y se detiene al alcanzar al puntero. Solo ratón, sin
 * prefers-reduced-motion. Escribe la propiedad `translate`, que no choca con
 * transform ni con scale de los botones.
 */
export function Cursor() {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const halo = ref.current;
    if (!halo || reduced) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let iniciado = false;
    let rafId = null;
    let previo = 0;
    const iman = { el: null, x: 0, y: 0, tx: 0, ty: 0 };

    const loop = (t) => {
      const dt = previo ? Math.min(t - previo, 64) : 16.7;
      previo = t;
      const k = 1 - Math.pow(0.82, dt / 16.7);
      const ki = 1 - Math.pow(0.85, dt / 16.7);

      x += (tx - x) * k;
      y += (ty - y) * k;
      halo.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;

      if (iman.el) {
        iman.x += (iman.tx - iman.x) * ki;
        iman.y += (iman.ty - iman.y) * ki;
        iman.el.style.translate = `${iman.x.toFixed(2)}px ${iman.y.toFixed(2)}px`;
        const quieto = Math.abs(iman.tx - iman.x) < 0.05 && Math.abs(iman.ty - iman.y) < 0.05;
        if (quieto && iman.tx === 0 && iman.ty === 0) {
          iman.el.style.translate = "";
          iman.el = null;
        }
      }

      const enReposo =
        Math.abs(tx - x) < 0.1 &&
        Math.abs(ty - y) < 0.1 &&
        (!iman.el || (Math.abs(iman.tx - iman.x) < 0.05 && Math.abs(iman.ty - iman.y) < 0.05));
      if (enReposo) {
        rafId = null;
        previo = 0;
        return;
      }
      rafId = requestAnimationFrame(loop);
    };
    const despertar = () => {
      if (rafId == null) rafId = requestAnimationFrame(loop);
    };

    const soltarIman = (siguiente) => {
      if (iman.el && iman.el !== siguiente) {
        iman.el.style.translate = "";
        iman.el = null;
        iman.x = iman.y = 0;
      }
    };

    const onMove = (e) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      if (!iniciado) {
        x = tx;
        y = ty;
        iniciado = true;
      }
      halo.classList.add("is-visible");

      const target = e.target instanceof Element ? e.target : null;
      halo.classList.toggle("is-active", Boolean(target?.closest(INTERACTIVO)));

      const m = target?.closest("[data-magnetic]") ?? null;
      if (m) {
        soltarIman(m);
        const r = m.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
        iman.el = m;
        iman.tx = dx * IMAN;
        iman.ty = dy * IMAN;
      } else if (iman.el) {
        iman.tx = 0;
        iman.ty = 0;
      }
      despertar();
    };

    const onLeave = () => {
      halo.classList.remove("is-visible");
      if (iman.el) {
        iman.tx = 0;
        iman.ty = 0;
        despertar();
      }
    };
    const onEnter = () => iniciado && halo.classList.add("is-visible");
    // Con la rueda el puntero no se mueve: el botón no debe quedarse desplazado.
    const onScroll = () => {
      if (!iman.el) return;
      iman.tx = 0;
      iman.ty = 0;
      despertar();
    };
    const onDown = (e) => e.pointerType === "mouse" && halo.classList.add("is-pressed");
    const onUp = () => halo.classList.remove("is-pressed");

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", onScroll);
      soltarIman(null);
    };
  }, [reduced]);

  return <div ref={ref} aria-hidden="true" className="cursor-halo" />;
}

export default Cursor;
