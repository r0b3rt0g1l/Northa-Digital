"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Cielo de fondo vivo y realista:
 *  - todo el cielo gira alrededor de la señal del hero, la estrella polar de
 *    Northa, en sentido antihorario como el cielo del norte. Cada estrella
 *    deja una estela en arco, como en una foto de larga exposición: las
 *    estelas siempre están a la vista y giran con su estrella;
 *  - dos capas con profundidad: la lejana (polvo, Vía Láctea y estrellas
 *    fijas) y la media (las que centellean y las brillantes), que gira un
 *    poco más rápido. Al hacer scroll el cielo acelera su giro, y con el
 *    ratón las capas se desplazan a distinto ritmo (paralaje);
 *  - centelleo individual con tres ondas de periodos distintos, destellos de
 *    difracción en las brillantes y estrellas fugaces cada pocos segundos.
 *
 * Lo fijo de cada capa (estrellas y estelas) se pinta UNA vez en un canvas
 * fuera de pantalla centrado en el polo y se copia girado en cada cuadro; lo
 * que centellea y las fugaces se pintan encima. Un único canvas 2D: funciona
 * igual en Chrome, Edge, Firefox y Safari, en Windows, macOS, Android e iOS.
 *
 * Intensidad: 100 % en el hero y la escena final, 82 % detrás del contenido
 * (el cielo sigue visible en toda la página). 30 cuadros por segundo, pausa
 * con la pestaña oculta, DPR máximo 1,5. Si los cuadros llegan tarde de forma
 * sostenida, baja a DPR 1, menos estrellas y 20 cuadros por segundo; el
 * movimiento sigue. Con prefers-reduced-motion o ahorro de datos: un cuadro
 * fijo, con estrellas y estelas, sin giro, paralaje ni fugaces.
 */

const ALTA = 1;
const BAJA = 0.82;
const SECCIONES_ALTAS = ["inicio", "final"];
const TAU = Math.PI * 2;
const VUELTA = 15 * 60 * 1000; // ms por vuelta completa de la capa lejana
const OMEGA = TAU / VUELTA; // radianes por ms
// La capa media gira un poco más rápido que la lejana: profundidad.
const PARALAJE_MEDIO = 1.18;
// Al hacer scroll el cielo gira hacia adelante (en cualquier sentido de
// scroll, así las estelas siempre quedan detrás de su estrella).
const GIRO_SCROLL = 0.00011; // rad por px desplazado
// Paralaje con el ratón: px de desplazamiento máximo por capa.
const MOUSE_LEJANA = 8;
const MOUSE_MEDIA = 20;
// Largo angular de las estelas (la «exposición»): igual para todas, así cerca
// del polo son cortas y lejos son largas, como en una foto real.
const ESTELA = 0.12;
const ESTELA_MAX_PX = 240;
const FPS = 30;
const MARGEN = 200; // px de cielo de sobra alrededor de la ventana
const MAX_PIXELES = 8e6; // tope de cada capa fija en píxeles reales (~32 MB)

// Temperaturas de color con su peso aproximado en un cielo a simple vista.
const COLORES = [
  [0.24, "196,214,255"], // azulada
  [0.46, "238,242,255"], // blanca
  [0.2, "255,246,230"], // cálida
  [0.08, "255,228,196"], // amarillenta
  [0.02, "255,204,170"], // anaranjada
];
// Las brillantes tiran a azuladas y blancas, con alguna cálida.
const COLORES_BRILLANTES = [0, 0, 1, 1, 1, 2, 3];

const azar = (min, max) => min + Math.random() * (max - min);

function colorAzar() {
  let r = Math.random();
  for (let i = 0; i < COLORES.length; i++) {
    r -= COLORES[i][0];
    if (r <= 0) return i;
  }
  return 1;
}

// Normal estándar (Box-Muller) para repartir estrellas en la franja.
function gauss() {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random());
}

/** Punto de luz: núcleo blanco y caída casi gaussiana teñida de color. */
function spritePunto(color) {
  const lado = 32;
  const r = lado / 2;
  const c = document.createElement("canvas");
  c.width = lado;
  c.height = lado;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.1, `rgba(${color},0.97)`);
  grad.addColorStop(0.22, `rgba(${color},0.55)`);
  grad.addColorStop(0.4, `rgba(${color},0.18)`);
  grad.addColorStop(0.64, `rgba(${color},0.05)`);
  grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, lado, lado);
  return c;
}

/**
 * Destello de difracción: dos puntas finas en cruz. Cada una es un degradado
 * radial aplastado, así se afina y se apaga hacia el extremo como en una
 * foto real, sin bordes duros.
 */
function spritePuntas(color) {
  const lado = 128;
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
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.1, `rgba(${color},0.6)`);
    grad.addColorStop(0.38, `rgba(${color},0.18)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grad;
    g.fillRect(-r, -r, lado, lado);
    g.restore();
  };
  punta(1, 0.024);
  punta(0.024, 1);
  return c;
}

/** Parámetros de centelleo: tres ondas de periodos distintos. */
function centelleo(min, max) {
  return {
    f1: TAU / azar(2600, 6500),
    f2: TAU / azar(1200, 2600),
    f3: TAU / azar(420, 860),
    p1: azar(0, TAU),
    p2: azar(0, TAU),
    p3: azar(0, TAU),
    amp: azar(min, max),
  };
}

/**
 * Estela en arco alrededor del polo, detrás de la estrella (el cielo gira en
 * sentido antihorario, así que la estela queda en el ángulo mayor). Se apaga
 * hacia la cola en tramos cortos con transparencia decreciente.
 */
function trazarEstela(g, s, alfa, grosor, largo = ESTELA) {
  const r = Math.hypot(s.dx, s.dy);
  if (r < 36 || alfa <= 0) return;
  const inicio = Math.atan2(s.dy, s.dx);
  const arco = Math.min(largo, ESTELA_MAX_PX / r);
  const tramos = Math.max(6, Math.ceil((r * arco) / 5));
  g.lineWidth = grosor;
  g.lineCap = "butt";
  g.strokeStyle = `rgb(${COLORES[s.c][1]})`;
  for (let i = 0; i < tramos; i++) {
    const a0 = inicio + (arco * i) / tramos;
    const a1 = inicio + (arco * (i + 1)) / tramos;
    g.globalAlpha = alfa * Math.pow(1 - i / tramos, 1.5);
    g.beginPath();
    g.arc(0, 0, r, a0, a1 + 0.002);
    g.stroke();
  }
  g.globalAlpha = 1;
}

export function Starfield() {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const ahorro = navigator.connection?.saveData === true;
    // Con movimiento reducido o ahorro de datos: un cuadro fijo (con estelas).
    const animar = !reduced && !ahorro;
    const movil = () => window.matchMedia("(max-width: 768px)").matches;
    const ratonFino = window.matchMedia("(pointer: fine)").matches;

    let vivo = true;
    let frame = 1000 / FPS;
    let factor = 1; // 1 o 0.5 si el equipo va justo
    let dprMax = 1.5; // 1 si el equipo va justo
    let width = 0;
    let height = 0;
    let dpr = 1;
    let lejana = null; // canvas fuera de pantalla: capa lejana con sus estelas
    let media = null; // canvas fuera de pantalla: estelas de la capa media
    let polo = { x: 0, y: 0 };
    let radio = 0;
    let angulo = 0; // negativo: antihorario en pantalla
    let giroPendiente = 0; // giro extra por scroll, que se reparte suave
    let ultimoScroll = window.scrollY;
    let mouse = { x: 0, y: 0 }; // -1..1, suavizado
    let mouseObjetivo = { x: 0, y: 0 };
    let zonas = [];
    let titilan = [];
    let medias = [];
    let brillantes = [];
    let fugaces = [];
    let proximaFugaz = 0;
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

    // Centro de la señal en coordenadas del documento, sin transformaciones
    // de la animación de entrada ni del parallax.
    const medirPolo = () => {
      const senal = document.querySelector(".senal");
      if (!senal) return { x: width / 2, y: height * 0.32 }; // páginas sin hero
      let x = senal.offsetWidth / 2;
      let y = senal.offsetHeight / 2;
      for (let el = senal; el; el = el.offsetParent) {
        x += el.offsetLeft;
        y += el.offsetTop;
      }
      return { x, y };
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

    /** Canvas cuadrado de 2 × radio con el origen en el polo. */
    const capa = () => {
      const lado = radio * 2;
      const escala = Math.min(dpr, Math.sqrt(MAX_PIXELES) / lado);
      const c = document.createElement("canvas");
      c.width = Math.floor(lado * escala);
      c.height = Math.floor(lado * escala);
      const g = c.getContext("2d");
      g.setTransform(escala, 0, 0, escala, radio * escala, radio * escala);
      return [c, g];
    };

    const poblar = () => {
      const m = movil();
      polo = medirPolo();
      medirZonas();
      radio = Math.ceil(
        Math.max(
          Math.hypot(polo.x, polo.y),
          Math.hypot(width - polo.x, polo.y),
          Math.hypot(polo.x, height - polo.y),
          Math.hypot(width - polo.x, height - polo.y),
        ) + MARGEN,
      );

      // Las cantidades se piensan para lo que se ve en la ventana y se
      // reparten en todo el disco que gira.
      const area = (width * height) / 1e6;
      const disco = (Math.PI * radio * radio) / (width * height);
      const n = (base) => Math.round(base * factor * disco);
      const nPolvo = n(m ? 420 : Math.min(1400, Math.max(560, area * 640)));
      const nFijas = n(m ? 380 : Math.min(1000, Math.max(460, area * 460)));
      const nTitilan = n(m ? 80 : Math.min(200, Math.max(110, area * 100)));
      const nMedias = n(m ? 20 : Math.min(54, Math.max(28, area * 28)));
      const nBrillantes = Math.round((m ? 4 : 9) * disco);

      // Franja de Vía Láctea, en coordenadas relativas al polo.
      const ang = -Math.atan2(height, width) * 0.7;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const nx = -dy;
      const ny = dx;
      const cx = width * 0.08;
      const cy = height * 0.16;
      const sigma = Math.min(width, height) * (m ? 0.22 : 0.17);
      const largo = radio * 2.2;
      const dentro = (x, y) => x * x + y * y <= radio * radio;

      const enDisco = () => {
        const r = radio * Math.sqrt(Math.random());
        const a = azar(0, TAU);
        return [r * Math.cos(a), r * Math.sin(a)];
      };
      const enFranja = () => {
        for (let i = 0; i < 6; i++) {
          const t = azar(-largo / 2, largo / 2);
          const o = gauss() * sigma;
          const x = cx + dx * t + nx * o;
          const y = cy + dy * t + ny * o;
          if (dentro(x, y)) return [x, y];
        }
        return enDisco();
      };
      const posicion = (pFranja) => (Math.random() < pFranja ? enFranja() : enDisco());
      // Ley de potencia: la mayoría tenues, unas pocas brillantes.
      const estrella = (pFranja, bMin = 0) => {
        const [x, y] = posicion(pFranja);
        const b = bMin + (1 - bMin) * Math.pow(Math.random(), 2.4);
        return { dx: x, dy: y, c: colorAzar(), b, a: 0.24 + 0.76 * b, tam: 2.4 + 5.2 * b };
      };

      // ---------- Capa lejana ----------
      const [cl, lg] = capa();
      lejana = cl;

      // Resplandor difuso de la franja, frío con algo de cálido.
      for (let i = 0; i < Math.round((m ? 10 : 16) * Math.sqrt(disco)); i++) {
        const t = azar(-largo / 2, largo / 2);
        const o = gauss() * sigma * 0.35;
        const x = cx + dx * t + nx * o;
        const y = cy + dy * t + ny * o;
        const rad = sigma * azar(1.1, 2.1);
        const tono = Math.random() < 0.6 ? "196,208,232" : "232,222,206";
        const grad = lg.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, `rgba(${tono},${azar(0.022, 0.04).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${tono},0)`);
        lg.fillStyle = grad;
        lg.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      // Grietas de polvo: recortan el resplandor a lo largo de la franja.
      lg.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 4; i++) {
        const t = azar(-largo / 3, largo / 3);
        const o = azar(-0.25, 0.25) * sigma;
        const rad = sigma * azar(1.6, 2.8);
        lg.save();
        lg.translate(cx + dx * t + nx * o, cy + dy * t + ny * o);
        lg.rotate(ang + azar(-0.12, 0.12));
        lg.scale(1, azar(0.08, 0.16));
        const grad = lg.createRadialGradient(0, 0, 0, 0, 0, rad);
        grad.addColorStop(0, "rgba(0,0,0,0.55)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        lg.fillStyle = grad;
        lg.fillRect(-rad, -rad, rad * 2, rad * 2);
        lg.restore();
      }
      lg.globalCompositeOperation = "source-over";

      // Polvo de estrellas: puntos tenues que dan textura a la franja.
      for (let i = 0; i < nPolvo; i++) {
        const [x, y] = posicion(0.6);
        const t = azar(0.8, 1.4);
        lg.globalAlpha = azar(0.1, 0.3);
        lg.fillStyle = `rgb(${COLORES[colorAzar()][1]})`;
        lg.fillRect(x, y, t, t);
      }
      // Estrellas fijas, más densas dentro de la franja. Las más brillantes
      // dejan estela; primero las estelas, encima las estrellas.
      const fijas = Array.from({ length: nFijas }, () => estrella(0.38));
      for (const s of fijas) {
        if (s.b > 0.32) trazarEstela(lg, s, 0.1 + 0.32 * s.b, 0.7 + 0.55 * s.b);
      }
      for (const s of fijas) {
        lg.globalAlpha = s.a;
        lg.drawImage(puntos[s.c], s.dx - s.tam / 2, s.dy - s.tam / 2, s.tam, s.tam);
      }
      lg.globalAlpha = 1;

      // ---------- Capa media: estrellas que centellean y brillantes ----------
      titilan = Array.from({ length: nTitilan }, () => ({
        ...estrella(0.25, 0.1),
        ...centelleo(0.25, 0.6),
      }));
      medias = Array.from({ length: nMedias }, () => ({
        ...estrella(0.15, 0.36),
        ...centelleo(0.15, 0.35),
      }));

      // Brillantes separadas entre sí y, al empezar, lejos de los textos.
      brillantes = [];
      const distancia = m ? 120 : 170;
      for (let intento = 0; brillantes.length < nBrillantes && intento < nBrillantes * 12; intento++) {
        const [x, y] = enDisco();
        if (Math.hypot(x, y) < 90) continue; // la señal ya ocupa el polo
        if (atenuacion(polo.x + x, polo.y + y, 0) < 1) continue;
        if (brillantes.some((b) => Math.hypot(b.dx - x, b.dy - y) < distancia)) continue;
        const tam = azar(10, 14);
        const c = COLORES_BRILLANTES[Math.floor(Math.random() * COLORES_BRILLANTES.length)];
        brillantes.push({
          dx: x,
          dy: y,
          c,
          tinte: c === 0 ? 2 : 0, // color al que vira en el centelleo
          a: azar(0.8, 1),
          tam,
          halo: tam * azar(3, 3.8),
          largo: m ? azar(30, 50) : azar(40, 74),
          fc: TAU / azar(700, 1400),
          pc: azar(0, TAU),
          ...centelleo(0.12, 0.26),
        });
      }

      const [cm, mg] = capa();
      media = cm;
      for (const s of titilan) trazarEstela(mg, s, 0.14 + 0.36 * s.b, 0.8 + 0.6 * s.b);
      for (const s of medias) trazarEstela(mg, s, 0.24 + 0.32 * s.b, 1.1 + 0.6 * s.b);
      for (const s of brillantes) trazarEstela(mg, s, 0.42, 1.8, ESTELA * 1.2);
    };

    /** Una estrella fugaz: cruza en diagonal hacia abajo y se apaga. */
    const lanzarFugaz = (t) => {
      const m = movil();
      const sentido = Math.random() < 0.5 ? 1 : -1;
      const ang = azar(0.3, 0.75); // bajo la horizontal
      const vel = azar(m ? 620 : 820, m ? 980 : 1380); // px/s
      fugaces.push({
        x: sentido > 0 ? azar(-0.05, 0.62) * width : azar(0.38, 1.05) * width,
        y: azar(-0.04, 0.5) * height,
        vx: Math.cos(ang) * vel * sentido,
        vy: Math.sin(ang) * vel,
        inicio: t,
        vida: azar(620, 1150),
        cola: azar(m ? 90 : 140, m ? 170 : 290),
        c: COLORES_BRILLANTES[Math.floor(Math.random() * COLORES_BRILLANTES.length)],
      });
      proximaFugaz = t + azar(m ? 2000 : 1300, m ? 4800 : 3800);
    };

    const dibujarFugaces = (t, scroll) => {
      if (!fugaces.length) return;
      const grosor = movil() ? 1.4 : 1.8;
      ctx.lineCap = "round";
      fugaces = fugaces.filter((f) => t - f.inicio < f.vida);
      for (const f of fugaces) {
        const e = t - f.inicio;
        const p = e / f.vida;
        const hx = f.x + (f.vx * e) / 1000;
        const hy = f.y + (f.vy * e) / 1000;
        const v = Math.hypot(f.vx, f.vy);
        const cola = f.cola * Math.min(1, e / 220);
        const tx = hx - (f.vx / v) * cola;
        const ty = hy - (f.vy / v) * cola;
        const a = Math.pow(Math.sin(Math.PI * p), 0.7) * intensidad * atenuacion(hx, hy, scroll);
        if (a <= 0.01) continue;
        const color = COLORES[f.c][1];
        const grad = ctx.createLinearGradient(hx, hy, tx, ty);
        grad.addColorStop(0, `rgba(255,255,255,${(0.95 * a).toFixed(3)})`);
        grad.addColorStop(0.12, `rgba(${color},${(0.6 * a).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${color},0)`);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = grad;
        ctx.lineWidth = grosor;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.drawImage(puntos[f.c], hx - 6, hy - 6, 12, 12);
      }
      ctx.globalAlpha = 1;
    };

    const dibujar = (t) => {
      if (!width || !height) return; // ventana sin tamaño (iframe oculto)
      ctx.clearRect(0, 0, width, height);
      const scroll = window.scrollY;

      // Capa lejana.
      const lx = polo.x + mouse.x * MOUSE_LEJANA;
      const ly = polo.y + mouse.y * MOUSE_LEJANA;
      ctx.save();
      ctx.globalAlpha = intensidad;
      ctx.translate(lx, ly);
      ctx.rotate(angulo);
      ctx.drawImage(lejana, -radio, -radio, radio * 2, radio * 2);
      ctx.restore();

      // Capa media: estelas y, encima, sus estrellas.
      const am = angulo * PARALAJE_MEDIO;
      const mx = polo.x + mouse.x * MOUSE_MEDIA;
      const my = polo.y + mouse.y * MOUSE_MEDIA;
      ctx.save();
      ctx.globalAlpha = intensidad;
      ctx.translate(mx, my);
      ctx.rotate(am);
      ctx.drawImage(media, -radio, -radio, radio * 2, radio * 2);
      ctx.restore();

      const cos = Math.cos(am);
      const sin = Math.sin(am);
      const punto = (s, borde) => {
        const x = mx + s.dx * cos - s.dy * sin;
        const y = my + s.dx * sin + s.dy * cos;
        return x < -borde || y < -borde || x > width + borde || y > height + borde ? null : [x, y];
      };

      for (const lista of [titilan, medias]) {
        for (const s of lista) {
          const p = punto(s, 8);
          if (!p) continue;
          ctx.globalAlpha = s.a * brillo(s, t) * intensidad;
          ctx.drawImage(puntos[s.c], p[0] - s.tam / 2, p[1] - s.tam / 2, s.tam, s.tam);
        }
      }
      for (const s of brillantes) {
        const p = punto(s, s.largo);
        if (!p) continue;
        const [x, y] = p;
        const b = brillo(s, t);
        const k = s.a * intensidad * atenuacion(x, y, scroll);
        ctx.globalAlpha = k * 0.18 * b;
        ctx.drawImage(puntos[s.c], x - s.halo / 2, y - s.halo / 2, s.halo, s.halo);
        // El largo y el brillo de las puntas siguen al centelleo.
        const largo = s.largo * (0.78 + 0.22 * b);
        ctx.globalAlpha = k * (0.38 + 0.5 * b);
        ctx.drawImage(puntas[s.c], x - largo / 2, y - largo / 2, largo, largo);
        ctx.globalAlpha = k * (0.72 + 0.28 * b);
        ctx.drawImage(puntos[s.c], x - s.tam / 2, y - s.tam / 2, s.tam, s.tam);
        // Centelleo de color: el núcleo vira un instante hacia otro tono.
        if (animar) {
          const tinte = Math.sin(t * s.fc + s.pc);
          if (tinte > 0.4) {
            const tam = s.tam * 1.25;
            ctx.globalAlpha = k * 0.55 * (tinte - 0.4);
            ctx.drawImage(puntos[s.tinte], x - tam / 2, y - tam / 2, tam, tam);
          }
        }
      }
      ctx.globalAlpha = 1;
      if (animar) dibujarFugaces(t, scroll);
    };

    const mover = (dt, t) => {
      const seg = dt / 1000;
      // Giro constante más el que dejó el scroll, repartido en ~0,4 s. Se
      // acumula en un rango amplio para que la capa media no salte al dar la
      // vuelta: el ángulo solo se reinicia cada 5 vueltas.
      const extra = giroPendiente * (1 - Math.exp(-seg / 0.4));
      giroPendiente -= extra;
      angulo = (angulo - OMEGA * dt - extra) % (TAU * 5);
      // Paralaje del ratón, suave (~0,6 s).
      const km = 1 - Math.exp(-seg / 0.6);
      mouse.x += (mouseObjetivo.x - mouse.x) * km;
      mouse.y += (mouseObjetivo.y - mouse.y) * km;
      // Transición de intensidad suave (~0,8 s).
      intensidad += (objetivo - intensidad) * (1 - Math.exp(-seg / 0.25));
      if (!proximaFugaz) proximaFugaz = t + 900;
      else if (t >= proximaFugaz && !document.hidden) lanzarFugaz(t);
    };

    // Vigila el ritmo real entre cuadros, que incluye el rasterizado del
    // navegador. Se ignoran los primeros segundos (carga de la página) y los
    // saltos sueltos (pestaña en segundo plano, una tarea larga): solo si la
    // mayoría de los cuadros llega tarde de forma sostenida, baja la
    // resolución del lienzo, la cantidad de estrellas y el ritmo.
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
          dprMax = 1;
          medir(true);
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
      if (!animar || rafId != null || timerCuadro != null || document.hidden) return;
      ultimo = 0;
      previo = 0;
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
      if (animar) arrancar();
      else {
        intensidad = nuevo;
        dibujar(0);
      }
    };

    const medir = (repoblar) => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, dprMax);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (repoblar || !radio) poblar();
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

    // Scroll: el cielo gira hacia adelante según lo recorrido.
    const onScroll = () => {
      const y = window.scrollY;
      if (animar) giroPendiente += Math.min(Math.abs(y - ultimoScroll), 1500) * GIRO_SCROLL;
      ultimoScroll = y;
    };
    // Ratón: las capas se desplazan hacia el lado contrario, a distinto ritmo.
    const onPointer = (e) => {
      if (e.pointerType !== "mouse" || !width) return;
      mouseObjetivo = { x: -((e.clientX / width) * 2 - 1), y: -((e.clientY / height) * 2 - 1) };
    };

    medir(true);

    // Con las fuentes cargadas el hero puede cambiar de alto y mover la señal:
    // el cielo se recoloca sin regenerarse, y los textos se vuelven a medir.
    document.fonts?.ready.then(() => {
      if (!vivo) return;
      const nuevo = medirPolo();
      if (Math.hypot(nuevo.x - polo.x, nuevo.y - polo.y) > MARGEN / 2) poblar();
      else {
        polo = nuevo;
        medirZonas();
      }
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
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    if (animar && ratonFino) window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      vivo = false;
      detener();
      clearTimeout(timer);
      io?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} aria-hidden="true" className="starfield pointer-events-none fixed inset-0 z-0" />;
}

export default Starfield;
