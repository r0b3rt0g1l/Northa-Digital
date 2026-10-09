"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { servicios, seguridad } from "@/lib/content/servicios";
import { abrirAsistente } from "@/lib/acciones";

const piezas = [...servicios, seguridad];

/**
 * Barra de servicios compacta. Al entrar en pantalla, las piezas aparecen y
 * dan dos pequeños saltos, una tras otra, dentro de la barra (menos de cinco
 * segundos en total); luego descansan. Se repite al volver a la barra o al
 * pasar el puntero por encima. No depende del scroll ni del cursor para
 * moverse, y no necesita botón de pausa porque se detiene sola. Solo usa
 * transform y opacity: se ve igual en Windows, macOS, Android e iOS.
 * Con movimiento reducido o sin JavaScript, la barra está quieta.
 * Cada pieza abre el asistente con ese servicio elegido.
 */
export function BarraServicios() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let primera = true;
    let fuera = true;
    // Mientras una secuencia sigue en curso no se reinicia.
    const enCurso = () =>
      (el.getAnimations?.({ subtree: true }) ?? []).some((a) => a.animationName && a.playState === "running");
    const saltar = () => {
      if (enCurso()) return;
      el.classList.remove("is-entrando", "is-saltando");
      void el.offsetWidth; // reinicia la animación
      if (primera) {
        primera = false;
        el.classList.add("is-entrando");
      } else {
        el.classList.remove("is-armada");
        el.classList.add("is-saltando");
      }
    };

    // Solo se oculta para la entrada si está bajo el pliegue.
    if (el.getBoundingClientRect().top > window.innerHeight * 0.9) el.classList.add("is-armada");
    else primera = false;

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.5 && fuera) {
          fuera = false;
          saltar();
        } else if (!e.isIntersecting) {
          fuera = true;
        }
      },
      { threshold: [0, 0.5] },
    );
    io.observe(el);
    const alPasar = (e) => e.pointerType === "mouse" && saltar();
    el.addEventListener("pointerenter", alPasar);
    return () => {
      io.disconnect();
      el.removeEventListener("pointerenter", alPasar);
    };
  }, []);

  return (
    <div ref={ref} className="barra">
      <ul className="barra-lista" aria-label="Servicios de Northa Digital">
        {piezas.map((s, i) => (
          <li key={s.id} style={{ "--i": i }}>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => abrirAsistente({ modo: "consulta", servicio: s.id })}
              className={cn("barra-pieza", s.id === seguridad.id && "barra-pieza--seguridad")}
            >
              <s.Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
              {s.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default BarraServicios;
