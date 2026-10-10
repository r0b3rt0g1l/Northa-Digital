"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { alCambiarMovimiento, movimientoPausado } from "@/lib/movimiento";

/**
 * Fondo espacial en vivo, en un único canvas 2D:
 *
 *  - Tres capas de estrellas con profundidad (lejana, media y cercana). Cada
 *    una se pinta UNA vez en un mosaico que se repite sin costuras y deriva
 *    despacio, cada capa a su ritmo: el espacio nunca está quieto.
 *  - Las estrellas son puntos nítidos con un halo corto, de tamaños, brillos
 *    y colores suaves distintos (blanco, azul claro, amarillo pálido). Nunca
 *    círculos grandes: solo las más brillantes llevan un destello fino.
 *  - Un grupo de estrellas centellea cada una a su propio ritmo (tres ondas
 *    de periodos distintos), y las brillantes cambian de tono un instante.
 *  - Estrellas fugaces cada pocos segundos: aparecen de repente, cruzan con
 *    una estela que se afina hacia atrás y se apagan con suavidad.
 *  - Una franja muy tenue de Vía Láctea da profundidad.
 *  - Al hacer scroll, las capas se desplazan en vertical a distinto ritmo
 *    (paralaje), con un leve retardo para que nunca sea brusco; con el ratón,
 *    un paralaje mínimo.
 *
 * Intensidad: 100 % en el hero y la escena final, 85 % detrás del contenido.
 * 30 cuadros por segundo, pausa con la pestaña oculta, DPR máximo 1,5. Si los
 * cuadros llegan tarde de forma sostenida, baja a 20 cuadros por segundo y
 * centellean la mitad de las estrellas; el cielo no cambia de sitio y el
 * movimiento sigue. Las posiciones salen de un generador con semilla: al girar
 * el teléfono o cambiar el ancho, las estrellas conservan su sitio. El lienzo
 * mide el alto grande de la pantalla (lvh), así que la barra del navegador
 * del celular no lo mueve. Con prefers-reduced-motion o ahorro de datos: un
 * cuadro fijo, sin deriva, paralaje, centelleo ni fugaces. Con «Pausar
 * animaciones» (pie de página) se queda quieto en el cuadro actual.
 */

const ALTA = 1;
const BAJA = 0.85;
const SECCIONES_ALTAS = ["inicio", "final"];
const TAU = Math.PI * 2;
const FPS = 30;
const DPR_MAX = 1.5;
// Dirección de la deriva: hacia la izquierda y un poco hacia arriba.
const DERIVA = { x: -0.96, y: -0.28 };

// Capas: tamaño del mosaico (px CSS), estrellas por megapíxel, tamaños del
// punto, brillo, velocidad de deriva (px/s), paralaje de scroll y de ratón.
const CAPAS = [
  { lado: 1024, densidad: 900, tam: [1.7, 3.3], alfa: [0.3, 0.78], vel: 2.4, scroll: 0.03, raton: 5 },
  { lado: 896, densidad: 270, tam: [2.6, 4.6], alfa: [0.5, 0.95], vel: 5.2, scroll: 0.07, raton: 11 },
  { lado: 1152, densidad: 48, tam: [3.8, 6.2], alfa: [0.72, 1], vel: 9, scroll: 0.12, raton: 18 },
];

// Colores suaves con su peso: blanco, azul claro y amarillo pálido.
const COLORES = [
  [0.52, "242,246,255"], // blanca
  [0.3, "196,218,255"], // azul claro
  [0.18, "255,240,206"], // amarillo pálido
];

// Generador con semilla (mulberry32): al volver a poblar el cielo, cada
// conjunto de estrellas sale igual y nada cambia de golpe.
function generador(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let aleatorio = Math.random;

const azar = (min, max) => min + aleatorio() * (max - min);
const modulo = (a, n) => ((a % n) + n) % n;

function colorAzar() {
  let r = aleatorio();
  for (let i = 0; i < COLORES.length; i++) {
    r -= COLORES[i][0];
    if (r <= 0) return i;
  }
  return 0;
}

// Normal estándar (Box-Muller) para repartir la Vía Láctea.
function gauss() {
  const u = 1 - aleatorio();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * aleatorio());
}

/**
 * Estrella como punto de luz: núcleo blanco muy pequeño y una caída corta
 * teñida de color. El sprite mide 16 px y se dibuja a 2-6 px: se ve como un
 * punto nítido, no como un círculo.
 */
function spritePunto(color) {
  const lado = 16;
  const r = lado / 2;
  const c = document.createElement("canvas");
  c.width = lado;
  c.height = lado;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.16, `rgba(${color},0.95)`);
  grad.addColorStop(0.34, `rgba(${color},0.32)`);
  grad.addColorStop(0.6, `rgba(${color},0.06)`);
  grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, lado, lado);
  return c;
}

/** Destello fino de difracción (cruz) para las estrellas más brillantes. */
function spritePuntas(color) {
  const lado = 64;
  const r = lado / 2;
  const c = document.createElement("canvas");
  c.width = lado;
  c.height = lado;
  const g = c.getContext("2d");
  const punta = (sx, sy) => {
    g.save();
    g.translate(r, r);
    g.scale(sx, sy);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.12, `rgba(${color},0.5)`);
    grad.addColorStop(0.45, `rgba(${color},0.12)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grad;
    g.fillRect(-r, -r, lado, lado);
    g.restore();
  };
  punta(1, 0.03);
  punta(0.03, 1);
  return c;
}

/** Parámetros de centelleo: tres ondas de periodos distintos. */
function centelleo(min, max) {
  return {
    f1: TAU / azar(2400, 6200),
    f2: TAU / azar(1100, 2500),
    f3: TAU / azar(380, 820),
    p1: azar(0, TAU),
    p2: azar(0, TAU),
    p3: azar(0, TAU),
    amp: azar(min, max),
  };
}

export function Starfield() {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const ahorro = navigator.connection?.saveData === true;
    // Con movimiento reducido o ahorro de datos: un cuadro fijo.
    const animar = !reduced && !ahorro;
    const movil = () => window.matchMedia("(max-width: 768px)").matches;
    const ratonFino = window.matchMedia("(pointer: fine)").matches;

    let vivo = true;
    let frame = 1000 / FPS;
    let factor = 1; // 1 o 0.5 si el equipo va justo: centellea la mitad
    let pausaUsuario = movimientoPausado();
    const semilla = (Math.random() * 2 ** 32) >>> 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    // Campo donde se repiten las estrellas que centellean y las brillantes. Se
    // fija al poblar: si solo cambia un poco el alto, nada se recoloca.
    let campo = { w: 0, h: 0, w2: 0, h2: 0 };
    let mosaicos = []; // un canvas por capa
    let via = null; // Vía Láctea, del tamaño de la ventana más un margen
    let viaMargen = 0;
    let titilan = [];
    let brillantes = [];
    let fugaces = [];
    let proximaFugaz = 0;
    let recorrido = 0; // px de deriva acumulados (capa de referencia)
    let scrollSuave = window.scrollY;
    // Scroll hecho mientras el cielo estaba detenido (pausa, pestaña oculta):
    // no se recupera de golpe al volver, las capas siguen desde donde estaban.
    let desfase = 0;
    let mouse = { x: 0, y: 0 };
    let mouseObjetivo = { x: 0, y: 0 };
    let zonas = [];
    let intensidad = ALTA;
    let objetivo = ALTA;
    let rafId = null;
    let timerCuadro = null;
    let ultimo = 0;
    let previo = 0;
    const tiempos = [];

    const puntos = COLORES.map(([, c]) => spritePunto(c));
    const puntas = COLORES.map(([, c]) => spritePuntas(c));

    // 1 en reposo; baja hasta 1 - amp sin repetirse. Sin animación, el promedio.
    const brillo = (s, t) => {
      if (!animar) return 1 - s.amp * 0.5;
      return (
        1 -
        s.amp *
          (0.5 +
            0.5 *
              (0.55 * Math.sin(t * s.f1 + s.p1) + 0.3 * Math.sin(t * s.f2 + s.p2) + 0.15 * Math.sin(t * s.f3 + s.p3)))
      );
    };

    const medirZonas = () => {
      const scroll = window.scrollY;
      zonas = Array.from(document.querySelectorAll("[data-cielo-claro]"), (el) => {
        const r = el.getBoundingClientRect();
        return { x0: r.left, x1: r.right, y0: r.top + scroll, y1: r.bottom + scroll };
      });
    };

    // 1 lejos de los textos del hero; baja a 0,3 detrás de ellos, con 80 px
    // de transición. Solo afecta a destellos y fugaces.
    const atenuacion = (x, y, scroll) => {
      let f = 1;
      for (const z of zonas) {
        const dx = Math.max(z.x0 - x, 0, x - z.x1);
        const dy = Math.max(z.y0 - scroll - y, 0, y - (z.y1 - scroll));
        const d = Math.hypot(dx, dy);
        if (d < 80) f = Math.min(f, 0.3 + 0.7 * (d / 80));
      }
      return f;
    };

    /** Mosaico de una capa: estrellas fijas que se repiten sin costuras. */
    const pintarMosaico = (capa, m) => {
      const lado = m ? Math.round(capa.lado * 0.75) : capa.lado;
      const escala = dpr;
      const c = document.createElement("canvas");
      c.width = Math.round(lado * escala);
      c.height = Math.round(lado * escala);
      const g = c.getContext("2d");
      g.setTransform(escala, 0, 0, escala, 0, 0);
      // En móvil, algo más densas: en una pantalla pequeña el cielo se ve vacío.
      const n = Math.round(((lado * lado) / 1e6) * capa.densidad * (m ? 1.2 : 1));
      for (let i = 0; i < n; i++) {
        const x = aleatorio() * lado;
        const y = aleatorio() * lado;
        // Ley de potencia: la mayoría pequeñas y tenues, pocas brillantes.
        const b = Math.pow(aleatorio(), 2.2);
        const tam = capa.tam[0] + (capa.tam[1] - capa.tam[0]) * b;
        const c0 = colorAzar();
        g.globalAlpha = capa.alfa[0] + (capa.alfa[1] - capa.alfa[0]) * b;
        // Se repite en los bordes para que el mosaico case sin cortes.
        for (const ox of [-lado, 0, lado]) {
          for (const oy of [-lado, 0, lado]) {
            const px = x + ox;
            const py = y + oy;
            if (px < -tam || py < -tam || px > lado + tam || py > lado + tam) continue;
            g.drawImage(puntos[c0], px - tam / 2, py - tam / 2, tam, tam);
          }
        }
      }
      g.globalAlpha = 1;
      return { canvas: c, lado };
    };

    /** Vía Láctea: nubes muy tenues en una franja diagonal, con grietas. */
    const pintarVia = (m) => {
      viaMargen = Math.round(height * 0.25);
      const w = width;
      const h = height + viaMargen * 2;
      const c = document.createElement("canvas");
      // A la resolución del lienzo: en cada cuadro se copia 1:1, sin remuestrear.
      const escala = dpr;
      c.width = Math.round(w * escala);
      c.height = Math.round(h * escala);
      const g = c.getContext("2d");
      g.setTransform(escala, 0, 0, escala, 0, 0);
      const ang = -Math.atan2(h, w) * 0.65;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const nx = -dy;
      const ny = dx;
      const cx = w * 0.42;
      const cy = h * 0.5;
      const sigma = Math.min(w, h) * (m ? 0.2 : 0.15);
      const largo = Math.hypot(w, h) * 1.1;
      for (let i = 0; i < (m ? 14 : 22); i++) {
        const t = azar(-largo / 2, largo / 2);
        const o = gauss() * sigma * 0.35;
        const x = cx + dx * t + nx * o;
        const y = cy + dy * t + ny * o;
        const rad = sigma * azar(1.1, 2.1);
        const tono = aleatorio() < 0.6 ? "196,208,232" : "232,222,206";
        const grad = g.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, `rgba(${tono},${azar(0.02, 0.036).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${tono},0)`);
        g.fillStyle = grad;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      g.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 4; i++) {
        const t = azar(-largo / 3, largo / 3);
        const o = azar(-0.25, 0.25) * sigma;
        const rad = sigma * azar(1.6, 2.8);
        g.save();
        g.translate(cx + dx * t + nx * o, cy + dy * t + ny * o);
        g.rotate(ang + azar(-0.12, 0.12));
        g.scale(1, azar(0.08, 0.16));
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, rad);
        grad.addColorStop(0, "rgba(0,0,0,0.55)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.fillRect(-rad, -rad, rad * 2, rad * 2);
        g.restore();
      }
      g.globalCompositeOperation = "source-over";
      // Polvo de estrellas a lo largo de la franja.
      for (let i = 0; i < (m ? 260 : 520); i++) {
        const t = azar(-largo / 2, largo / 2);
        const o = gauss() * sigma * 0.55;
        const x = cx + dx * t + nx * o;
        const y = cy + dy * t + ny * o;
        if (x < 0 || y < 0 || x > w || y > h) continue;
        const s = azar(0.7, 1.3);
        g.globalAlpha = azar(0.08, 0.26);
        g.fillStyle = `rgb(${COLORES[colorAzar()][1]})`;
        g.fillRect(x, y, s, s);
      }
      g.globalAlpha = 1;
      via = c;
    };

    const poblar = () => {
      const m = movil();
      medirZonas();
      // Cada conjunto con su propia semilla: el mismo cielo en cada repoblado.
      mosaicos = CAPAS.map((capa, i) => {
        aleatorio = generador(semilla + 11 * (i + 1));
        return pintarMosaico(capa, m);
      });
      aleatorio = generador(semilla + 97);
      pintarVia(m);
      campo = { w: width + 40, h: height + 180, w2: width + 80, h2: height + 220 };
      const area = (width * height) / 1e6;
      // Estrellas que centellean: viven en el campo y derivan con la capa media.
      const nTitilan = Math.round(m ? 105 : Math.min(240, Math.max(130, area * 130)));
      aleatorio = generador(semilla + 211);
      titilan = Array.from({ length: nTitilan }, () => {
        const b = Math.pow(aleatorio(), 1.8);
        return {
          x: aleatorio(),
          y: aleatorio(),
          c: colorAzar(),
          a: 0.45 + 0.5 * b,
          tam: 2.8 + 3 * b,
          ...centelleo(0.3, 0.75),
        };
      });
      // Brillantes: pocas, separadas, con destello fino; derivan con la cercana.
      const nBrillantes = m ? 5 : Math.min(9, Math.max(5, Math.round(area * 5)));
      aleatorio = generador(semilla + 307);
      brillantes = [];
      for (let intento = 0; brillantes.length < nBrillantes && intento < 200; intento++) {
        const x = aleatorio();
        const y = aleatorio();
        if (brillantes.some((b) => Math.hypot((b.x - x) * width, (b.y - y) * height) < (m ? 120 : 200))) continue;
        const c = aleatorio() < 0.45 ? 1 : aleatorio() < 0.5 ? 0 : 2;
        brillantes.push({
          x,
          y,
          c,
          tinte: c === 1 ? 2 : 1, // tono al que vira un instante
          a: azar(0.8, 1),
          tam: azar(5.5, 7.5),
          halo: azar(13, 18),
          largo: m ? azar(18, 26) : azar(22, 34),
          fc: TAU / azar(900, 1700),
          pc: azar(0, TAU),
          ...centelleo(0.15, 0.32),
        });
      }
      aleatorio = Math.random; // las fugaces, al azar de verdad
    };

    /** Una estrella fugaz: aparece, cruza en diagonal y se apaga. */
    const lanzarFugaz = (t) => {
      const m = movil();
      const sentido = aleatorio() < 0.5 ? 1 : -1;
      const ang = azar(0.22, 0.62); // bajo la horizontal
      const vel = azar(m ? 620 : 760, m ? 980 : 1300); // px/s
      fugaces.push({
        x: sentido > 0 ? azar(-0.05, 0.6) * width : azar(0.4, 1.05) * width,
        y: azar(-0.05, 0.55) * height,
        vx: Math.cos(ang) * vel * sentido,
        vy: Math.sin(ang) * vel,
        inicio: t,
        vida: azar(700, 1250),
        cola: azar(m ? 90 : 130, m ? 170 : 260),
        grosor: azar(1.4, 2.2),
        c: aleatorio() < 0.6 ? 0 : 1,
      });
      proximaFugaz = t + azar(m ? 1800 : 1200, m ? 4200 : 3300);
    };

    const dibujarFugaces = (t, scroll) => {
      if (!fugaces.length) return;
      fugaces = fugaces.filter((f) => t - f.inicio < f.vida);
      for (const f of fugaces) {
        const e = t - f.inicio;
        const p = e / f.vida;
        const hx = f.x + (f.vx * e) / 1000;
        const hy = f.y + (f.vy * e) / 1000;
        const v = Math.hypot(f.vx, f.vy);
        const ux = f.vx / v;
        const uy = f.vy / v;
        // La estela crece al aparecer y se acorta al apagarse.
        const cola = f.cola * Math.min(1, e / 180) * (p > 0.7 ? 1 - (p - 0.7) / 0.6 : 1);
        const tx = hx - ux * cola;
        const ty = hy - uy * cola;
        // Entra rápido y se desvanece despacio.
        const env = p < 0.12 ? p / 0.12 : Math.pow(1 - (p - 0.12) / 0.88, 1.4);
        const a = env * intensidad * atenuacion(hx, hy, scroll);
        if (a <= 0.01) continue;
        const color = COLORES[f.c][1];
        const grad = ctx.createLinearGradient(hx, hy, tx, ty);
        grad.addColorStop(0, `rgba(255,255,255,${(0.95 * a).toFixed(3)})`);
        grad.addColorStop(0.15, `rgba(${color},${(0.6 * a).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${color},0)`);
        // Estela en cuña: ancha en la cabeza, fina en la cola.
        const w = f.grosor / 2;
        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(hx - uy * w, hy + ux * w);
        ctx.lineTo(tx, ty);
        ctx.lineTo(hx + uy * w, hy - ux * w);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = a;
        ctx.drawImage(puntos[f.c], hx - 4, hy - 4, 8, 8);
      }
      ctx.globalAlpha = 1;
    };

    const dibujar = (t) => {
      if (!width || !height) return; // ventana sin tamaño (iframe oculto)
      ctx.clearRect(0, 0, width, height);
      const scroll = window.scrollY;
      // En el cuadro fijo (movimiento reducido) el scroll no mueve nada.
      const sv = animar ? scrollSuave - desfase : 0;
      // Al píxel de dispositivo: copia 1:1, sin remuestrear (la mitad de costo).
      const px = (v) => Math.round(v * dpr) / dpr;

      // Vía Láctea: paralaje mínimo y acotado.
      ctx.globalAlpha = intensidad;
      const vy = px(-viaMargen - Math.min(Math.max(sv * 0.012, 0), viaMargen));
      ctx.drawImage(via, 0, vy, width, height + viaMargen * 2);

      // Capas de estrellas: deriva + paralaje de scroll + ratón, en mosaico.
      CAPAS.forEach((capa, i) => {
        const { canvas: c, lado } = mosaicos[i];
        const avance = recorrido * (capa.vel / CAPAS[1].vel);
        const ox = modulo(DERIVA.x * avance + mouse.x * capa.raton, lado);
        const oy = modulo(DERIVA.y * avance - sv * capa.scroll + mouse.y * capa.raton, lado);
        for (let x = ox - lado; x < width; x += lado) {
          if (x + lado <= 0) continue;
          for (let y = oy - lado; y < height; y += lado) {
            if (y + lado <= 0) continue;
            ctx.drawImage(c, px(x), px(y), lado, lado);
          }
        }
      });

      // Estrellas que centellean (capa media). Si el equipo va justo, la mitad.
      const { w: W, h: H, w2: W2, h2: H2 } = campo;
      const avM = recorrido;
      const mx = DERIVA.x * avM + mouse.x * CAPAS[1].raton;
      const my = DERIVA.y * avM - sv * CAPAS[1].scroll + mouse.y * CAPAS[1].raton;
      for (let i = 0; i < titilan.length; i += factor < 1 ? 2 : 1) {
        const s = titilan[i];
        const x = modulo(s.x * W + mx, W) - 20;
        const y = modulo(s.y * H + my, H) - 90;
        ctx.globalAlpha = s.a * brillo(s, t) * intensidad;
        ctx.drawImage(puntos[s.c], x - s.tam / 2, y - s.tam / 2, s.tam, s.tam);
      }

      // Brillantes (capa cercana): punto, halo corto y destello fino.
      const avC = recorrido * (CAPAS[2].vel / CAPAS[1].vel);
      const cx = DERIVA.x * avC + mouse.x * CAPAS[2].raton;
      const cy = DERIVA.y * avC - sv * CAPAS[2].scroll + mouse.y * CAPAS[2].raton;
      for (const s of brillantes) {
        const x = modulo(s.x * W2 + cx, W2) - 40;
        const y = modulo(s.y * H2 + cy, H2) - 110;
        const b = brillo(s, t);
        const k = s.a * intensidad * atenuacion(x, y, scroll);
        ctx.globalAlpha = k * 0.22 * b;
        ctx.drawImage(puntos[s.c], x - s.halo / 2, y - s.halo / 2, s.halo, s.halo);
        const largo = s.largo * (0.8 + 0.2 * b);
        ctx.globalAlpha = k * (0.3 + 0.45 * b);
        ctx.drawImage(puntas[s.c], x - largo / 2, y - largo / 2, largo, largo);
        ctx.globalAlpha = k * (0.75 + 0.25 * b);
        ctx.drawImage(puntos[s.c], x - s.tam / 2, y - s.tam / 2, s.tam, s.tam);
        if (animar) {
          const tinte = Math.sin(t * s.fc + s.pc);
          if (tinte > 0.5) {
            ctx.globalAlpha = k * 0.5 * (tinte - 0.5);
            ctx.drawImage(puntos[s.tinte], x - s.tam / 2, y - s.tam / 2, s.tam, s.tam);
          }
        }
      }
      ctx.globalAlpha = 1;
      if (animar) dibujarFugaces(t, scroll);
    };

    const mover = (dt, t) => {
      const seg = dt / 1000;
      recorrido += CAPAS[1].vel * seg;
      // El paralaje sigue al scroll con un leve retardo (~0,2 s): nunca brusco.
      scrollSuave += (window.scrollY - scrollSuave) * (1 - Math.exp(-seg / 0.2));
      const km = 1 - Math.exp(-seg / 0.6);
      mouse.x += (mouseObjetivo.x - mouse.x) * km;
      mouse.y += (mouseObjetivo.y - mouse.y) * km;
      intensidad += (objetivo - intensidad) * (1 - Math.exp(-seg / 0.25));
      if (!proximaFugaz) proximaFugaz = t + 700;
      else if (t >= proximaFugaz) lanzarFugaz(t);
    };

    // Vigila el ritmo real entre cuadros, que incluye el rasterizado del
    // navegador. Se ignoran los primeros segundos (carga de la página) y los
    // saltos sueltos (pestaña en segundo plano, una tarea larga): solo si la
    // mayoría de los cuadros llega tarde de forma sostenida, baja el ritmo y
    // centellea la mitad de las estrellas. El cielo no se vuelve a poblar:
    // nada cambia de sitio.
    let calentamiento = 90;
    const vigilarPresupuesto = (intervalo) => {
      if (factor < 1 || tiempos.length >= 90 || !(intervalo > 0) || intervalo > 250) return;
      if (calentamiento > 0) {
        calentamiento--;
        return;
      }
      tiempos.push(intervalo);
      if (tiempos.length === 90) {
        const p75 = [...tiempos].sort((a, b) => a - b)[67];
        if (p75 > frame * 1.5) {
          factor = 0.5;
          frame = 1000 / 20;
        }
      }
    };

    // Con ritmos bajos se espera con un temporizador en lugar de despertar en
    // cada refresco de pantalla: menos trabajo para el navegador.
    const programar = () => {
      if (!vivo || document.hidden) return;
      if (frame > 45) {
        timerCuadro = setTimeout(() => {
          timerCuadro = null;
          rafId = requestAnimationFrame(tick);
        }, frame - 12);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    function tick(t) {
      rafId = null;
      if (ultimo && t - ultimo < frame - 2) {
        programar();
        return;
      }
      const intervalo = previo ? t - previo : 0;
      const dt = previo ? Math.min(intervalo, 150) : frame;
      previo = t;
      // Avanza en pasos exactos de `frame`: el mismo ritmo a 60, 90, 120 o 144 Hz.
      ultimo = ultimo ? Math.max(ultimo + frame, t - frame) : t;
      mover(dt, t);
      dibujar(t);
      vigilarPresupuesto(intervalo);
      programar();
    }

    const arrancar = () => {
      if (!animar || pausaUsuario || rafId != null || timerCuadro != null || document.hidden) return;
      ultimo = 0;
      previo = 0;
      desfase += window.scrollY - scrollSuave;
      scrollSuave = window.scrollY;
      rafId = requestAnimationFrame(tick);
    };
    function detener() {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (timerCuadro != null) {
        clearTimeout(timerCuadro);
        timerCuadro = null;
      }
    }

    const fijarObjetivo = (nuevo) => {
      objetivo = nuevo;
      if (animar && !pausaUsuario) arrancar();
      else {
        intensidad = nuevo;
        dibujar(animar ? performance.now() : 0);
      }
    };

    // El tamaño lo da el CSS: todo el ancho y el alto grande de la pantalla
    // (100lvh), que no cambia cuando la barra del navegador aparece o se va.
    const caja = () => [canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight];
    const medir = (repoblar) => {
      [width, height] = caja();
      dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (repoblar || !mosaicos.length) {
        poblar();
        ultimoAncho = width;
        ultimoAlto = height;
      }
      dibujar(performance.now());
    };

    // Si el lienzo no cambió de tamaño (barra del navegador), no se toca. Con
    // un cambio de ancho o de alto grande se vuelve a poblar con la misma
    // semilla: las estrellas conservan su sitio.
    let ultimoAncho = 0;
    let ultimoAlto = 0;
    let timer = null;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const [w, h] = caja();
        const dprNuevo = Math.min(window.devicePixelRatio || 1, DPR_MAX);
        if (w === width && h === height && dprNuevo === dpr) return;
        const repoblar = w !== ultimoAncho || Math.abs(h - ultimoAlto) > 160 || dprNuevo !== dpr;
        medir(repoblar);
      }, 150);
    };
    // Ratón: las capas se desplazan apenas hacia el lado contrario.
    const onPointer = (e) => {
      if (e.pointerType !== "mouse" || !width) return;
      mouseObjetivo = { x: -((e.clientX / width) * 2 - 1), y: -((e.clientY / height) * 2 - 1) };
    };

    medir(true);

    // Con las fuentes cargadas el hero puede cambiar de alto: se vuelven a
    // medir los textos que atenúan los destellos.
    document.fonts?.ready.then(() => {
      if (!vivo) return;
      medirZonas();
      dibujar(performance.now());
    });

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
      else arrancar();
    };
    // «Pausar animaciones»: se queda quieto en el cuadro actual.
    const quitarMovimiento = alCambiarMovimiento(() => {
      pausaUsuario = movimientoPausado();
      if (pausaUsuario) detener();
      else arrancar();
    });
    window.addEventListener("resize", onResize);
    if (animar && ratonFino) window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      vivo = false;
      detener();
      clearTimeout(timer);
      io?.disconnect();
      quitarMovimiento();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} aria-hidden="true" className="starfield pointer-events-none fixed left-0 top-0 z-0 h-lvh w-full" />;
}

export default Starfield;
