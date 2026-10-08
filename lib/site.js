// Identidad, contacto y URLs de Northa Digital.
// Solo datos reales: nada de aquí se inventa.

export const site = {
  name: "Northa Digital",
  shortName: "Northa",
  tagline: "Diseño, sistemas y presencia digital",
  description:
    "Creamos portales, sistemas, sitios web, identidad visual y contenido digital para organizaciones que necesitan una presencia profesional y funcional.",
  // Dirección principal: la URL de producción en Vercel. Se puede sobrescribir
  // con NEXT_PUBLIC_SITE_URL cuando exista un dominio propio.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://northa-landing.vercel.app",
  locale: "es_MX",
  founder: "Roberto Gil",

  contact: {
    email: "rgilh@hotmail.com",
    emailHref: "mailto:rgilh@hotmail.com",
    whatsappDisplay: "+52 662 386 6834",
    whatsappNumber: "526623866834",
    whatsappHref: "https://wa.me/526623866834",
  },
};

// Clave pública de Web3Forms. Se incrusta al compilar: configúrala en Vercel
// (Production y Preview) y vuelve a desplegar. Sin clave, el formulario envía
// por WhatsApp; con clave, envía por Web3Forms y WhatsApp queda como segunda vía.
export const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY || "";

/** Enlace de WhatsApp con un mensaje precargado. */
export function whatsappConTexto(texto = "") {
  const base = "Hola, les escribo desde su sitio web.";
  const cuerpo = texto ? `${base}\n\n${texto}` : base;
  return `${site.contact.whatsappHref}?text=${encodeURIComponent(cuerpo)}`;
}
