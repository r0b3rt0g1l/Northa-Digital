"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { StarIcon } from "@/components/ui/StarIcon";
import { EVENTO_ASISTENTE } from "@/lib/acciones";
import { site } from "@/lib/site";

// El panel se descarga solo cuando alguien lo abre (o pasa por el botón).
const cargarPanel = () => import("./AsistentePanel");
const precargar = () => {
  cargarPanel().catch(() => {});
};

/**
 * Si el panel no se puede descargar (sin conexión o tras un despliegue
 * nuevo), se muestra este respaldo con contacto directo en lugar de romper
 * la página. Vive en el mismo archivo para no depender de otra descarga.
 */
function PanelRespaldo({ onCerrar }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCerrar(true);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  return (
    <div
      id="asistente-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="asistente-respaldo-titulo"
      data-asistente=""
      className="glass-strong fixed inset-x-3 bottom-3 z-[60] flex flex-col gap-4 rounded-[24px] p-5 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[400px]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="asistente-respaldo-titulo" className="text-[15px]">
          Asistente de Northa
        </h2>
        <button
          type="button"
          onClick={() => onCerrar(true)}
          aria-label="Cerrar asistente"
          className="-mr-2 -mt-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-white/[0.06] hover:text-text"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <p className="m-0 text-[14.5px] text-text-2">
        No pudimos cargar el asistente. Escríbenos y te respondemos directamente.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={site.contact.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full bg-text px-4 text-sm font-semibold text-bg"
        >
          Escribir por WhatsApp
        </a>
        <a
          href={site.contact.emailHref}
          className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-sm font-medium text-text"
        >
          Enviar correo
        </a>
      </div>
    </div>
  );
}

const AsistentePanel = dynamic(
  () => cargarPanel().catch(() => ({ default: PanelRespaldo })),
  { ssr: false, loading: () => null },
);

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
      precargar();
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
        onPointerEnter={precargar}
        onFocus={precargar}
        onClick={() => setAbierto(true)}
        style={{ "--d": "900ms" }}
        className={
          "glass glass-hover lanzador-in fixed bottom-4 right-4 z-[55] inline-flex h-12 items-center gap-2.5 rounded-full text-sm font-medium text-text max-sm:w-12 max-sm:justify-center sm:bottom-6 sm:right-6 sm:pl-3.5 sm:pr-5" +
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
