"use client";

import { useEffect, useRef } from "react";
import { LayoutDashboard, Laptop, ShieldCheck } from "lucide-react";

/**
 * Esquema conceptual de acceso protegido: el equipo llega al panel solo a
 * través de una conexión verificada. Es una ilustración, no una interfaz: no
 * tiene campos, botones de acceso, logotipos de terceros ni pantallas de
 * verificación. Al entrar en pantalla, la luz recorre el camino tres veces y
 * queda en reposo; vuelve a recorrerlo al pasar el puntero o enfocar la
 * sección. Con movimiento reducido se muestra quieta.
 */
export function IlustracionAcceso() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let fuera = true;
    const reproducir = () => {
      // No se reinicia a mitad de un recorrido.
      if ((el.getAnimations?.({ subtree: true }) ?? []).some((a) => a.animationName && a.playState === "running")) return;
      el.classList.remove("is-activa");
      void el.offsetWidth; // reinicia la animación
      el.classList.add("is-activa");
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.35 && fuera) {
          fuera = false;
          reproducir();
        } else if (!e.isIntersecting) {
          fuera = true;
        }
      },
      { threshold: [0, 0.35] },
    );
    io.observe(el);
    const seccion = el.closest("section");
    seccion?.addEventListener("pointerenter", reproducir);
    seccion?.addEventListener("focusin", reproducir);
    return () => {
      io.disconnect();
      seccion?.removeEventListener("pointerenter", reproducir);
      seccion?.removeEventListener("focusin", reproducir);
    };
  }, []);

  return (
    <figure
      ref={ref}
      className="acceso card relative m-0 overflow-hidden rounded-[24px] p-5 sm:p-8"
      aria-label="Esquema ilustrativo: el equipo llega al panel de administración solo a través de una conexión protegida y verificada."
      role="img"
    >
      <span className="absolute left-5 top-4 font-mono text-[11px] tracking-[0.08em] text-faint sm:left-8 sm:top-6">
        Esquema ilustrativo
      </span>
      <div className="acceso-escena" aria-hidden="true">
        <svg className="acceso-lineas" viewBox="0 0 600 160" preserveAspectRatio="none">
          <path className="acceso-via" d="M70 80 H530" />
          <path className="acceso-luz" d="M70 80 H530" pathLength="100" />
        </svg>

        <div className="acceso-nodo">
          <span className="acceso-icono">
            <Laptop className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="acceso-etiqueta">Equipo</span>
        </div>

        <div className="acceso-nodo acceso-nodo--centro">
          <span className="acceso-anillo" />
          <span className="acceso-anillo acceso-anillo--2" />
          <span className="acceso-icono acceso-icono--escudo">
            <ShieldCheck className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <span className="acceso-etiqueta">Acceso verificado</span>
        </div>

        <div className="acceso-nodo">
          <span className="acceso-icono acceso-icono--panel">
            <LayoutDashboard className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="acceso-etiqueta">Panel de administración</span>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2" aria-hidden="true">
        {["VPN", "Zero Trust", "Acceso por persona"].map((t) => (
          <span
            key={t}
            className="rounded-full border border-line-strong bg-white/[0.03] px-3 py-1 font-mono text-[11.5px] tracking-[0.04em] text-text-2"
          >
            {t}
          </span>
        ))}
      </div>
    </figure>
  );
}

export default IlustracionAcceso;
