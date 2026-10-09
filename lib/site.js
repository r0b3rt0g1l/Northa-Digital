// Identidad, contacto y URLs de Northa Digital.
// Solo datos reales: nada de aquí se inventa.

// Contacto predeterminado de todo el sitio. El número se guarda una vez, en
// formato internacional solo con dígitos (52 + 10 dígitos), y de ahí salen el
// enlace de WhatsApp, el de llamada y la forma legible.
const TELEFONO = "6622055021";
const TELEFONO_INTERNACIONAL = `52${TELEFONO}`;
const CORREO = "northadigital@gmail.com";

const CONTACTO = {
  email: CORREO,
  emailHref: `mailto:${CORREO}`,
  phone: TELEFONO,
  phoneDisplay: `${TELEFONO.slice(0, 3)} ${TELEFONO.slice(3, 6)} ${TELEFONO.slice(6)}`,
  phoneHref: `tel:+${TELEFONO_INTERNACIONAL}`,
  phoneInternational: `+52 ${TELEFONO.slice(0, 3)} ${TELEFONO.slice(3, 6)} ${TELEFONO.slice(6)}`,
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

/** Texto completo del mensaje de WhatsApp: saludo y, si hay, el cuerpo. */
export function textoWhatsapp(texto = "") {
  const saludo = "Hola, les escribo desde el sitio de Northa Digital.";
  return texto ? `${saludo}\n\n${texto}` : saludo;
}

/** Enlace de WhatsApp con un mensaje precargado, codificado para URL. */
export function whatsappConTexto(texto = "") {
  return `${site.contact.whatsappHref}?text=${encodeURIComponent(textoWhatsapp(texto))}`;
}
