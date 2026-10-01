"use client";
// Réplica para pruebas: las 3 cadenas de clases son las del bundle publicado (1-oct-2026).
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./navItems";

function NavLink({ href, label, className }) {
  const pathname = usePathname();
  const activo = href === "/" ? pathname === "/" : pathname?.startsWith(href);
  return (
    <a
      href={href}
      className={cn(
        "relative inline-flex h-full items-center gap-1.5 whitespace-nowrap px-1 py-2 text-sm font-medium uppercase tracking-normal transition-colors duration-200",
        activo ? "text-[var(--color-guinda)]" : "text-[var(--color-text)] hover:text-[var(--color-guinda)]",
        className,
      )}
    >
      <span className="relative">{label}</span>
    </a>
  );
}

function EnlaceExterno({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "relative inline-flex h-full items-center gap-1.5 whitespace-nowrap px-1 py-2 text-sm font-medium uppercase tracking-normal transition-colors duration-200 outline-none focus-visible:rounded-md focus-visible:ring-2",
      )}
    >
      {label}
    </a>
  );
}

function ConSubmenu({ label }) {
  return (
    <button
      type="button"
      className={cn(
        "relative inline-flex h-full items-center gap-1 whitespace-nowrap px-1 py-2 text-sm font-medium uppercase tracking-normal transition-colors duration-200 outline-none focus-visible:rounded-md focus-visible:ring-2",
      )}
    >
      {label}
    </button>
  );
}

export function Navbar() {
  return (
    <nav className="hidden items-stretch gap-5 lg:flex">
      <ConSubmenu label="Gobierno" />
      <EnlaceExterno href="https://transparencia.sonora.gob.mx" label="Transparencia" />
      {navItems.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} />
      ))}
    </nav>
  );
}
