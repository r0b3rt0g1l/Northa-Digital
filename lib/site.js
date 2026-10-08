// Identidad, contacto y URLs de Northa Digital.
// Solo datos reales: nada de aquí se inventa.

export const site = {
  name: "Northa Digital",
  shortName: "Northa",
  tagline: "Diseño, sistemas y presencia digital",
  description:
    "Creamos portales, sistemas, sitios web, identidad visual y contenido digital para organizaciones que necesitan una presencia profesional y funcional.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://northa.digital",
  locale: "es_MX",
  location: "Sonora, México",
  founder: "Roberto Gil",

  contact: {
    email: "rgilh@hotmail.com",
    emailHref: "mailto:rgilh@hotmail.com",
    whatsappDisplay: "+52 662 386 6834",
    whatsappHref: "https://wa.me/526623866834",
  },
};

// Clave pública de Web3Forms para el bloque de contacto. Vacía hasta que se
// configure NEXT_PUBLIC_WEB3FORMS_KEY — el formulario renderiza igual y, sin
// clave, ofrece enviar el mismo mensaje por WhatsApp.
export const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY || "";
