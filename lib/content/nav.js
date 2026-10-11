// Navegación corta. Los enlaces llevan "/" delante para que también funcionen
// desde la página 404. "Servicios" se muestra como menú desplegable con los
// servicios reales; su enlace lleva a la sección "Lo que construimos".
export const navSections = [
  { id: "servicios", label: "Servicios", href: "/#servicios" },
  { id: "portafolio", label: "Portafolio", href: "/#portafolio" },
  { id: "contacto", label: "Contacto", href: "/#contacto" },
];

// CTA principal de la barra: abre WhatsApp directo en el chat con Northa
// (ver lib/whatsapp.js). El asistente se abre con su propio botón.
export const ctaPrincipal = {
  label: "Cuéntanos tu proyecto",
  short: "Cuéntanos",
};
