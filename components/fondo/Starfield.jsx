"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Cielo de fondo en un canvas fijo, con tres capas de profundidad:
 *  - lejana: muchas estrellas diminutas; casi todas se pintan UNA vez en un
 *    canvas fuera de pantalla y solo un tercio parpadea;
 *  - media: pocas estrellas algo más brillantes, con halo y parpadeo lento;
 *  - cercana: unas cuantas motas desenfocadas que derivan muy despacio.
 *
 * Intensidad por sección: 100 % en el hero y el cierre, 40 % detrás del
 * contenido. Solo se anima mientras el hero o el cierre están en pantalla;
 * en el resto queda un cuadro fijo. 30 cuadros por segundo con acumulador,
 * DPR máximo 1,5, pausa con la pestaña oculta, y un cuadro estático con
 * prefers-reduced-motion o ahorro de datos. Si el equipo va justo, reduce
 * densidad y cuadros por segundo a la mitad.
 */

const ALTA = 1;
const BAJA = 0.4;
const SECCIONES_ALTAS = ["inicio", "empezar"];

const azar = (min, max) => min + Math.random() * (max - min);

function sprite(radio, color) {
  const lado = Math.ceil(radio * 2);
  const c = document.createElement("canvas");
  c.width = lado;
  c.height = lado;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(radio, radio, 0, radio, radio, radio);
  grad.addColorStop(0, `rgba(${color},1)`);
  grad.addColorStop(0.18, `rgba(${color},0.55)`);
  grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, lado, lado);
  return c;
}

export function Starfield() {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const ahorro = navigator.connection?.saveData === true;
    const animar = !reduced && !ahorro;
    const movil = () => window.matchMedia("(max-width: 768px)").matches;

    let frame = 1000 / 30;
    let factor = 1; // 1 o 0.5 si el equipo va justo
    let width = 0;
    let height = 0;
    let dpr = 1;
    let lejana = null; // canvas con la capa lejana estática
    let titilan = [];
    let medias = [];
    let cercanas = [];
    let intensidad = ALTA;
    let objetivo = ALTA;
    let rafId = null;
    let ultimo = 0;
    let previo = 0;
    const tiempos = [];

    const spriteMedia = sprite(6, "235,242,255");
    const spriteCercana = sprite(14, "127,211,255");

    const poblar = () => {
      const area = (width * height) / 1e6;
      const m = movil();
      const nLejanas = Math.round((m ? 90 : Math.min(320, Math.max(120, area * 170))) * factor);
      const nMedias = Math.round((m ? 12 : Math.min(40, Math.max(18, area * 23))) * factor);
      const nCercanas = m ? 4 : 8;

      // Capa lejana: dos tercios fijos en un canvas aparte; un tercio titila.
      lejana = document.createElement("canvas");
      lejana.width = Math.floor(width * dpr);
      lejana.height = Math.floor(height * dpr);
      const lg = lejana.getContext("2d");
      lg.setTransform(dpr, 0, 0, dpr, 0, 0);
      lg.fillStyle = "#eef2f8";
      titilan = [];
      for (let i = 0; i < nLejanas; i++) {
        const s = { x: azar(0, width), y: azar(0, height), r: azar(0.3, 0.6), a: azar(0.08, 0.28) };
        if (i % 3 === 0) {
          titilan.push({ ...s, fase: azar(0, Math.PI * 2), vel: (Math.PI * 2) / azar(6000, 12000) });
        } else {
          lg.globalAlpha = s.a;
          lg.beginPath();
          lg.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          lg.fill();
        }
      }
      medias = Array.from({ length: nMedias }, () => ({
        x: azar(0, width),
        y: azar(0, height),
        tam: azar(7, 11),
        a: azar(0.45, 0.7),
        fase: azar(0, Math.PI * 2),
        vel: (Math.PI * 2) / azar(4000, 8000),
        vy: azar(0.15, 0.3), // px por segundo
      }));
      cercanas = Array.from({ length: nCercanas }, () => ({
        x: azar(0, width),
        y: azar(0, height),
        tam: azar(16, 28),
        a: azar(0.06, 0.16),
        vx: azar(-0.25, 0.25),
        vy: -azar(0.4, 0.8),
      }));
    };

    const dibujar = (t) => {
      if (!width || !height) return; // ventana sin tamaño (iframe oculto)
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = intensidad;
      ctx.drawImage(lejana, 0, 0, width, height);

      ctx.fillStyle = "#eef2f8";
      for (const s of titilan) {
        const brillo = animar ? 0.55 + 0.45 * Math.sin(t * s.vel + s.fase) : 1;
        ctx.globalAlpha = s.a * brillo * intensidad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const s of medias) {
        const brillo = animar ? 0.6 + 0.4 * Math.sin(t * s.vel + s.fase) : 1;
        ctx.globalAlpha = s.a * brillo * intensidad;
        ctx.drawImage(spriteMedia, s.x - s.tam / 2, s.y - s.tam / 2, s.tam, s.tam);
      }
      for (const s of cercanas) {
        ctx.globalAlpha = s.a * intensidad;
        ctx.drawImage(spriteCercana, s.x - s.tam / 2, s.y - s.tam / 2, s.tam, s.tam);
      }
      ctx.globalAlpha = 1;
    };

    const mover = (dt) => {
      const seg = dt / 1000;
      for (const s of medias) {
        s.y -= s.vy * seg;
        if (s.y < -8) {
          s.y = height + 8;
          s.x = azar(0, width);
        }
      }
      for (const s of cercanas) {
        s.x += s.vx * seg;
        s.y += s.vy * seg;
        if (s.y < -20) {
          s.y = height + 20;
          s.x = azar(0, width);
        }
        if (s.x < -20) s.x = width + 20;
        else if (s.x > width + 20) s.x = -20;
      }
      // Transición de intensidad suave (~0,8 s).
      intensidad += (objetivo - intensidad) * (1 - Math.exp(-seg / 0.25));
    };

    const vigilarPresupuesto = (inicio) => {
      if (factor < 1 || tiempos.length >= 60) return;
      tiempos.push(performance.now() - inicio);
      if (tiempos.length === 60) {
        const p95 = [...tiempos].sort((a, b) => a - b)[56];
        if (p95 > 4) {
          factor = 0.5;
          frame = 1000 / 20;
          poblar();
        }
      }
    };

    const tick = (t) => {
      rafId = requestAnimationFrame(tick);
      if (ultimo && t - ultimo < frame - 2) return;
      const dt = previo ? Math.min(t - previo, 100) : frame;
      previo = t;
      // Avanza en pasos exactos de `frame`: 30 cps reales a 60, 90, 120 o 144 Hz.
      ultimo = ultimo ? Math.max(ultimo + frame, t - frame) : t;
      const inicio = performance.now();
      mover(dt);
      dibujar(t);
      vigilarPresupuesto(inicio);
      // Fuera de hero y cierre, al terminar la transición queda un cuadro fijo.
      if (objetivo === BAJA && Math.abs(intensidad - BAJA) < 0.005) {
        intensidad = BAJA;
        dibujar(t);
        detener();
      }
    };

    const arrancar = () => {
      if (!animar || rafId != null || document.hidden) return;
      ultimo = 0;
      previo = 0;
      rafId = requestAnimationFrame(tick);
    };
    function detener() {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    const fijarObjetivo = (nuevo) => {
      objetivo = nuevo;
      if (animar) arrancar();
      else {
        intensidad = nuevo;
        dibujar(0);
      }
    };

    const medir = (repoblar) => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (repoblar || !lejana) poblar();
      dibujar(performance.now());
    };

    // En móvil la barra del navegador cambia el alto al hacer scroll: solo se
    // regenera el cielo si el cambio es grande.
    let ultimoAncho = window.innerWidth;
    let ultimoAlto = window.innerHeight;
    let timer = null;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const repoblar = w !== ultimoAncho || Math.abs(h - ultimoAlto) > 160;
        ultimoAncho = w;
        ultimoAlto = h;
        medir(repoblar);
      }, 150);
    };

    medir(true);

    // Intensidad según las secciones visibles.
    const altas = SECCIONES_ALTAS.map((id) => document.getElementById(id)).filter(Boolean);
    const visibles = new Set();
    let io = null;
    if (altas.length) {
      // Cuenta como visible si se ve al menos un 15 % bajo la barra fija; un
      // borde que asoma tras ella no enciende el cielo.
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting && e.intersectionRatio >= 0.15) visibles.add(e.target.id);
            else visibles.delete(e.target.id);
          }
          fijarObjetivo(visibles.size ? ALTA : BAJA);
        },
        { rootMargin: "-96px 0px 0px 0px", threshold: [0, 0.15, 0.3] },
      );
      altas.forEach((el) => io.observe(el));
    } else {
      fijarObjetivo(ALTA); // páginas sin hero (404): cielo completo
    }

    const onVisibility = () => {
      if (document.hidden) detener();
      else if (objetivo === ALTA || Math.abs(intensidad - objetivo) > 0.005) arrancar();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      detener();
      clearTimeout(timer);
      io?.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} aria-hidden="true" className="starfield pointer-events-none fixed inset-0 z-0" />;
}

export default Starfield;
