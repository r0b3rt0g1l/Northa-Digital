import { servicios, seguridad } from "./servicios";

// Consulta guiada del asistente: unas preguntas breves que terminan en un
// resumen que el visitante revisa antes de abrir WhatsApp. Todo es contenido
// predefinido: no hay inteligencia artificial ni atención en tiempo real.
//
// Las opciones describen lo que el visitante necesita, con palabras sacadas de
// la descripción de cada servicio. No prometen precios, plazos ni resultados.
// No se pide ningún dato personal: el resumen solo lleva lo que se elige.

export const SERVICIO_NO_SE = "no-se";

/** Servicios que se pueden elegir en la consulta, en el orden del menú. */
export const serviciosConsulta = [
  ...servicios.map((s) => ({ id: s.id, label: s.title })),
  { id: seguridad.id, label: seguridad.title },
  { id: SERVICIO_NO_SE, label: "Aún no lo sé" },
];

// Qué quiere lograr el visitante, según el servicio.
const objetivos = {
  "portales-sistemas": [
    "Publicar información pública y de transparencia",
    "Facilitar procesos y presentar servicios",
    "Organizar información y procesos internos",
    "Mejorar un portal o sistema que ya tenemos",
  ],
  "desarrollo-web": ["Tener un sitio nuevo", "Renovar el sitio que ya tenemos", "Presentar un servicio o una campaña"],
  "redes-sociales": [
    "Publicar con una voz constante",
    "Ordenar la estrategia y el calendario",
    "Acompañar una campaña",
  ],
  fotografia: ["Fotografía institucional", "Fotografía de producto", "Fotografía de espacios"],
  video: ["Presentar un servicio", "Mostrar un proyecto", "Comunicar un mensaje"],
  "diseno-grafico": [
    "Crear o renovar nuestra identidad visual",
    "Piezas editoriales",
    "Material para una campaña",
  ],
  [seguridad.id]: [
    "Proteger un panel de administración",
    "Que mi equipo se conecte de forma privada",
    "Revisar quién puede entrar a nuestros sistemas",
  ],
  [SERVICIO_NO_SE]: [
    "Mejorar cómo nos presentamos en línea",
    "Organizar información o procesos",
    "Comunicar mejor un proyecto",
  ],
};

// Lo que el proyecto debe incluir, según el servicio. Se pueden elegir varias.
const requisitos = {
  "portales-sistemas": [
    "Sección de transparencia",
    "Información de servicios",
    "Panel para publicar por nuestra cuenta",
    "Accesos por usuario",
  ],
  "desarrollo-web": [
    "Varias secciones",
    "Que se vea bien en celular",
    "Que podamos actualizarlo",
    "Contacto directo desde el sitio",
  ],
  "redes-sociales": ["Calendario de publicaciones", "Diseño de publicaciones", "Fotografía o video para redes"],
  fotografia: ["Sesión en nuestro espacio", "Retratos del equipo", "Fotos para catálogo"],
  video: ["Guion", "Grabación", "Edición", "Versiones para redes"],
  "diseno-grafico": ["Logotipo", "Guía de uso de marca", "Piezas impresas", "Piezas para redes"],
  [seguridad.id]: ["Panel de administración", "Acceso para varias personas", "Conexión desde fuera de la oficina"],
  [SERVICIO_NO_SE]: ["Que sea fácil de usar", "Que podamos actualizarlo", "Que se vea profesional"],
};

export const tiposOrganizacion = [
  "Gobierno o institución pública",
  "Empresa o negocio",
  "Organización o asociación",
  "Proyecto personal",
  "Otro",
];

export const plazos = ["Lo antes posible", "En 1 a 3 meses", "En más de 3 meses", "Aún no tengo fecha"];

export const OPCION_TEXTO = "Escribirlo con mis palabras";
export const OPCION_OMITIR = "Prefiero comentarlo después";

/**
 * Pasos de la consulta, en orden. `campo` es la clave en las respuestas.
 *  - opciones(respuestas): lista de etiquetas para elegir.
 *  - multiple: se eligen varias y se confirma con "Continuar".
 *  - texto: acepta una respuesta escrita.
 *  - opcional: se puede saltar.
 */
export const pasos = [
  {
    campo: "servicio",
    titulo: "Servicio",
    pregunta: "¿Con qué te podemos ayudar?",
    opciones: () => serviciosConsulta.map((s) => s.label),
  },
  {
    campo: "objetivo",
    titulo: "Objetivo",
    pregunta: "¿Qué te gustaría lograr?",
    opciones: (r) => objetivos[r.servicioId] ?? objetivos[SERVICIO_NO_SE],
    texto: true,
  },
  {
    campo: "tipo",
    titulo: "Tipo de organización",
    pregunta: "¿Para qué tipo de organización es?",
    opciones: () => tiposOrganizacion,
    texto: true,
  },
  {
    campo: "requisitos",
    titulo: "Debe incluir",
    pregunta: "¿Qué debe incluir sí o sí? Puedes elegir varias opciones.",
    opciones: (r) => requisitos[r.servicioId] ?? requisitos[SERVICIO_NO_SE],
    multiple: true,
    texto: true,
    opcional: true,
  },
  {
    campo: "plazo",
    titulo: "Plazo aproximado",
    pregunta: "¿Para cuándo lo necesitas, más o menos?",
    opciones: () => plazos,
    texto: true,
  },
  {
    campo: "comentario",
    titulo: "Comentario",
    pregunta: "¿Algo más que quieras contarnos? Es opcional. Evita compartir datos personales sensibles.",
    opciones: () => [],
    texto: true,
    opcional: true,
  },
];

export const consulta = {
  bienvenida:
    "Hola, soy el asistente del sitio de Northa Digital. Te haré unas preguntas breves para orientar tu consulta y preparar un mensaje para WhatsApp que podrás revisar antes de enviarlo.",
  aviso:
    "Asistente con respuestas predefinidas. No es atención en tiempo real: el equipo responde por WhatsApp o correo.",
  resumen: "Este es el resumen de tu consulta. Revísalo y, si está bien, ábrelo en WhatsApp para enviarlo.",
  persona:
    "Claro. Puedes escribirle directamente al equipo por WhatsApp, llamar o enviar un correo. El mensaje se abre listo para que lo revises y lo envíes tú.",
  dudas: "¿Qué te gustaría saber? Elige una pregunta o escríbela con tus palabras.",
  mensajePersona: "Me gustaría hablar con una persona del equipo.",
};

/** Etiqueta del servicio a partir de su id. */
export function servicioPorId(id) {
  return serviciosConsulta.find((s) => s.id === id) ?? null;
}

/** Id del servicio a partir de su etiqueta. */
export function servicioPorEtiqueta(label) {
  return serviciosConsulta.find((s) => s.label === label) ?? null;
}

/** Líneas del resumen, solo con lo que se respondió. */
export function lineasResumen(respuestas) {
  return pasos
    .map((p) => {
      const valor = respuestas[p.campo];
      const texto = Array.isArray(valor) ? valor.join(", ") : valor;
      return texto ? { campo: p.campo, titulo: p.titulo, texto } : null;
    })
    .filter(Boolean);
}

/** Texto que se precarga en WhatsApp: solo las respuestas de la consulta. */
export function mensajeConsulta(respuestas) {
  const lineas = lineasResumen(respuestas).map((l) => `${l.titulo}: ${l.texto}`);
  return ["Quiero hacer una consulta.", "", ...lineas].join("\n");
}
