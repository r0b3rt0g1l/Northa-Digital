"use client";

import { useSyncExternalStore } from "react";
import { alCambiarMovimiento, movimientoPausado } from "@/lib/movimiento";

/**
 * true si la persona pausó las animaciones con el botón del pie. Reactivo y
 * seguro en SSR (useSyncExternalStore).
 */
export function useMovimientoPausado() {
  return useSyncExternalStore(alCambiarMovimiento, movimientoPausado, () => false);
}

export default useMovimientoPausado;
