"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Mail } from "lucide-react";
import { StarIcon } from "@/components/ui/StarIcon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { EVENTO_ASISTENTE } from "@/lib/acciones";
import { site } from "@/lib/site";
import { EnlaceWhatsapp } from "@/components/ui/EnlaceWhatsapp";

// El panel se descarga solo cuando alguien lo abre (o pasa por el botón).
const cargarPanel = () => import("./AsistentePanel");
const precargar = () => {
  cargarPanel().catch(() => {});
};

const marco =
  "glass-strong panel-opaco fixed inset-x-3 bottom-3 z-[60] flex flex-col gap-4 rounded-[24px] p-5 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]";

/** Mientras se descarga el panel: un aviso breve en su lugar. */
function PanelCargando() {
  return (
    <div className={marco} role="status" aria-live="polite" data-asistente="">
      <div className="flex items-center gap-3">
        <span className="cargando grid h-10 w-10 place-items-center rounded-[12px] border border-line-strong">
          <StarIcon className="h-5 w-5" />
        </span>
        <p className="m-0 text-[14.5px] text-text-2">Abriendo el asistente…</p>
      </div>
    </div>
  );
}

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
      className={marco}
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
      <p className="m-0 text-[14.5px] text-text-2" role="alert">
        No pudimos cargar el asistente. Escríbenos y te respondemos directamente.
      </p>
      <div className="flex flex-wrap gap-2">
        <EnlaceWhatsapp className="inline-flex min-h-11 items-center gap-2 rounded-full bg-text px-4 text-sm font-semibold text-bg">
          <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
          Escribir por WhatsApp
        </EnlaceWhatsapp>
        <a
          href={site.contact.emailHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-medium text-text"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          {site.contact.email}
        </a>
      </div>
    </div>
  );
}

const AsistentePanel = dynamic(
  () => cargarPanel().catch(() => ({ default: PanelRespaldo })),
  { ssr: false, loading: () => <PanelCargando /> },
);

/**
 * Asistente del sitio: un botón discreto abajo a la derecha que abre el panel
 * de consulta guiada. También se abre desde cualquier botón de la página
 * (evento northa:asistente), con un modo y un servicio ya elegidos. Al
 * cerrarse devuelve el foco al elemento que lo abrió.
 */
export function Asistente() {
  const [abierto, setAbierto] = useState(false);
  const [peticion, setPeticion] = useState(null);
  const lanzadorRef = useRef(null);
  const origenRef = useRef(null);

  useEffect(() => {
    const onAbrir = (e) => {
      precargar();
      const activo = document.activeElement;
      if (activo instanceof HTMLElement && !activo.closest("[data-asistente]")) origenRef.current = activo;
      setPeticion(e.detail && Object.keys(e.detail).length ? { ...e.detail } : null);
      setAbierto(true);
    };
    window.addEventListener(EVENTO_ASISTENTE, onAbrir);
    return () => window.removeEventListener(EVENTO_ASISTENTE, onAbrir);
  }, []);

  const cerrar = useCallback((devolverFoco = true) => {
    setAbierto(false);
    if (!devolverFoco) return;
    const origen = origenRef.current;
    origenRef.current = null;
    requestAnimationFrame(() => {
      // Si el elemento de origen ya no está visible (menú cerrado), vuelve al lanzador.
      const destino = origen?.isConnected && origen.getClientRects().length ? origen : lanzadorRef.current;
      destino?.focus();
    });
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
        onClick={() => {
          origenRef.current = lanzadorRef.current;
          setAbierto(true);
        }}
        style={{ "--d": "900ms" }}
        className={
          "glass-strong glass-hover lanzador-in fixed bottom-4 right-4 z-[55] inline-flex h-12 items-center gap-2.5 rounded-full text-sm font-medium text-text max-sm:w-12 max-sm:justify-center sm:bottom-6 sm:right-6 sm:pl-3.5 sm:pr-5" +
          (abierto ? " invisible" : "")
        }
      >
        <StarIcon className="h-5 w-5" />
        <span className="max-sm:sr-only">Asistente</span>
      </button>

      {abierto ? (
        <AsistentePanel onCerrar={cerrar} peticion={peticion} onPeticionUsada={() => setPeticion(null)} />
      ) : null}
    </>
  );
}

export default Asistente;
