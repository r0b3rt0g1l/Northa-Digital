// Puente entre bloques de la página: el asistente puede llevar al formulario
// con un mensaje precargado, y cualquier botón puede abrir el asistente.

export const EVENTO_ASISTENTE = "northa:asistente";
export const EVENTO_MENSAJE = "northa:mensaje";

/** Abre el asistente. `pregunta` opcional: la envía como primer mensaje. */
export function abrirAsistente(pregunta) {
  window.dispatchEvent(new CustomEvent(EVENTO_ASISTENTE, { detail: { pregunta } }));
}

/** Lleva al bloque de 30 segundos y, si hay texto, lo precarga. */
export function irAlFormulario(texto = "") {
  window.dispatchEvent(new CustomEvent(EVENTO_MENSAJE, { detail: { texto } }));
}

/** Desplaza a una sección respetando movimiento reducido. */
export function irASeccion(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

/** Ejecuta `fn` cuando termina el desplazamiento (o tras un tiempo máximo). */
export function alTerminarScroll(fn, maximo = 900) {
  let hecho = false;
  const una = () => {
    if (hecho) return;
    hecho = true;
    window.removeEventListener("scrollend", una);
    fn();
  };
  window.addEventListener("scrollend", una, { once: true });
  setTimeout(una, maximo);
}
