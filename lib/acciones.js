// Puente entre bloques de la página: cualquier botón puede abrir el asistente
// en un modo concreto (consulta guiada, dudas o hablar con una persona) y con
// un servicio ya elegido.

export const EVENTO_ASISTENTE = "northa:asistente";

/**
 * Abre el asistente.
 * @param {{ modo?: "consulta" | "dudas" | "persona", servicio?: string, pregunta?: string } | string} [opciones]
 *   Un texto suelto se trata como una pregunta para el modo de dudas.
 */
export function abrirAsistente(opciones = {}) {
  const detail = typeof opciones === "string" ? { modo: "dudas", pregunta: opciones } : opciones;
  window.dispatchEvent(new CustomEvent(EVENTO_ASISTENTE, { detail }));
}

/** Desplaza a una sección respetando movimiento reducido. */
export function irASeccion(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}
