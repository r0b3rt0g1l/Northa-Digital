"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";

/**
 * Todos los portales municipales publicados, en tarjetas compactas. Cada
 * tarjeta es un enlace que abre el portal en una pestaña nueva. Al entrar en
 * pantalla aparecen en cascada y una luz recorre sus bordes una sola vez.
 * Sin JavaScript o con movimiento reducido se muestran quietas desde el
 * inicio. Funciona con teclado, ratón y pantalla táctil.
 */
export function Municipios({ enlaces }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Solo se arma si está bajo el pliegue: lo visible nunca se oculta.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.classList.add("is-armada");
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.classList.add("is-en-vista");
        io.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <ul ref={ref} className="municipios m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-3 lg:grid-cols-3">
      {enlaces.map((e, i) => (
        <li key={e.url} style={{ "--i": i }}>
          <a
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            className="municipio group/m flex h-full min-h-[64px] items-center justify-between gap-2 rounded-2xl border border-line bg-surface/80 px-3.5 py-3 transition-[border-color,background-color,translate] duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-surface-2 focus-visible:-translate-y-0.5"
          >
            <span className="flex min-w-0 flex-col">
              <span className="wrap-break-word hyphens-auto text-[15px] font-semibold leading-tight tracking-[-0.01em] text-text">{e.nombre}</span>
              <span className="text-[12px] text-muted transition-colors group-hover/m:text-accent-2">Ver portal</span>
            </span>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-muted transition-[color,translate] duration-300 group-hover/m:-translate-y-0.5 group-hover/m:translate-x-0.5 group-hover/m:text-accent-2"
              aria-hidden="true"
            />
            <span className="sr-only"> (abre el portal de {e.nombre} en una pestaña nueva)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default Municipios;
