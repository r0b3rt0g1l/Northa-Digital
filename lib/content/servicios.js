import { LayoutGrid, Globe, Share2, Camera, Video, PenTool, ShieldCheck } from "lucide-react";

// Servicios descritos por lo que resuelven, nunca por cómo se implementan.
// El destacado lleva el texto y la nota de seguridad del brief, literales.
// `resumen` es la línea corta del menú de servicios.
export const servicios = [
  {
    id: "portales-sistemas",
    destacado: true,
    Icon: LayoutGrid,
    title: "Portales y sistemas digitales",
    resumen: "Información, procesos y comunicación en un solo lugar.",
    description:
      "Portales y herramientas digitales para centralizar información, facilitar procesos, mejorar la comunicación y administrar accesos de forma responsable.",
    nota:
      "Los sistemas se planean considerando buenas prácticas de seguridad, control de acceso y protección de información.",
  },
  {
    id: "desarrollo-web",
    Icon: Globe,
    title: "Desarrollo web",
    resumen: "Sitios claros y rápidos en cualquier pantalla.",
    description:
      "Sitios claros y rápidos que se ven bien en cualquier pantalla.",
  },
  {
    id: "redes-sociales",
    Icon: Share2,
    title: "Redes sociales",
    resumen: "Estrategia, calendario y voz constante.",
    description:
      "Estrategia, calendario y publicaciones con una voz constante.",
  },
  {
    id: "fotografia",
    Icon: Camera,
    title: "Fotografía",
    resumen: "Institucional, de producto y de espacios.",
    description:
      "Fotografía institucional, de producto y de espacios.",
  },
  {
    id: "video",
    Icon: Video,
    title: "Video",
    resumen: "Piezas breves para presentar y comunicar.",
    description:
      "Piezas breves para presentar servicios, proyectos y mensajes.",
  },
  {
    id: "diseno-grafico",
    Icon: PenTool,
    title: "Diseño gráfico",
    resumen: "Identidad, piezas editoriales y campañas.",
    description:
      "Identidad visual, piezas editoriales y material para campañas.",
  },
];

// Categoría de seguridad: se describe en términos generales. Nada de
// configuraciones, nombres de paneles, direcciones, accesos ni procedimientos.
export const seguridad = {
  id: "seguridad",
  Icon: ShieldCheck,
  title: "Seguridad y acceso protegido",
  titular: "Solo entra quien debe entrar.",
  resumen:
    "VPN y Cloudflare Zero Trust para que a los paneles de administración solo entren las personas autorizadas.",
  description:
    "Protegemos los paneles de administración de tus sistemas para que solo lleguen las personas autorizadas, con VPN y acceso Zero Trust de Cloudflare.",
  puntos: [
    "VPN para que tu equipo se conecte a los sistemas de forma privada.",
    "Paneles de administración detrás de Cloudflare Zero Trust: cada acceso se verifica antes de entrar.",
    "Cada persona entra solo a lo que le corresponde.",
  ],
};
