import { LayoutGrid, Globe, Share2, Camera, Video, PenTool } from "lucide-react";

// Servicios descritos por lo que resuelven, nunca por cómo se implementan.
// El destacado lleva el texto y la nota de seguridad del brief, literales.
// El resto, máximo dos líneas en móvil.
export const servicios = [
  {
    id: "portales-sistemas",
    destacado: true,
    Icon: LayoutGrid,
    title: "Portales y sistemas digitales",
    description:
      "Portales y herramientas digitales para centralizar información, facilitar procesos, mejorar la comunicación y administrar accesos de forma responsable.",
    nota:
      "Los sistemas se planean considerando buenas prácticas de seguridad, control de acceso y protección de información.",
  },
  {
    id: "desarrollo-web",
    Icon: Globe,
    title: "Desarrollo web",
    description:
      "Sitios claros y rápidos que se ven bien en cualquier pantalla.",
  },
  {
    id: "redes-sociales",
    Icon: Share2,
    title: "Redes sociales",
    description:
      "Estrategia, calendario y publicaciones con una voz constante.",
  },
  {
    id: "fotografia",
    Icon: Camera,
    title: "Fotografía",
    description:
      "Fotografía institucional, de producto y de espacios.",
  },
  {
    id: "video",
    Icon: Video,
    title: "Video",
    description:
      "Piezas breves para presentar servicios, proyectos y mensajes.",
  },
  {
    id: "diseno-grafico",
    Icon: PenTool,
    title: "Diseño gráfico",
    description:
      "Identidad visual, piezas editoriales y material para campañas.",
  },
];
