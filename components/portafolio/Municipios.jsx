"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, LockKeyhole, Pause, Play } from "lucide-react";
import { StarIcon } from "@/components/ui/StarIcon";
import capturas from "@/lib/content/capturas.json";
import { slugMunicipio } from "@/lib/content/slug";

const INTERVALO = 2600; // ms por municipio: cambia rápido, sin prisa al leer
const sinGuion = (t) => t.replace(/­/g, "");
const dominio = (url) => new URL(url).hostname.replace(/^www\./, "");
const capturaDe = (m) => capturas[slugMunicipio(m.nombre)] ?? null;

/**
 * Portafolio de municipios con la página de inicio real de cada portal:
 *
 *  - Un widget al estilo de Apple con forma de ventana de navegador que pasa
 *    solo por todos los municipios (cada 2,6 s, transición vertical corta).
 *    Se detiene al pasar el puntero o enfocarlo, unos segundos tras deslizar,
 *    fuera de pantalla, con la pestaña oculta y con su botón de pausa (WCAG
 *    2.2.2). Solo descarga la captura del municipio visible y la siguiente.
 *  - Debajo, una tarjeta por municipio con la captura de su página de inicio,
 *    el nombre, el dominio y el botón para visitar el portal.
 *
 * Las capturas viven en public/portafolio/portales/ y se actualizan con
 * scripts/capturar-portales.mjs (índice en lib/content/capturas.json). Si un
 * municipio aún no tiene captura, se muestra un diseño con su color.
 * Con movimiento reducido el widget no avanza solo. Sin JavaScript se ve el
 * primer municipio y todas las tarjetas con su enlace.
 */
export function Municipios({ enlaces }) {
  const total = enlaces.length;

  const [activo, setActivo] = useState(0);
  const [cargados, setCargados] = useState(() => new Set([0, 1 % total]));
  const [pausado, setPausado] = useState(false); // por el visitante (botón)
  // Esperas: puntero encima, foco dentro (salvo en el botón de pausa) y unos
  // segundos tras deslizar en táctil. Cada una se lleva por separado.
  const [puntero, setPuntero] = useState(false);
  const [foco, setFoco] = useState(false);
  const [deslizado, setDeslizado] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducido, setReducido] = useState(false);
  const widgetRef = useRef(null);
  const toque = useRef(null);
  const espera = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setReducido(mq.matches);
    leer();
    mq.addEventListener?.("change", leer);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    if (widgetRef.current) io.observe(widgetRef.current);
    return () => {
      mq.removeEventListener?.("change", leer);
      io.disconnect();
      clearTimeout(espera.current);
    };
  }, []);

  // Puntero encima, con eventos nativos: el onPointerLeave de React se pierde
  // si el nodo bajo el puntero cambia (el icono del botón de pausa).
  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return;
    const entra = (e) => e.pointerType === "mouse" && setPuntero(true);
    const sale = (e) => e.pointerType === "mouse" && setPuntero(false);
    el.addEventListener("pointerenter", entra);
    el.addEventListener("pointerleave", sale);
    return () => {
      el.removeEventListener("pointerenter", entra);
      el.removeEventListener("pointerleave", sale);
    };
  }, []);

  /** Muestra el municipio i y deja lista la captura del siguiente. */
  const ir = (i) => {
    const n = (i + total) % total;
    const sig = (n + 1) % total;
    setActivo(n);
    setCargados((prev) => (prev.has(n) && prev.has(sig) ? prev : new Set([...prev, n, sig])));
  };

  const avanza = !pausado && !puntero && !foco && !deslizado && visible && !reducido;
  const siguiente = useEffectEvent(() => ir(activo + 1));

  // Cada cambio, también el manual, cuenta 2,6 s completos.
  useEffect(() => {
    if (!avanza) return;
    let t = setTimeout(function paso() {
      if (document.hidden) {
        t = setTimeout(paso, INTERVALO);
        return;
      }
      siguiente();
    }, INTERVALO);
    return () => clearTimeout(t);
  }, [avanza, activo]);

  // Deslizar en pantallas táctiles: horizontal o vertical, a partir de 40 px.
  const alTocar = (e) => {
    if (e.pointerType !== "touch") return;
    toque.current = { x: e.clientX, y: e.clientY };
  };
  const alSoltar = (e) => {
    const t = toque.current;
    toque.current = null;
    if (!t || e.pointerType !== "touch") return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
    ir(activo + ((Math.abs(dx) > Math.abs(dy) ? dx : dy) < 0 ? 1 : -1));
    // Tras deslizar, el municipio elegido se queda unos segundos.
    setDeslizado(true);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => setDeslizado(false), 3500);
  };

  const actual = enlaces[activo];

  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <figure
        ref={widgetRef}
        className="widget glass mx-auto w-full max-w-[1040px]"
        onFocus={(e) => setFoco(!e.target.closest(".widget-pausa"))}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setFoco(false);
        }}
      >
        {/* Barra de navegador: decorativa, con el dominio del portal visible. */}
        <div className="widget-navegador" aria-hidden="true">
          <span className="widget-luces">
            <i />
            <i />
            <i />
          </span>
          <span className="widget-url">
            <LockKeyhole className="h-3 w-3 shrink-0" strokeWidth={2.2} />
            <span className="truncate">{dominio(actual.url)}</span>
          </span>
          <span className="widget-cuenta">
            {String(activo + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
        <div
          className="widget-pantalla"
          role="region"
          aria-roledescription="carrusel"
          aria-label="Portales municipales hechos por Northa Digital"
          onPointerDown={alTocar}
          onPointerUp={alSoltar}
          onPointerCancel={() => (toque.current = null)}
        >
          <div className="widget-pila" aria-live={avanza ? "off" : "polite"}>
            {enlaces.map((m, i) => {
              const estado = i === activo ? "activo" : i === (activo - 1 + total) % total ? "saliente" : "espera";
              const nombre = sinGuion(m.nombre);
              const captura = capturaDe(m);
              return (
                <div
                  key={m.url}
                  className="widget-pieza"
                  data-estado={estado}
                  role="group"
                  aria-roledescription="diapositiva"
                  aria-label={`${i + 1} de ${total}: ${nombre}`}
                  aria-hidden={i !== activo}
                  inert={i !== activo}
                  style={{ "--color": m.color }}
                >
                  {captura && cargados.has(i) ? (
                    <Image
                      src={captura.src}
                      alt={`Página de inicio del portal del Municipio de ${nombre}.`}
                      width={captura.width}
                      height={captura.height}
                      sizes="(min-width: 1100px) 1040px, 94vw"
                      loading="lazy"
                      className="widget-foto"
                    />
                  ) : (
                    <span className="widget-respaldo" aria-hidden="true">
                      <span className="widget-inicial">{nombre.charAt(0)}</span>
                      <StarIcon className="widget-estrella" />
                    </span>
                  )}
                  <span className="widget-velo" aria-hidden="true" />
                  <span className="hecho-por widget-sello">
                    <StarIcon className="h-3.5 w-3.5" />
                    Hecho por Northa Digital
                  </span>
                  <div className="widget-pie">
                    <span className="widget-etiqueta">Portal municipal</span>
                    <span className="widget-nombre">{m.nombre}</span>
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="widget-enlace">
                      Visitar portal
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only"> de {nombre} (se abre en una pestaña nueva)</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
          <span className="widget-puntos" aria-hidden="true">
            {enlaces.map((m, i) => (
              <span key={m.url} data-activo={i === activo || undefined} />
            ))}
          </span>
          {!reducido ? (
            <button
              type="button"
              className="widget-pausa"
              onClick={() => setPausado((v) => !v)}
              aria-label={pausado ? "Reanudar el carrusel de municipios" : "Pausar el carrusel de municipios"}
            >
              {pausado ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </button>
          ) : null}
        </div>
      </figure>

      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 px-1">
          <h3 className="text-[clamp(1.25rem,1vw+1rem,1.6rem)] tracking-[-0.02em]">Portales municipales</h3>
          <span className="rounded-full border border-line-strong px-3 py-1 font-mono text-[11.5px] text-text-2">
            {total} publicados
          </span>
        </div>
        <ul className="portales m-0 grid list-none grid-cols-1 gap-2.5 p-0 min-[340px]:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {enlaces.map((e) => {
            const nombre = sinGuion(e.nombre);
            const captura = capturaDe(e);
            return (
              <li key={e.url}>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="portal glass group/p"
                  data-tilt="4"
                  style={{ "--color": e.color }}
                >
                  <span className="portal-captura">
                    {captura ? (
                      <Image
                        src={captura.src}
                        alt=""
                        width={captura.width}
                        height={captura.height}
                        sizes="(min-width: 1280px) 230px, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 340px) 50vw, 100vw"
                        loading="lazy"
                      />
                    ) : (
                      <span className="portal-respaldo" aria-hidden="true">
                        {nombre.charAt(0)}
                      </span>
                    )}
                  </span>
                  <span className="portal-cuerpo">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="municipio-color" aria-hidden="true" />
                      <span className="portal-nombre">{e.nombre}</span>
                    </span>
                    <span className="portal-dominio">{dominio(e.url)}</span>
                    <span className="portal-boton">
                      Visitar portal
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="sr-only"> (se abre en una pestaña nueva)</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default Municipios;
