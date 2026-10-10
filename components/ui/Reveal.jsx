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
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  return observer;
}

/**
 * Revela su contenido (fade + 16 px + escala mínima) al entrar en pantalla,
 * una sola vez. El contenido sale visible del servidor: solo se "arma"
 * (se oculta) si al montar está por debajo del pliegue. Así no retrasa la
 * primera pintura, funciona sin JavaScript y respeta prefers-reduced-motion.
 *
 * Es un envoltorio: no combines aquí clases con transform propio (hover de
 * tarjetas); ponlas en un hijo.
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { top } = el.getBoundingClientRect();
    if (top < window.innerHeight * 0.92) return; // ya visible: no se toca
    el.classList.add("reveal-armed");
    const io = getObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn(className)}
      style={delay ? { ...style, "--d": `${delay}ms` } : style}
      {...props}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
