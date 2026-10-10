"use client";

import { useEffect } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { fijarMovimientoPausado, restaurarMovimiento } from "@/lib/movimiento";
import { useMovimientoPausado } from "@/hooks/useMovimientoPausado";

/**
 * Pausa o reanuda las animaciones continuas del sitio: el cielo, la señal del
 * hero y el banner de servicios (WCAG 2.2.2). Discreto, en el pie de página;
 * con `salto`, además, como segundo enlace de salto al inicio de la página
 * (solo se ve con el foco del teclado). La elección se recuerda en este
 * navegador.
 */
export function PausaMovimiento({ className, salto = false }) {
  const pausado = useMovimientoPausado();

  useEffect(() => {
    restaurarMovimiento();
  }, []);

  const Icono = pausado ? Play : Pause;
  return (
    <button
      type="button"
      onClick={() => fijarMovimientoPausado(!pausado)}
      className={cn(
        salto
          ? "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:items-center focus:gap-2 focus:rounded-full focus:bg-text focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-bg focus:outline-2 focus:outline-offset-4 focus:outline-accent"
          : "inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-[13px] text-faint transition-colors hover:text-text",
        className,
      )}
    >
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      {pausado ? "Reanudar animaciones" : "Pausar animaciones"}
    </button>
  );
}

export default PausaMovimiento;
