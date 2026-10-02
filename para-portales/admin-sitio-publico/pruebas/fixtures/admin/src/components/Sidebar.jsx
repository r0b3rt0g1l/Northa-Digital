"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/lib/actions";
import { Icon } from "@/components/icons";
import CommandPalette from "@/components/CommandPalette";
import { DASHBOARD, SECTIONS } from "@/lib/nav";

function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function initialsOf(usuario) {
  const base = usuario?.nombre || usuario?.email || "U";
  return base
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function NavItem({ href, label, icon, active, onNavigate }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-white/[0.06] text-white font-medium"
          : "text-white/70 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[#B5732E]" />
      )}
      <Icon
        name={icon}
        size={18}
        className={active ? "text-[#C98A4E]" : "text-white/55 group-hover:text-white/90"}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarNav({ pathname, onNavigate }) {
  return (
    <nav className="flex flex-col gap-0.5">
      <NavItem {...DASHBOARD} active={isActive(pathname, DASHBOARD.href)} onNavigate={onNavigate} />
      {SECTIONS.map((section) => (
        <div key={section.header}>
          <p className="px-3 mt-5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {section.header}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                active={isActive(pathname, item.href)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function Sidebar({ usuario }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {/* Botón hamburguesa (solo móvil) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-30 p-2 rounded-lg glass-dark text-white"
        aria-label="Abrir menú"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Panel flotante en desktop; cajón deslizante en móvil */}
      <aside
        className={`glass-dark z-40 flex flex-col text-white overflow-hidden transform transition-transform
          fixed inset-y-0 left-0 w-64
          md:sticky md:inset-y-auto md:top-3 md:self-start md:m-3 md:h-[calc(100dvh-1.5rem)] md:w-64 md:rounded-2xl
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="px-5 py-5 flex items-center justify-between shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            {usuario?.municipioEscudoUrl ? (
              <img
                src={usuario.municipioEscudoUrl}
                alt={usuario?.municipioNombre || "Escudo del municipio"}
                className="h-7 w-7 shrink-0 object-contain"
              />
            ) : null}
            <span className="truncate text-base font-semibold tracking-tight">CMS Municipal</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
              className="hidden md:inline-flex items-center text-[10px] font-medium text-white/50 border border-white/15 rounded px-1.5 py-0.5 hover:text-white/80 hover:border-white/25 transition-colors"
              aria-label="Buscar (Comando K)"
            >
              ⌘K
            </button>
            <button
              type="button"
              onClick={close}
              className="md:hidden text-white/70 hover:text-white"
              aria-label="Cerrar menú"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-dark px-3 pb-4">
          <SidebarNav pathname={pathname} onNavigate={close} />
        </div>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold shrink-0">
              {initialsOf(usuario) || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {usuario?.nombre || usuario?.email || "Usuario"}
              </p>
              <p className="text-xs text-white/50 truncate">
                {usuario?.municipioNombre || usuario?.municipioSlug || ""}
              </p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Icon name="logout" size={16} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <CommandPalette />
    </>
  );
}
