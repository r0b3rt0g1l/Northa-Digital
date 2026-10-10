"use client";

import { useEffect, useId, useRef } from "react";
import { StarIcon } from "@/components/ui/StarIcon";

/**
 * Sello circular «Creado por Northa Digital» con la estrella al centro. Al
 * entrar en pantalla gira una vuelta (2,6 s) y la estrella destella; vuelve a
 * girar al pasar el puntero. No tapa contenido: vive en su propio espacio
 * junto al título. Con movimiento reducido, quieto.
 */
export function SelloNortha({ className = "" }) {
  const ref = useRef(null);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let fuera = true;
    const girar = () => {
      // No se reinicia a mitad de una vuelta.
      if ((el.getAnimations?.({ subtree: true }) ?? []).some((a) => a.animationName === "sello-giro" && a.playState === "running")) return;
      el.classList.remove("is-girando");
      void el.offsetWidth;
      el.classList.add("is-girando");
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.6 && fuera) {
          fuera = false;
          girar();
        } else if (!e.isIntersecting) {
          fuera = true;
        }
      },
      { threshold: [0, 0.6] },
    );
    io.observe(el);
    el.addEventListener("pointerenter", girar);
    return () => {
      io.disconnect();
      el.removeEventListener("pointerenter", girar);
    };
  }, []);

  return (
    <div ref={ref} role="img" aria-label="Sello: creado por Northa Digital" className={`sello ${className}`}>
      <svg className="sello-anillo" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <defs>
          <path id={`${uid}-circulo`} d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
        </defs>
        <circle cx="100" cy="100" r="92" className="sello-borde" />
        <circle cx="100" cy="100" r="56" className="sello-borde sello-borde--interior" />
        {/* textLength va en <text>: Firefox lo ignora en <textPath>. */}
        <text className="sello-texto" textLength="462" lengthAdjust="spacing">
          <textPath href={`#${uid}-circulo`} startOffset="0">
            CREADO POR NORTHA DIGITAL ✦ DISEÑO · SISTEMAS · CONTENIDO ✦
          </textPath>
        </text>
      </svg>
      <span className="sello-centro" aria-hidden="true">
        <StarIcon className="h-9 w-9" />
      </span>
    </div>
  );
}

export default SelloNortha;
