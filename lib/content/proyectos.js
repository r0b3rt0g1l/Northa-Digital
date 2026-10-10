// Portafolio: los portales municipales publicados. El proyecto con
// `destacado: true` se muestra en la portada con todos sus enlaces.
//
// Cada proyecto: { slug, destacado, title, description,
//   enlaces?: [{ nombre, url, color }]  (solo URLs reales y verificadas) }
// La página de inicio de cada portal se captura con
// scripts/capturar-portales.mjs (índice en lib/content/capturas.json).
// `color` es el color institucional de cada municipio: el tono dominante del
// escudo o logotipo que usa su propio portal (provisional en varios casos),
// tal como aparece en su imagen para redes (en San Javier, el dorado de su
// logotipo). Se usa en el diseño de respaldo del portafolio cuando todavía
// no hay captura del portal.
// Un nombre largo puede llevar un guion blando (\u00AD) para partirse bien
// en pantallas estrechas; no se ve ni lo leen los lectores de pantalla.

export const proyectos = [
  {
    slug: "portales-municipales",
    destacado: true,
    title: "Portales municipales",
    description:
      "Plataformas para presentar información pública, turismo, servicios y contenido institucional de forma clara y ordenada.",
    enlaces: [
      { nombre: "Aconchi", url: "https://www.aconchitransparencia.com.mx", color: "#873b51" },
      { nombre: "Bacadé\u00ADhuachi", url: "https://bacadehuachitransparencia.com.mx", color: "#e13638" },
      { nombre: "Bacanora", url: "https://bacanoratransparencia.com.mx", color: "#af2800" },
      { nombre: "Banámichi", url: "https://www.banamichitransparencia.com.mx", color: "#846b23" },
      { nombre: "Baviácora", url: "https://baviacoratransparencia.com.mx", color: "#9d2538" },
      { nombre: "Carbó", url: "https://carbotransparencia.com.mx", color: "#fef10e" },
      { nombre: "Cucurpe", url: "https://cucurpetransparencia.com.mx", color: "#014169" },
      { nombre: "Huachinera", url: "https://www.huachineratransparencia.com.mx", color: "#009a34" },
      { nombre: "Mazatán", url: "https://mazatantransparencia.com.mx", color: "#103625" },
      { nombre: "Rayón", url: "https://www.rayontransparencia.com.mx", color: "#b70014" },
      { nombre: "Sahuaripa", url: "https://sahuaripatransparencia.com.mx", color: "#ae453d" },
      { nombre: "San Javier", url: "https://sanjaviertransparencia.com.mx", color: "#c4a061" },
      { nombre: "Soyopa", url: "https://www.soyopatransparencia.com.mx", color: "#b9933e" },
      { nombre: "Tepache", url: "https://www.tepachetransparencia.com.mx", color: "#996952" },
      { nombre: "Villa Pesqueira", url: "https://villapesqueiratransparencia.com.mx", color: "#6a0c08" },
    ],
  },
];

export const proyectoDestacado =
  proyectos.find((p) => p.destacado) ?? proyectos[0];

