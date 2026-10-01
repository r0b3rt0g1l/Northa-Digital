"use client";
import Link from "next/link";
import { navItems } from "./navItems";

export function Navbar() {
  return (
    <nav className="hidden items-stretch gap-5 lg:flex">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`relative inline-flex h-full items-center gap-1.5 whitespace-nowrap px-1 py-2 text-sm font-medium uppercase tracking-normal transition-colors duration-200`}
        >
          <span className="relative">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
