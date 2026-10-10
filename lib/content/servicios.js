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
  LockKeyhole,
  ClipboardCheck,
  Network,
  KeyRound,
  Activity,
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

// Seguridad: se comunica de forma simple. Los cuatro puntos nombran lo que el
// visitante entiende (VPN, login, control de acceso) sin herramientas,
// configuraciones, direcciones, paneles reales ni procedimientos. La única
// excepción, pedida por el cliente, es `acceso`: capturas reales rotuladas
// como tales y redactadas según el README («Capturas del acceso»).
export const seguridad = {
  id: "seguridad",
  Icon: ShieldCheck,
  title: "Seguridad y acceso protegido",
  titular: "Plataformas protegidas.",
  resumen: "Protección moderna y control de acceso para tus plataformas administrativas.",
  description:
    "Implementamos medidas modernas de protección y control de acceso para las plataformas administrativas que construimos.",
  puntos: [
    { Icon: Network, titulo: "Acceso protegido con VPN", texto: "El panel se administra desde una conexión privada y cifrada." },
    { Icon: KeyRound, titulo: "Login administrativo seguro", texto: "Solo las personas autorizadas entran al panel." },
    { Icon: ShieldCheck, titulo: "Protección para portales municipales", texto: "La información de tu municipio, cuidada." },
    { Icon: Activity, titulo: "Control de acceso y monitoreo", texto: "Quién entra y qué puede hacer, siempre a la vista." },
  ],
  // Capturas reales del acceso al panel (CMS) de un portal. Antes de
  // publicarlas se taparon el dominio privado de acceso y el código, y el
  // correo que se ve es el de Northa (public/seguridad/). Los alt describen
  // sin nombrar la aplicación ni la cuenta.
  acceso: {
    titulo: "Así se entra al panel de tu portal",
    texto: "Tres pasos del acceso a nuestro CMS. Ocultamos los datos sensibles y mostramos el correo de Northa.",
    pasos: [
      {
        src: "/seguridad/acceso-correo.webp",
        width: 918,
        height: 544,
        titulo: "Primero, el acceso privado",
        texto: "Antes de mostrar el panel, Cloudflare Access pide el correo de quien entra.",
        alt: "Captura de Cloudflare Access pidiendo el correo de quien entra, con el botón para enviar el código. El dominio de acceso está oculto.",
      },
      {
        src: "/seguridad/acceso-codigo.webp",
        width: 910,
        height: 746,
        titulo: "Código de un solo uso",
        texto: "Llega a ese correo y vence en 10 minutos.",
        alt: "Captura de la pantalla donde se escribe el código de un solo uso que llega por correo y vence en 10 minutos. El código está oculto.",
      },
      {
        src: "/seguridad/acceso-panel.webp",
        width: 854,
        height: 826,
        titulo: "Después, el login del panel",
        texto: "Correo, contraseña y una verificación anti-bots de Cloudflare.",
        alt: "Captura del inicio de sesión del panel del portal, con los campos de correo y contraseña vacíos y la verificación anti-bots de Cloudflare superada.",
      },
    ],
  },
};

// Beneficios para el cliente, en pocas palabras. No prometen funciones,
// precios, plazos ni integraciones.
export const beneficios = [
  { Icon: Sparkles, titulo: "Presencia digital", texto: "Tu organización, clara y profesional en internet." },
  { Icon: LayoutList, titulo: "Información ordenada", texto: "Todo en su lugar y fácil de encontrar." },
  { Icon: LockKeyhole, titulo: "Seguridad", texto: "Acceso protegido y datos bajo control." },
  { Icon: ClipboardCheck, titulo: "Trámites", texto: "Servicios y requisitos a la vista." },
  { Icon: MessagesSquare, titulo: "Comunicación", texto: "Mensajes claros para tu comunidad." },
  { Icon: LayoutDashboard, titulo: "Administración", texto: "Publica y actualiza por tu cuenta." },
];
