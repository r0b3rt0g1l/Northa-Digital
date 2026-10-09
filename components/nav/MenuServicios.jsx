"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronDown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { servicios, seguridad } from "@/lib/content/servicios";
import { abrirAsistente } from "@/lib/acciones";

const ESPERA_ABRIR = 90; // ms con el ratón encima antes de abrir
const ESPERA_CERRAR = 240; // ms fuera antes de cerrar

/**
 * «Servicios» como menú desplegable (patrón de navegación con divulgación):
 * un botón con aria-expanded que muestra la lista de servicios reales y la
 * categoría de seguridad. Cada servicio abre el asistente con ese servicio
 * elegido. No depende del hover:
 *  - clic o toque abre y cierra;
 *  - Enter, Espacio o flecha abajo abren; las flechas recorren las opciones,
 *    Inicio y Fin saltan al primero y al último, Escape cierra y devuelve el
 *    foco al botón; al salir con Tab se cierra;
 *  - con ratón, además, se abre al pasar por encima y se cierra al salir.
 */
export function MenuServicios({ activo = false }) {
  const uid = useId();
  const panelId = `${uid}-servicios`;
  const [abierto, setAbierto] = useState(false);
  const raizRef = useRef(null);
  const botonRef = useRef(null);
  const panelRef = useRef(null);
  const timer = useRef(null);
  // Abierto por pasar el ratón: el clic que sigue lo deja abierto en vez de
  // cerrarlo.
  const porHover = useRef(false);

  const opciones = () => Array.from(panelRef.current?.querySelectorAll("[data-opcion]") ?? []);

  const cerrar = useCallback((devolverFoco = false) => {
    clearTimeout(timer.current);
    porHover.current = false;
    setAbierto(false);
    if (devolverFoco) botonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const onPointer = (e) => {
      if (!raizRef.current?.contains(e.target)) cerrar();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        // Solo devuelve el foco al botón si estaba dentro del menú: si se
        // abrió con el ratón, el foco del teclado se queda donde estaba.
        cerrar(!!raizRef.current?.contains(document.activeElement));
      }
    };
    const onFoco = (e) => {
      if (!raizRef.current?.contains(e.target)) cerrar();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFoco);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFoco);
    };
  }, [abierto, cerrar]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const enfocar = (indice) => {
    const lista = opciones();
    if (!lista.length) return;
    lista[(indice + lista.length) % lista.length].focus();
  };

  const onKeyBoton = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      requestAnimationFrame(() => enfocar(0));
    }
  };

  const onKeyPanel = (e) => {
    const lista = opciones();
    const i = lista.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      enfocar(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      enfocar(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      enfocar(0);
    } else if (e.key === "End") {
      e.preventDefault();
      enfocar(lista.length - 1);
    }
  };

  // Solo ratón: el hover complementa al clic, nunca lo sustituye.
  const alEntrar = (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAbierto((v) => {
        if (!v) porHover.current = true;
        return true;
      });
    }, ESPERA_ABRIR);
  };
  const alSalir = (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      porHover.current = false;
      setAbierto(false);
    }, ESPERA_CERRAR);
  };

  const consultar = (servicio) => {
    // El foco vuelve al botón antes de abrir el asistente: al cerrarlo, el
    // foco regresa a «Servicios» y no a una opción ya oculta.
    cerrar(true);
    abrirAsistente({ modo: "consulta", servicio });
  };

  return (
    // Sin `relative`: el panel se posiciona respecto a la barra (<nav>) y queda
    // centrado en ella, dentro de la pantalla desde 768 px.
    <div ref={raizRef} onPointerEnter={alEntrar} onPointerLeave={alSalir}>
      <button
        ref={botonRef}
        type="button"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => {
          clearTimeout(timer.current);
          if (porHover.current) {
            porHover.current = false;
            setAbierto(true);
            return;
          }
          setAbierto((v) => !v);
        }}
        onKeyDown={onKeyBoton}
        className={cn(
          "relative inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors md:px-3 lg:px-4",
          activo || abierto ? "text-text" : "text-text-2 hover:text-text",
        )}
      >
        Servicios
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform duration-300", abierto && "rotate-180")}
          aria-hidden="true"
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent transition-opacity",
            activo ? "opacity-100" : "opacity-0",
          )}
        />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        hidden={!abierto}
        onKeyDown={onKeyPanel}
        className="menu-servicios glass-strong absolute left-1/2 top-[calc(100%+6px)] z-50 w-[min(760px,calc(100vw-48px))] -translate-x-1/2 rounded-[24px] p-3"
      >
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
          <ul className="m-0 grid list-none grid-cols-2 gap-1 p-0" aria-label="Servicios">
            {servicios.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  data-opcion=""
                  onClick={() => consultar(s.id)}
                  className="group/s flex h-full w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06]"
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line-strong bg-white/[0.04]">
                    <s.Icon className="h-[18px] w-[18px] text-accent-2" strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[14px] font-semibold leading-snug text-text">{s.title}</span>
                    <span className="text-[12.5px] leading-snug text-muted">{s.resumen}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-col justify-between gap-3 rounded-[18px] border border-accent/30 bg-accent/[0.07] p-4">
            <div className="flex flex-col gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent/40 bg-accent/[0.12]">
                <ShieldCheck className="h-[18px] w-[18px] text-accent-2" strokeWidth={1.6} aria-hidden="true" />
              </span>
              <p className="m-0 text-[14px] font-semibold text-text">{seguridad.title}</p>
              <p className="m-0 text-[12.5px] leading-relaxed text-text-2">{seguridad.resumen}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {/* Ancla dentro de la página; desde la 404 lleva al inicio. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/#seguridad"
                data-opcion=""
                onClick={() => cerrar()}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-1 text-[13px] font-medium text-text hover:text-accent-2"
              >
                Ver cómo funciona
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <button
                type="button"
                data-opcion=""
                onClick={() => consultar(seguridad.id)}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-accent/40 bg-accent/[0.12] px-4 text-[13px] font-semibold text-text transition-colors hover:bg-accent/[0.2]"
              >
                Consultar sobre seguridad
              </button>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-line px-3 pt-2.5">
          <p className="m-0 text-[12px] text-faint">Elige un servicio y el asistente te guía en tu consulta.</p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/#servicios"
            data-opcion=""
            onClick={() => cerrar()}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-1 text-[13px] font-medium text-text-2 hover:text-text"
          >
            Ver todo
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default MenuServicios;
