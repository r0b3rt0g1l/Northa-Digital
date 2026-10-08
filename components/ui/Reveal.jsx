"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

// Un solo IntersectionObserver compartido por todos los Reveal de la página.
let observer = null;

function getObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
  );
  return observer;
}

/**
 * Revela su contenido (fade + 16 px + escala mínima) al entrar en viewport,
 * una sola vez. Sin librerías: clase CSS `.reveal` + `.is-in`.
 * - prefers-reduced-motion: estado final sin animación (ver globals.css).
 * - Sin JavaScript: `.no-js .reveal` muestra el contenido.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  style,
  children,
  ...props
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    const io = getObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", className)}
      style={delay ? { ...style, "--d": `${delay}ms` } : style}
      {...props}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
