"use client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, label, className }) {
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

export function EnlaceExterno({ href, label }) {
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

