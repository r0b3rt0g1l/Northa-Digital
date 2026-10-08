"use client";

import { useEffect, useRef } from "react";

/**
 * Pausa las animaciones CSS de su sección mientras no está en pantalla
 * (clase .is-paused). No pinta nada.
 */
export function PausaFuera() {
  const ref = useRef(null);

  useEffect(() => {
    const seccion = ref.current?.closest("section");
    if (!seccion) return;
    const io = new IntersectionObserver(([e]) => seccion.classList.toggle("is-paused", !e.isIntersecting), {
      rootMargin: "120px 0px",
    });
    io.observe(seccion);
    return () => io.disconnect();
  }, []);

  return <span ref={ref} hidden />;
}

export default PausaFuera;
