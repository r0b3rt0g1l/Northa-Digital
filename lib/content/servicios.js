import {
  LayoutGrid,
  Globe,
  Share2,
  Camera,
  Video,
  PenTool,
  ShieldCheck,
  Sparkles,
  LayoutList,
  Mountain,
  ClipboardCheck,
  MessagesSquare,
  LayoutDashboard,
} from "lucide-react";

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

// Seguridad: se comunica de forma simple, sin explicaciones técnicas, nombres
// de herramientas, configuraciones, paneles, direcciones ni procedimientos.
export const seguridad = {
  id: "seguridad",
  Icon: ShieldCheck,
  title: "Seguridad y acceso protegido",
  titular: "Plataformas protegidas.",
  resumen: "Protección moderna y control de acceso para tus plataformas administrativas.",
  description:
    "Implementamos medidas modernas de protección y control de acceso para las plataformas administrativas que construimos.",
};

// Beneficios para el cliente, en pocas palabras. No prometen funciones,
// precios, plazos ni integraciones.
export const beneficios = [
  { Icon: Sparkles, titulo: "Presencia digital", texto: "Tu organización, clara y profesional en internet." },
  { Icon: LayoutList, titulo: "Información ordenada", texto: "Todo en su lugar y fácil de encontrar." },
  { Icon: Mountain, titulo: "Turismo", texto: "Lo mejor de tu municipio, bien contado." },
  { Icon: ClipboardCheck, titulo: "Trámites", texto: "Servicios y requisitos a la vista." },
  { Icon: MessagesSquare, titulo: "Comunicación", texto: "Mensajes claros para tu comunidad." },
  { Icon: LayoutDashboard, titulo: "Administración", texto: "Publica y actualiza por tu cuenta." },
];
