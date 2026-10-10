"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/Logo";
import { BotonWhatsapp } from "@/components/ui/BotonWhatsapp";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { navSections, ctaPrincipal } from "@/lib/content/nav";
import { servicios, seguridad } from "@/lib/content/servicios";
import { abrirAsistente } from "@/lib/acciones";
import { MenuServicios } from "./MenuServicios";

// Seguridad no marca ningún enlace (queda el último activo); la escena final
// lleva al contacto del pie.
const SPY_IDS = ["inicio", "servicios", "portafolio", "final", "contacto"];
const ALIAS = { final: "contacto" };

/**
 * Barra fija en cápsula de vidrio: marca, el menú de servicios, dos enlaces
 * y el CTA principal (con el ícono de WhatsApp), que abre el asistente en la
 * consulta guiada. Al hacer scroll gana contraste y blur. Menú móvil
 * accesible: «Servicios» se despliega dentro; se cierra con Escape
 * (devolviendo el foco al botón), al tocar fuera, al perder el foco, al
 * desplazarse y al elegir una opción.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [serviciosMovil, setServiciosMovil] = useState(false);
  const spy = useScrollSpy(SPY_IDS);
  const activeId = ALIAS[spy] ?? spy;
  const headerRef = useRef(null);
  const toggleRef = useRef(null);
  const firstLinkRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const startY = window.scrollY;
    const close = (returnFocus = false) => {
      setOpen(false);
      setServiciosMovil(false);
      if (returnFocus) toggleRef.current?.focus();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // el mismo Escape no cierra también el asistente
        close(true);
      }
    };
    const onPointer = (e) => {
      if (!headerRef.current?.contains(e.target)) close();
    };
    const onFocus = (e) => {
      if (!headerRef.current?.contains(e.target) && !e.target.closest?.("[data-asistente]")) close();
    };
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > 40) close();
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => mq.matches && close();

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener?.("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener?.("change", onMq);
    };
  }, [open]);

  const cerrarMenu = () => {
    setOpen(false);
    setServiciosMovil(false);
  };

  // Al abrir el asistente desde el menú móvil, el foco pasa antes al botón
  // del menú: al cerrar el asistente, vuelve ahí.
  const consultarMovil = (servicio) => {
    cerrarMenu();
    toggleRef.current?.focus();
    abrirAsistente({ modo: "consulta", servicio });
  };

  return (
    <header
      ref={headerRef}
      // Con un menú abierto, la barra queda por encima del asistente.
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 has-[[aria-expanded=true]]:z-[70] sm:px-6 sm:pt-4"
    >
      <nav
        aria-label="Navegación principal"
        className={cn(
          "mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between gap-3 rounded-full pl-4 pr-2 transition-[background-color,box-shadow] duration-300 sm:pl-5",
          scrolled || open ? "glass-strong" : "glass",
        )}
      >
        {/* Ancla dentro de la página; desde la 404 lleva al inicio. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/#inicio" className="inline-flex min-h-11 items-center rounded-full" aria-label="Northa Digital, inicio">
          <Logo />
        </a>

        <ul className="m-0 hidden list-none items-center gap-1 p-0 md:flex">
          <li>
            <MenuServicios activo={activeId === "servicios"} />
          </li>
          {navSections
            .filter((s) => s.id !== "servicios")
            .map((s) => {
              const isActive = activeId === s.id;
              return (
                <li key={s.id}>
                  <a
                    href={s.href}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "relative inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors md:px-3 lg:px-4",
                      isActive ? "text-text" : "text-text-2 hover:text-text",
                    )}
                  >
                    {s.label}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent transition-opacity",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </a>
                </li>
              );
            })}
        </ul>

        <div className="flex items-center gap-1.5">
          <BotonWhatsapp size="sm" className="hidden whitespace-nowrap pl-2.5 sm:inline-flex">
            {ctaPrincipal.label}
          </BotonWhatsapp>
          {/* Por debajo de 350 px solo queda el ícono, para que quepa el menú. */}
          <BotonWhatsapp size="sm" magnetic={false} className="pl-2 pr-4 max-[349px]:pr-2 sm:hidden">
            <span className="max-[349px]:sr-only">{ctaPrincipal.short}</span>
          </BotonWhatsapp>
          <button
            ref={toggleRef}
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-white/[0.04] text-text transition-colors hover:bg-white/[0.08] md:hidden"
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => (open ? cerrarMenu() : setOpen(true))}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div
          id="menu-movil"
          className="menu-movil glass-strong mx-auto mt-2 max-h-[calc(100svh-96px)] w-full max-w-[1200px] overflow-y-auto overscroll-contain rounded-[24px] p-3 md:hidden"
        >
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            <li>
              <button
                ref={firstLinkRef}
                type="button"
                aria-expanded={serviciosMovil}
                aria-controls="menu-movil-servicios"
                onClick={() => setServiciosMovil((v) => !v)}
                className={cn(
                  "flex min-h-[52px] w-full items-center justify-between rounded-2xl px-4 text-base font-medium transition-colors",
                  activeId === "servicios" || serviciosMovil
                    ? "bg-white/[0.06] text-text"
                    : "text-text-2 hover:bg-white/[0.05] hover:text-text",
                )}
              >
                Servicios
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-300", serviciosMovil && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
              <ul
                id="menu-movil-servicios"
                hidden={!serviciosMovil}
                className="m-0 mt-1 grid list-none grid-cols-1 gap-1 p-0 pl-2"
              >
                {servicios.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => consultarMovil(s.id)}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-text-2 hover:bg-white/[0.05] hover:text-text"
                    >
                      <s.Icon className="h-[18px] w-[18px] shrink-0 text-accent-2" strokeWidth={1.6} aria-hidden="true" />
                      {s.title}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => consultarMovil(seguridad.id)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent/[0.07] px-3 text-left text-[15px] text-text hover:bg-accent/[0.12]"
                  >
                    <ShieldCheck className="h-[18px] w-[18px] shrink-0 text-accent-2" strokeWidth={1.6} aria-hidden="true" />
                    {seguridad.title}
                  </button>
                </li>
                <li>
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a
                    href="/#servicios"
                    onClick={cerrarMenu}
                    className="flex min-h-12 items-center rounded-xl px-3 text-[14px] font-medium text-muted hover:text-text"
                  >
                    Ver la sección de servicios
                  </a>
                </li>
              </ul>
            </li>
            {navSections
              .filter((s) => s.id !== "servicios")
              .map((s) => (
                <li key={s.id}>
                  <a
                    href={s.href}
                    onClick={cerrarMenu}
                    aria-current={activeId === s.id ? "true" : undefined}
                    className={cn(
                      "flex min-h-[52px] items-center rounded-2xl px-4 text-base font-medium transition-colors",
                      activeId === s.id
                        ? "bg-white/[0.06] text-text"
                        : "text-text-2 hover:bg-white/[0.05] hover:text-text",
                    )}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            <li className="mt-2">
              <BotonWhatsapp className="w-full" magnetic={false} onAbrir={cerrarMenu}>
                {ctaPrincipal.label}
              </BotonWhatsapp>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}

export default Nav;
