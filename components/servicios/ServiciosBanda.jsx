"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { StarIcon } from "@/components/ui/StarIcon";
import { servicios } from "@/lib/content/servicios";

function Secuencia() {
  return (
    <div className="banda-secuencia">
      {servicios.map((s) => (
        <span key={s.id} className="banda-item">
          <span className="banda-texto">{s.title}</span>
          <StarIcon className="banda-estrella" />
        </span>
      ))}
    </div>
  );
}

/**
 * La barra de servicios: una franja recta a todo el ancho con los nombres en
 * grande que corre sin fin. El movimiento es una animación CSS, sin trabajo
 * en JavaScript en reposo. Al hacer scroll se acelera un poco según la
 * velocidad, sigue la dirección y vuelve sola a su ritmo. Se pausa fuera de
 * pantalla y tiene un botón de pausa. La franja es decorativa: la lista real
 * está en las tarjetas.
 */
export function ServiciosBanda() {
  const ref = useRef(null);
  const [detenida, setDetenida] = useState(false);
  const detenidaRef = useRef(false);

  useEffect(() => {
    detenidaRef.current = detenida;
  }, [detenida]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const animaciones = () => Array.from(root.querySelectorAll(".banda-pista")).flatMap((p) => p.getAnimations());

    let visible = false;
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        root.classList.toggle("is-paused", !visible);
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(root);

    let ritmo = 1;
    let sentido = 1;
    let rafId = null;
    let previo = 0;
    let ultimoY = window.scrollY;
    let ultimoT = performance.now();

    const aplicar = () => {
      for (const a of animaciones()) a.playbackRate = ritmo * sentido;
    };
    // Vuelve al ritmo base en menos de un segundo y se detiene.
    const calmar = (t) => {
      const dt = previo ? Math.min(t - previo, 64) : 16;
      previo = t;
      ritmo += (1 - ritmo) * (1 - Math.exp(-dt / 260));
      if (Math.abs(ritmo - 1) < 0.03) {
        ritmo = 1;
        aplicar();
        rafId = null;
        previo = 0;
        return;
      }
      aplicar();
      rafId = requestAnimationFrame(calmar);
    };

    const onScroll = () => {
      const y = window.scrollY;
      const t = performance.now();
      const dy = y - ultimoY;
      const dt = Math.max(16, t - ultimoT);
      ultimoY = y;
      ultimoT = t;
      if (!visible || !dy || detenidaRef.current) return;
      sentido = dy > 0 ? 1 : -1;
      ritmo = Math.min(3, Math.max(ritmo, 1 + Math.abs(dy / dt) * 1.4));
      aplicar();
      if (rafId == null) rafId = requestAnimationFrame(calmar);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div ref={ref} aria-hidden="true" className={detenida ? "banda is-detenida" : "banda"}>
        <div className="banda-pista">
          <Secuencia />
          <Secuencia />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1200px] justify-end px-5 sm:px-8">
        <button
          type="button"
          onClick={() => setDetenida((d) => !d)}
          aria-label={detenida ? "Reanudar el movimiento de la barra de servicios" : "Pausar el movimiento de la barra de servicios"}
          className="banda-control"
        >
          {detenida ? (
            <Play className="h-3.5 w-3.5 translate-x-px" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Pause className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

export default ServiciosBanda;
