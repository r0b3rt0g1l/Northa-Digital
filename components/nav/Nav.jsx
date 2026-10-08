"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { navSections, ctaPrincipal } from "@/lib/content/nav";

// "empezar" es el cierre: también responde a "¿cómo contactar?".
const SPY_IDS = ["inicio", "servicios", "contacto", "portafolio", "empezar"];
const ALIAS = { empezar: "contacto" };

/**
 * Barra fija en cápsula de vidrio: marca, tres enlaces y el CTA principal.
 * Al hacer scroll gana contraste y blur. Menú móvil accesible: se cierra con
 * Escape (devolviendo el foco al botón), al tocar fuera, al perder el foco,
 * al desplazarse y al elegir un enlace.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
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
      if (returnFocus) toggleRef.current?.focus();
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e) => {
      if (!headerRef.current?.contains(e.target)) close();
    };
    const onFocus = (e) => {
      if (!headerRef.current?.contains(e.target)) close();
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

  return (
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
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
          {navSections.map((s) => {
            const isActive = activeId === s.id;
            return (
              <li key={s.id}>
                <a
                  href={s.href}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors",
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
          <Button href={ctaPrincipal.href} size="sm" className="hidden sm:inline-flex">
            {ctaPrincipal.label}
          </Button>
          <Button href={ctaPrincipal.href} size="sm" magnetic={false} className="px-4 sm:hidden">
            {ctaPrincipal.short}
          </Button>
          <button
            ref={toggleRef}
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-white/[0.04] text-text transition-colors hover:bg-white/[0.08] md:hidden"
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div id="menu-movil" className="glass-strong mx-auto mt-2 w-full max-w-[1200px] rounded-[24px] p-3 md:hidden">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {navSections.map((s, i) => (
              <li key={s.id}>
                <a
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={s.href}
                  onClick={() => setOpen(false)}
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
              <Button href={ctaPrincipal.href} className="w-full" magnetic={false} onClick={() => setOpen(false)}>
                {ctaPrincipal.label}
              </Button>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}

export default Nav;
