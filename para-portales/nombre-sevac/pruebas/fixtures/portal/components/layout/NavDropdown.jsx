"use client";
import { cn } from "@/lib/utils";

export function NavDropdown({ label }) {
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

