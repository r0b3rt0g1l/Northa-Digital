// Identidad, contacto y URLs de Northa Digital.
// Solo datos reales: nada de aquí se inventa.

// Contacto predeterminado de todo el sitio: WhatsApp y correo. El número se
// guarda una vez, en formato internacional solo con dígitos (52 + 10 dígitos),
// y de él sale el enlace de WhatsApp. El sitio no ofrece llamadas ni muestra
// el número escrito: solo el botón de WhatsApp (ver lib/whatsapp.js).
const TELEFONO = "6622055021";
const TELEFONO_INTERNACIONAL = `52${TELEFONO}`;
const CORREO = "northadigital@gmail.com";

const CONTACTO = {
  email: CORREO,
  emailHref: `mailto:${CORREO}`,
  whatsappNumber: TELEFONO_INTERNACIONAL,
  whatsappHref: `https://wa.me/${TELEFONO_INTERNACIONAL}`,
};

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

  contact: CONTACTO,
};

/** Mensaje prellenado de WhatsApp que pidió el cliente para todo el sitio. */
export const MENSAJE_WHATSAPP = "Hola, vi su página y me interesa un servicio digital.";

/**
 * Texto completo del mensaje de WhatsApp: el saludo del cliente (con el
 * nombre, si el visitante lo dio) y, si hay, el cuerpo.
 */
export function textoWhatsapp(texto = "", nombre = "") {
  const saludo = nombre ? `Hola, soy ${nombre}. Vi su página y me interesa un servicio digital.` : MENSAJE_WHATSAPP;
  return texto ? `${saludo}\n\n${texto}` : saludo;
}
