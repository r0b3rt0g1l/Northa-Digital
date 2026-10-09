// Conversación guiada del asistente: pocas preguntas, directas, que terminan
// en un mensaje para WhatsApp que el visitante revisa y envía. Todo es
// contenido predefinido: no hay inteligencia artificial ni atención en tiempo
// real. Las opciones salen de los servicios reales; no se prometen precios,
// plazos, funciones ni integraciones.
//
// Datos que se recogen (solo viajan en el mensaje que el visitante envía):
// tipo de proyecto, municipio u organización, necesidad principal, nombre y
// forma de contacto. El nombre, la organización y el correo son opcionales.

export const TIPO_NO_SE = "No estoy seguro";
export const OPCION_OTRA = "Algo más";
export const OPCION_RESERVA = "Prefiero no decirlo";

/** Tipos de proyecto, en el orden en que se ofrecen. */
export const tipos = [
  { id: "portal", label: "Portal municipal" },
  { id: "web", label: "Página web" },
  { id: "sistema", label: "Sistema administrativo" },
  { id: "contenido", label: "Contenido y diseño" },
];

/** Para quien no sabe qué necesita: una pregunta simple. */
export const ambitos = ["Un municipio", "Un negocio", "Un proyecto personal", "Otra organización"];
const tipoPorAmbito = {
  "Un municipio": "portal",
  "Un negocio": "web",
  "Un proyecto personal": "web",
  "Otra organización": "web",
};

/** Lo principal que se necesita, según el tipo de proyecto. */
export const necesidades = {
  portal: ["Información pública", "Turismo", "Trámites", "Formularios", "Galería"],
  web: ["Presentar mi negocio o proyecto", "Mostrar servicios", "Galería", "Formularios de contacto"],
  sistema: ["Organizar información", "Formularios y registros", "Accesos por usuario", "Protección y control de acceso"],
  contenido: ["Redes sociales", "Fotografía", "Video", "Diseño gráfico"],
};

export const formasContacto = ["WhatsApp", "Llamada", "Correo"];

// Entradas desde el sitio (menú de servicios, banda, sección de seguridad):
// cada servicio real se traduce a un punto de partida de la conversación.
const PUNTOS_DE_PARTIDA = {
  "portales-sistemas": { tiposSugeridos: ["portal", "sistema"] },
  "desarrollo-web": { tipoId: "web" },
  "redes-sociales": { tipoId: "contenido", necesidad: "Redes sociales" },
  fotografia: { tipoId: "contenido", necesidad: "Fotografía" },
  video: { tipoId: "contenido", necesidad: "Video" },
  "diseno-grafico": { tipoId: "contenido", necesidad: "Diseño gráfico" },
  seguridad: { tipoId: "sistema", necesidad: "Protección y control de acceso" },
};

export const tipoPorId = (id) => tipos.find((t) => t.id === id) ?? null;
const tipoPorLabel = (label) => tipos.find((t) => t.label === label) ?? null;

/** Respuestas iniciales cuando la conversación empieza desde un servicio. */
export function respuestasDesde(servicioId) {
  const p = PUNTOS_DE_PARTIDA[servicioId];
  if (!p) return {};
  const r = {};
  if (p.tiposSugeridos) r.tiposSugeridos = p.tiposSugeridos;
  if (p.tipoId) {
    r.tipoId = p.tipoId;
    r.tipo = tipoPorId(p.tipoId).label;
  }
  if (p.necesidad) r.necesidad = p.necesidad;
  return r;
}

// ---------- Texto libre ----------

const normalizar = (t) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const PALABRAS_TIPO = {
  portal: ["municipio", "municipal", "ayuntamiento", "alcaldia", "cabildo", "portal", "gobierno", "transparencia", "turismo"],
  web: ["pagina", "sitio", "web", "landing", "negocio", "tienda", "empresa"],
  sistema: ["sistema", "administrativ", "formulario", "registro", "panel", "plataforma", "intranet", "control"],
  contenido: ["redes", "facebook", "instagram", "tiktok", "foto", "video", "diseno", "logo", "identidad", "imagen"],
};

const PALABRAS_NECESIDAD = [
  { claves: ["turis"], opciones: ["Turismo"] },
  { claves: ["tramite"], opciones: ["Trámites"] },
  { claves: ["formulario", "registro"], opciones: ["Formularios", "Formularios y registros", "Formularios de contacto"] },
  { claves: ["galeria", "fotos del", "album"], opciones: ["Galería"] },
  { claves: ["transparencia", "informacion publica", "informacion"], opciones: ["Información pública", "Organizar información"] },
  { claves: ["servicios"], opciones: ["Mostrar servicios"] },
  { claves: ["acceso", "seguridad", "proteger", "proteccion"], opciones: ["Protección y control de acceso", "Accesos por usuario"] },
  { claves: ["redes", "facebook", "instagram"], opciones: ["Redes sociales"] },
  { claves: ["foto"], opciones: ["Fotografía"] },
  { claves: ["video"], opciones: ["Video"] },
  { claves: ["logo", "diseno", "identidad"], opciones: ["Diseño gráfico"] },
];

/** Tipo de proyecto que se reconoce en un texto, o null. */
export function tipoDesdeTexto(texto) {
  const t = normalizar(texto);
  let mejor = null;
  let puntos = 0;
  for (const [id, claves] of Object.entries(PALABRAS_TIPO)) {
    const n = claves.filter((c) => t.includes(c)).length;
    if (n > puntos) {
      mejor = id;
      puntos = n;
    }
  }
  return mejor;
}

/** Necesidad de la lista del tipo que se reconoce en un texto, o null. */
export function necesidadDesdeTexto(texto, tipoId) {
  const lista = necesidades[tipoId] ?? [];
  const t = normalizar(texto);
  for (const { claves, opciones } of PALABRAS_NECESIDAD) {
    if (!claves.some((c) => t.includes(c))) continue;
    const hallada = opciones.find((o) => lista.includes(o));
    if (hallada) return hallada;
  }
  return null;
}

/** Formato mínimo de correo: algo@algo.algo, sin espacios. */
export const correoValido = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t.trim());

// ---------- Pasos ----------

/**
 * Pasos de la conversación, en orden. `campo` es la clave en las respuestas.
 *  - pregunta(r): texto del asistente.
 *  - opciones(r): etiquetas para elegir (puede ser vacío).
 *  - cuando(r): el paso solo aplica si devuelve true.
 *  - texto: acepta una respuesta escrita; `entrada` es el texto de ayuda.
 *  - reserva: etiqueta del botón para no responder (el dato es opcional).
 *  - otra: muestra «Algo más» para escribirlo con sus palabras.
 */
export const pasos = [
  {
    campo: "tipo",
    titulo: "Proyecto",
    pregunta: (r) =>
      r.tiposSugeridos
        ? "Perfecto. ¿Lo que buscas es un portal municipal o un sistema administrativo?"
        : "¿Buscas un portal municipal, una página web o algún sistema digital?",
    opciones: (r) => [
      ...(r.tiposSugeridos ? r.tiposSugeridos.map((id) => tipoPorId(id).label) : tipos.map((t) => t.label)),
      TIPO_NO_SE,
    ],
    texto: true,
    entrada: "Escribe lo que buscas…",
  },
  {
    campo: "ambito",
    titulo: "Es para",
    cuando: (r) => !!r.noSabe,
    pregunta: () => "Sin problema, lo vemos juntos. ¿Es para un municipio, un negocio o un proyecto personal?",
    opciones: () => ambitos,
  },
  {
    campo: "organizacion",
    titulo: "Municipio u organización",
    pregunta: (r) => {
      const intro = r.ambito ? `Te sugiero empezar por ${r.tipoId === "portal" ? "un portal municipal" : "una página web"}. ` : "Perfecto. ";
      if (r.tipoId === "portal") return `${intro}¿Para qué municipio sería?`;
      if (r.ambito === "Un proyecto personal") return `${intro}¿Cómo se llama tu proyecto?`;
      return `${intro}¿Para qué municipio u organización sería?`;
    },
    opciones: () => [],
    texto: true,
    entrada: "Nombre del municipio u organización",
    reserva: OPCION_RESERVA,
  },
  {
    campo: "necesidad",
    titulo: "Lo principal",
    pregunta: (r) =>
      r.tipoId === "portal"
        ? "¿Qué es lo principal que necesitas: información pública, turismo, trámites, formularios, galería o algo más?"
        : "¿Qué es lo principal que necesitas?",
    opciones: (r) => necesidades[r.tipoId] ?? [],
    texto: true,
    otra: true,
    entrada: "Cuéntame en pocas palabras…",
  },
  {
    campo: "nombre",
    titulo: "Nombre",
    pregunta: () => "Para que el equipo sepa con quién habla, ¿cómo te llamas?",
    opciones: () => [],
    texto: true,
    entrada: "Tu nombre",
    reserva: OPCION_RESERVA,
  },
  {
    campo: "contacto",
    titulo: "Contacto",
    pregunta: (r) => (r.nombre ? `Gracias, ${r.nombre}. ` : "") + "¿Cómo prefieres que te contactemos?",
    opciones: () => formasContacto,
  },
  {
    campo: "correo",
    titulo: "Correo",
    cuando: (r) => r.contacto === "Correo",
    pregunta: () => "¿A qué correo te escribimos? Si prefieres, lo compartes después.",
    opciones: () => [],
    texto: true,
    entrada: "tu@correo.com",
    reserva: "Lo comparto después",
  },
];

/** El paso aplica con estas respuestas. */
export const aplica = (p, r) => !p.cuando || p.cuando(r);

/** Índice del primer paso que aplica y aún no tiene respuesta, desde `desde`. */
export function siguientePaso(r, desde = 0) {
  for (let i = desde; i < pasos.length; i++) {
    const p = pasos[i];
    if (aplica(p, r) && !(p.campo in r)) return i;
  }
  return pasos.length;
}

/** Pasos que aplican ahora (para el contador «2 de 5»). */
export const pasosVisibles = (r) => pasos.filter((p) => aplica(p, r));

/** La conversación tiene lo necesario para preparar el mensaje. */
export const consultaCompleta = (r) => siguientePaso(r) >= pasos.length && !!r?.tipo;

/**
 * Guarda la respuesta de un paso y devuelve las respuestas nuevas. Aplica las
 * reglas que dependen del texto: tipo reconocido, ámbito que sugiere un tipo,
 * necesidad reconocida, «Prefiero no decirlo» (null).
 */
export function aplicarRespuesta(r, campo, valor) {
  const n = { ...r };
  if (campo === "tipo") {
    delete n.tiposSugeridos;
    const t = tipoPorLabel(valor);
    if (valor === TIPO_NO_SE) {
      n.noSabe = true;
      n.tipo = TIPO_NO_SE;
      delete n.tipoId;
    } else if (t) {
      n.tipo = t.label;
      n.tipoId = t.id;
      delete n.noSabe;
      delete n.ambito;
    } else {
      // Texto libre: se intenta reconocer el tipo; si no, se pregunta el ámbito.
      const id = tipoDesdeTexto(valor);
      n.idea = valor;
      if (id) {
        n.tipo = tipoPorId(id).label;
        n.tipoId = id;
        delete n.noSabe;
        const nec = necesidadDesdeTexto(valor, id);
        if (nec && !("necesidad" in r)) n.necesidad = nec;
      } else {
        n.noSabe = true;
        n.tipo = TIPO_NO_SE;
        delete n.tipoId;
      }
    }
    // Si cambió el tipo, la necesidad elegida puede no aplicar.
    if (r.tipoId !== n.tipoId && "necesidad" in r && !(necesidades[n.tipoId] ?? []).includes(r.necesidad)) {
      delete n.necesidad;
    }
    return n;
  }
  if (campo === "ambito") {
    n.ambito = valor;
    n.tipoId = tipoPorAmbito[valor] ?? "web";
    n.tipo = tipoPorId(n.tipoId).label;
    if ("necesidad" in n && !necesidades[n.tipoId].includes(n.necesidad)) delete n.necesidad;
    if (n.idea) {
      const nec = necesidadDesdeTexto(n.idea, n.tipoId);
      if (nec && !("necesidad" in n)) n.necesidad = nec;
    }
    return n;
  }
  if (campo === "necesidad" && valor && !(necesidades[n.tipoId] ?? []).includes(valor)) {
    n.necesidad = necesidadDesdeTexto(valor, n.tipoId) ?? valor;
    return n;
  }
  if (campo === "contacto" && valor !== "Correo") delete n.correo;
  n[campo] = valor === OPCION_RESERVA || valor === "Lo comparto después" ? null : valor;
  return n;
}

/** Quita la respuesta de un campo (y lo que depende de él) para volver a preguntarlo. */
export function quitarRespuesta(r, campo) {
  const n = { ...r };
  delete n[campo];
  if (campo === "tipo") {
    delete n.tipoId;
    delete n.noSabe;
    delete n.ambito;
    delete n.idea;
  }
  if (campo === "ambito") delete n.tipoId;
  if (campo === "contacto") delete n.correo;
  return n;
}

// ---------- Textos ----------

export const consulta = {
  bienvenida: "¡Hola! Soy el asistente de Northa Digital. ¿Buscas un portal municipal, una página web o algún sistema digital?",
  aviso: "Respuestas automáticas. El equipo de Northa te responde por WhatsApp.",
  cierre: "Con gusto te ayudo a definirlo. ¿Quieres continuar por WhatsApp con el equipo de Northa Digital?",
  persona:
    "Claro. Puedes escribirle directo al equipo por WhatsApp, llamar o mandar un correo. El mensaje se abre listo para que tú lo envíes.",
  dudas: "Dime qué te gustaría saber, o elige una pregunta.",
  mensajePersona: "Me gustaría hablar con una persona del equipo.",
  correoInvalido: "Ese correo no parece completo. ¿Me lo escribes de nuevo? También puedes compartirlo después.",
};

/** Líneas del resumen, solo con lo que se respondió. */
export function lineasResumen(r) {
  const lineas = [];
  if (r.tipo && r.tipo !== TIPO_NO_SE) lineas.push({ campo: "tipo", titulo: "Proyecto", texto: r.tipo });
  if (r.ambito) lineas.push({ campo: "ambito", titulo: "Es para", texto: r.ambito });
  if (r.organizacion) lineas.push({ campo: "organizacion", titulo: "Municipio u organización", texto: r.organizacion });
  if (r.necesidad) lineas.push({ campo: "necesidad", titulo: "Lo principal", texto: r.necesidad });
  if (r.nombre) lineas.push({ campo: "nombre", titulo: "Nombre", texto: r.nombre });
  if (r.contacto) {
    lineas.push({ campo: "contacto", titulo: "Contacto", texto: r.correo ? `${r.contacto} (${r.correo})` : r.contacto });
  }
  return lineas;
}

/** Cuerpo del mensaje de WhatsApp (sin el saludo, que añade site.js). */
export function mensajeConsulta(r) {
  const lineas = [];
  if (r.tipo && r.tipo !== TIPO_NO_SE) lineas.push(`Busco: ${r.tipo}`);
  if (r.ambito) lineas.push(`Es para: ${r.ambito.toLowerCase()}`);
  if (r.organizacion) lineas.push(`Municipio u organización: ${r.organizacion}`);
  if (r.necesidad) lineas.push(`Lo principal: ${r.necesidad}`);
  if (r.idea && r.idea !== r.necesidad) lineas.push(`En mis palabras: ${r.idea}`);
  if (r.contacto) {
    const forma = r.contacto === "Llamada" ? "llamada" : r.contacto === "Correo" ? "correo" : "WhatsApp";
    lineas.push(`Prefiero que me contacten por ${forma}${r.correo ? ` (${r.correo})` : ""}.`);
  }
  return [...lineas, "", "¿Me pueden orientar?"].join("\n");
}
