#!/usr/bin/env node
// medir-publicacion.mjs
//
// Mide cuánto tarda una noticia publicada en el panel de CMS Municipal en verse
// (1) en la API pública y (2) en el portal del municipio: portada (/), listado
// (/acciones-de-gobierno) y detalle (/acciones-de-gobierno/noticias/<slug>).
// Es la prueba de punta a punta "publicar y verla en el portal en < 1 min".
//
// SOLO LECTURA: únicamente peticiones GET. Nunca publica, edita ni revalida nada.
// Requisitos: Node >= 18, sin dependencias.
//
//   node scripts/verificacion/medir-publicacion.mjs --slug villapesqueira \
//        --portal https://villapesqueira.vercel.app --titulo "Prueba Villa Pesqueira"
//   node scripts/verificacion/medir-publicacion.mjs --ayuda
//
// Códigos de salida: 0 todo visible <= 60 s tras aparecer en la API · 1 visible, pero tardó más
// · 2 no apareció antes del límite · 3 error de red o de argumentos.

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const API_POR_DEFECTO = 'https://api.northadigital.com';
export const TIMEOUT_POR_DEFECTO_MS = 15_000;
export const ESPERA_REINTENTO_MS = 1_000;
export const LIMITE_POR_DEFECTO_S = 600;
export const INTERVALO_POR_DEFECTO_S = 5;
export const UMBRAL_POR_DEFECTO_S = 60;
/** Ventana ISR de / y /acciones-de-gobierno en los portales (x-nextjs-stale-time). */
export const ISR_SEGUNDOS = 300;
/** Títulos normalizados más cortos que esto pueden dar coincidencias falsas en el HTML. */
export const TITULO_CORTO = 10;

export const CODIGOS = Object.freeze({ RAPIDO: 0, LENTO: 1, NO_APARECIO: 2, ERROR: 3 });
const RESULTADOS = Object.freeze({ 0: 'RAPIDO', 1: 'LENTO', 2: 'NO_APARECIO', 3: 'ERROR' });

export const RUTA_HOME = '/';
export const RUTA_ACCIONES = '/acciones-de-gobierno';

/** Páginas del portal que se sondean, en orden. El detalle solo existe cuando se conoce el slug. */
export const PAGINAS = Object.freeze([
  Object.freeze({ clave: 'home', tiempo: 't_home', nombre: 'portada (/)' }),
  Object.freeze({ clave: 'acciones', tiempo: 't_acciones', nombre: 'listado (/acciones-de-gobierno)' }),
  Object.freeze({ clave: 'detalle', tiempo: 't_detalle', nombre: 'detalle (/acciones-de-gobierno/noticias/<slug>)' }),
]);

const METODOS_PERMITIDOS = new Set(['GET', 'HEAD']);
const USER_AGENT = 'medir-publicacion/1.0 (CMS Municipal; solo lectura)';

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

/** Error de red o de tiempo de espera (después de agotar los reintentos). */
export class ErrorRed extends Error {
  constructor(mensaje, { url, causa, intentos } = {}) {
    super(mensaje);
    this.name = 'ErrorRed';
    this.url = url;
    this.causa = causa;
    this.intentos = intentos;
  }
}

/** Argumentos de línea de comandos inválidos. */
export class ErrorUso extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorUso';
  }
}

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

export function parsearJson(texto) {
  try {
    return { ok: true, valor: JSON.parse(texto) };
  } catch {
    return { ok: false, valor: undefined };
  }
}

function esObjetoPlano(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

/** Espera `ms`; termina antes si la señal se aborta (Ctrl+C). */
export function dormir(ms, senal) {
  return new Promise((resolver) => {
    if (!(ms > 0) || senal?.aborted) {
      resolver();
      return;
    }
    const temporizador = setTimeout(terminar, ms);
    function terminar() {
      clearTimeout(temporizador);
      senal?.removeEventListener?.('abort', terminar);
      resolver();
    }
    senal?.addEventListener?.('abort', terminar, { once: true });
  });
}

/** Redondea segundos a milésimas (para el JSON). */
export function redondear(segundos) {
  return segundos === null || segundos === undefined ? null : Math.round(segundos * 1000) / 1000;
}

/** Segundos legibles: "12.3". */
export function fmt(segundos) {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) return '—';
  return segundos.toFixed(1);
}

function plural(n, singular, pluralTexto = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** Normaliza la base de la API: sin barras finales y sin un "/api" final (las rutas ya lo incluyen). */
export function normalizarBaseApi(api) {
  const texto = String(api ?? '').trim();
  if (!/^https?:\/\//i.test(texto)) {
    throw new ErrorUso(`--api debe empezar con http:// o https:// (recibido: "${api}").`);
  }
  const base = texto.replace(/\/+$/, '').replace(/\/api$/i, '');
  try {
    new URL(base);
  } catch {
    throw new ErrorUso(`--api no es una URL válida: "${api}".`);
  }
  return base;
}

/** Normaliza la URL del portal: agrega https:// si falta y quita barras finales. */
export function normalizarPortal(portal) {
  let texto = String(portal ?? '').trim();
  if (!texto) throw new ErrorUso('--portal no puede estar vacío.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(texto)) texto = `https://${texto}`;
  if (!/^https?:\/\//i.test(texto)) {
    throw new ErrorUso(`--portal debe ser http:// o https:// (recibido: "${portal}").`);
  }
  const base = texto.replace(/\/+$/, '');
  try {
    new URL(base);
  } catch {
    throw new ErrorUso(`--portal no es una URL válida: "${portal}".`);
  }
  return base;
}

export function urlNoticias(api, slug) {
  return `${api}/api/municipios/${encodeURIComponent(slug)}/noticias`;
}

export function rutaDetalle(slugNoticia) {
  return `/acciones-de-gobierno/noticias/${encodeURIComponent(slugNoticia)}`;
}

/**
 * URL de una página del portal. Nunca agrega parámetros de consulta: un "?t=..." se saltaría
 * la caché ISR de Vercel y la medición ya no reflejaría lo que ve un visitante.
 */
export function urlPortal(portal, ruta) {
  return ruta === '/' ? `${portal}/` : `${portal}${ruta}`;
}

// --- Normalización de títulos y HTML ----------------------------------------

const MARCAS_COMBINANTES = /[̀-ͯ]/g;
const INVISIBLES = /[­​-‍⁠﻿]/g;

/**
 * Normaliza un título para comparar: sin acentos (NFKD sin marcas; ñ => n), minúsculas,
 * comillas y guiones tipográficos a ASCII, sin caracteres invisibles y espacios colapsados.
 */
export function normalizarTitulo(texto) {
  return String(texto ?? '')
    .normalize('NFKD')
    .replace(MARCAS_COMBINANTES, '')
    .replace(INVISIBLES, '')
    .replace(/[‘’‚‛′´`]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', uuml: 'ü', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Uuml: 'Ü', Ntilde: 'Ñ',
  agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù', ccedil: 'ç', Ccedil: 'Ç',
  iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º', deg: '°', middot: '·', copy: '©', reg: '®',
  laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', bull: '•', num: '#', percnt: '%',
  lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', excl: '!', quest: '?',
  shy: '­', zwsp: '​', ensp: ' ', emsp: ' ', thinsp: ' ', colon: ':',
  comma: ',', period: '.', lpar: '(', rpar: ')', sol: '/',
};

/** Decodifica entidades HTML con nombre (&amp; &oacute; ...) y numéricas (&#39; &#x27;). Una sola pasada. */
export function decodificarEntidades(texto) {
  return String(texto ?? '').replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (original, cuerpo) => {
    if (cuerpo[0] === '#') {
      const hex = cuerpo[1] === 'x' || cuerpo[1] === 'X';
      const punto = parseInt(cuerpo.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(punto) || punto < 0 || punto > 0x10ffff) return original;
      try {
        return String.fromCodePoint(punto);
      } catch {
        return original;
      }
    }
    return ENTIDADES[cuerpo] ?? ENTIDADES[cuerpo.toLowerCase()] ?? original;
  });
}

/** Resuelve los escapes de cadena JS/JSON (\" \\ \/ ó) del payload de Next.js. Una pasada. */
export function desescaparJs(texto) {
  return String(texto ?? '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\([\\"'/])/g, '$1');
}

/**
 * Variantes normalizadas del HTML donde buscar el título: crudo, sin etiquetas (con y sin
 * espacio en su lugar; cubre los <!-- --> que React mete entre textos) y con los escapes JS
 * del payload RSC resueltos (una y dos pasadas: el JSON va dentro de una cadena JS).
 */
export function variantesHtml(html) {
  const crudo = String(html ?? '');
  const unaPasada = desescaparJs(crudo);
  const variantes = [
    crudo,
    crudo.replace(/<[^>]*>/g, ' '),
    crudo.replace(/<[^>]*>/g, ''),
    unaPasada,
    desescaparJs(unaPasada),
  ];
  return [...new Set(variantes.map((v) => normalizarTitulo(decodificarEntidades(v))))];
}

/** ¿El HTML contiene el título? Compara normalizado (entidades, acentos, mayúsculas, espacios). */
export function htmlContieneTitulo(html, titulo, variantes = variantesHtml(html)) {
  const aguja = normalizarTitulo(titulo);
  if (!aguja) return false;
  return variantes.some((v) => v.includes(aguja));
}

/** Noticias de la lista cuyo título normalizado es idéntico al buscado (en el orden de la API). */
export function buscarNoticias(lista, titulo) {
  const aguja = normalizarTitulo(titulo);
  if (!aguja || !Array.isArray(lista)) return [];
  return lista.filter((n) => esObjetoPlano(n) && typeof n.titulo === 'string' && normalizarTitulo(n.titulo) === aguja);
}

/** Títulos que contienen al buscado o están contenidos en él (pistas si no hay coincidencia exacta). */
export function titulosParecidos(lista, titulo, maximo = 3) {
  const aguja = normalizarTitulo(titulo);
  if (aguja.length < 4 || !Array.isArray(lista)) return [];
  const parecidos = [];
  for (const n of lista) {
    if (!esObjetoPlano(n) || typeof n.titulo !== 'string') continue;
    const t = normalizarTitulo(n.titulo);
    if (t === aguja || t.length < 4) continue;
    if (t.includes(aguja) || aguja.includes(t)) parecidos.push(n.titulo.trim());
    if (parecidos.length >= maximo) break;
  }
  return parecidos;
}

// --- Cabeceras de caché -----------------------------------------------------

function enteroONulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const n = parseInt(valor, 10);
  return Number.isFinite(n) ? n : null;
}

/** Cabeceras de caché de Vercel/Next que interesan: x-vercel-cache, age (s) y x-nextjs-stale-time (s). */
export function cabecerasCache(headers) {
  const leer = (nombre) => headers?.get?.(nombre) ?? null;
  return {
    xVercelCache: leer('x-vercel-cache'),
    age: enteroONulo(leer('age')),
    staleTime: enteroONulo(leer('x-nextjs-stale-time')),
  };
}

/** "HIT age=280" (para las líneas de sondeo); '' si no hay cabeceras. */
export function describirCacheBreve(s) {
  const partes = [];
  if (s?.xVercelCache) partes.push(String(s.xVercelCache).toUpperCase());
  if (s?.age !== null && s?.age !== undefined) partes.push(`age=${s.age}`);
  return partes.join(' ');
}

/** "x-vercel-cache=HIT, age=280 s" (para el resumen). */
export function describirCache(s) {
  const partes = [];
  if (s?.xVercelCache) partes.push(`x-vercel-cache=${String(s.xVercelCache).toUpperCase()}`);
  if (s?.age !== null && s?.age !== undefined) partes.push(`age=${s.age} s`);
  return partes.length ? partes.join(', ') : 'sin cabeceras de caché de Vercel';
}

/**
 * Explica, con las cabeceras de caché, cómo llegó la noticia a una página: por revalidación
 * bajo demanda, por vencimiento de la ventana ISR o porque la página no se cachea.
 * `historial`: sondeos de esa página (sin errores de red), en orden. Devuelve texto o null.
 */
export function diagnosticarCache(historial, { ventana = ISR_SEGUNDOS } = {}) {
  const i = historial.findIndex((s) => s.aparece);
  if (i < 0) return null;
  const actual = historial[i];
  const cache = String(actual.xVercelCache ?? '').toUpperCase();
  if (cache === 'REVALIDATED') {
    return 'apareció con x-vercel-cache=REVALIDATED: la caché se invalidó bajo demanda (la revalidación funciona).';
  }
  const todosMiss = historial.slice(0, i + 1).every((s) => String(s.xVercelCache ?? '').toUpperCase() === 'MISS');
  if (todosMiss) {
    return 'la página no se sirve desde caché (x-vercel-cache=MISS): se renderiza en cada visita, así que se ve en cuanto está en la API.';
  }
  if (i === 0) {
    return `ya se veía en el primer sondeo (${describirCache(actual)}); no se puede saber cómo se regeneró.`;
  }
  const previo = historial[i - 1];
  if (previo.status !== actual.status) {
    return `pasó de ${previo.status} (${describirCache(previo)}) a ${actual.status} (${describirCache(actual)}).`;
  }
  const cachePrevio = String(previo.xVercelCache ?? '').toUpperCase();
  const edadEstimada = previo.age === null || previo.age === undefined ? null : previo.age + (actual.t - previo.t);
  if (cachePrevio === 'STALE' || (edadEstimada !== null && edadEstimada >= ventana)) {
    const edad = cachePrevio === 'STALE' ? '' : `; edad estimada ${fmt(edadEstimada)} s >= ${ventana} s`;
    return `el sondeo anterior recibió una copia vencida (${describirCache(previo)}${edad}): apareció al regenerarse `
      + 'por vencimiento del ISR, no por revalidación bajo demanda.';
  }
  if (edadEstimada !== null && (actual.age === null || actual.age === undefined || actual.age < edadEstimada)) {
    return `la copia se renovó antes de vencer la ventana ISR (antes ${describirCache(previo)}, edad estimada `
      + `${fmt(edadEstimada)} s < ${ventana} s; ahora ${describirCache(actual)}): señal de revalidación bajo demanda.`;
  }
  return `antes ${describirCache(previo)}; ahora ${describirCache(actual)}.`;
}

// ---------------------------------------------------------------------------
// Cliente HTTP (solo lectura, con timeout y 1 reintento)
// ---------------------------------------------------------------------------

/**
 * Crea un cliente HTTP de solo lectura. `pedir()` hace GET/HEAD con timeout por intento
 * (AbortController) y reintenta 1 vez ante error de red, timeout o 5xx.
 * Devuelve { status, ok, headers, texto, url, ms, intentos } o lanza ErrorRed.
 */
export function crearCliente({
  timeoutMs = TIMEOUT_POR_DEFECTO_MS,
  reintentos = 1,
  esperaReintentoMs = ESPERA_REINTENTO_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  let peticiones = 0;

  async function intentar(url, metodo, aceptar) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
    const inicio = Date.now();
    peticiones++;
    try {
      const res = await fetchImpl(url, {
        method: metodo,
        headers: { accept: aceptar, 'user-agent': USER_AGENT },
        redirect: 'follow',
        signal: controlador.signal,
      });
      const texto = metodo === 'HEAD' ? '' : await res.text();
      return { status: res.status, ok: res.ok, headers: res.headers, texto, url: res.url || url, ms: Date.now() - inicio };
    } catch (err) {
      if (controlador.signal.aborted) {
        throw new ErrorRed(`tiempo de espera agotado (${timeoutMs} ms)`, { url, causa: err });
      }
      const detalle = err?.cause?.code || err?.cause?.message || err?.message || String(err);
      throw new ErrorRed(`error de red (${detalle})`, { url, causa: err });
    } finally {
      clearTimeout(temporizador);
    }
  }

  async function pedir(url, { metodo = 'GET', aceptar = 'application/json' } = {}) {
    const verbo = String(metodo).toUpperCase();
    if (!METODOS_PERMITIDOS.has(verbo)) {
      throw new Error(`Solo lectura: el método ${verbo} no está permitido (solo GET y HEAD).`);
    }
    let ultimoError = null;
    for (let intento = 0; intento <= reintentos; intento++) {
      if (intento > 0 && esperaReintentoMs > 0) await dormir(esperaReintentoMs);
      try {
        const respuesta = await intentar(url, verbo, aceptar);
        respuesta.intentos = intento + 1;
        if (respuesta.status >= 500 && intento < reintentos) continue;
        return respuesta;
      } catch (err) {
        if (!(err instanceof ErrorRed)) throw err;
        err.intentos = intento + 1;
        ultimoError = err;
      }
    }
    if (ultimoError && reintentos > 0) ultimoError.message += ` tras ${ultimoError.intentos} intentos`;
    throw ultimoError;
  }

  return {
    pedir,
    get peticiones() {
      return peticiones;
    },
  };
}

/** Mensaje breve de una respuesta HTTP no exitosa ({"error": ...} o inicio del cuerpo). */
export function describirRespuesta(respuesta) {
  const json = parsearJson(respuesta.texto ?? '');
  if (json.ok && esObjetoPlano(json.valor) && typeof json.valor.error === 'string') {
    return `${respuesta.status} "${json.valor.error}"`;
  }
  const fragmento = String(respuesta.texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return fragmento ? `${respuesta.status} ${fragmento}` : `${respuesta.status}`;
}

/** ¿Es el 404 "Municipio '<slug>' no encontrado" (tenant sin alta)? "Ruta no encontrada" NO lo es. */
export function esMunicipioInexistente(status, texto) {
  if (status !== 404) return false;
  const json = parsearJson(texto ?? '');
  if (!json.ok || !esObjetoPlano(json.valor) || typeof json.valor.error !== 'string') return false;
  return /municipio/i.test(json.valor.error) && /no encontrado/i.test(json.valor.error);
}

// ---------------------------------------------------------------------------
// Medición
// ---------------------------------------------------------------------------

function nuevaPagina(ruta, url) {
  return {
    ruta,
    url,
    t: null,
    tras: null,
    status: null,
    xVercelCache: null,
    age: null,
    sondeos: 0,
    errores: 0,
    statusVistos: {},
    sinTitulo: 0,
    ultimo: null,
  };
}

/** Veredicto, código de salida y página más lenta a partir del informe. */
export function evaluar(informe) {
  const { umbralS, limiteS } = informe.parametros;
  const corte = informe.interrumpido
    ? `antes de la interrupción (Ctrl+C a los ${fmt(informe.duracionS)} s)`
    : `antes del límite (${limiteS} s)`;
  if (informe.error) {
    return { codigo: CODIGOS.ERROR, resultado: RESULTADOS[3], veredicto: 'sin medición', masLenta: null, mensaje: informe.error };
  }
  if (!informe.noticia) {
    return {
      codigo: CODIGOS.NO_APARECIO,
      resultado: RESULTADOS[2],
      veredicto: 'no apareció',
      masLenta: null,
      mensaje: `La noticia no apareció en la API ${corte}.`,
    };
  }
  const faltan = PAGINAS.filter((p) => informe.paginas[p.clave].t === null);
  if (faltan.length) {
    return {
      codigo: CODIGOS.NO_APARECIO,
      resultado: RESULTADOS[2],
      veredicto: 'no apareció',
      masLenta: null,
      mensaje: `Está en la API, pero no apareció en ${faltan.map((p) => p.nombre).join(', ')} ${corte}.`,
    };
  }
  const masLenta = PAGINAS
    .map((p) => ({ clave: p.clave, tras: informe.paginas[p.clave].tras }))
    .reduce((a, b) => (b.tras > a.tras ? b : a));
  if (masLenta.tras <= umbralS) {
    return {
      codigo: CODIGOS.RAPIDO,
      resultado: RESULTADOS[0],
      veredicto: `< ${umbralS} s`,
      masLenta,
      mensaje: `Las tres páginas mostraron la noticia <= ${umbralS} s después de la API (la más lenta: ${masLenta.clave}, +${fmt(masLenta.tras)} s).`,
    };
  }
  return {
    codigo: CODIGOS.LENTO,
    resultado: RESULTADOS[1],
    veredicto: `no (> ${umbralS} s)`,
    masLenta,
    mensaje: `Apareció, pero ${masLenta.clave} tardó +${fmt(masLenta.tras)} s después de la API (meta: ${umbralS} s).`,
  };
}

/**
 * Límite recomendado: t_api + una ventana ISR completa (peor caso: la página se regeneró
 * justo antes de publicar) + 60 s de margen para la visita que dispara la regeneración.
 */
export function limiteSugerido(tApi, ventana = ISR_SEGUNDOS) {
  return Math.max(LIMITE_POR_DEFECTO_S, Math.ceil(((tApi ?? 0) + ventana + 60) / 60) * 60);
}

/** Interpretación en lenguaje llano del resultado (lista de frases). */
export function interpretar(informe) {
  const ideas = [];
  if (informe.codigo === CODIGOS.ERROR) return ideas;
  const { umbralS, intervaloS } = informe.parametros;
  const ventana = informe.ventanaIsrS || ISR_SEGUNDOS;
  const { paginas, noticia } = informe;
  const ya = informe.yaPublicadaAlIniciar;

  if (!noticia) {
    ideas.push(`La noticia no apareció en la API en ${fmt(informe.duracionS)} s. Revisa en el panel que esté publicada `
      + '(no en borrador), que su fecha de publicación no sea futura, que el título coincida (se compara sin acentos, '
      + `mayúsculas ni espacios extra) y que sea del municipio "${informe.slug}".`);
    if (informe.parecidos?.length) {
      ideas.push(`En la API hay títulos parecidos: ${informe.parecidos.map((t) => `"${t}"`).join(', ')}. `
        + 'Si es uno de ellos, repite con ese --titulo exacto.');
    }
    if (informe.erroresApi) ideas.push(`${plural(informe.erroresApi, 'sondeo')} de la API fallaron por red.`);
    if (informe.interrumpido) ideas.push('Medición interrumpida (Ctrl+C) antes del límite.');
    return ideas;
  }

  if (informe.coincidencias > 1) {
    ideas.push(`Hay ${informe.coincidencias} noticias con ese título en la API; se tomó la primera de la lista `
      + `(slug ${noticia.slug}). Usa un título único para no confundir la medición con una prueba anterior.`);
  }
  if (ya) {
    ideas.push('La noticia ya estaba publicada al iniciar: t_api=0 y los tiempos del portal cuentan desde el arranque, '
      + 'así que NO miden la latencia real de publicación. Para medirla: arranca el script, DESPUÉS publica una noticia '
      + `con título único (p. ej. con la hora) y deja --limite de al menos ${LIMITE_POR_DEFECTO_S} s.`);
  }

  const tras = PAGINAS.map((p) => paginas[p.clave].tras).filter((n) => n !== null);
  const maxTras = tras.length ? Math.max(...tras) : null;
  if (informe.codigo === CODIGOS.RAPIDO && !ya) {
    ideas.push(`El portal mostró la noticia <= ${umbralS} s después de que apareció en la API: cumple la meta. `
      + `Confirma con las cabeceras de abajo que fue revalidación bajo demanda y no el vencimiento casual de la ventana ISR (~${ventana} s).`);
  }
  if (!ya && maxTras !== null && maxTras >= ventana * 0.8) {
    ideas.push(`Tardó ~${ventana} s o más (${fmt(maxTras)} s): probablemente NO hay revalidación bajo demanda y el portal `
      + `depende del ISR (~${ventana} s + una visita que dispare la regeneración). El portal tiene /api/revalidate `
      + '(acepta POST): el backend debe llamarlo al publicar, editar o borrar una noticia.');
  } else if (!ya && informe.codigo === CODIGOS.LENTO) {
    ideas.push(`Tardó más de ${umbralS} s pero menos que la ventana ISR (~${ventana} s): quizá la página ya estaba cerca de `
      + 'vencer su ventana ISR cuando se publicó (eso no prueba revalidación bajo demanda) o la revalidación es lenta. '
      + 'Repite la prueba y revisa las cabeceras de abajo.');
  }

  if (informe.codigo === CODIGOS.NO_APARECIO) {
    const faltan = PAGINAS.filter((p) => paginas[p.clave].t === null);
    const observado = Math.max(0, (informe.duracionS ?? 0) - informe.tApi);
    if (observado < ventana + 2 * intervaloS) {
      ideas.push(`Solo se observaron ${fmt(observado)} s después de que la noticia apareció en la API; la ventana ISR es de `
        + `~${ventana} s (+ una visita que dispare la regeneración). Repite con --limite ${limiteSugerido(informe.tApi, ventana)} `
        + 'para distinguir el ISR de un fallo real.');
    } else {
      ideas.push(`Pasaron ${fmt(observado)} s desde que apareció en la API (más que la ventana ISR de ~${ventana} s) y aún falta: `
        + `${faltan.map((p) => p.nombre).join(', ')}. No se explica solo con ISR: revisa que el portal consulte el slug `
        + `"${informe.slug}" en la API correcta, filtros por categoría o fecha, el revalidate de los fetch de Next y los registros de Vercel.`);
    }
    if (paginas.home.t === null && paginas.acciones.t !== null) {
      ideas.push('La portada puede mostrar solo las noticias más recientes por fecha de publicación: si esta noticia tiene '
        + 'una fecha anterior a otras, no saldrá en la portada.');
    }
  }

  const detalle = paginas.detalle;
  const veces404 = detalle.statusVistos['404'] ?? 0;
  if (veces404) {
    if (detalle.t === null) {
      ideas.push(`El detalle respondió 404 ${plural(veces404, 'vez', 'veces')} aunque la noticia ya estaba en la API: puede ser `
        + 'un 404 guardado en la caché de Vercel (>= 15 min) por una visita anterior a esa URL, o que la página de detalle '
        + 'no genere rutas nuevas. No abras la URL de detalle antes de publicar.');
    } else {
      ideas.push(`El detalle respondió 404 ${plural(veces404, 'vez', 'veces')} antes de mostrar la noticia.`);
    }
  }
  if (detalle.t === null && detalle.sinTitulo) {
    ideas.push('El detalle respondió 200 pero sin el título en el HTML: revisa que la página muestre el título tal como está en la API.');
  }

  for (const p of PAGINAS) {
    const historial = informe.sondeos.filter((s) => s.objetivo === p.clave && !s.error);
    const diagnostico = diagnosticarCache(historial, { ventana });
    if (diagnostico) ideas.push(`${p.clave}: ${diagnostico}`);
  }

  const erroresPortal = PAGINAS.reduce((suma, p) => suma + paginas[p.clave].errores, 0);
  const errores = erroresPortal + (informe.erroresApi ?? 0);
  if (errores) ideas.push(`${plural(errores, 'sondeo')} fallaron por red; los tiempos pueden estar inflados.`);
  if (informe.interrumpido) ideas.push('Medición interrumpida (Ctrl+C) antes de terminar.');
  return ideas;
}

class ErrorMedicion extends Error {}

/**
 * Hace la medición completa. Nunca lanza por problemas de red: devuelve el informe con
 * `codigo` (0-3). Dependencias inyectables: fetchImpl, esperaReintentoMs, ahora (ms monótonos),
 * senal (AbortSignal para detener) y alEvento(evento) para mostrar el progreso.
 */
export async function medirPublicacion(opciones, deps = {}) {
  const {
    fetchImpl = globalThis.fetch,
    esperaReintentoMs,
    ahora = () => performance.now(),
    senal,
    alEvento = () => {},
  } = deps;
  const { slug, api, portal, titulo } = opciones;
  const limiteS = opciones.limiteS ?? LIMITE_POR_DEFECTO_S;
  const intervaloS = opciones.intervaloS ?? INTERVALO_POR_DEFECTO_S;
  const umbralS = opciones.umbralS ?? UMBRAL_POR_DEFECTO_S;
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS;

  const cliente = crearCliente({ timeoutMs, fetchImpl, esperaReintentoMs });
  const t0 = ahora();
  const seg = () => (ahora() - t0) / 1000;
  const tituloNormalizado = normalizarTitulo(titulo);

  const informe = {
    herramienta: 'medir-publicacion',
    version: 1,
    slug,
    api,
    portal,
    titulo,
    tituloNormalizado,
    inicio: new Date().toISOString(),
    parametros: { limiteS, intervaloS, umbralS, timeoutMs },
    urls: {
      noticias: urlNoticias(api, slug),
      home: urlPortal(portal, RUTA_HOME),
      acciones: urlPortal(portal, RUTA_ACCIONES),
      detalle: null,
    },
    yaPublicadaAlIniciar: false,
    noticia: null,
    coincidencias: 0,
    parecidos: [],
    tApi: null,
    paginas: {
      home: nuevaPagina(RUTA_HOME, urlPortal(portal, RUTA_HOME)),
      acciones: nuevaPagina(RUTA_ACCIONES, urlPortal(portal, RUTA_ACCIONES)),
      detalle: nuevaPagina(null, null),
    },
    ventanaIsrS: ISR_SEGUNDOS,
    erroresApi: 0,
    avisos: [],
    sondeos: [],
    interrumpido: false,
    error: null,
  };

  const avisar = (mensaje) => {
    informe.avisos.push(mensaje);
    alEvento({ tipo: 'aviso', t: seg(), mensaje });
  };
  const registrar = (sondeo) => {
    informe.sondeos.push(sondeo);
    alEvento({ tipo: sondeo.objetivo === 'api' ? 'api' : 'pagina', ...sondeo });
  };

  if (tituloNormalizado.length < TITULO_CORTO) {
    avisar(`título corto ("${tituloNormalizado}"): puede coincidir con otro texto del portal; usa uno más largo y único.`);
  }

  async function sondearApi(primera) {
    const url = informe.urls.noticias;
    let r;
    try {
      r = await cliente.pedir(url);
    } catch (err) {
      if (!(err instanceof ErrorRed)) throw err;
      informe.erroresApi++;
      registrar({ objetivo: 'api', t: redondear(seg()), url, error: err.message });
      if (primera) throw new ErrorMedicion(`No se pudo consultar la API (${url}): ${err.message}.`);
      return;
    }
    const t = seg();
    const base = { objetivo: 'api', t: redondear(t), url, status: r.status, ms: r.ms, intentos: r.intentos };
    const json = parsearJson(r.texto);
    if (r.status !== 200 || !json.ok || !Array.isArray(json.valor)) {
      const detalle = r.status === 200 ? 'respuesta que no es un array JSON' : describirRespuesta(r);
      registrar({ ...base, detalle });
      if (!primera) return;
      if (esMunicipioInexistente(r.status, r.texto)) {
        throw new ErrorMedicion(`El municipio "${slug}" no existe en la API (${describirRespuesta(r)}): el alta está pendiente `
          + 'o el slug es incorrecto (distingue mayúsculas). No se puede medir.');
      }
      throw new ErrorMedicion(`La API respondió ${detalle} en ${url}; no se puede medir.`);
    }
    const lista = json.valor;
    const coincidencias = buscarNoticias(lista, titulo);
    if (!coincidencias.length) {
      const parecidos = titulosParecidos(lista, titulo);
      if (parecidos.length) informe.parecidos = parecidos;
      registrar({ ...base, total: lista.length, coincidencia: null, parecidos });
      return;
    }
    const elegida = coincidencias[0];
    informe.noticia = {
      id: elegida.id ?? null,
      slug: typeof elegida.slug === 'string' && elegida.slug ? elegida.slug : null,
      titulo: elegida.titulo,
      publicarEn: elegida.publicarEn ?? null,
      creadoEn: elegida.creadoEn ?? null,
    };
    informe.coincidencias = coincidencias.length;
    informe.yaPublicadaAlIniciar = primera;
    informe.tApi = primera ? 0 : redondear(t);
    registrar({
      ...base,
      total: lista.length,
      coincidencia: { id: informe.noticia.id, slug: informe.noticia.slug, titulo: elegida.titulo },
    });
    if (primera) avisar('ya estaba publicada al iniciar; la medición del portal empieza ahora (t_api=0).');
    if (coincidencias.length > 1) {
      avisar(`hay ${coincidencias.length} noticias con ese título; se usa la primera de la lista (slug ${informe.noticia.slug}).`);
    }
    if (informe.noticia.slug) {
      const ruta = rutaDetalle(informe.noticia.slug);
      informe.paginas.detalle.ruta = ruta;
      informe.paginas.detalle.url = urlPortal(portal, ruta);
      informe.urls.detalle = informe.paginas.detalle.url;
    } else {
      avisar('la noticia no trae slug en la API: no se puede pedir la página de detalle.');
    }
  }

  async function sondearPagina(clave) {
    const pagina = informe.paginas[clave];
    let r;
    try {
      r = await cliente.pedir(pagina.url, { aceptar: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' });
    } catch (err) {
      if (!(err instanceof ErrorRed)) throw err;
      pagina.errores++;
      registrar({ objetivo: clave, t: redondear(seg()), url: pagina.url, error: err.message });
      return false;
    }
    const t = seg();
    const cache = cabecerasCache(r.headers);
    if (cache.staleTime && cache.staleTime > 0) informe.ventanaIsrS = cache.staleTime;
    const conTitulo = r.ok && htmlContieneTitulo(r.texto, tituloNormalizado);
    pagina.sondeos++;
    pagina.statusVistos[r.status] = (pagina.statusVistos[r.status] ?? 0) + 1;
    pagina.ultimo = { status: r.status, xVercelCache: cache.xVercelCache, age: cache.age };
    // En el detalle, un 200 sin el título es raro (la URL es de esta noticia); en los listados solo es "aún no".
    const sinTitulo = clave === 'detalle' && r.status === 200 && !conTitulo;
    if (sinTitulo) pagina.sinTitulo++;
    const tras = conTitulo ? redondear(Math.max(0, t - informe.tApi)) : null;
    if (conTitulo) {
      Object.assign(pagina, { t: redondear(t), tras, status: r.status, xVercelCache: cache.xVercelCache, age: cache.age });
    }
    registrar({
      objetivo: clave,
      t: redondear(t),
      url: pagina.url,
      status: r.status,
      ms: r.ms,
      intentos: r.intentos,
      xVercelCache: cache.xVercelCache,
      age: cache.age,
      aparece: conTitulo,
      ...(conTitulo ? { tras } : {}),
      ...(sinTitulo ? { sinTitulo: true } : {}),
    });
    return true;
  }

  const pendientes = () => PAGINAS
    .map((p) => p.clave)
    .filter((c) => informe.paginas[c].t === null && informe.paginas[c].url);

  try {
    let ronda = 0;
    let primeraApi = true;
    let primeraPortal = true;
    for (;;) {
      if (senal?.aborted) {
        informe.interrumpido = true;
        break;
      }
      if (!informe.noticia) {
        await sondearApi(primeraApi);
        primeraApi = false;
      }
      if (informe.noticia) {
        const claves = pendientes();
        // Como mucho 3 peticiones en paralelo (portada, listado y detalle).
        const respondieron = await Promise.all(claves.map((c) => sondearPagina(c)));
        if (primeraPortal && claves.length && respondieron.every((ok) => !ok)) {
          throw new ErrorMedicion(`No se pudo conectar con el portal (${portal}): ninguna página respondió.`);
        }
        primeraPortal = false;
        // Sin slug no hay URL de detalle: se termina en cuanto portada y listado la muestran.
        if (pendientes().length === 0) break;
      }
      ronda++;
      const siguiente = Math.max(seg(), ronda * intervaloS);
      if (siguiente > limiteS + 1e-9) break;
      await dormir((siguiente - seg()) * 1000, senal);
      if (senal?.aborted) {
        informe.interrumpido = true;
        break;
      }
    }
  } catch (err) {
    if (!(err instanceof ErrorMedicion)) throw err;
    informe.error = err.message;
  }

  informe.duracionS = redondear(seg());
  informe.peticiones = cliente.peticiones;
  informe.tiempos = {
    t_api: informe.tApi,
    t_home: informe.paginas.home.t,
    t_acciones: informe.paginas.acciones.t,
    t_detalle: informe.paginas.detalle.t,
  };
  informe.trasApi = {
    home: informe.paginas.home.tras,
    acciones: informe.paginas.acciones.tras,
    detalle: informe.paginas.detalle.tras,
  };
  Object.assign(informe, evaluar(informe));
  informe.interpretacion = interpretar(informe);
  return informe;
}

// ---------------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------------

export function usarColor(flujo, env = process.env) {
  return Boolean(flujo?.isTTY) && env.NO_COLOR === undefined;
}

function crearPintor(activo) {
  const envolver = (codigo) => (texto) => (activo ? `\x1b[${codigo}m${texto}\x1b[0m` : String(texto));
  return {
    verde: envolver('32'),
    amarillo: envolver('33'),
    rojo: envolver('31'),
    negrita: envolver('1'),
    tenue: envolver('2'),
  };
}

export function formatearEncabezado(opciones, { color = false } = {}) {
  const p = crearPintor(color);
  return [
    p.negrita(`Medición de publicación: "${opciones.titulo}" en ${opciones.slug}`),
    `  API:     ${urlNoticias(opciones.api, opciones.slug)}`,
    `  Portal:  ${opciones.portal}  (/, ${RUTA_ACCIONES} y el detalle en cuanto la noticia esté en la API)`,
    `  Límite:  ${opciones.limiteS} s · intervalo ${opciones.intervaloS} s · meta <= ${opciones.umbralS} s tras la API`,
    p.tenue('  Si aún no la publicas, hazlo ahora en el panel. Ctrl+C detiene y muestra el resumen.'),
    '',
  ].join('\n') + '\n';
}

/** Una línea por sondeo o aviso, con marca de tiempo relativa al arranque. */
export function formatearEvento(e, { color = false } = {}) {
  const p = crearPintor(color);
  const marca = p.tenue(`[+${fmt(e.t).padStart(5)}s]`);
  if (e.tipo === 'aviso') return `${marca} ${p.amarillo('AVISO')}     ${e.mensaje}`;
  const objetivo = (e.tipo === 'api' ? 'API' : e.objetivo).padEnd(9);
  if (e.error) return `${marca} ${objetivo} ${p.rojo(e.error)}`;
  const duracion = p.tenue(` (${e.ms} ms${e.intentos > 1 ? `, ${e.intentos} intentos` : ''})`);
  if (e.tipo === 'api') {
    if (e.detalle) return `${marca} ${objetivo} ${p.rojo(e.detalle)}${duracion}`;
    let texto = `${e.status} · ${plural(e.total, 'noticia')}`;
    if (e.coincidencia) {
      texto += ` · ${p.verde('ENCONTRADA')} slug=${e.coincidencia.slug ?? '—'} id=${e.coincidencia.id ?? '—'}`;
    } else {
      texto += ` · ${p.amarillo('sin coincidencia')}`;
      if (e.parecidos?.length) texto += ` (parecida: "${e.parecidos[0]}")`;
    }
    return `${marca} ${objetivo} ${texto}${duracion}`;
  }
  let texto = `${e.status}`;
  const cache = describirCacheBreve(e);
  if (cache) texto += ` · ${cache}`;
  if (e.aparece) texto += ` · ${p.verde('APARECE')} (+${fmt(e.tras)} s tras la API)`;
  else if (e.sinTitulo) texto += ` · ${p.amarillo('200 sin el título')}`;
  else texto += ` · ${p.amarillo('aún no')}`;
  return `${marca} ${objetivo} ${texto}${duracion}`;
}

/** Resumen final legible. */
export function formatearResumen(informe, { color = false } = {}) {
  const p = crearPintor(color);
  const lineas = ['', p.negrita(`Resumen: "${informe.titulo}" en ${informe.slug}`)];
  // Con error antes de encontrar la noticia no hay tiempos que mostrar: el motivo va en "Resultado".
  if (!informe.error || informe.noticia) {
    const n = informe.noticia;
    if (n) {
      const nota = informe.yaPublicadaAlIniciar ? 'ya estaba publicada al iniciar · ' : '';
      lineas.push(`  t_api       = ${fmt(informe.tApi).padStart(6)} s  ${nota}slug ${n.slug ?? '—'} · id ${n.id ?? '—'}`);
    } else {
      lineas.push(`  t_api       = ${'—'.padStart(6)}    ${p.rojo('no apareció en la API')}`);
    }
    for (const def of PAGINAS) {
      const pag = informe.paginas[def.clave];
      const etiqueta = def.tiempo.padEnd(11);
      if (pag.t !== null) {
        const extra = def.clave === 'detalle' ? `status ${pag.status} · ` : '';
        lineas.push(`  ${etiqueta} = ${fmt(pag.t).padStart(6)} s  (+${fmt(pag.tras)} s tras la API) · ${extra}${describirCache(pag)}`);
      } else if (!n) {
        lineas.push(`  ${etiqueta} = ${'—'.padStart(6)}    sin medir (la noticia no llegó a la API)`);
      } else {
        const ultimo = pag.ultimo ? `; último: ${pag.ultimo.status}${describirCacheBreve(pag.ultimo) ? ` ${describirCacheBreve(pag.ultimo)}` : ''}` : '';
        const errores = pag.errores ? `, ${plural(pag.errores, 'error', 'errores')} de red` : '';
        const motivo = pag.url ? `${plural(pag.sondeos, 'sondeo')}${errores}${ultimo}` : 'sin URL de detalle';
        lineas.push(`  ${etiqueta} = ${'—'.padStart(6)}    ${p.rojo('no apareció')} (${motivo})`);
      }
    }
    const pintar = informe.codigo === CODIGOS.RAPIDO ? p.verde : informe.codigo === CODIGOS.LENTO ? p.amarillo : p.rojo;
    const lenta = informe.masLenta ? ` (la más lenta: ${informe.masLenta.clave}, +${fmt(informe.masLenta.tras)} s)` : '';
    if (!informe.error) lineas.push(`  Veredicto: ${pintar(informe.veredicto)}${lenta}`);
  } else {
    lineas.push(`  ${p.tenue('Sin medición.')}`);
  }
  if (informe.interpretacion?.length) {
    lineas.push('', p.negrita('Interpretación'));
    for (const idea of informe.interpretacion) lineas.push(`  - ${idea}`);
  }
  const pintarResultado = informe.codigo === CODIGOS.RAPIDO ? p.verde : informe.codigo === CODIGOS.LENTO ? p.amarillo : p.rojo;
  lineas.push('');
  lineas.push(`${p.negrita('Resultado:')} ${pintarResultado(`${informe.resultado} (código ${informe.codigo})`)} · ${informe.mensaje}`
    + p.tenue(`  (${plural(informe.peticiones ?? 0, 'petición', 'peticiones')}, ${fmt(informe.duracionS)} s)`));
  return `${lineas.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function textoAyuda() {
  return `medir-publicacion.mjs — mide cuánto tarda una noticia publicada en el panel en verse en la API
y en el portal (prueba de punta a punta "< 1 min"). Solo lectura: únicamente GET.

USO
  node medir-publicacion.mjs --slug <slug> --portal <URL> --titulo "<título>" [opciones]

  1. Arranca el script.  2. Publica en el panel la noticia con ese título (mejor si es único,
  p. ej. "Prueba Villa Pesqueira 14:32").  3. Espera el resumen.

OPCIONES
  --slug slug          Municipio (distingue mayúsculas), p. ej. villapesqueira.
  --portal URL         Portal del municipio, p. ej. https://villapesqueira.vercel.app
  --titulo "texto"     Título de la noticia. Se compara normalizado: sin acentos, en minúsculas
                       y con espacios colapsados (en la API, título idéntico; en el HTML, que lo
                       contenga, resolviendo entidades como &amp; &oacute; &#x27;).
  --limite s           Segundos máximos desde el arranque (por defecto ${LIMITE_POR_DEFECTO_S}).
  --intervalo s        Segundos entre sondeos (por defecto ${INTERVALO_POR_DEFECTO_S}; admite decimales).
  --umbral s           Meta después de aparecer en la API (por defecto ${UMBRAL_POR_DEFECTO_S}).
  --api URL            Base de la API (por defecto ${API_POR_DEFECTO}).
  --timeout ms         Tiempo máximo por petición (por defecto ${TIMEOUT_POR_DEFECTO_MS}).
                       Se reintenta 1 vez ante error de red, timeout o 5xx.
  --json               Informe JSON en stdout (el progreso se escribe en stderr).
  --ayuda, -h          Muestra esta ayuda.

QUÉ HACE (todo GET)
  1. Sondea GET /api/municipios/<slug>/noticias cada --intervalo s hasta ver el título:
     t_api = segundos desde el arranque. Si ya estaba al arrancar, lo avisa y t_api=0.
  2. Desde t_api sondea <portal>/ (t_home) y <portal>${RUTA_ACCIONES} (t_acciones) sin
     parámetros extra (para no saltarse la caché ISR) y anota x-vercel-cache y age de la
     respuesta en la que apareció. /noticias no se usa: en estos portales es 404.
  3. Solo cuando la noticia ya está en la API pide el detalle
     <portal>${RUTA_ACCIONES}/noticias/<slug> (t_detalle y su status): un 404 pedido
     antes quedaría en la caché de Vercel >= 15 min y arruinaría la prueba.
  4. Termina cuando las tres páginas la muestran o al llegar a --limite.

CÓDIGOS DE SALIDA
  0  las tres páginas la mostraron <= --umbral s (${UMBRAL_POR_DEFECTO_S}) después de t_api
  1  aparecieron, pero alguna tardó más de --umbral s
  2  no apareció (en la API o en alguna página) antes de --limite
  3  error de red (API o portal inalcanzable) o de argumentos (p. ej. municipio inexistente)

INTERPRETACIÓN
  ~${ISR_SEGUNDOS} s o más => probablemente no hay revalidación bajo demanda: el portal depende del ISR
  (~${ISR_SEGUNDOS} s + una visita que dispare la regeneración). El portal tiene /api/revalidate (acepta
  POST); el backend debe llamarlo al publicar. x-vercel-cache=REVALIDATED, o una copia que se
  renueva antes de cumplir ${ISR_SEGUNDOS} s de age, indican revalidación bajo demanda.

EJEMPLOS
  node medir-publicacion.mjs --slug villapesqueira --portal https://villapesqueira.vercel.app \\
       --titulo "Prueba Villa Pesqueira"
  node medir-publicacion.mjs --slug carbo --portal https://carbotransparencia.com.mx \\
       --titulo "Prueba Carbó 14:32" --limite 900 --json > medicion.json
`;
}

function traducirErrorParseArgs(err) {
  const mensaje = String(err?.message ?? err);
  const opcion = mensaje.match(/'(-{1,2}[^' ]+)/)?.[1] ?? '';
  switch (err?.code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION':
      return `Opción desconocida: ${opcion || mensaje}`;
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE':
      if (/ambiguous/i.test(mensaje)) {
        return `El valor de ${opcion} empieza con "-": escríbelo como ${opcion}="valor".`;
      }
      return `La opción ${opcion || ''} requiere un valor.`.replace('  ', ' ');
    case 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL':
      return `Argumento inesperado: ${mensaje}`;
    default:
      return mensaje;
  }
}

function leerSegundos(valor, opcion) {
  const texto = String(valor).trim().replace(',', '.');
  const n = Number(texto);
  if (!texto || !Number.isFinite(n) || n <= 0) {
    throw new ErrorUso(`${opcion} debe ser un número de segundos mayor que 0 (recibido: "${valor}").`);
  }
  return n;
}

/** Analiza argv (sin "node" ni el script). Lanza ErrorUso si algo no cuadra. */
export function analizarArgumentos(argv) {
  let valores;
  let posicionales;
  try {
    ({ values: valores, positionals: posicionales } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        slug: { type: 'string' },
        portal: { type: 'string' },
        titulo: { type: 'string' },
        limite: { type: 'string' },
        intervalo: { type: 'string' },
        umbral: { type: 'string' },
        api: { type: 'string' },
        timeout: { type: 'string' },
        json: { type: 'boolean', default: false },
        ayuda: { type: 'boolean', short: 'h', default: false },
        help: { type: 'boolean', default: false },
      },
    }));
  } catch (err) {
    throw new ErrorUso(traducirErrorParseArgs(err));
  }

  const opciones = {
    ayuda: Boolean(valores.ayuda || valores.help),
    json: Boolean(valores.json),
    slug: null,
    portal: null,
    titulo: null,
    limiteS: LIMITE_POR_DEFECTO_S,
    intervaloS: INTERVALO_POR_DEFECTO_S,
    umbralS: UMBRAL_POR_DEFECTO_S,
    api: API_POR_DEFECTO,
    timeoutMs: TIMEOUT_POR_DEFECTO_MS,
  };
  if (opciones.ayuda) return opciones;

  if (posicionales.length > 1 || (posicionales.length === 1 && valores.slug !== undefined)) {
    throw new ErrorUso(`Sobran argumentos: ${posicionales.join(' ')} (¿olvidaste las comillas en --titulo "..."?).`);
  }
  const slug = String(valores.slug ?? posicionales[0] ?? '').trim();
  if (!slug) throw new ErrorUso('Falta --slug (p. ej. --slug villapesqueira).');
  if (slug.includes('/') || /\s/.test(slug)) throw new ErrorUso(`Slug inválido: "${slug}".`);
  opciones.slug = slug;

  if (valores.portal === undefined) throw new ErrorUso('Falta --portal (p. ej. --portal https://villapesqueira.vercel.app).');
  opciones.portal = normalizarPortal(valores.portal);

  if (valores.titulo === undefined) throw new ErrorUso('Falta --titulo "Título de la noticia".');
  if (!normalizarTitulo(valores.titulo)) throw new ErrorUso('--titulo no puede estar vacío.');
  opciones.titulo = valores.titulo.trim();

  if (valores.limite !== undefined) opciones.limiteS = leerSegundos(valores.limite, '--limite');
  if (valores.intervalo !== undefined) opciones.intervaloS = leerSegundos(valores.intervalo, '--intervalo');
  if (valores.umbral !== undefined) opciones.umbralS = leerSegundos(valores.umbral, '--umbral');
  if (valores.api !== undefined) opciones.api = normalizarBaseApi(valores.api);
  if (valores.timeout !== undefined) {
    const ms = Number(valores.timeout);
    if (!/^\d+$/.test(valores.timeout.trim()) || !Number.isSafeInteger(ms) || ms <= 0) {
      throw new ErrorUso(`--timeout debe ser un entero positivo en milisegundos (recibido: "${valores.timeout}").`);
    }
    opciones.timeoutMs = ms;
  }
  return opciones;
}

/**
 * Punto de entrada. Devuelve el código de salida (no llama a process.exit).
 * entorno: { stdout, stderr, env, fetchImpl, esperaReintentoMs, senal, ahora } (inyectables en pruebas).
 */
export async function main(argv = process.argv.slice(2), entorno = {}) {
  const {
    stdout = process.stdout,
    stderr = process.stderr,
    env = process.env,
    fetchImpl = globalThis.fetch,
    esperaReintentoMs,
    senal,
    ahora,
  } = entorno;

  let opciones;
  try {
    opciones = analizarArgumentos(argv);
  } catch (err) {
    if (!(err instanceof ErrorUso)) throw err;
    stderr.write(`Error: ${err.message}\nUsa --ayuda para ver el uso.\n`);
    return CODIGOS.ERROR;
  }
  if (opciones.ayuda) {
    stdout.write(textoAyuda());
    return 0;
  }
  if (typeof fetchImpl !== 'function') {
    stderr.write('Error: este Node no tiene fetch global; se requiere Node >= 18.\n');
    return CODIGOS.ERROR;
  }

  // Con --json el progreso va a stderr para que stdout sea JSON puro.
  const progreso = opciones.json ? stderr : stdout;
  const color = usarColor(progreso, env);
  progreso.write(formatearEncabezado(opciones, { color }));
  const alEvento = (evento) => progreso.write(`${formatearEvento(evento, { color })}\n`);

  let informe;
  try {
    informe = await medirPublicacion(opciones, { fetchImpl, esperaReintentoMs, senal, alEvento, ...(ahora ? { ahora } : {}) });
  } catch (err) {
    const mensaje = `Error inesperado: ${err?.message ?? err}`;
    if (opciones.json) {
      stdout.write(`${JSON.stringify({ herramienta: 'medir-publicacion', slug: opciones.slug, resultado: 'ERROR', codigo: CODIGOS.ERROR, mensaje }, null, 2)}\n`);
    }
    stderr.write(`${mensaje}\n${err?.stack ? `${err.stack}\n` : ''}`);
    return CODIGOS.ERROR;
  }

  if (opciones.json) {
    stdout.write(`${JSON.stringify(informe, null, 2)}\n`);
    stderr.write(`Resultado: ${informe.resultado} (código ${informe.codigo}) · ${informe.mensaje}\n`);
  } else {
    stdout.write(formatearResumen(informe, { color }));
  }
  return informe.codigo;
}

function esPuntoDeEntrada() {
  if (!process.argv[1]) return false;
  try {
    if (import.meta.url === pathToFileURL(process.argv[1]).href) return true;
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (esPuntoDeEntrada()) {
  // Primer Ctrl+C: termina la medición y muestra el resumen parcial. Segundo: sale ya.
  const detener = new AbortController();
  process.once('SIGINT', () => {
    detener.abort();
    process.once('SIGINT', () => process.exit(130));
  });
  main(process.argv.slice(2), { senal: detener.signal }).then(
    (codigo) => {
      process.exitCode = codigo;
    },
    (err) => {
      process.stderr.write(`Error inesperado: ${err?.stack ?? err}\n`);
      process.exitCode = CODIGOS.ERROR;
    },
  );
}
