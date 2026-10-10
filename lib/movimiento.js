/**
 * Pausa de las animaciones continuas del sitio (WCAG 2.2.2): el cielo, la
 * señal del hero y el banner de servicios. La activa la persona con el botón
 * «Pausar animaciones» del pie y se recuerda en este navegador. El estado vive
 * en un atributo de <html> para que el CSS y el lienzo lo lean sin React.
 */
const ATRIBUTO = "data-movimiento-pausado";
const CLAVE = "northa-movimiento-pausado";
const EVENTO = "northa:movimiento";

export function movimientoPausado() {
  return typeof document !== "undefined" && document.documentElement.hasAttribute(ATRIBUTO);
}

export function fijarMovimientoPausado(pausado) {
  document.documentElement.toggleAttribute(ATRIBUTO, pausado);
  try {
    if (pausado) localStorage.setItem(CLAVE, "1");
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento (modo privado estricto): la pausa dura esta visita.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Aplica la pausa guardada en una visita anterior. */
export function restaurarMovimiento() {
  let guardada = false;
  try {
    guardada = localStorage.getItem(CLAVE) === "1";
  } catch {
    guardada = false;
  }
  if (guardada && !movimientoPausado()) fijarMovimientoPausado(true);
}

export function alCambiarMovimiento(fn) {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}
