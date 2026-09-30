#!/usr/bin/env node
// verificar-alta.mjs
//
// Verifica que el alta de un municipio (tenant) en CMS Municipal quedó bien:
// la API pública lo sirve completo y aislado, y (opcionalmente) el portal lo muestra.
//
// SOLO LECTURA: únicamente hace peticiones GET/HEAD. Nunca escribe nada.
// Requisitos: Node >= 18, sin dependencias.
//
//   node scripts/verificacion/verificar-alta.mjs carbo --nombre "Carbó" --portal https://carbotransparencia.com.mx
//   node scripts/verificacion/verificar-alta.mjs --ayuda
//
// Códigos de salida: 0 OK (avisos permitidos) · 1 alguna FALLA · 2 ALTA_PENDIENTE · 3 error de red/inesperado.

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const API_POR_DEFECTO = 'https://api.northadigital.com';
export const TIMEOUT_POR_DEFECTO_MS = 15_000;
export const ESPERA_REINTENTO_MS = 1_000;
export const CONCURRENCIA_MAXIMA = 3;
export const PREFIJO_NOMBRE = 'H. Ayuntamiento de ';
export const ISR_SEGUNDOS = 300;

/** Subrutas públicas de /api/municipios/:slug (todas devuelven un array). */
export const SUBRUTAS = [
  'hero', 'noticias', 'sevac', 'estadisticas', 'documentos', 'funcionarios', 'atractivos', 'imagenes',
];

/** Subrutas que, vacías, pueden hacer que el portal oculte su bloque. */
const TEXTO_BLOQUE_VACIO = {
  hero: 'el hero',
  estadisticas: 'las estadísticas',
};

export const CODIGOS = Object.freeze({ OK: 0, FALLA: 1, ALTA_PENDIENTE: 2, ERROR: 3 });
export const ESTADOS = Object.freeze({ OK: 'OK', AVISO: 'AVISO', FALLA: 'FALLA' });

export const SECCIONES = Object.freeze({
  municipio: '1. Municipio en la API',
  listado: '2. Listado de municipios',
  contenido: '3. Contenido por subruta',
  portal: '4. Portal',
});

const METODOS_PERMITIDOS = new Set(['GET', 'HEAD']);
const USER_AGENT = 'verificar-alta/1.0 (CMS Municipal; solo lectura)';
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATRON_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export function esUuid(valor) {
  return typeof valor === 'string' && PATRON_UUID.test(valor);
}

export function quitarAcentos(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

export function parsearJson(texto) {
  try {
    return { ok: true, valor: JSON.parse(texto) };
  } catch {
    return { ok: false, valor: undefined };
  }
}

export function esObjetoPlano(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

export const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

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

/** Construye una URL de /api/municipios[/seg...] escapando cada segmento. */
export function urlApi(base, ...segmentos) {
  return `${base}/api/municipios${segmentos.map((s) => `/${encodeURIComponent(s)}`).join('')}`;
}

/** Ruta legible (sin la base) para los mensajes. */
function rutaVisible(url, base) {
  return url.startsWith(base) ? url.slice(base.length) || '/' : url;
}

/** ¿La respuesta es el 404 "Municipio ... no encontrado" (alta pendiente)? "Ruta no encontrada" NO lo es. */
export function esAltaPendiente(status, cuerpo) {
  if (status !== 404 || !esObjetoPlano(cuerpo) || typeof cuerpo.error !== 'string') return false;
  return /\bno encontrado\b/i.test(cuerpo.error) && !/\bruta\b/i.test(cuerpo.error);
}

// --- Entidades HTML y normalización de texto -------------------------------

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', uuml: 'ü', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Uuml: 'Ü', Ntilde: 'Ñ',
  iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º', deg: '°', middot: '·', copy: '©', reg: '®',
  laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', bull: '•',
  lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„',
  shy: '­', zwsp: '​', ensp: ' ', emsp: ' ', thinsp: ' ',
};

/** Decodifica entidades HTML con nombre (&amp; &aacute; ...) y numéricas (&#39; &#x27;). Una sola pasada. */
export function decodificarEntidades(texto) {
  return String(texto).replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (original, cuerpo) => {
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

/**
 * Normaliza un texto para comparar: decodifica entidades, NFC, comillas tipográficas
 * a rectas, quita guiones suaves / ancho cero y colapsa todo espacio (incl. &nbsp;) a uno.
 */
export function normalizarTexto(texto) {
  return decodificarEntidades(texto)
    .normalize('NFC')
    .replace(/[­​‌‍⁠﻿]/g, '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Variantes normalizadas del HTML donde buscar un texto:
 * crudo, sin etiquetas (con y sin espacio en su lugar) y con los escapes JS/JSON
 * del payload de Next.js (\" ó ...) resueltos.
 */
export function variantesHtml(html) {
  const crudo = String(html ?? '');
  const sinEscapesJs = crudo
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(["'\\/])/g, '$1');
  return [
    crudo,
    crudo.replace(/<[^>]*>/g, ' '),
    crudo.replace(/<[^>]*>/g, ''),
    sinEscapesJs,
  ].map(normalizarTexto);
}

/** ¿El HTML contiene el texto (comparando con entidades y espacios normalizados)? Distingue mayúsculas. */
export function contieneTexto(html, buscado, variantes = variantesHtml(html)) {
  const aguja = normalizarTexto(buscado);
  if (!aguja) return true;
  return variantes.some((v) => v.includes(aguja));
}

/** Cabeceras de caché de Vercel/Next que interesa reportar. */
export function cabecerasCache(headers) {
  const leer = (nombre) => headers?.get?.(nombre) ?? null;
  return {
    'x-vercel-cache': leer('x-vercel-cache'),
    age: leer('age'),
    'x-nextjs-stale-time': leer('x-nextjs-stale-time'),
  };
}

export function describirCabeceras(cabeceras) {
  const partes = [];
  for (const [nombre, valor] of Object.entries(cabeceras)) {
    if (valor === null || valor === undefined || valor === '') continue;
    partes.push(`${nombre}=${valor}${nombre === 'age' ? ' s' : ''}`);
  }
  return partes.length ? partes.join(', ') : 'sin cabeceras de caché de Vercel';
}

/** Sugerencia para un texto que falta en la portada, según las cabeceras de caché. */
export function sugerenciaCache(cabeceras) {
  const cache = String(cabeceras['x-vercel-cache'] ?? '').toUpperCase();
  const edad = parseInt(cabeceras.age, 10);
  const ventana = parseInt(cabeceras['x-nextjs-stale-time'], 10) || ISR_SEGUNDOS;
  let texto = `puede ser la caché ISR (~${ventana} s) del portal`;
  if (cache) texto += ` (x-vercel-cache=${cache}${Number.isFinite(edad) ? `, age=${edad} s` : ''})`;
  if (cache === 'STALE') {
    texto += '; esa visita ya disparó la regeneración: reintenta en unos segundos';
  } else if ((cache === 'HIT' || cache === 'PRERENDER') && Number.isFinite(edad) && edad < ventana) {
    texto += `; la copia en caché puede tardar ~${ventana - edad} s más en regenerarse: reintenta después`;
  } else {
    texto += '; reintenta en unos minutos';
  }
  return texto;
}

/** Mensaje breve de error de una respuesta HTTP ({"error": ...} o inicio del cuerpo). */
export function describirRespuesta(respuesta) {
  const json = parsearJson(respuesta.texto ?? '');
  if (json.ok && esObjetoPlano(json.valor) && typeof json.valor.error === 'string') {
    return `${respuesta.status} "${json.valor.error}"`;
  }
  const fragmento = String(respuesta.texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return fragmento ? `${respuesta.status} ${fragmento}` : `${respuesta.status}`;
}

function plural(n, singular, pluralTexto = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

function listaCorta(valores, maximo = 3) {
  const unicos = [...new Set(valores.map(String))];
  const visibles = unicos.slice(0, maximo).join(', ');
  return unicos.length > maximo ? `${visibles} y ${unicos.length - maximo} más` : visibles;
}

/** Ejecuta fn sobre los elementos con, como mucho, `limite` en paralelo. Conserva el orden. */
export async function mapearConConcurrencia(elementos, limite, fn) {
  const resultados = new Array(elementos.length);
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.max(1, Math.min(limite, elementos.length)) }, async () => {
    while (siguiente < elementos.length) {
      const indice = siguiente++;
      resultados[indice] = await fn(elementos[indice], indice);
    }
  });
  await Promise.all(trabajadores);
  return resultados;
}

export function resumir(comprobaciones) {
  const resumen = { ok: 0, aviso: 0, falla: 0 };
  for (const c of comprobaciones) {
    if (c.estado === ESTADOS.OK) resumen.ok++;
    else if (c.estado === ESTADOS.AVISO) resumen.aviso++;
    else if (c.estado === ESTADOS.FALLA) resumen.falla++;
  }
  return resumen;
}

// ---------------------------------------------------------------------------
// Cliente HTTP (solo lectura, con timeout y 1 reintento)
// ---------------------------------------------------------------------------

/**
 * Crea un cliente HTTP de solo lectura. `pedir()` hace GET/HEAD con timeout por
 * intento (AbortController) y reintenta ante error de red, timeout o 5xx.
 * Devuelve { status, ok, headers, texto, url, redirigido, ms, intentos } o lanza ErrorRed.
 */
export function crearCliente({
  timeoutMs = TIMEOUT_POR_DEFECTO_MS,
  reintentos = 1,
  esperaReintentoMs = ESPERA_REINTENTO_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  let peticiones = 0;

  async function intentar(url, metodo, { leerCuerpo, aceptar }) {
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
      let texto = '';
      if (metodo !== 'HEAD' && leerCuerpo) {
        texto = await res.text();
      } else {
        await res.body?.cancel?.().catch(() => {});
      }
      return {
        status: res.status,
        ok: res.ok,
        headers: res.headers,
        texto,
        url: res.url || url,
        redirigido: Boolean(res.redirected),
        ms: Date.now() - inicio,
      };
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

  async function pedir(url, { metodo = 'GET', leerCuerpo = true, aceptar = 'application/json' } = {}) {
    const verbo = String(metodo).toUpperCase();
    if (!METODOS_PERMITIDOS.has(verbo)) {
      throw new Error(`Solo lectura: el método ${verbo} no está permitido (solo GET y HEAD).`);
    }
    let ultimoError = null;
    for (let intento = 0; intento <= reintentos; intento++) {
      if (intento > 0 && esperaReintentoMs > 0) await dormir(esperaReintentoMs);
      try {
        const respuesta = await intentar(url, verbo, { leerCuerpo, aceptar });
        respuesta.intentos = intento + 1;
        if (respuesta.status >= 500 && intento < reintentos) continue;
        return respuesta;
      } catch (err) {
        if (!(err instanceof ErrorRed)) throw err;
        err.intentos = intento + 1;
        ultimoError = err;
      }
    }
    if (ultimoError && reintentos > 0) {
      ultimoError.message += ` tras ${ultimoError.intentos} intentos`;
    }
    throw ultimoError;
  }

  return {
    pedir,
    get peticiones() {
      return peticiones;
    },
  };
}

// ---------------------------------------------------------------------------
// Comprobaciones
// ---------------------------------------------------------------------------

function comprobacion(seccion, clave, estado, detalle, datos) {
  return { seccion, clave, estado, detalle, ...(datos === undefined ? {} : { datos }) };
}

/** Campos del objeto municipio (sin red). */
export function comprobarCamposMunicipio(municipio, { slug, nombre }) {
  const s = 'municipio';
  const lista = [];

  lista.push(esUuid(municipio.id)
    ? comprobacion(s, 'id', ESTADOS.OK, `${municipio.id} (UUID válido)`)
    : comprobacion(s, 'id', ESTADOS.FALLA, `id no es un UUID: ${JSON.stringify(municipio.id)}`));

  lista.push(municipio.slug === slug
    ? comprobacion(s, 'slug', ESTADOS.OK, `"${municipio.slug}" coincide`)
    : comprobacion(s, 'slug', ESTADOS.FALLA, `la API devolvió slug ${JSON.stringify(municipio.slug)}; se esperaba "${slug}"`));

  lista.push(municipio.activo === true
    ? comprobacion(s, 'activo', ESTADOS.OK, 'true')
    : comprobacion(s, 'activo', ESTADOS.FALLA,
      `activo = ${JSON.stringify(municipio.activo)}; debe ser true para que el portal lo muestre (actívalo en el panel o en la BD)`));

  lista.push(typeof municipio.estado === 'string' && municipio.estado.trim()
    ? comprobacion(s, 'estado', ESTADOS.OK, municipio.estado)
    : comprobacion(s, 'estado', ESTADOS.FALLA, `estado vacío o ausente: ${JSON.stringify(municipio.estado)}`));

  const nombreApi = typeof municipio.nombre === 'string' ? normalizarTexto(municipio.nombre) : '';
  if (!nombreApi) {
    lista.push(comprobacion(s, 'nombre', ESTADOS.FALLA, `nombre vacío o ausente: ${JSON.stringify(municipio.nombre)}`));
  } else {
    if (nombre) {
      const esperado = normalizarTexto(nombre);
      if (nombreApi.includes(esperado)) {
        lista.push(comprobacion(s, 'nombre', ESTADOS.OK, `"${municipio.nombre}" incluye "${nombre}"`));
      } else {
        const casi = quitarAcentos(nombreApi).toLowerCase().includes(quitarAcentos(esperado).toLowerCase());
        lista.push(comprobacion(s, 'nombre', ESTADOS.FALLA,
          `"${municipio.nombre}" no incluye "${nombre}"${casi ? ' (solo coincide ignorando acentos/mayúsculas: revisa la ortografía)' : ''}`));
      }
    } else {
      lista.push(comprobacion(s, 'nombre', ESTADOS.OK, `"${municipio.nombre}" (sin --nombre para comparar)`));
    }
    lista.push(municipio.nombre.startsWith(PREFIJO_NOMBRE)
      ? comprobacion(s, 'convención nombre', ESTADOS.OK, `empieza por "${PREFIJO_NOMBRE}"`)
      : comprobacion(s, 'convención nombre', ESTADOS.AVISO,
        `no empieza por "${PREFIJO_NOMBRE}" (13 de 14 tenants siguen esa convención)`));
  }

  if (municipio.dominio === null || municipio.dominio === undefined || municipio.dominio === '') {
    lista.push(comprobacion(s, 'dominio', ESTADOS.AVISO, 'sin dominio propio (esperado mientras no haya dominio)'));
  } else {
    lista.push(comprobacion(s, 'dominio', ESTADOS.OK, String(municipio.dominio)));
  }
  return lista;
}

async function comprobarEscudo(cliente, municipio, api) {
  const s = 'municipio';
  const valor = municipio.escudoUrl;
  if (typeof valor !== 'string' || !valor.trim()) {
    return [comprobacion(s, 'escudo', ESTADOS.FALLA, 'escudoUrl vacío: sube el escudo en el panel')];
  }
  let url;
  try {
    url = new URL(valor.trim(), `${api}/`).href;
  } catch {
    return [comprobacion(s, 'escudo', ESTADOS.FALLA, `escudoUrl no es una URL válida: ${JSON.stringify(valor)}`)];
  }
  const esImagen = (r) => r.status === 200 && /^image\//i.test(r.headers.get('content-type') ?? '');
  let respuesta = null;
  let via = 'HEAD';
  try {
    respuesta = await cliente.pedir(url, { metodo: 'HEAD', aceptar: 'image/*' });
  } catch {
    respuesta = null;
  }
  if (!respuesta || !esImagen(respuesta)) {
    via = respuesta ? `GET (HEAD dio ${respuesta.status})` : 'GET (HEAD sin respuesta)';
    try {
      respuesta = await cliente.pedir(url, { metodo: 'GET', aceptar: 'image/*', leerCuerpo: false });
    } catch (err) {
      return [comprobacion(s, 'escudo', ESTADOS.FALLA, `${url} inalcanzable: ${err.message}`, { url })];
    }
  }
  const tipo = respuesta.headers.get('content-type') ?? '';
  const datos = { url, status: respuesta.status, contentType: tipo || null, via };
  if (esImagen(respuesta)) {
    const bytes = parseInt(respuesta.headers.get('content-length') ?? '', 10);
    const tam = Number.isFinite(bytes) ? `, ${Math.round(bytes / 1024)} KB` : '';
    return [comprobacion(s, 'escudo', ESTADOS.OK, `200 ${tipo}${tam} vía ${via}`, datos)];
  }
  return [comprobacion(s, 'escudo', ESTADOS.FALLA,
    `${url} -> ${respuesta.status}, content-type "${tipo || '(ninguno)'}" vía ${via}; se esperaba 200 image/*`, datos)];
}

async function comprobarListado(cliente, api, slug, id) {
  const s = 'listado';
  const url = urlApi(api);
  let respuesta;
  try {
    respuesta = await cliente.pedir(url);
  } catch (err) {
    return [comprobacion(s, 'aparece 1 vez', ESTADOS.FALLA, `GET /api/municipios: ${err.message}`)];
  }
  if (respuesta.status !== 200) {
    return [comprobacion(s, 'aparece 1 vez', ESTADOS.FALLA, `GET /api/municipios -> ${describirRespuesta(respuesta)}`)];
  }
  const json = parsearJson(respuesta.texto);
  if (!json.ok || !Array.isArray(json.valor)) {
    return [comprobacion(s, 'aparece 1 vez', ESTADOS.FALLA, 'GET /api/municipios no devolvió un array JSON')];
  }
  const lista = json.valor;
  const coincidencias = lista.filter((m) => esObjetoPlano(m) && m.slug === slug);
  const datos = { total: lista.length, apariciones: coincidencias.length, ids: coincidencias.map((m) => m.id) };
  const resultado = [];
  if (coincidencias.length === 0) {
    resultado.push(comprobacion(s, 'aparece 1 vez', ESTADOS.FALLA,
      `"${slug}" no aparece en GET /api/municipios (${plural(lista.length, 'municipio')}); ¿filtro por activo o caché?`, datos));
  } else if (coincidencias.length > 1) {
    resultado.push(comprobacion(s, 'aparece 1 vez', ESTADOS.FALLA,
      `"${slug}" aparece ${coincidencias.length} veces (ids: ${listaCorta(datos.ids, 5)}): slug duplicado`, datos));
  } else if (coincidencias[0].id !== id) {
    resultado.push(comprobacion(s, 'aparece 1 vez', ESTADOS.FALLA,
      `"${slug}" aparece con otro id (${coincidencias[0].id} ≠ ${id})`, datos));
  } else {
    resultado.push(comprobacion(s, 'aparece 1 vez', ESTADOS.OK,
      `1 vez con el mismo id (${plural(lista.length, 'municipio')} en total)`, datos));
  }
  const parecidos = lista.filter((m) => esObjetoPlano(m) && typeof m.slug === 'string'
    && m.slug !== slug && m.slug.toLowerCase() === slug.toLowerCase());
  if (parecidos.length) {
    resultado.push(comprobacion(s, 'slug parecido', ESTADOS.AVISO,
      `hay otro municipio con slug que solo difiere en mayúsculas: ${listaCorta(parecidos.map((m) => m.slug))}`));
  }
  return resultado;
}

async function comprobarSubruta(cliente, api, slug, id, subruta) {
  const s = 'contenido';
  const url = urlApi(api, slug, subruta);
  let respuesta;
  try {
    respuesta = await cliente.pedir(url);
  } catch (err) {
    return [comprobacion(s, subruta, ESTADOS.FALLA, `${rutaVisible(url, api)}: ${err.message}`)];
  }
  if (respuesta.status !== 200) {
    return [comprobacion(s, subruta, ESTADOS.FALLA, `${rutaVisible(url, api)} -> ${describirRespuesta(respuesta)}`)];
  }
  const json = parsearJson(respuesta.texto);
  if (!json.ok || !Array.isArray(json.valor)) {
    return [comprobacion(s, subruta, ESTADOS.FALLA, `${rutaVisible(url, api)} respondió 200 pero no es un array JSON`)];
  }
  const elementos = json.valor;
  const conId = elementos.filter((e) => esObjetoPlano(e) && e.municipioId !== undefined && e.municipioId !== null);
  const ajenos = conId.filter((e) => e.municipioId !== id);
  const datos = { conteo: elementos.length, conMunicipioId: conId.length, ajenos: ajenos.length };
  const resultado = [];

  if (ajenos.length) {
    datos.municipioIdsAjenos = [...new Set(ajenos.map((e) => e.municipioId))];
    resultado.push(comprobacion(s, subruta, ESTADOS.FALLA,
      `FUGA: ${ajenos.length} de ${plural(elementos.length, 'elemento')} con municipioId ajeno `
      + `(${listaCorta(datos.municipioIdsAjenos)}); p. ej. id ${ajenos[0].id ?? '(sin id)'}`, datos));
  } else if (elementos.length === 0 && TEXTO_BLOQUE_VACIO[subruta]) {
    resultado.push(comprobacion(s, subruta, ESTADOS.AVISO,
      `0 elementos: el portal podría ocultar ${TEXTO_BLOQUE_VACIO[subruta]} si el servidor no conserva el respaldo `
      + 'con listas vacías; carga contenido en el panel', datos));
  } else {
    let nota = '';
    if (conId.length === elementos.length && elementos.length) nota = '; municipioId correcto en todos';
    else if (conId.length) nota = `; municipioId correcto en ${conId.length}`;
    else if (elementos.length) nota = '; la lista no trae municipioId';
    resultado.push(comprobacion(s, subruta, ESTADOS.OK, `${plural(elementos.length, 'elemento')}${nota}`, datos));
  }

  // La lista de noticias no trae municipioId: se revisa el detalle de una noticia de muestra.
  if (subruta === 'noticias') {
    const muestra = elementos.find((e) => esObjetoPlano(e) && typeof e.slug === 'string' && e.slug);
    if (muestra) resultado.push(await comprobarDetalleNoticia(cliente, api, slug, id, muestra.slug));
  }
  return resultado;
}

async function comprobarDetalleNoticia(cliente, api, slug, id, slugNoticia) {
  const s = 'contenido';
  const clave = 'noticias (detalle)';
  const url = urlApi(api, slug, 'noticias', slugNoticia);
  let respuesta;
  try {
    respuesta = await cliente.pedir(url);
  } catch (err) {
    return comprobacion(s, clave, ESTADOS.AVISO, `no se pudo revisar la noticia de muestra "${slugNoticia}": ${err.message}`);
  }
  if (respuesta.status !== 200) {
    return comprobacion(s, clave, ESTADOS.AVISO,
      `la noticia de muestra "${slugNoticia}" está en la lista pero su detalle da ${describirRespuesta(respuesta)}`);
  }
  const json = parsearJson(respuesta.texto);
  if (!json.ok || !esObjetoPlano(json.valor)) {
    return comprobacion(s, clave, ESTADOS.AVISO, `el detalle de "${slugNoticia}" no es un objeto JSON`);
  }
  const { municipioId } = json.valor;
  if (municipioId === undefined || municipioId === null) {
    return comprobacion(s, clave, ESTADOS.OK, `"${slugNoticia}" responde 200 (sin municipioId para comparar)`);
  }
  if (municipioId !== id) {
    return comprobacion(s, clave, ESTADOS.FALLA,
      `FUGA: la noticia "${slugNoticia}" pertenece a otro municipio (municipioId ${municipioId})`, { municipioId });
  }
  return comprobacion(s, clave, ESTADOS.OK, `muestra "${slugNoticia}": municipioId correcto`);
}

async function comprobarPortal(cliente, portal, { nombre, textos }) {
  const s = 'portal';
  const resultado = [];

  const urlPortada = `${portal}/`;
  let portada = null;
  try {
    portada = await cliente.pedir(urlPortada, { aceptar: 'text/html' });
  } catch (err) {
    resultado.push(comprobacion(s, 'portada /', ESTADOS.FALLA, `${urlPortada} inalcanzable: ${err.message}`));
  }
  if (portada) {
    const cabeceras = cabecerasCache(portada.headers);
    const redireccion = portada.redirigido ? ` (redirigido a ${portada.url})` : '';
    const datos = { url: urlPortada, status: portada.status, cabeceras, urlFinal: portada.url };
    if (portada.status === 200) {
      resultado.push(comprobacion(s, 'portada /', ESTADOS.OK,
        `200 en ${portada.ms} ms${redireccion} · ${describirCabeceras(cabeceras)}`, datos));
      const variantes = variantesHtml(portada.texto);
      if (nombre) {
        resultado.push(contieneTexto(portada.texto, nombre, variantes)
          ? comprobacion(s, 'nombre en HTML', ESTADOS.OK, `contiene "${nombre}"`)
          : comprobacion(s, 'nombre en HTML', ESTADOS.AVISO,
            `el HTML no contiene "${nombre}"; ¿caché ISR o portal de otro municipio? (${describirCabeceras(cabeceras)})`));
      }
      for (const texto of textos) {
        resultado.push(contieneTexto(portada.texto, texto, variantes)
          ? comprobacion(s, 'texto esperado', ESTADOS.OK, `aparece "${texto}"`)
          : comprobacion(s, 'texto esperado', ESTADOS.FALLA,
            `no aparece "${texto}"; ${sugerenciaCache(cabeceras)}`, { texto, cabeceras }));
      }
    } else {
      resultado.push(comprobacion(s, 'portada /', ESTADOS.FALLA,
        `${urlPortada} -> ${portada.status}${redireccion} · ${describirCabeceras(cabeceras)}`
        + (nombre || textos.length ? '; no se revisan los textos' : ''), datos));
    }
  }

  const urlSevac = `${portal}/transparencia/sevac`;
  try {
    const sevac = await cliente.pedir(urlSevac, { aceptar: 'text/html', leerCuerpo: false });
    const cabeceras = cabecerasCache(sevac.headers);
    const datos = { url: urlSevac, status: sevac.status, cabeceras };
    resultado.push(sevac.status === 200
      ? comprobacion(s, '/transparencia/sevac', ESTADOS.OK,
        `200 en ${sevac.ms} ms (dinámica: refleja la API al instante) · ${describirCabeceras(cabeceras)}`, datos)
      : comprobacion(s, '/transparencia/sevac', ESTADOS.FALLA, `${urlSevac} -> ${sevac.status}`, datos));
  } catch (err) {
    resultado.push(comprobacion(s, '/transparencia/sevac', ESTADOS.FALLA, `${urlSevac} inalcanzable: ${err.message}`));
  }
  return resultado;
}

/** Con el municipio ausente, busca en el listado un slug que solo difiera en mayúsculas. */
async function buscarSlugParecido(cliente, api, slug) {
  try {
    const respuesta = await cliente.pedir(urlApi(api));
    const json = parsearJson(respuesta.texto);
    if (respuesta.status !== 200 || !json.ok || !Array.isArray(json.valor)) return null;
    const parecido = json.valor.find((m) => esObjetoPlano(m) && typeof m.slug === 'string'
      && m.slug !== slug && m.slug.toLowerCase() === slug.toLowerCase());
    return parecido ? parecido.slug : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Verificación completa
// ---------------------------------------------------------------------------

/**
 * Ejecuta todas las comprobaciones y devuelve el informe (no imprime nada).
 * opciones: { slug, nombre?, portal?, esperarTexto?: string[], api?, timeoutMs? }
 */
export async function verificarAlta(opciones, { fetchImpl, esperaReintentoMs } = {}) {
  const slug = opciones.slug;
  const api = normalizarBaseApi(opciones.api ?? API_POR_DEFECTO);
  const portal = opciones.portal ? normalizarPortal(opciones.portal) : null;
  const nombre = opciones.nombre ?? null;
  const textos = opciones.esperarTexto ?? [];
  const cliente = crearCliente({
    timeoutMs: opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS,
    fetchImpl,
    ...(esperaReintentoMs === undefined ? {} : { esperaReintentoMs }),
  });
  const inicio = Date.now();
  const informe = {
    herramienta: 'verificar-alta',
    version: 1,
    slug,
    api,
    portal,
    nombreEsperado: nombre,
    textosEsperados: textos,
    inicio: new Date(inicio).toISOString(),
    duracionMs: 0,
    peticiones: 0,
    municipio: null,
    comprobaciones: [],
    resumen: { ok: 0, aviso: 0, falla: 0 },
    resultado: null,
    codigo: null,
    mensaje: '',
  };
  const c = informe.comprobaciones;

  const terminar = (resultado, mensaje) => {
    informe.resumen = resumir(c);
    if (!resultado) resultado = informe.resumen.falla ? 'FALLA' : 'OK';
    informe.resultado = resultado;
    informe.codigo = CODIGOS[resultado];
    if (mensaje) {
      informe.mensaje = mensaje;
    } else if (resultado === 'OK') {
      informe.mensaje = informe.resumen.aviso
        ? `Alta verificada, con ${plural(informe.resumen.aviso, 'aviso')} para revisar.`
        : 'Alta verificada: todo en orden.';
    } else {
      informe.mensaje = `Hay ${plural(informe.resumen.falla, 'falla')}: revisa el detalle.`;
    }
    informe.duracionMs = Date.now() - inicio;
    informe.peticiones = cliente.peticiones;
    return informe;
  };

  if (!PATRON_SLUG.test(slug)) {
    c.push(comprobacion('municipio', 'formato slug', ESTADOS.AVISO,
      `"${slug}" tiene caracteres fuera de [a-z0-9-]; los slugs distinguen mayúsculas`));
  }

  // 1. GET /api/municipios/<slug>
  const urlMunicipio = urlApi(api, slug);
  const ruta = rutaVisible(urlMunicipio, api);
  let respuesta;
  try {
    respuesta = await cliente.pedir(urlMunicipio);
  } catch (err) {
    c.push(comprobacion('municipio', 'existe', ESTADOS.FALLA, `${ruta}: ${err.message}`));
    return terminar('ERROR', `La API no responde (${api}): ${err.message}.`);
  }
  const json = parsearJson(respuesta.texto);

  if (esAltaPendiente(respuesta.status, json.valor)) {
    c.push(comprobacion('municipio', 'existe', ESTADOS.FALLA, `${ruta} -> ${describirRespuesta(respuesta)}`));
    const parecido = await buscarSlugParecido(cliente, api, slug);
    if (parecido) {
      c.push(comprobacion('municipio', 'slug parecido', ESTADOS.FALLA,
        `no existe "${slug}" pero sí "${parecido}": los slugs distinguen mayúsculas`));
      return terminar('FALLA', `No existe el slug "${slug}", pero sí "${parecido}": usa el slug exacto (distingue mayúsculas).`);
    }
    return terminar('ALTA_PENDIENTE',
      `El municipio "${slug}" aún no existe en la BD; corre el alta. `
      + 'Se omiten las demás comprobaciones hasta que exista.');
  }
  if (respuesta.status !== 200) {
    const pista = respuesta.status === 404 ? ' ¿Es correcta la base --api?' : '';
    c.push(comprobacion('municipio', 'existe', ESTADOS.FALLA, `${ruta} -> ${describirRespuesta(respuesta)}`));
    const intentos = respuesta.intentos > 1 ? ` tras ${respuesta.intentos} intentos` : '';
    return terminar('ERROR', `Respuesta inesperada de la API: ${ruta} -> ${respuesta.status}${intentos}.${pista}`);
  }
  if (!json.ok || !esObjetoPlano(json.valor)) {
    c.push(comprobacion('municipio', 'existe', ESTADOS.FALLA, `${ruta} respondió 200 pero no es un objeto JSON`));
    return terminar('ERROR', `Respuesta inesperada de la API: ${ruta} no devolvió un objeto JSON.`);
  }

  const municipio = json.valor;
  informe.municipio = municipio;
  c.push(comprobacion('municipio', 'existe', ESTADOS.OK, `${ruta} -> 200 en ${respuesta.ms} ms`));
  c.push(...comprobarCamposMunicipio(municipio, { slug, nombre }));
  const id = municipio.id;

  // Escudo, listado (2), subrutas (3) y portal (4) con concurrencia <= 3.
  const tareas = [
    () => comprobarEscudo(cliente, municipio, api),
    () => comprobarListado(cliente, api, slug, id),
    ...SUBRUTAS.map((subruta) => () => comprobarSubruta(cliente, api, slug, id, subruta)),
  ];
  if (portal) tareas.push(() => comprobarPortal(cliente, portal, { nombre, textos }));
  const resultados = await mapearConConcurrencia(tareas, CONCURRENCIA_MAXIMA, (tarea) => tarea());
  for (const lista of resultados) c.push(...lista);

  return terminar(null);
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

const ETIQUETAS = { OK: '[ OK  ]', AVISO: '[AVISO]', FALLA: '[FALLA]' };

/** Texto legible del informe para la terminal. */
export function formatearInforme(informe, { color = false } = {}) {
  const p = crearPintor(color);
  const pintarEstado = (estado) => {
    const etiqueta = ETIQUETAS[estado] ?? `[${estado}]`;
    if (estado === ESTADOS.OK) return p.verde(etiqueta);
    if (estado === ESTADOS.AVISO) return p.amarillo(etiqueta);
    return p.rojo(etiqueta);
  };
  const lineas = [];
  lineas.push(p.negrita(`Verificación de alta: ${informe.slug}`));
  lineas.push(`  API:    ${informe.api}`);
  if (informe.portal) lineas.push(`  Portal: ${informe.portal}`);
  if (informe.municipio?.nombre) lineas.push(`  Nombre: ${informe.municipio.nombre}`);

  const ancho = Math.max(0, ...informe.comprobaciones.map((x) => x.clave.length));
  for (const [seccion, titulo] of Object.entries(SECCIONES)) {
    const filas = informe.comprobaciones.filter((x) => x.seccion === seccion);
    if (!filas.length) continue;
    lineas.push('', p.negrita(titulo));
    for (const fila of filas) {
      lineas.push(`  ${pintarEstado(fila.estado)} ${fila.clave.padEnd(ancho)}  ${fila.detalle}`);
    }
  }

  const { ok, aviso, falla } = informe.resumen;
  const segundos = (informe.duracionMs / 1000).toFixed(1);
  lineas.push('');
  lineas.push(`Resumen: ${p.verde(`${ok} OK`)} · ${p.amarillo(`${aviso} AVISO`)} · ${p.rojo(`${falla} FALLA`)}`
    + p.tenue(`  (${plural(informe.peticiones, 'petición', 'peticiones')}, ${segundos} s)`));
  const pintarResultado = informe.resultado === 'OK' ? p.verde
    : informe.resultado === 'ALTA_PENDIENTE' ? p.amarillo : p.rojo;
  lineas.push(`${p.negrita('Resultado:')} ${pintarResultado(`${informe.resultado} (código ${informe.codigo})`)} · ${informe.mensaje}`);
  return `${lineas.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** Bucle de espera (bash/zsh): repite mientras el código sea 2; se detiene con 0, 1 o 3. */
export function ejemploBucle({ comando, pausa = 10 }) {
  return `until ${comando}; codigo=$?; [ "$codigo" -ne 2 ]; do sleep ${pausa}; done; echo "Código final: $codigo"`;
}

export function textoAyuda() {
  const cmd = 'node verificar-alta.mjs villapesqueira --nombre "Villa Pesqueira" --portal https://villapesqueira.vercel.app';
  return `verificar-alta.mjs — verifica que el alta de un municipio quedó bien (solo lectura: GET/HEAD).

USO
  node verificar-alta.mjs <slug> [opciones]

OPCIONES
  --nombre "Villa Pesqueira"   El nombre en la API debe incluirlo (FALLA si no) y se busca
                               en el HTML del portal (AVISO si no).
  --portal URL                 Portal a revisar, p. ej. https://villapesqueira.vercel.app
  --esperar-texto "texto"      Texto que debe aparecer en la portada del portal (FALLA si no).
                               Repetible. Requiere --portal. Compara con entidades HTML
                               (&amp; &#x27; &quot; ...) y espacios normalizados; distingue mayúsculas.
  --api URL                    Base de la API (por defecto ${API_POR_DEFECTO}).
  --timeout ms                 Tiempo máximo por petición (por defecto ${TIMEOUT_POR_DEFECTO_MS}).
                               Se reintenta 1 vez ante error de red, timeout o 5xx.
  --json                       Salida JSON para máquinas (en stdout).
  --ayuda, -h                  Muestra esta ayuda.

QUÉ COMPRUEBA (cada punto: OK / AVISO / FALLA)
  1. GET /api/municipios/<slug>: existe (404 "no encontrado" => ALTA_PENDIENTE), id UUID,
     slug, activo === true, estado, nombre (--nombre y convención "${PREFIJO_NOMBRE}"),
     dominio (null => AVISO) y escudoUrl (HEAD o GET => 200 image/*).
  2. GET /api/municipios: el slug aparece exactamente 1 vez y con el mismo id.
  3. Subrutas ${SUBRUTAS.join(', ')}:
     200 + array, conteo y ningún municipioId ajeno (fuga). Hero o estadísticas vacíos => AVISO.
     Además revisa el detalle de una noticia de muestra (la lista no trae municipioId).
  4. Con --portal: GET / (200, cabeceras x-vercel-cache / age / x-nextjs-stale-time, --nombre y
     --esperar-texto en el HTML; la portada tiene caché ISR de ~${ISR_SEGUNDOS} s) y GET /transparencia/sevac (200).

CÓDIGOS DE SALIDA
  0  todo OK (puede haber avisos)
  1  alguna FALLA
  2  ALTA_PENDIENTE: el municipio aún no existe en la BD (corre el alta)
  3  error de red o inesperado (API inalcanzable, respuesta rara, argumentos inválidos)

ESPERAR A QUE TERMINE EL ALTA (bash/zsh)
  Repite mientras el código sea 2 y se detiene con 0, 1 o 3:

    ${ejemploBucle({ comando: cmd })}

  Con límite de intentos (60 x 10 s = 10 min):

    for i in {1..60}; do ${cmd}; codigo=$?; [ "$codigo" -ne 2 ] && break; sleep 10; done; echo "Código final: $codigo"

  Ojo: "until node verificar-alta.mjs ...; do sleep 10; done" NO sirve: seguiría repitiendo
  también con 1 (FALLA) y 3 (error), porque until solo se detiene con 0.

EJEMPLOS
  node verificar-alta.mjs carbo --nombre "Carbó" --portal https://carbotransparencia.com.mx
  node verificar-alta.mjs villapesqueira --portal https://villapesqueira.vercel.app \\
       --esperar-texto "Bienvenidos a Villa Pesqueira" --json
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
        nombre: { type: 'string' },
        portal: { type: 'string' },
        'esperar-texto': { type: 'string', multiple: true },
        api: { type: 'string' },
        json: { type: 'boolean', default: false },
        timeout: { type: 'string' },
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
    nombre: null,
    portal: null,
    esperarTexto: [],
    api: API_POR_DEFECTO,
    timeoutMs: TIMEOUT_POR_DEFECTO_MS,
  };
  if (opciones.ayuda) return opciones;

  if (posicionales.length === 0) throw new ErrorUso('Falta el slug del municipio (p. ej. villapesqueira).');
  if (posicionales.length > 1) {
    throw new ErrorUso(`Sobran argumentos: ${posicionales.slice(1).join(' ')} `
      + '(¿olvidaste las comillas en --nombre "Villa Pesqueira"?).');
  }
  const slug = posicionales[0].trim();
  if (!slug || slug.includes('/')) throw new ErrorUso(`Slug inválido: "${posicionales[0]}".`);
  opciones.slug = slug;

  if (valores.nombre !== undefined) {
    if (!valores.nombre.trim()) throw new ErrorUso('--nombre no puede estar vacío.');
    opciones.nombre = valores.nombre.trim();
  }
  if (valores.portal !== undefined) opciones.portal = normalizarPortal(valores.portal);
  const textos = valores['esperar-texto'] ?? [];
  if (textos.some((t) => !t.trim())) throw new ErrorUso('--esperar-texto no puede estar vacío.');
  if (textos.length && !opciones.portal) throw new ErrorUso('--esperar-texto requiere --portal.');
  opciones.esperarTexto = textos;
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
 * entorno: { stdout, stderr, env, fetchImpl, esperaReintentoMs } (inyectables en pruebas).
 */
export async function main(argv = process.argv.slice(2), entorno = {}) {
  const {
    stdout = process.stdout,
    stderr = process.stderr,
    env = process.env,
    fetchImpl = globalThis.fetch,
    esperaReintentoMs,
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
    return CODIGOS.OK;
  }
  if (typeof fetchImpl !== 'function') {
    stderr.write('Error: este Node no tiene fetch global; se requiere Node >= 18.\n');
    return CODIGOS.ERROR;
  }

  let informe;
  try {
    informe = await verificarAlta(opciones, { fetchImpl, esperaReintentoMs });
  } catch (err) {
    const mensaje = `Error inesperado: ${err?.message ?? err}`;
    if (opciones.json) {
      stdout.write(`${JSON.stringify({ herramienta: 'verificar-alta', slug: opciones.slug, resultado: 'ERROR', codigo: CODIGOS.ERROR, mensaje }, null, 2)}\n`);
    }
    stderr.write(`${mensaje}\n${err?.stack ? `${err.stack}\n` : ''}`);
    return CODIGOS.ERROR;
  }

  if (opciones.json) stdout.write(`${JSON.stringify(informe, null, 2)}\n`);
  else stdout.write(formatearInforme(informe, { color: usarColor(stdout, env) }));
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
  main().then(
    (codigo) => {
      process.exitCode = codigo;
    },
    (err) => {
      process.stderr.write(`Error inesperado: ${err?.stack ?? err}\n`);
      process.exitCode = CODIGOS.ERROR;
    },
  );
}
