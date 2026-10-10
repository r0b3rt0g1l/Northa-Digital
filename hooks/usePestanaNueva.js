"use client";

import { useSyncExternalStore } from "react";
import { esDispositivoMovil } from "@/lib/whatsapp";

const sinCambios = () => () => {};

/**
 * true en computadora, donde los enlaces de WhatsApp abren WhatsApp Web en
 * una pestaña nueva (en celular navegan en la misma). En el servidor, false.
 */
export function usePestanaNueva() {
  return useSyncExternalStore(sinCambios, () => !esDispositivoMovil(), () => false);
}

export default usePestanaNueva;
