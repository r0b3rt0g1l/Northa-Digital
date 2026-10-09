// Portafolio: los portales municipales publicados. El proyecto con
// `destacado: true` se muestra en la portada: su captura y todos sus enlaces.
//
// Cada proyecto: { slug, destacado, title, description,
//   imagen?: { src, alt, width, height, enlace, credito },
//   enlaces?: [{ nombre, url }]  (solo URLs reales y verificadas) }
// Un nombre largo puede llevar un guion blando (\u00AD) para partirse bien
// en pantallas estrechas; no se ve ni lo leen los lectores de pantalla.

export const proyectos = [
  {
    slug: "portales-municipales",
    destacado: true,
    title: "Portales municipales",
    description:
      "Plataformas digitales para presentar información pública, turismo, servicios, transparencia y contenido institucional de forma clara, accesible y organizada.",
    imagen: {
      src: "/portafolio/portal-mazatan.webp",
      width: 2400,
      height: 973,
      alt: "Página de inicio del portal del Municipio de Mazatán: menú institucional, fotografía del monumento local y datos de población y superficie.",
      enlace: { nombre: "Mazatán", url: "https://mazatantransparencia.com.mx" },
      // El escudo que aparece en la captura es de terceros y requiere atribución.
      credito: {
        texto: "Escudo municipal: Sonorense434, CC BY-SA 4.0.",
        url: "https://mazatantransparencia.com.mx/creditos",
      },
    },
    enlaces: [
      { nombre: "Aconchi", url: "https://www.aconchitransparencia.com.mx" },
      { nombre: "Bacadé\u00ADhuachi", url: "https://bacadehuachitransparencia.com.mx" },
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
      { nombre: "Villa Pesqueira", url: "https://villapesqueiratransparencia.com.mx" },
    ],
  },
];

export const proyectoDestacado =
  proyectos.find((p) => p.destacado) ?? proyectos[0];

