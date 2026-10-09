// Navegación corta. Los enlaces llevan "/" delante para que también funcionen
// desde la página 404. "Servicios" se muestra como menú desplegable con los
// servicios reales; su enlace lleva a la sección "Lo que construimos".
export const navSections = [
  { id: "servicios", label: "Servicios", href: "/#servicios" },
  { id: "portafolio", label: "Portafolio", href: "/#portafolio" },
  { id: "contacto", label: "Contacto", href: "/#contacto" },
];

// CTA principal de la barra: abre el asistente en la consulta guiada.
export const ctaPrincipal = {
  label: "Cuéntanos tu proyecto",
  short: "Cuéntanos",
};
