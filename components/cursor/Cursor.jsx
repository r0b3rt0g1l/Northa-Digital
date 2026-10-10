"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const INTERACTIVO = "a, button, [role='button'], select, summary, label, [data-cursor='active']";
const TEXTO = "h1, h2, h3, p, figcaption, dd, dt, blockquote, [data-cursor='texto']";
const ESCRITURA =
  "input:not([type='checkbox']):not([type='radio']):not([type='submit']):not([type='button']), textarea, [contenteditable='true']";
const PARALAJE = 4; // px máximos que se mueve el elemento con el puntero
const MARGEN = 6; // px de resaltado alrededor del elemento
const PUNTERO = 18; // diámetro en reposo

/**
 * Puntero adaptable al estilo de iPadOS, solo con ratón:
 *  - en reposo es un círculo translúcido que sigue al ratón con una inercia
 *    mínima;
 *  - sobre un botón o un enlace se transforma en su resaltado: toma su
 *    tamaño y su radio, y el elemento se desplaza unos píxeles con el
 *    puntero (paralaje). Sobre un botón sólido el resaltado no se ve y el
 *    botón se eleva un poco;
 *  - sobre el texto se vuelve una barra de escritura del alto de la línea;
 *  - en los campos vuelve el cursor del sistema.
 * Un solo bucle que se detiene en reposo. Sin prefers-reduced-motion. Escribe
 * las propiedades `translate` y `scale`, que no chocan con transform; no
 * mueve elementos que ya usan `translate` para colocarse.
 */
export function Cursor() {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const halo = ref.current;
    if (!halo || reduced) return;
    if (!window.matchMedia("(pointer: fine) and (hover: hover)").matches) return;

    const raiz = document.documentElement;
    raiz.classList.add("cursor-propio");

    // Posición, tamaño y radio actuales y objetivo del puntero.
    const p = { x: 0, y: 0, w: PUNTERO, h: PUNTERO, r: PUNTERO / 2 };
    const o = { x: 0, y: 0, w: PUNTERO, h: PUNTERO, r: PUNTERO / 2 };
    let mx = 0;
    let my = 0;
    let iniciado = false;
    let rafId = null;
    let previo = 0;
    let modo = "libre"; // libre | resalte | elevar | texto | oculto
    // Elemento enganchado y su desplazamiento por paralaje.
    const el = { nodo: null, x: 0, y: 0, tx: 0, ty: 0, mueve: false, elevar: false, radio: 10 };

    const soltar = () => {
      if (!el.nodo) return;
      el.tx = 0;
      el.ty = 0;
    };
    const limpiarNodo = () => {
      if (!el.nodo) return;
      el.nodo.style.translate = "";
      el.nodo.style.scale = "";
      el.nodo = null;
      el.x = el.y = el.tx = el.ty = 0;
    };

    const esSolido = (nodo) => {
      const c = getComputedStyle(nodo).backgroundColor.match(/[\d.]+/g);
      if (!c) return false;
      const [r, g, b, a = 1] = c.map(Number);
      return a > 0.8 && (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
    };

    const enganchar = (nodo) => {
      if (el.nodo !== nodo) {
        limpiarNodo();
        el.nodo = nodo;
        const estilo = getComputedStyle(nodo);
        el.mueve = estilo.translate === "none";
        el.elevar = esSolido(nodo);
        el.radio = parseFloat(estilo.borderTopLeftRadius) || 10;
      }
    };

    // Decide la forma según lo que hay bajo el puntero.
    const objetivo = (target) => {
      if (target?.closest(ESCRITURA)) {
        modo = "oculto";
        soltar();
        return;
      }
      const inter = target?.closest(INTERACTIVO);
      if (inter) {
        const r = inter.getBoundingClientRect();
        // Solo se adapta a piezas del tamaño de un botón o un enlace.
        if (r.width <= 520 && r.height <= 96) {
          enganchar(inter);
          modo = el.elevar ? "elevar" : "resalte";
          return;
        }
      }
      soltar();
      const texto = !inter && target?.closest(TEXTO);
      if (texto) {
        const fs = parseFloat(getComputedStyle(texto).fontSize) || 16;
        modo = "texto";
        o.w = 2.5;
        o.h = Math.min(64, fs * 1.15);
        o.r = 1.5;
        return;
      }
      modo = "libre";
    };

    const loop = (t) => {
      const dt = previo ? Math.min(t - previo, 64) : 16.7;
      previo = t;
      const k = 1 - Math.pow(0.62, dt / 16.7); // puntero: casi inmediato
      const ks = 1 - Math.pow(0.78, dt / 16.7); // forma: un poco más suave
      const ke = 1 - Math.pow(0.82, dt / 16.7); // elemento: con inercia

      if (el.nodo && !el.nodo.isConnected) {
        // El elemento salió de la página (por ejemplo, al cerrar un panel).
        el.nodo = null;
        modo = "libre";
        halo.dataset.modo = modo;
      }
      if (el.nodo && (modo === "resalte" || modo === "elevar")) {
        // Centro del elemento sin su propio desplazamiento.
        const r = el.nodo.getBoundingClientRect();
        const cx = r.left + r.width / 2 - el.x;
        const cy = r.top + r.height / 2 - el.y;
        const dx = Math.max(-1, Math.min(1, (mx - cx) / (r.width / 2 + 20)));
        const dy = Math.max(-1, Math.min(1, (my - cy) / (r.height / 2 + 20)));
        el.tx = el.mueve ? dx * PARALAJE : 0;
        el.ty = el.mueve ? dy * PARALAJE : 0;
        o.x = cx + el.tx * 1.4;
        o.y = cy + el.ty * 1.4;
        o.w = r.width + MARGEN * 2;
        o.h = r.height + MARGEN * 2;
        o.r = Math.min(o.h / 2, el.radio + MARGEN);
      } else {
        o.x = mx;
        o.y = my;
        if (modo !== "texto") {
          o.w = PUNTERO;
          o.h = PUNTERO;
          o.r = PUNTERO / 2;
        }
      }

      p.x += (o.x - p.x) * k;
      p.y += (o.y - p.y) * k;
      p.w += (o.w - p.w) * ks;
      p.h += (o.h - p.h) * ks;
      p.r += (o.r - p.r) * ks;
      halo.style.translate = `${(p.x - p.w / 2).toFixed(1)}px ${(p.y - p.h / 2).toFixed(1)}px`;
      halo.style.width = `${p.w.toFixed(1)}px`;
      halo.style.height = `${p.h.toFixed(1)}px`;
      halo.style.borderRadius = `${p.r.toFixed(1)}px`;

      if (el.nodo) {
        el.x += (el.tx - el.x) * ke;
        el.y += (el.ty - el.y) * ke;
        if (el.mueve) el.nodo.style.translate = `${el.x.toFixed(2)}px ${el.y.toFixed(2)}px`;
        const quieto = Math.abs(el.tx - el.x) < 0.05 && Math.abs(el.ty - el.y) < 0.05;
        if (modo !== "resalte" && modo !== "elevar" && quieto) limpiarNodo();
      }

      const quieto =
        Math.abs(o.x - p.x) < 0.1 &&
        Math.abs(o.y - p.y) < 0.1 &&
        Math.abs(o.w - p.w) < 0.1 &&
        Math.abs(o.h - p.h) < 0.1 &&
        (!el.nodo || (Math.abs(el.tx - el.x) < 0.05 && Math.abs(el.ty - el.y) < 0.05));
      if (quieto) {
        rafId = null;
        previo = 0;
        return;
      }
      rafId = requestAnimationFrame(loop);
    };
    const despertar = () => {
      if (rafId == null) rafId = requestAnimationFrame(loop);
    };

    const pintarModo = () => {
      halo.dataset.modo = modo;
      if (el.nodo) el.nodo.style.scale = modo === "elevar" ? "1.035" : "";
    };

    const onMove = (e) => {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX;
      my = e.clientY;
      if (!iniciado) {
        p.x = o.x = mx;
        p.y = o.y = my;
        iniciado = true;
      }
      halo.classList.add("is-visible");
      objetivo(e.target instanceof Element ? e.target : null);
      pintarModo();
      despertar();
    };

    const onLeave = () => {
      halo.classList.remove("is-visible");
      soltar();
      modo = "libre";
      pintarModo();
      despertar();
    };
    const onEnter = () => iniciado && halo.classList.add("is-visible");
    // Con la rueda el puntero no se mueve, pero cambia lo que hay debajo.
    let pendiente = false;
    const onScroll = () => {
      if (!iniciado || pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        objetivo(document.elementFromPoint(mx, my));
        pintarModo();
        despertar();
      });
    };
    const onDown = (e) => {
      if (e.pointerType !== "mouse") return;
      halo.classList.add("is-pressed");
      if (el.nodo && modo === "elevar") el.nodo.style.scale = "0.98";
    };
    const onUp = () => {
      halo.classList.remove("is-pressed");
      pintarModo();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raiz.addEventListener("mouseleave", onLeave);
    raiz.addEventListener("mouseenter", onEnter);
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      raiz.classList.remove("cursor-propio");
      window.removeEventListener("pointermove", onMove);
      raiz.removeEventListener("mouseleave", onLeave);
      raiz.removeEventListener("mouseenter", onEnter);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", onScroll);
      limpiarNodo();
      halo.classList.remove("is-visible");
    };
  }, [reduced]);

  return <div ref={ref} aria-hidden="true" className="cursor-halo" />;
}

export default Cursor;
