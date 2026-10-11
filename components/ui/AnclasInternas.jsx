"use client";

import { useEffect } from "react";
import { irASeccion } from "@/lib/acciones";

/**
 * Los enlaces internos se escriben "/#seccion" para que también funcionen
 * desde la 404. En la portada, si la URL trae parámetros (fbclid, utm_*,
 * gclid), el navegador recargaría la página entera al seguirlos: aquí se
 * interceptan y solo se desplaza, conservando la URL y lo que el visitante
 * haya escrito.
 */
export function AnclasInternas() {
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a[href^="/#"]') : null;
      if (!a || a.target === "_blank" || window.location.pathname !== "/") return;
      const id = a.getAttribute("href").slice(2);
      if (!id || !document.getElementById(id)) return;
      e.preventDefault();
      irASeccion(id);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

export default AnclasInternas;
