"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Escena de cierre: la estrella del norte de Northa brilla con fuerza y da
 * una vuelta completa de 360° cuando entra en pantalla (4,8 s); después queda
 * encendida y quieta. Vuelve a girar cada vez que se regresa
 * a ella. Es decorativa: no tiene texto ni controles y no captura el puntero.
 * Con movimiento reducido no gira: se muestra encendida y quieta.
 */
export function EscenaFinal() {
  const ref = useRef(null);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-encendida");
      return;
    }
    let fuera = true;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.45 && fuera) {
          fuera = false;
          el.classList.remove("is-girando");
          void el.offsetWidth; // reinicia el giro
          el.classList.add("is-girando", "is-encendida");
        } else if (!e.isIntersecting) {
          fuera = true;
        }
      },
      { threshold: [0, 0.45] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div id="final" ref={ref} aria-hidden="true" className="final relative isolate grid min-h-[64svh] place-items-center overflow-hidden px-5 py-24 sm:min-h-[78svh]">
      <div className="final-escena">
        <span className="final-halo" />
        <span className="final-halo final-halo--amplio" />
        <span className="final-rayo final-rayo--h" />
        <span className="final-rayo final-rayo--v" />
        <svg className="final-estrella" viewBox="0 0 200 200" focusable="false">
          <defs>
            <radialGradient id={`${uid}-cuerpo`} cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="45%" stopColor="#eaf3ff" />
              <stop offset="100%" stopColor="#9ec9ff" />
            </radialGradient>
            <linearGradient id={`${uid}-cuadrante`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7fd3ff" />
              <stop offset="100%" stopColor="#4f8cff" />
            </linearGradient>
          </defs>
          <path
            d="M100 18 L121.2 78.8 L168 100 L121.2 121.2 L100 182 L78.8 121.2 L32 100 L78.8 78.8 Z"
            fill={`url(#${uid}-cuerpo)`}
          />
          <path d="M100 18 L121.2 78.8 L100 100 L78.8 78.8 Z" fill={`url(#${uid}-cuadrante)`} />
        </svg>
        <span className="final-nucleo" />
      </div>
    </div>
  );
}

export default EscenaFinal;
