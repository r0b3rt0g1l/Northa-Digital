// Navegación corta: solo las secciones que existen en la página.
export const navSections = [
  { id: "servicios", label: "Servicios" },
  { id: "portafolio", label: "Portafolio" },
  { id: "contacto", label: "Contacto" },
];

export const navSectionIds = navSections.map((s) => s.id);

// CTA principal, compartido por navbar, hero y cierre.
export const ctaPrincipal = {
  label: "Cuéntanos tu proyecto",
  short: "Hablemos",
  href: "#contacto",
};
