"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { ArrowUpRight, Shuffle } from "lucide-react";
import { cn } from "@/lib/cn";
import { servicios, seguridad } from "@/lib/content/servicios";
import { abrirAsistente } from "@/lib/acciones";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const cartas = [...servicios, seguridad];
const ESTELA = [0.34, 0.2, 0.1]; // opacidad de las copias que siguen a cada carta
const RETRASO = 115; // ms entre cartas: la cascada
const DURACION = 1500; // ms del vuelo de cada carta

/**
 * Trayectoria de una carta, como al ganar en Solitario: sale pequeña del mazo
 * con un salto, crece, cae y rebota contra su lugar con rebotes cada vez más
 * bajos (restitución 0,42), mientras avanza de lado y endereza su giro. Al
 * final queda exacta en su posición. Devuelve fotogramas para la Web Animations API
 * con transform (translate, rotate, scale), así que solo trabaja la GPU.
 */
function trayectoria(dx0, dy0, giro) {
  const g = 3200; // px/s²: gravedad
  const v0 = -460; // px/s: salto inicial hacia arriba
  const e = 0.42; // restitución de cada rebote
  // Primer vuelo: de dy0 (respecto al lugar final) hasta 0 con salto inicial.
  // y(t) = dy0 + v0 t + g t²/2 = 0 → raíz positiva.
  const t1 = (-v0 + Math.sqrt(Math.max(v0 * v0 - 2 * g * dy0, 0))) / g;
  const vImpacto = v0 + g * t1;
  const tramos = [{ inicio: 0, fin: t1, y0: dy0, v: v0 }];
  let v = vImpacto * e;
  let t = t1;
  for (let i = 0; i < 3; i++) {
    const dur = (2 * v) / g;
    tramos.push({ inicio: t, fin: t + dur, y0: 0, v: -v });
    t += dur;
    v *= e;
  }
  const total = t;
  const n = 46;
  const cuadros = [];
  for (let k = 0; k <= n; k++) {
    const tt = (k / n) * total;
    const tr = tramos.find((x) => tt <= x.fin) ?? tramos[tramos.length - 1];
    const dt = tt - tr.inicio;
    const y = k === n ? 0 : Math.min(0, tr.y0 + tr.v * dt + (g * dt * dt) / 2) || 0;
    const p = tt / total;
    const x = dx0 * Math.pow(1 - p, 2.2); // avanza de lado y frena
    const r = giro * Math.pow(1 - p, 1.6);
    // Sale pequeña del mazo y crece en el primer tercio del vuelo.
    const crece = Math.min(1, p / 0.32);
    const e2 = 0.28 + 0.72 * (1 - Math.pow(1 - crece, 3));
    // Aplastado breve al tocar el lugar.
    const golpe = tramos.slice(1).some((b) => Math.abs(tt - b.inicio) < total * 0.018);
    const sx = (golpe ? 1.04 : 1) * e2;
    const sy = (golpe ? 0.95 : 1) * e2;
    cuadros.push({
      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
      offset: p,
    });
  }
  cuadros[0].offset = 0;
  cuadros[cuadros.length - 1].offset = 1;
  return cuadros;
}

/**
 * Banner de servicios en cartas. Al llegar a la sección (o con «Repartir de
 * nuevo») las cartas salen del mazo en cascada y rebotan hasta su lugar,
 * dejando una estela de copias que se desvanece, como al ganar en Solitario.
 * Después quedan quietas y legibles: la animación nunca tapa textos ni
 * botones de otras secciones y no se repite sola.
 *
 * Al pasar el cursor, cada carta se eleva, se inclina en 3D hacia el puntero
 * (GlassPointer) y la recorre un destello. Cada carta abre el asistente con
 * ese servicio. Con movimiento reducido las cartas aparecen en su lugar, sin
 * vuelo ni botón de repartir. Sin JavaScript se ven todas en su sitio.
 */
export function BarajaServicios() {
  const raiz = useRef(null);
  const reducido = useReducedMotion();
  const repartiendo = useRef(false);

  const repartir = () => {
    const el = raiz.current;
    if (!el || repartiendo.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    repartiendo.current = true;
    const mazo = el.querySelector(".baraja-mazo").getBoundingClientRect();
    const items = [...el.querySelectorAll(".carta-lugar")];
    const animaciones = [];
    items.forEach((li, i) => {
      const r = li.getBoundingClientRect();
      // El mazo está arriba a la derecha; cada carta sale de ahí, apilada.
      const dx0 = mazo.left + mazo.width / 2 - (r.left + r.width / 2) + i * 1.5;
      const dy0 = mazo.top + mazo.height / 2 - (r.top + r.height / 2) - i * 1.5;
      const giro = (i % 2 ? 1 : -1) * (10 + ((i * 7) % 9));
      const cuadros = trayectoria(dx0, dy0, giro);
      const carta = li.querySelector(".carta");
      animaciones.push(
        carta.animate(cuadros, { duration: DURACION, delay: i * RETRASO, easing: "linear", fill: "backwards" }),
      );
      li.querySelectorAll(".carta-estela").forEach((copia, k) => {
        const a = ESTELA[k] ?? 0.1;
        const conOpacidad = cuadros.map((c) => ({
          ...c,
          // Las copias se apagan al final del vuelo.
          opacity: c.offset < 0.7 ? a : a * Math.max(0, (1 - c.offset) / 0.3),
        }));
        animaciones.push(
          copia.animate(conOpacidad, {
            duration: DURACION,
            delay: i * RETRASO + (k + 1) * 55,
            easing: "linear",
            fill: "none",
          }),
        );
      });
    });
    el.classList.remove("is-pendiente");
    el.classList.add("is-repartiendo");
    Promise.all(animaciones.map((a) => a.finished.catch(() => {}))).then(() => {
      repartiendo.current = false;
      el.classList.remove("is-repartiendo");
    });
  };

  const alVer = useEffectEvent(() => repartir());

  useEffect(() => {
    const el = raiz.current;
    if (!el || reducido) return;
    // Las cartas esperan en el mazo hasta que la sección se ve.
    el.classList.add("is-pendiente");
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        alVer();
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.classList.remove("is-pendiente");
    };
  }, [reducido]);

  return (
    <div ref={raiz} className="baraja glass">
      <div className="baraja-cabeza">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="eyebrow m-0">Servicios</p>
          <h3 className="text-[clamp(1.2rem,0.9vw+1rem,1.55rem)] tracking-[-0.02em]">Elige un servicio y cuéntanos</h3>
        </div>
        <span className="baraja-mazo" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {!reducido ? (
          <button type="button" className="baraja-repartir" onClick={repartir}>
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            <span className="max-sm:sr-only">Repartir de nuevo</span>
          </button>
        ) : null}
      </div>
      <ul className="baraja-cartas" aria-label="Servicios de Northa Digital">
        {cartas.map((s) => (
          <li key={s.id} className="carta-lugar">
            {ESTELA.map((_, k) => (
              <span key={k} className="carta-estela" aria-hidden="true">
                <s.Icon className="h-5 w-5" strokeWidth={1.6} />
              </span>
            ))}
            <button
              type="button"
              aria-haspopup="dialog"
              data-tilt="7"
              onClick={() => abrirAsistente({ modo: "consulta", servicio: s.id })}
              className={cn("carta glass glass-interior", s.id === seguridad.id && "carta--seguridad")}
            >
              <span className="carta-brillo" aria-hidden="true" />
              <span className="carta-icono" aria-hidden="true">
                <s.Icon className="h-5 w-5" strokeWidth={1.6} />
              </span>
              <span className="carta-titulo">{s.title}</span>
              <span className="carta-texto">{s.resumen}</span>
              <span className="carta-accion">
                Consultar
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default BarajaServicios;
