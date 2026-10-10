"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { servicios, seguridad } from "@/lib/content/servicios";
import { abrirAsistente } from "@/lib/acciones";
import { alCambiarMovimiento } from "@/lib/movimiento";
import { useMovimientoPausado } from "@/hooks/useMovimientoPausado";

const piezas = [...servicios, seguridad];
// Copias de la fila para que el recorrido no tenga huecos ni en pantallas muy
// anchas: la pista avanza exactamente una copia y vuelve a empezar.
const COPIAS = 4;

/**
 * Banner de servicios en movimiento: los servicios avanzan siempre hacia la
 * derecha en un bucle continuo, sin cortes, y mientras avanzan dan un brinco
 * lento y rítmico, uno tras otro, como conejos. La velocidad deja leerlos con
 * calma. Vive en su propia franja de vidrio, a todo el ancho, así que no tapa
 * textos ni otros botones. Solo usa transform, translate y scale: fluido en
 * Windows, macOS, Android e iOS.
 *
 * Accesibilidad (WCAG 2.2.2): botón de pausa siempre visible, y la banda se
 * detiene al pasar el puntero, al tocarla, fuera de pantalla y al enfocar un
 * botón con teclado (la pista vuelve al inicio para que el foco se vea). Las
 * copias de relleno responden al clic y al toque (son las que se ven casi
 * siempre), pero no se leen ni entran en el orden del teclado; al pulsarlas,
 * el foco pasa al botón real, que es al que vuelve al cerrar el asistente.
 * «Pausar animaciones» también la detiene; su propio botón la pone en marcha
 * de nuevo solo a ella, sin tocar la pausa del resto del sitio. Con movimiento reducido, la banda queda quieta, centrada y en
 * varias filas, sin brinco ni pausa. En móvil va más lenta y con botones más
 * pequeños. Cada botón abre el asistente con ese servicio.
 */
export function BarraServicios() {
  const [pausadaAqui, setPausada] = useState(false);
  // En marcha solo aquí aunque el resto del sitio esté en pausa.
  const [forzada, setForzada] = useState(false);
  const pausaGlobal = useMovimientoPausado();
  const pausada = pausaGlobal ? !forzada : pausadaAqui;
  const [tocada, setTocada] = useState(false);
  const [fuera, setFuera] = useState(false);
  const timer = useRef(null);
  const raiz = useRef(null);

  // Fuera de pantalla, la banda se detiene: no gasta cuadros que nadie ve.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setFuera(!e.isIntersecting));
    if (raiz.current) io.observe(raiz.current);
    // Cada vez que cambia la pausa global, la banda vuelve a seguirla.
    const quitar = alCambiarMovimiento(() => setForzada(false));
    return () => {
      io.disconnect();
      quitar();
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

  // Un toque en la ventana detiene la banda unos segundos para poder elegir
  // con calma (el botón de pausa queda fuera, así «Reanudar» reanuda ya).
  const alTocar = (e) => {
    if (e.pointerType === "mouse") return;
    setTocada(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTocada(false), 3500);
  };

  return (
    <div
      ref={raiz}
      className={cn("banda glass", (pausada || tocada) && "is-pausada", fuera && "is-fuera")}
    >
      <div className="banda-ventana" onFocus={alEnfocar} onBlur={alSalir} onPointerDown={alTocar}>
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
                    onClick={() => {
                      // Desde una copia, el foco pasa al botón real: el
                      // asistente vuelve a él al cerrarse, no a uno oculto.
                      if (copia > 0) raiz.current?.querySelectorAll(".banda-grupo:first-child .banda-pieza")[i]?.focus({ preventScroll: true });
                      abrirAsistente({ modo: "consulta", servicio: s.id });
                    }}
                    className={cn("banda-pieza glass glass-interior", s.id === seguridad.id && "banda-pieza--seguridad")}
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
        onClick={() => {
          clearTimeout(timer.current);
          setTocada(false);
          if (pausaGlobal) setForzada((v) => !v);
          else setPausada((v) => !v);
        }}
        aria-label={pausada ? "Reanudar el movimiento de los servicios" : "Pausar el movimiento de los servicios"}
      >
        {pausada ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

export default BarraServicios;
