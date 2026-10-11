"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Contenedor que, solo cuando su contenido se desplaza de lado, se vuelve una
 * región enfocable con nombre. Con el foco en ella, las flechas izquierda y
 * derecha avanzan exactamente una tarjeta (el primer hijo de la lista), en
 * cualquier navegador. Si todo cabe, no añade una parada de tabulación vacía.
 */
export function DesplazableAccesible({ etiqueta, className, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const desplaza = el.scrollWidth > el.clientWidth + 1;
      if (desplaza) {
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "region");
        el.setAttribute("aria-label", etiqueta);
      } else {
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
        el.removeAttribute("aria-label");
      }
    };
    const alTeclear = (e) => {
      if (e.target !== el || !el.hasAttribute("tabindex")) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const lista = el.firstElementChild;
      const tarjeta = lista?.firstElementChild;
      if (!tarjeta) return;
      e.preventDefault();
      const hueco = parseFloat(getComputedStyle(lista).columnGap) || 0;
      const paso = tarjeta.getBoundingClientRect().width + hueco;
      const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollBy({ left: e.key === "ArrowRight" ? paso : -paso, behavior: reducido ? "auto" : "smooth" });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    el.addEventListener("keydown", alTeclear);
    return () => {
      ro.disconnect();
      el.removeEventListener("keydown", alTeclear);
    };
  }, [etiqueta]);

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}

export default DesplazableAccesible;
