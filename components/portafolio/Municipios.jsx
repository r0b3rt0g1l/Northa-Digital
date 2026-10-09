"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { StarIcon } from "@/components/ui/StarIcon";

const INTERVALO = 2600; // ms por municipio: cambia rápido, sin prisa al leer
const sinGuion = (t) => t.replace(/­/g, "");

/**
 * Portafolio de municipios: un widget al estilo de Apple que pasa solo por
 * todos los municipios con portal publicado, y la lista completa con el
 * enlace a cada portal.
 *
 *  - Cada municipio se muestra con su nombre y su imagen: la captura real del
 *    portal cuando existe en el proyecto (Mazatán) y, si no, un diseño de
 *    respaldo con su color institucional (ver lib/content/proyectos.js).
 *  - Cambia solo cada 2,6 s con una transición vertical corta, como una pila
 *    de widgets. Se detiene al pasar el puntero o enfocar el bloque, unos
 *    segundos tras deslizar, fuera de pantalla, con la pestaña oculta y con su
 *    botón de pausa (WCAG 2.2.2).
 *  - Pasar el puntero o enfocar un municipio de la lista lo muestra en el
 *    widget. En pantallas táctiles se puede deslizar para avanzar.
 *  - Con movimiento reducido no avanza solo ni se desliza: cambia al elegir.
 *  - Sin JavaScript se ve el primer municipio y la lista con todos los enlaces.
 */
export function Municipios({ enlaces, imagen }) {
  // Orden del widget: primero el municipio con captura, luego el resto.
  const conImagen = imagen ? enlaces.find((e) => e.url === imagen.enlace.url) : null;
  const orden = conImagen ? [conImagen, ...enlaces.filter((e) => e !== conImagen)] : enlaces;
  const total = orden.length;

  const [activo, setActivo] = useState(0);
  const [pausado, setPausado] = useState(false); // por el visitante (botón)
  // Esperas: puntero encima, foco dentro (salvo en el botón de pausa) y unos
  // segundos tras deslizar en táctil. Cada una se lleva por separado.
  const [puntero, setPuntero] = useState(false);
  const [foco, setFoco] = useState(false);
  const [deslizado, setDeslizado] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducido, setReducido] = useState(false);
  const raizRef = useRef(null);
  const toque = useRef(null);
  const espera = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setReducido(mq.matches);
    leer();
    mq.addEventListener?.("change", leer);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    if (raizRef.current) io.observe(raizRef.current);
    return () => {
      mq.removeEventListener?.("change", leer);
      io.disconnect();
      clearTimeout(espera.current);
    };
  }, []);

  // Puntero encima, con eventos nativos: el onPointerLeave de React se pierde
  // si el nodo bajo el puntero cambia (el icono del botón de pausa).
  useEffect(() => {
    const el = raizRef.current;
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

  const avanza = !pausado && !puntero && !foco && !deslizado && visible && !reducido;

  // Cada cambio, también el manual, cuenta 2,6 s completos.
  useEffect(() => {
    if (!avanza) return;
    const t = setTimeout(function paso() {
      if (document.hidden) return void setTimeout(paso, INTERVALO);
      setActivo((i) => (i + 1) % total);
    }, INTERVALO);
    return () => clearTimeout(t);
  }, [avanza, total, activo]);

  const ir = (i) => setActivo((i + total) % total);
  const indiceDe = (e) => orden.indexOf(e);

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

  const actual = orden[activo];

  return (
    <div
      ref={raizRef}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-8"
      onFocus={(e) => setFoco(!e.target.closest(".widget-pausa"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFoco(false);
      }}
    >
      <figure className="m-0 flex flex-col gap-3">
        <div
          className="widget"
          role="region"
          aria-roledescription="carrusel"
          aria-label="Municipios con portal hecho por Northa Digital"
          onPointerDown={alTocar}
          onPointerUp={alSoltar}
          onPointerCancel={() => (toque.current = null)}
        >
          <div className="widget-pila" aria-live={avanza ? "off" : "polite"}>
            {orden.map((m, i) => {
              const estado = i === activo ? "activo" : i === (activo - 1 + orden.length) % orden.length ? "saliente" : "espera";
              const nombre = sinGuion(m.nombre);
              return (
                <div
                  key={m.url}
                  className="widget-pieza"
                  data-estado={estado}
                  role="group"
                  aria-roledescription="diapositiva"
                  aria-label={`${i + 1} de ${orden.length}: ${nombre}`}
                  aria-hidden={i !== activo}
                  inert={i !== activo}
                  style={{ "--color": m.color }}
                >
                  {m === conImagen ? (
                    <Image
                      src={imagen.src}
                      alt={imagen.alt}
                      width={imagen.width}
                      height={imagen.height}
                      // Se pinta con object-fit: cover en una caja más alta que la foto,
                      // así que su ancho real es 2,4-3,3 veces el del widget.
                      sizes="(min-width: 1240px) 1520px, (min-width: 1024px) 118vw, (min-width: 640px) 240vw, 330vw"
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
                  <span className="widget-cuenta" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")} / {String(orden.length).padStart(2, "0")}
                  </span>
                  <div className="widget-pie">
                    <span className="widget-etiqueta">Portal municipal</span>
                    <span className="widget-nombre">{m.nombre}</span>
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="widget-enlace">
                      Ver portal
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only"> de {nombre} (se abre en una pestaña nueva)</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
          <span className="widget-puntos" aria-hidden="true">
            {orden.map((m, i) => (
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
        {conImagen && imagen.credito ? (
          <figcaption className="px-2 text-[12.5px] text-faint">
            Captura del portal de {sinGuion(conImagen.nombre)}.{" "}
            <a
              href={imagen.credito.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-text-2"
            >
              {imagen.credito.texto}
            </a>
          </figcaption>
        ) : null}
      </figure>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <h3 className="text-[clamp(1.25rem,1vw+1rem,1.6rem)] tracking-[-0.02em]">Portales municipales</h3>
          <span className="rounded-full border border-line-strong px-3 py-1 font-mono text-[11.5px] text-text-2">
            {enlaces.length} publicados
          </span>
        </div>
        <ul className="municipios m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
          {enlaces.map((e) => {
            const nombre = sinGuion(e.nombre);
            const esActivo = e === actual;
            return (
              <li key={e.url}>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onPointerEnter={(ev) => ev.pointerType === "mouse" && ir(indiceDe(e))}
                  onFocus={() => ir(indiceDe(e))}
                  data-activo={esActivo || undefined}
                  style={{ "--color": e.color }}
                  className="municipio group/m flex h-full min-h-12 items-center justify-between gap-2 rounded-2xl border border-line bg-surface/80 px-3.5 py-2.5 transition-[border-color,background-color] duration-300 hover:border-white/20 hover:bg-surface-2"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="municipio-color" aria-hidden="true" />
                    <span className="wrap-break-word hyphens-auto text-[14.5px] font-semibold leading-tight tracking-[-0.01em] text-text">
                      {e.nombre}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 text-muted transition-[color,translate] duration-300 group-hover/m:-translate-y-0.5 group-hover/m:translate-x-0.5 group-hover/m:text-accent-2"
                    aria-hidden="true"
                  />
                  <span className="sr-only"> (abre el portal de {nombre} en una pestaña nueva)</span>
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
