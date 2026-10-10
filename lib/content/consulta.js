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

export const formasContacto = ["WhatsApp", "Correo"];

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
  // Campos que no respondió el visitante: «Atrás» no vuelve a ellos.
  r.precargados = ["tipo", "necesidad"].filter((c) => c in r);
  return r;
}

// ---------- Texto libre ----------

export const normalizar = (t = "") =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Una clave coincide con una palabra del texto que empieza igual
 * ("administrativ" → administrativo), o con la palabra exacta si termina en
 * "=" ("foto=" no coincide con "fotocopias"), o como frase si lleva espacio.
 * Así «tienda» no coincide dentro de «atienda» ni «logo» en «odontólogo».
 */
function hay(texto, clave) {
  const t = normalizar(texto);
  if (clave.includes(" ")) return ` ${t.replace(/[^a-z0-9]+/g, " ")} `.includes(` ${clave} `);
  const palabras = t.split(/[^a-z0-9]+/);
  return clave.endsWith("=") ? palabras.includes(clave.slice(0, -1)) : palabras.some((p) => p.startsWith(clave));
}

const PALABRAS_TIPO = {
  portal: ["municipio", "municipal", "ayuntamiento", "alcaldia", "cabildo", "portal", "gobierno", "transparencia", "turis"],
  web: ["pagina", "sitio", "web", "landing", "negocio", "tienda", "empresa"],
  sistema: ["sistema", "administrativ", "formulario", "registro", "panel", "plataforma", "intranet", "control"],
  contenido: ["redes", "facebook", "instagram", "tiktok", "fotos", "fotograf", "foto=", "video", "diseno", "logo", "identidad"],
};

const PALABRAS_NECESIDAD = [
  { claves: ["turis"], opciones: ["Turismo"] },
  { claves: ["tramite"], opciones: ["Trámites"] },
  { claves: ["formulario", "registro"], opciones: ["Formularios", "Formularios y registros", "Formularios de contacto"] },
  { claves: ["galeria", "album"], opciones: ["Galería"] },
  { claves: ["transparencia", "informacion publica"], opciones: ["Información pública"] },
  { claves: ["servicios"], opciones: ["Mostrar servicios"] },
  { claves: ["acceso", "seguridad", "proteger", "proteccion"], opciones: ["Protección y control de acceso", "Accesos por usuario"] },
  { claves: ["redes", "facebook", "instagram"], opciones: ["Redes sociales"] },
  { claves: ["fotos", "fotograf", "foto="], opciones: ["Fotografía", "Galería"] },
  { claves: ["video"], opciones: ["Video"] },
  { claves: ["logo", "diseno", "identidad"], opciones: ["Diseño gráfico"] },
];

/** Tipo de proyecto que se reconoce en un texto, o null. */
export function tipoDesdeTexto(texto) {
  let mejor = null;
  let puntos = 0;
  for (const [id, claves] of Object.entries(PALABRAS_TIPO)) {
    const n = claves.filter((c) => hay(texto, c)).length;
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
  for (const { claves, opciones } of PALABRAS_NECESIDAD) {
    if (!claves.some((c) => hay(texto, c))) continue;
    const hallada = opciones.find((o) => lista.includes(o));
    if (hallada) return hallada;
  }
  return null;
}

// Lo que se escribe en los pasos que solo tienen opciones.
const SINONIMOS = {
  contacto: [
    ["Correo", /\b(e-?mail|mail|correo)\b|@/],
    ["WhatsApp", /whats|wasap|guasap|wpp/],
  ],
  ambito: [
    ["Un municipio", /municip|ayuntamiento|alcald|gobierno|cabildo/],
    ["Un negocio", /negocio|empresa|tienda|local|comercio|panader|restaur|hotel|consultorio|despacho/],
    ["Un proyecto personal", /personal|propio|\bmio\b|para mi\b/],
    ["Otra organización", /asociaci|escuela|organizaci|fundaci|iglesia|club|colegio|universidad/],
  ],
};

/** Opción de un paso sin texto que corresponde a lo escrito, o null. */
export function opcionDesdeTexto(campo, texto) {
  const t = normalizar(texto);
  return (SINONIMOS[campo] ?? []).find(([, re]) => re.test(t))?.[0] ?? null;
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
    pregunta: (r) =>
      r.idea
        ? "Entendido. ¿Es para un municipio, un negocio o un proyecto personal?"
        : "Sin problema, lo vemos juntos. ¿Es para un municipio, un negocio o un proyecto personal?",
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
    etiqueta: "Tu correo",
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

// Respuestas escritas que equivalen a no dar el dato opcional.
const NO_DECIRLO = /^(no|nop|ninguno|prefiero no( decirlo)?|no quiero( decirlo)?|prefiero no decirlo|lo comparto despues|despues)\.?$/;

/** Quita «Me llamo», «Soy» o «Mi nombre es» al principio del nombre. */
const limpiarNombre = (v) => v.replace(/^(hola[,.!]?\s*)?(me llamo|mi nombre es|soy)\s+/i, "").trim() || v;

/** Marca o desmarca un campo como precargado (no lo respondió el visitante). */
function precargar(n, campo, si) {
  const lista = (n.precargados ?? []).filter((c) => c !== campo);
  n.precargados = si ? [...lista, campo] : lista;
}

/**
 * Guarda la respuesta de un paso y devuelve las respuestas nuevas. Aplica las
 * reglas que dependen del texto: tipo reconocido, ámbito que sugiere un tipo,
 * necesidad reconocida, nombre sin «Me llamo», «Prefiero no decirlo» (null).
 */
export function aplicarRespuesta(r, campo, valor) {
  const n = { ...r };
  precargar(n, campo, false);
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
        if (nec && !("necesidad" in r)) {
          n.necesidad = nec;
          precargar(n, "necesidad", true);
        }
      } else {
        n.noSabe = true;
        n.tipo = TIPO_NO_SE;
        delete n.tipoId;
      }
    }
    // Si cambió el tipo, la necesidad elegida puede no aplicar.
    if (r.tipoId !== n.tipoId && "necesidad" in n && !(necesidades[n.tipoId] ?? []).includes(n.necesidad)) {
      delete n.necesidad;
      delete n.detalle;
    }
    return n;
  }
  if (campo === "ambito") {
    n.ambito = valor;
    n.tipoId = tipoPorAmbito[valor] ?? "web";
    n.tipo = tipoPorId(n.tipoId).label;
    if ("necesidad" in n && !necesidades[n.tipoId].includes(n.necesidad)) {
      delete n.necesidad;
      delete n.detalle;
    }
    if (n.idea) {
      const nec = necesidadDesdeTexto(n.idea, n.tipoId);
      if (nec && !("necesidad" in n)) {
        n.necesidad = nec;
        precargar(n, "necesidad", true);
      }
    }
    return n;
  }
  if (campo === "necesidad") {
    delete n.detalle;
    if (valor && !(necesidades[n.tipoId] ?? []).includes(valor)) {
      // Escrita con sus palabras: se reconoce la categoría y se conserva el texto.
      const reconocida = necesidadDesdeTexto(valor, n.tipoId);
      n.necesidad = reconocida ?? valor;
      if (reconocida) n.detalle = valor;
      return n;
    }
    n.necesidad = valor;
    return n;
  }
  if (campo === "contacto" && valor !== "Correo") delete n.correo;
  const sinDato = valor == null || valor === OPCION_RESERVA || NO_DECIRLO.test(normalizar(String(valor)));
  n[campo] = sinDato ? null : campo === "nombre" ? limpiarNombre(valor) : valor;
  return n;
}

/** Quita la respuesta de un campo (y lo que depende de él) para volver a preguntarlo. */
export function quitarRespuesta(r, campo) {
  const n = { ...r };
  delete n[campo];
  precargar(n, campo, false);
  if (campo === "tipo") {
    delete n.tipoId;
    delete n.noSabe;
    delete n.ambito;
    delete n.idea;
  }
  if (campo === "ambito") delete n.tipoId;
  if (campo === "necesidad") delete n.detalle;
  if (campo === "contacto") delete n.correo;
  return n;
}

/**
 * La pregunta de un paso sin las entradas de cortesía («Perfecto.», «Te
 * sugiero…», «Gracias, Ana.»): para repetirla tras «Atrás», «Cambiar» o una
 * duda sin que suene mecánica.
 */
export const preguntaSola = (i, r) =>
  pasos[i]
    .pregunta(r)
    .replace(/^(Perfecto|Entendido|Sin problema, lo vemos juntos|Te sugiero empezar por [^.]+|Gracias, [^.]+)\. /, "");

// ---------- Textos ----------

export const consulta = {
  bienvenida: "¡Hola! Soy el asistente de Northa Digital. ¿Buscas un portal municipal, una página web o algún sistema digital?",
  aviso: "Tu mensaje llega al equipo de Northa cuando lo envías por WhatsApp.",
  cierre: "Con gusto te ayudo a definirlo. ¿Quieres continuar por WhatsApp con el equipo de Northa Digital?",
  persona:
    "Claro. Puedes escribirle directo al equipo por WhatsApp o mandar un correo. El mensaje se abre listo para que tú lo envíes.",
  dudas: "Dime qué te gustaría saber, o elige una pregunta.",
  mensajePersona: "Me gustaría hablar con una persona del equipo.",
  correoInvalido: "Ese correo no parece completo. ¿Me lo escribes de nuevo? También puedes compartirlo después.",
  sinLlamadas: "Por ahora atendemos por WhatsApp y correo, no por llamada. ¿Cuál prefieres?",
};

/** Lo que el visitante escribió con sus palabras, sin repetir lo que ya dice el resumen. */
function enSusPalabras(r) {
  const repetido = (t) => [r.tipo, r.necesidad].some((x) => x && normalizar(x) === normalizar(t));
  const vago = (t) => /^(no s[eé]|ni idea|no estoy segur[oa]|hola|buen[oa]s?( dias| tardes| noches)?)\W*$/i.test(t.trim());
  return [r.idea, r.detalle].filter((t, i, a) => t && !repetido(t) && !vago(t) && a.indexOf(t) === i);
}

/** Líneas del resumen, solo con lo que se respondió. */
export function lineasResumen(r) {
  const lineas = [];
  if (r.tipo && r.tipo !== TIPO_NO_SE) lineas.push({ campo: "tipo", titulo: "Proyecto", texto: r.tipo });
  if (r.ambito) lineas.push({ campo: "ambito", titulo: "Es para", texto: r.ambito });
  if (r.organizacion) lineas.push({ campo: "organizacion", titulo: "Municipio u organización", texto: r.organizacion });
  if (r.necesidad) {
    lineas.push({ campo: "necesidad", titulo: "Lo principal", texto: r.detalle ? `${r.necesidad}: «${r.detalle}»` : r.necesidad });
  }
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
  for (const t of enSusPalabras(r)) lineas.push(`En mis palabras: ${t}`);
  if (r.contacto) {
    const forma = r.contacto === "Correo" ? "correo" : "WhatsApp";
    lineas.push(`Prefiero que me contacten por ${forma}${r.correo ? ` (${r.correo})` : ""}.`);
  }
  return [...lineas, "", "¿Me pueden orientar?"].join("\n");
}
