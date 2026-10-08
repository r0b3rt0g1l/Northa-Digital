import { LayoutGrid, Globe, Share2, Camera, Video, PenTool } from "lucide-react";

// Servicios descritos por lo que resuelven, nunca por cómo se implementan.
// `nota` solo existe donde hace falta precisar algo (seguridad en sistemas).
export const servicios = [
  {
    id: "portales-sistemas",
    Icon: LayoutGrid,
    title: "Portales y sistemas digitales",
    description:
      "Portales y herramientas digitales diseñadas para organizar información, facilitar trámites, centralizar procesos y proteger el acceso a datos relevantes.",
    nota:
      "Consideramos buenas prácticas de seguridad, control de acceso y protección de información desde la planeación del sistema.",
  },
  {
    id: "desarrollo-web",
    Icon: Globe,
    title: "Desarrollo web",
    description:
      "Sitios rápidos, claros y fáciles de mantener, pensados para presentar a tu organización con precisión en cualquier dispositivo.",
  },
  {
    id: "redes-sociales",
    Icon: Share2,
    title: "Redes sociales",
    description:
      "Estrategia, calendario y publicaciones con una línea visual consistente, para comunicar con regularidad y criterio.",
  },
  {
    id: "fotografia",
    Icon: Camera,
    title: "Fotografía",
    description:
      "Producción fotográfica institucional, de producto y de espacios, con imágenes listas para web, redes e impresos.",
  },
  {
    id: "video",
    Icon: Video,
    title: "Video",
    description:
      "Piezas breves y claras para presentar servicios, proyectos y mensajes institucionales en los canales donde se consumen.",
  },
  {
    id: "diseno-grafico",
    Icon: PenTool,
    title: "Diseño gráfico",
    description:
      "Identidad visual, piezas editoriales y material para campañas, con un sistema coherente que se sostiene en el tiempo.",
  },
];
