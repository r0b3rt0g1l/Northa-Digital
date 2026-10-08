"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { StarIcon } from "@/components/ui/StarIcon";
import { EVENTO_ASISTENTE } from "@/lib/acciones";

// El panel se descarga solo cuando alguien lo abre (o pasa por el botón).
const cargarPanel = () => import("./AsistentePanel");
const AsistentePanel = dynamic(cargarPanel, { ssr: false, loading: () => null });

/**
 * Asistente del sitio: un botón discreto abajo a la derecha que abre un
 * panel de conversación. Se puede abrir también desde cualquier botón de la
 * página (evento northa:asistente). No bloquea la navegación ni pide datos.
 */
export function Asistente() {
  const [abierto, setAbierto] = useState(false);
  const [pregunta, setPregunta] = useState(null);
  const lanzadorRef = useRef(null);

  useEffect(() => {
    const onAbrir = (e) => {
      cargarPanel();
      setPregunta(e.detail?.pregunta || null);
      setAbierto(true);
    };
    window.addEventListener(EVENTO_ASISTENTE, onAbrir);
    return () => window.removeEventListener(EVENTO_ASISTENTE, onAbrir);
  }, []);

  const cerrar = useCallback((devolverFoco = true) => {
    setAbierto(false);
    if (devolverFoco) requestAnimationFrame(() => lanzadorRef.current?.focus());
  }, []);

  return (
    <>
      <button
        ref={lanzadorRef}
        type="button"
        data-asistente=""
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls="asistente-panel"
        aria-label="Abrir asistente del sitio"
        onPointerEnter={cargarPanel}
        onFocus={cargarPanel}
        onClick={() => setAbierto(true)}
        style={{ "--d": "900ms" }}
        className={
          "glass glass-hover hero-in fixed bottom-4 right-4 z-[55] inline-flex h-12 items-center gap-2.5 rounded-full text-sm font-medium text-text max-sm:w-12 max-sm:justify-center sm:bottom-6 sm:right-6 sm:pl-3.5 sm:pr-5" +
          (abierto ? " invisible" : "")
        }
      >
        <StarIcon className="h-5 w-5" />
        <span className="max-sm:sr-only">Asistente</span>
      </button>

      {abierto ? (
        <AsistentePanel
          onCerrar={cerrar}
          preguntaInicial={pregunta}
          onPreguntaUsada={() => setPregunta(null)}
        />
      ) : null}
    </>
  );
}

export default Asistente;
