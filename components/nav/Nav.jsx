"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { navSections, ctaPrincipal } from "@/lib/content/nav";

const SPY_IDS = ["inicio", ...navSections.map((s) => s.id)];

/**
 * Barra fija y minimalista en cápsula de vidrio. Al hacer scroll gana
 * contraste y blur (glass → glass-strong). Menú móvil accesible:
 * aria-expanded, cierre con Escape y al elegir un enlace.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const activeId = useScrollSpy(SPY_IDS);
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
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mq.addEventListener?.("change", onChange);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener?.("change", onChange);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4">
      <nav
        aria-label="Navegación principal"
        className={cn(
          "mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between gap-3 rounded-full pl-4 pr-2.5 transition-[background-color,box-shadow] duration-300 sm:pl-5",
          scrolled || open ? "glass-strong" : "glass",
        )}
      >
        <a
          href="#inicio"
          className="rounded-full"
          aria-label="Northa Digital — inicio"
        >
          <Logo />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {navSections.map((s) => {
            const isActive = activeId === s.id;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative inline-flex h-10 items-center rounded-full px-3.5 text-sm font-medium transition-colors",
                    isActive
                      ? "text-text"
                      : "text-text-2 hover:text-text",
                  )}
                >
                  {s.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-1/2 -bottom-0.5 h-1 w-1 -translate-x-1/2 rounded-full bg-accent transition-opacity",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                </a>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Button href={ctaPrincipal.href} size="sm" className="hidden sm:inline-flex">
            {ctaPrincipal.label}
          </Button>
          <Button href={ctaPrincipal.href} size="sm" className="sm:hidden" magnetic={false}>
            {ctaPrincipal.short}
          </Button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-line-strong bg-white/[0.04] text-text transition-colors hover:bg-white/[0.08] md:hidden"
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {open ? (
        <div
          id="menu-movil"
          className="glass-strong mx-auto mt-2 w-full max-w-[1200px] rounded-[24px] p-3 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {navSections.map((s, i) => (
              <li key={s.id}>
                <a
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={`#${s.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={activeId === s.id ? "true" : undefined}
                  className={cn(
                    "block rounded-2xl px-4 py-3.5 text-base font-medium transition-colors",
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
              <Button
                href={ctaPrincipal.href}
                className="w-full"
                magnetic={false}
                onClick={() => setOpen(false)}
              >
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
