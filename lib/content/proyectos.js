// Portafolio. Hoy hay un solo proyecto real; la estructura admite más sin
// aparentar que ya existen: el primero con `destacado: true` se muestra como
// caso principal y el resto, si lo hay, en una cuadrícula secundaria.
//
// Cada proyecto: { slug, destacado, etiqueta, title, description, tags,
//                  enlaces: [{ nombre, url }] (opcional, solo URLs reales) }

export const proyectos = [
  {
    slug: "portales-municipales",
    destacado: true,
    etiqueta: "Proyecto destacado",
    title: "Portales municipales",
    description:
      "Plataformas para comunicar información pública, turismo, servicios, transparencia y contenido institucional de manera clara y accesible, con un panel para que cada equipo publique por su cuenta.",
    tags: ["Información pública", "Transparencia", "Turismo", "Servicios", "Noticias"],
    // Portales en línea. Dominios reales; solo nombres, sin escudos ni cifras.
    enlaces: [
      { nombre: "Aconchi", url: "https://www.aconchitransparencia.com.mx" },
      { nombre: "Bacadéhuachi", url: "https://bacadehuachitransparencia.com.mx" },
      { nombre: "Bacanora", url: "https://bacanoratransparencia.com.mx" },
      { nombre: "Banámichi", url: "https://www.banamichitransparencia.com.mx" },
      { nombre: "Baviácora", url: "https://baviacoratransparencia.com.mx" },
      { nombre: "Carbó", url: "https://carbotransparencia.com.mx" },
      { nombre: "Cucurpe", url: "https://cucurpetransparencia.com.mx" },
      { nombre: "Huachinera", url: "https://www.huachineratransparencia.com.mx" },
      { nombre: "Mazatán", url: "https://mazatantransparencia.com.mx" },
      { nombre: "Rayón", url: "https://www.rayontransparencia.com.mx" },
      { nombre: "Sahuaripa", url: "https://sahuaripatransparencia.com.mx" },
      { nombre: "San Javier", url: "https://sanjaviertransparencia.com.mx" },
      { nombre: "Soyopa", url: "https://www.soyopatransparencia.com.mx" },
      { nombre: "Tepache", url: "https://www.tepachetransparencia.com.mx" },
    ],
  },
];

export const proyectoDestacado =
  proyectos.find((p) => p.destacado) ?? proyectos[0];

export const proyectosSecundarios = proyectos.filter(
  (p) => p !== proyectoDestacado,
);
