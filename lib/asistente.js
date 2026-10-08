import { asistente, temas } from "./content/asistente";

const porId = new Map(temas.map((t) => [t.id, t]));

/** Minúsculas, sin acentos ni signos: "¿Cuánto cuesta?" → "cuanto cuesta". */
export function normalizar(texto = "") {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Las claves se normalizan una vez. Las que tienen espacio son frases.
const indice = temas.map((t, orden) => ({
  tema: t,
  orden,
  peso: t.peso ?? 1,
  frases: t.claves.map(normalizar).filter((c) => c.includes(" ")),
  palabras: t.claves.map(normalizar).filter((c) => c && !c.includes(" ")),
}));

function puntuar(entrada, palabrasEntrada) {
  const texto = ` ${palabrasEntrada.join(" ")} `;
  let puntos = 0;
  // Las palabras que ya cuentan dentro de una frase no suman otra vez.
  const usadas = new Set();
  for (const f of entrada.frases) {
    if (texto.includes(` ${f} `)) {
      puntos += 3;
      f.split(" ").forEach((p) => usadas.add(p));
    }
  }
  for (const clave of entrada.palabras) {
    let mejor = 0;
    for (const p of palabrasEntrada) {
      if (usadas.has(p)) continue;
      if (p === clave) mejor = Math.max(mejor, 2);
      else if (clave.length >= 4 && p.startsWith(clave)) mejor = Math.max(mejor, 1.5);
    }
    puntos += mejor;
  }
  return puntos * entrada.peso;
}

/**
 * Elige el tema que mejor responde a un texto libre.
 * Devuelve { tema, relacionado } o { tema: null } si nada coincide.
 * `relacionado` es el segundo mejor tema, para sugerirlo después.
 */
export function interpretar(texto) {
  const palabras = normalizar(texto).split(" ").filter(Boolean);
  if (!palabras.length) return { tema: null, relacionado: null };

  const ranking = indice
    .map((e) => ({ e, puntos: puntuar(e, palabras) }))
    .filter((r) => r.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.e.orden - b.e.orden);

  return {
    tema: ranking[0]?.e.tema ?? null,
    relacionado: ranking[1]?.e.tema ?? null,
  };
}

/** Respuesta lista para pintar a partir de un id de tema. */
export function responderTema(id) {
  const tema = porId.get(id);
  if (!tema) return null;
  return {
    texto: tema.respuesta,
    acciones: tema.acciones ?? [],
    sugerencias: (tema.sugerencias ?? []).filter((s) => porId.has(s)),
  };
}

/** Respuesta a un texto libre, con derivación al equipo si no hay coincidencia. */
export function responderTexto(texto) {
  const { tema, relacionado } = interpretar(texto);
  if (!tema) {
    return {
      texto: asistente.noEntendido,
      acciones: [
        { tipo: "whatsapp", label: "Enviar mi pregunta por WhatsApp", texto },
        { tipo: "formulario", label: "Contarlo en 30 segundos", texto },
      ],
      sugerencias: ["servicios", "trabajo", "empezar"],
    };
  }
  const base = responderTema(tema.id);
  // Si la pregunta tocaba otro tema, se ofrece primero como sugerencia.
  const sugerencias = [
    ...(relacionado && relacionado.id !== tema.id ? [relacionado.id] : []),
    ...base.sugerencias,
  ].filter((id, i, arr) => arr.indexOf(id) === i && id !== tema.id);
  // Las acciones de contacto llevan la pregunta original como contexto.
  const acciones = base.acciones.map((a) =>
    a.tipo === "whatsapp" || a.tipo === "formulario" ? { ...a, texto } : a,
  );
  return { ...base, acciones, sugerencias: sugerencias.slice(0, 4) };
}

export function temaPorId(id) {
  return porId.get(id) ?? null;
}
