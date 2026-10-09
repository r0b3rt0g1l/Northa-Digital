"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { servicios, seguridad } from "@/lib/content/servicios";
import { abrirAsistente } from "@/lib/acciones";

const piezas = [...servicios, seguridad];
// Copias de la fila para que el recorrido no tenga huecos ni en pantallas muy
// anchas: la pista avanza exactamente una copia y vuelve a empezar.
const COPIAS = 4;

/**
 * Banda de servicios en movimiento: los botones recorren la pantalla de lado
 * a lado en un ciclo continuo y, además, rebotan uno tras otro, como una ola.
 * Vive en su propia franja, a todo el ancho, así que no tapa textos ni otros
 * botones. Solo usa transform y translate: fluido en Windows, macOS, Android
 * e iOS.
 *
 * Accesibilidad (WCAG 2.2.2): botón de pausa siempre visible, y la banda se
 * detiene al pasar el puntero, al enfocar un botón, al tocarla y fuera de
 * pantalla. Con teclado, la pista vuelve al inicio para que el foco se vea. Las copias
 * de relleno responden al clic y al toque (son las que se ven casi siempre),
 * pero no se leen ni entran en el orden del teclado. Con movimiento reducido, la banda
 * queda quieta y centrada, sin rebote ni pausa. En móvil va más lenta y con
 * botones más pequeños. Cada botón abre el asistente con ese servicio.
 */
export function BarraServicios() {
  const [pausada, setPausada] = useState(false);
  const [tocada, setTocada] = useState(false);
  const [fuera, setFuera] = useState(false);
  const timer = useRef(null);
  const raiz = useRef(null);

  // Fuera de pantalla, la banda se detiene: no gasta cuadros que nadie ve.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setFuera(!e.isIntersecting));
    if (raiz.current) io.observe(raiz.current);
    return () => {
      io.disconnect();
      clearTimeout(timer.current);
    };
  }, []);

  // Con teclado, la pista vuelve al inicio (CSS) y el botón enfocado entra en
  // la ventana si no cabe; al salir, la ventana vuelve a su sitio.
  const alEnfocar = (e) => {
    if (e.target.matches?.(":focus-visible")) e.target.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const alSalir = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.scrollLeft = 0;
  };

  // Un toque detiene la banda unos segundos para poder elegir con calma.
  const alTocar = (e) => {
    if (e.pointerType === "mouse") return;
    setTocada(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTocada(false), 3500);
  };

  return (
    <div
      ref={raiz}
      className={cn("banda", (pausada || tocada) && "is-pausada", fuera && "is-fuera")}
      onPointerDown={alTocar}
    >
      <div className="banda-ventana" onFocus={alEnfocar} onBlur={alSalir}>
        <div className="banda-pista">
          {Array.from({ length: COPIAS }, (_, copia) => (
            <ul
              key={copia}
              className="banda-grupo"
              aria-label={copia === 0 ? "Servicios de Northa Digital" : undefined}
              aria-hidden={copia > 0 || undefined}
            >
              {piezas.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    tabIndex={copia > 0 ? -1 : undefined}
                    onClick={() => abrirAsistente({ modo: "consulta", servicio: s.id })}
                    className={cn("banda-pieza", s.id === seguridad.id && "banda-pieza--seguridad")}
                    style={{ "--i": i }}
                  >
                    <s.Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="banda-pausa"
        onClick={() => setPausada((v) => !v)}
        aria-label={pausada ? "Reanudar el movimiento de los servicios" : "Pausar el movimiento de los servicios"}
      >
        {pausada ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

export default BarraServicios;
