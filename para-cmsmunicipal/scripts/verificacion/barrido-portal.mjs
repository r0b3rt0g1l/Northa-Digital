#!/usr/bin/env node
// barrido-portal.mjs
//
// Barrido de "restos" de otros municipios en un portal municipal ya publicado.
//
// Al clonar un portal desde el molde de otro municipio quedan restos: nombres,
// textos históricos ("misión jesuita de 1639, en la región del Río Sonora" es
// de Baviácora), correos, teléfonos, rutas de Cloudinary con otro slug...
// Este script descarga el HTML renderizado de las rutas del portal y todos los
// recursos /_next/static/*.js|*.css que referencian, y busca en ellos:
//
//   RESTOS (código 1): nombres y slugs de TODOS los municipios de la API
//     excepto el propio, un listado fijo de municipios de Sonora usados como
//     molde, y los términos de --extra. Con límites de palabra ("carbón" no
//     dispara "carbo"; "crayón" no dispara "rayon").
//   AVISOS (no cambian el código): correos, teléfonos mexicanos y URLs de
//     res.cloudinary.com con cms-municipal/<otro-slug>/.
//
// El script NO sabe si una mención es legítima (colindancias, historia:
// "colindante con Sahuaripa", "adscrito a Villa Pesqueira (1931)"). Reporta
// todo con contexto; hay que revisarlo a mano y silenciar lo legítimo con
// --permitir.
//
// Solo hace peticiones GET. Node >= 18, sin dependencias.
//
// Uso:
//   node barrido-portal.mjs --portal https://villapesqueira.vercel.app --slug villapesqueira \
//        --nombre "Villa Pesqueira" --extra "1639,río sonora,misión jesuita"
// Ayuda: node barrido-portal.mjs --ayuda
//
// Códigos de salida: 0 sin restos (puede haber avisos), 1 hay restos,
//                    3 error de red o de argumentos (o barrido incompleto).

import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const API_POR_DEFECTO = 'https://api.northadigital.com';
export const TIMEOUT_POR_DEFECTO = 15_000;
export const MAX_RUTAS_POR_DEFECTO = 30;
export const CONCURRENCIA_MAXIMA = 4;
export const REINTENTOS = 1;
export const ESPERA_REINTENTO_MS = 750;
export const RADIO_CONTEXTO = 60;
export const MAX_CONTEXTOS_POR_ARCHIVO = 10;
export const MAX_SITEMAPS_HIJOS = 10;

export const CODIGO = Object.freeze({ LIMPIO: 0, RESTOS: 1, ERROR: 3 });

const AGENTE = 'barrido-portal/1.0 (Northa Digital; verificacion de restos; solo GET)';

/**
 * Municipios de Sonora cuyos portales se han usado como molde o que son
 * vecinos de la flota. Se buscan siempre (además de los de la API), salvo el
 * propio. Se omiten a propósito nombres que son palabras o apellidos comunes
 * (Granados, Divisaderos, Fronteras) y Hermosillo (capital, aparece de forma
 * legítima, p. ej. en la zona horaria America/Hermosillo); agrégalos con
 * --extra si hacen falta.
 */
export const MUNICIPIOS_MOLDE = Object.freeze([
  'Arivechi', 'Moctezuma', 'Huásabas', 'Sahuaripa', 'Bacanora', 'Soyopa', 'Tepache',
  'Cumpas', 'Bacadéhuachi', 'Huachinera', 'Nácori Chico', 'Villa Hidalgo', 'Bacerac',
  'Bavispe', 'Nacozari de García', 'San Pedro de la Cueva', 'Villa Pesqueira', 'Mazatán',
  'Ures', 'Baviácora', 'Aconchi', 'Banámichi', 'Huépac', 'Arizpe', 'San Felipe de Jesús',
  'Bacoachi', 'Cucurpe', 'Opodepe', 'Rayón', 'Carbó', 'San Javier', 'Ónavas',
  'Suaqui Grande', 'Yécora', 'La Colorada', 'San Miguel de Horcasitas',
]);

/** Prefijos del campo `nombre` de la API que no forman parte del nombre del municipio. */
const RE_PREFIJO_NOMBRE =
  /^\s*(?:(?:h\.?\s*)?ayuntamiento(?:\s+constitucional)?\s+de|municipio\s+de)\s+/i;

/** Dominios y locales de correo que son marcadores de posición obvios. */
const DOMINIOS_CORREO_PLACEHOLDER = new Set([
  'correo.com', 'ejemplo.com', 'ejemplo.mx', 'ejemplo.com.mx', 'ejemplo.gob.mx',
  'example.com', 'example.org', 'example.net', 'dominio.com', 'tudominio.com',
  'midominio.com', 'email.com', 'test.com', 'domain.com', 'tucorreo.com',
]);
const RE_LOCAL_PLACEHOLDER = /^(?:tu|tucorreo|ejemplo.*|example.*|usuario|nombre|correo|email|test|prueba)$/;
/** "Extensiones" que delatan nombres de archivo tipo logo@2x.png, no correos. */
const TLD_ARCHIVO = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'tif', 'tiff',
  'js', 'mjs', 'cjs', 'css', 'map', 'json', 'txt', 'pdf', 'woff', 'woff2', 'ttf', 'otf',
]);

/** Extensiones que no son páginas HTML (no se tratan como rutas). */
const RE_EXT_NO_PAGINA =
  /\.(?:pdf|jpe?g|png|gif|webp|avif|svg|ico|xml|txt|json|js|mjs|css|map|zip|rar|docx?|xlsx?|pptx?|csv|mp4|mp3|webm|woff2?|ttf|otf)$/i;

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

/** Error de argumentos o de red que termina el barrido con código 3. */
export class ErrorBarrido extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorBarrido';
    this.codigo = CODIGO.ERROR;
  }
}

// ---------------------------------------------------------------------------
// Texto: normalización con mapa al original
// ---------------------------------------------------------------------------

export function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Minúsculas + sin diacríticos (NFD). "Bacadéhuachi" -> "bacadehuachi". */
export function plegar(texto) {
  return String(texto).toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '');
}

/** Normaliza un término de búsqueda: plegado, espacios colapsados, sin bordes. */
export function normalizarTermino(texto) {
  return plegar(String(texto ?? '')).replace(/\s+/g, ' ').trim();
}

/** Quita "H. Ayuntamiento de " / "Municipio de " del campo nombre de la API. */
export function nombreBase(nombreApi) {
  return String(nombreApi ?? '').replace(RE_PREFIJO_NOMBRE, '').trim();
}

const ENTIDADES = {
  quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ', shy: '',
  iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»', ordm: 'º', ordf: 'ª', deg: '°',
  copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘',
  rsquo: '’', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„', middot: '·', bull: '•',
  euro: '€', times: '×', divide: '÷', para: '¶', sect: '§', cent: '¢', pound: '£',
  szlig: 'ß', aelig: 'æ', AElig: 'Æ', oslash: 'ø', Oslash: 'Ø', eth: 'ð', thorn: 'þ',
  ensp: ' ', emsp: ' ', thinsp: ' ', zwnj: '', zwj: '', lrm: '', rlm: '',
};
const DIACRITICO_ENTIDAD = {
  acute: '́', grave: '̀', circ: '̂', uml: '̈', tilde: '̃',
  cedil: '̧', ring: '̊',
};

function decodificarEntidad(nombre) {
  if (Object.hasOwn(ENTIDADES, nombre)) return ENTIDADES[nombre];
  const m = /^([a-zA-Z])(acute|grave|circ|uml|tilde|cedil|ring)$/.exec(nombre);
  if (m) return (m[1] + DIACRITICO_ENTIDAD[m[2]]).normalize('NFC');
  return null;
}

function desdeCodigo(cp) {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return null;
  try {
    return String.fromCodePoint(cp);
  } catch {
    return null;
  }
}

const ESCAPE_SIMPLE = { n: '\n', r: '\n', t: '\t', f: ' ', v: ' ', b: ' ', 0: ' ' };

// Escapes JS/JSON (\uXXXX, \u{X}, \xXX, \n, \", \/ ... con 1+ barras, para
// cubrir el doble escapado del payload RSC), entidades HTML y tramos no ASCII.
const RE_DECODIFICABLE =
  /\\+(?:u\{([0-9a-fA-F]{1,6})\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([nrtfvb0])|(["'/`]))|&(?:#(\d{1,7});?|#[xX]([0-9a-fA-F]{1,6});?|([a-zA-Z][a-zA-Z0-9]{1,31});)|[^\x00-\x7f]+/g;

class Mapa {
  constructor(capacidad) {
    this.inicio = new Int32Array(Math.max(16, capacidad));
    this.fin = new Int32Array(Math.max(16, capacidad));
    this.n = 0;
  }

  asegurar(extra) {
    if (this.n + extra <= this.inicio.length) return;
    const cap = Math.max(this.inicio.length * 2, this.n + extra);
    const ini = new Int32Array(cap);
    const fin = new Int32Array(cap);
    ini.set(this.inicio.subarray(0, this.n));
    fin.set(this.fin.subarray(0, this.n));
    this.inicio = ini;
    this.fin = fin;
  }

  identidad(desde, hasta) {
    const largo = hasta - desde;
    this.asegurar(largo);
    for (let k = 0; k < largo; k++) {
      this.inicio[this.n + k] = desde + k;
      this.fin[this.n + k] = desde + k + 1;
    }
    this.n += largo;
  }

  bloque(unidades, desde, hasta) {
    this.asegurar(unidades);
    for (let k = 0; k < unidades; k++) {
      this.inicio[this.n + k] = desde;
      this.fin[this.n + k] = hasta;
    }
    this.n += unidades;
  }
}

/** Una pasada: decodifica escapes/entidades y pliega, con mapa por unidad UTF-16. */
function pasoNormalizar(original) {
  const partes = [];
  const mapa = new Mapa(original.length + 16);
  let cambios = false;
  let ultimo = 0;
  const re = new RegExp(RE_DECODIFICABLE.source, 'g');
  let m;
  while ((m = re.exec(original)) !== null) {
    const ini = m.index;
    const fin = ini + m[0].length;
    if (ini > ultimo) {
      partes.push(original.slice(ultimo, ini).toLowerCase());
      mapa.identidad(ultimo, ini);
    }
    ultimo = fin;
    const c0 = m[0].charCodeAt(0);
    if (c0 > 0x7f) {
      // Tramo no ASCII: plegar carácter por carácter (puede cambiar de largo).
      let pos = ini;
      for (const ch of m[0]) {
        const p = plegar(ch);
        partes.push(p);
        mapa.bloque(p.length, pos, pos + ch.length);
        pos += ch.length;
      }
      continue;
    }
    let dec = null;
    if (m[1] !== undefined) dec = desdeCodigo(parseInt(m[1], 16));
    else if (m[2] !== undefined) dec = String.fromCharCode(parseInt(m[2], 16));
    else if (m[3] !== undefined) dec = String.fromCharCode(parseInt(m[3], 16));
    else if (m[4] !== undefined) dec = ESCAPE_SIMPLE[m[4]];
    else if (m[5] !== undefined) dec = m[5];
    else if (m[6] !== undefined) dec = desdeCodigo(parseInt(m[6], 10));
    else if (m[7] !== undefined) dec = desdeCodigo(parseInt(m[7], 16));
    else if (m[8] !== undefined) dec = decodificarEntidad(m[8]);
    if (dec === null || dec === undefined) {
      // No se reconoce: se deja tal cual (en minúsculas).
      partes.push(m[0].toLowerCase());
      mapa.identidad(ini, fin);
      continue;
    }
    cambios = true;
    const p = plegar(dec);
    partes.push(p);
    mapa.bloque(p.length, ini, fin);
  }
  if (ultimo < original.length) {
    partes.push(original.slice(ultimo).toLowerCase());
    mapa.identidad(ultimo, original.length);
  }
  return {
    texto: partes.join(''),
    inicio: mapa.inicio.subarray(0, mapa.n),
    fin: mapa.fin.subarray(0, mapa.n),
    cambios,
  };
}

/**
 * Normaliza un documento para buscar: decodifica escapes \uXXXX (y \xXX, \n,
 * \", ...), entidades HTML (&aacute; &#225; &#xE1; &quot; &amp;), pasa a
 * minúsculas y quita diacríticos. Hace hasta dos pasadas para cubrir el doble
 * escapado (&amp;aacute;, \\u00e1). Devuelve { texto, inicio, fin }, donde
 * inicio[i]/fin[i] delimitan en el ORIGINAL la unidad i del texto normalizado.
 */
export function normalizarConMapa(original) {
  const texto = String(original ?? '');
  let r = pasoNormalizar(texto);
  if (r.cambios && /[&\\]/.test(r.texto)) {
    const r2 = pasoNormalizar(r.texto);
    if (r2.cambios) {
      const n = r2.texto.length;
      const inicio = new Int32Array(n);
      const fin = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        inicio[i] = r.inicio[r2.inicio[i]];
        fin[i] = r.fin[r2.fin[i] - 1];
      }
      r = { texto: r2.texto, inicio, fin, cambios: true };
    }
  }
  return { texto: r.texto, inicio: r.inicio, fin: r.fin };
}

/** Rango [ini, fin) en el original que corresponde al rango [a, b) normalizado. */
export function rangoOriginal(norm, a, b) {
  if (b <= a) return [norm.inicio[a] ?? 0, norm.inicio[a] ?? 0];
  return [norm.inicio[a], norm.fin[b - 1]];
}

/** Fragmento de ±radio caracteres del ORIGINAL alrededor de [ini, fin), con «» en la coincidencia. */
export function fragmento(original, ini, fin, radio = RADIO_CONTEXTO) {
  let a = Math.max(0, ini - radio);
  let b = Math.min(original.length, fin + radio);
  // No partir pares sustitutos.
  if (a > 0 && /[\udc00-\udfff]/.test(original[a])) a--;
  if (b < original.length && /[\ud800-\udbff]/.test(original[b - 1])) b++;
  const limpio = (s) => s.replace(/\s+/g, ' ');
  return (
    (a > 0 ? '…' : '') +
    limpio(original.slice(a, ini)) +
    '«' + limpio(original.slice(ini, fin)) + '»' +
    limpio(original.slice(fin, b)) +
    (b < original.length ? '…' : '')
  );
}

// ---------------------------------------------------------------------------
// Términos
// ---------------------------------------------------------------------------

/** Separa listas "a,b, c" (admite varias apariciones de la opción). */
export function separarLista(valor) {
  const valores = Array.isArray(valor) ? valor : valor == null ? [] : [valor];
  return valores
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

const sinEspacios = (t) => t.replace(/[\s\-_]+/g, '');

/** Dominio sin "www." ni puerto, en minúsculas. */
export function dominioBase(dominio) {
  let d = String(dominio ?? '').trim().toLowerCase();
  if (!d) return '';
  d = d.replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '');
  return d.replace(/^www\./, '');
}

/** Acepta la respuesta de /api/municipios como arreglo o envuelta ({data|municipios|items}). */
export function listaMunicipios(json) {
  if (Array.isArray(json)) return json;
  for (const clave of ['data', 'municipios', 'items', 'resultados']) {
    if (json && Array.isArray(json[clave])) return json[clave];
  }
  return null;
}

/**
 * Construye la lista de términos a buscar.
 * - Nombres (sin prefijo) y slugs de todos los municipios de la API menos el
 *   propio, y el dominio de cada uno (sin "www.").
 * - MUNICIPIOS_MOLDE (listado fijo) y --extra.
 * - Excluye el propio nombre/slug/dominio y lo de --permitir (comparando
 *   también sin espacios: "san javier" permite "sanjavier").
 * Lanza ErrorBarrido si el slug no está en la API y no se dio --nombre.
 */
export function construirTerminos({ municipios = [], slug, nombre, extra = [], permitir = [], molde = MUNICIPIOS_MOLDE }) {
  const slugPropio = String(slug ?? '').trim().toLowerCase();
  const tenant = municipios.find((m) => String(m?.slug ?? '').toLowerCase() === slugPropio);
  let nombrePropio;
  let fuenteNombre;
  if (tenant) {
    nombrePropio = nombreBase(tenant.nombre) || String(nombre ?? '').trim();
    fuenteNombre = 'api';
  } else if (nombre && String(nombre).trim()) {
    nombrePropio = String(nombre).trim();
    fuenteNombre = 'argumento';
  } else {
    throw new ErrorBarrido(
      `El slug "${slugPropio}" no está en la API de municipios (¿aún sin alta?). ` +
        'Indica el nombre del municipio con --nombre "Nombre".',
    );
  }

  const propios = new Set(
    [nombrePropio, nombre, slugPropio, tenant ? dominioBase(tenant.dominio) : '']
      .filter(Boolean)
      .map(normalizarTermino),
  );
  const propiosSinEsp = new Set([...propios].map(sinEspacios));
  const permitidos = [...new Set(permitir.map(normalizarTermino).filter(Boolean))];
  const permitidosSinEsp = new Set(permitidos.map(sinEspacios));

  const mapa = new Map();
  const excluidos = [];
  const agregar = (valor, etiqueta, municipio, origen) => {
    const termino = normalizarTermino(valor);
    if (!termino) return;
    if (propios.has(termino) || propiosSinEsp.has(sinEspacios(termino))) {
      excluidos.push({ termino, motivo: 'propio' });
      return;
    }
    if (permitidosSinEsp.has(sinEspacios(termino))) {
      excluidos.push({ termino, motivo: 'permitido' });
      return;
    }
    const previo = mapa.get(termino);
    if (previo) {
      if (!previo.origenes.includes(origen)) previo.origenes.push(origen);
      if (!previo.municipio && municipio) previo.municipio = municipio;
      return;
    }
    mapa.set(termino, { termino, etiqueta, municipio, origenes: [origen] });
  };

  for (const m of municipios) {
    const s = String(m?.slug ?? '').trim().toLowerCase();
    if (s === slugPropio) continue;
    const n = nombreBase(m?.nombre);
    if (n) agregar(n, n, n, 'API (nombre)');
    if (s) agregar(s, s, n || s, 'API (slug)');
    const d = dominioBase(m?.dominio);
    if (d) agregar(d, d, n || s, 'API (dominio)');
  }
  for (const n of molde) agregar(n, n, n, 'listado de moldes');
  for (const e of extra) agregar(e, e, null, '--extra');

  const terminos = [...mapa.values()].sort((a, b) => a.termino.localeCompare(b.termino));
  return {
    propio: {
      slug: slugPropio,
      nombre: nombrePropio,
      dominio: tenant ? dominioBase(tenant.dominio) : null,
      fuenteNombre,
      terminos: [...propios],
    },
    terminos,
    permitidos,
    excluidos: dedupPor(excluidos, (e) => `${e.termino}|${e.motivo}`),
  };
}

function dedupPor(lista, clave) {
  const vistos = new Set();
  return lista.filter((x) => {
    const k = clave(x);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** Regex de un término normalizado con límites de palabra Unicode (equivalente a \b). */
export function regexTermino(termino) {
  const partes = normalizarTermino(termino).split(/[\s\-_]+/).filter(Boolean).map(escaparRegex);
  const cuerpo = partes.join('[\\s\\-_]+');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${cuerpo}(?![\\p{L}\\p{N}_])`, 'gu');
}

// ---------------------------------------------------------------------------
// Detección en un documento
// ---------------------------------------------------------------------------

function rangosDe(texto, re) {
  const out = [];
  for (const m of texto.matchAll(re)) out.push([m.index, m.index + m[0].length]);
  return out;
}

const contenido = (rangos, a, b) => rangos.some(([x, y]) => a >= x && b <= y);
const solapa = (rangos, a, b) => rangos.some(([x, y]) => a < y && b > x);

const RE_CLOUDINARY = /res\.cloudinary\.com(?:\/|%2f)[^\s"'<>()\\,&]*/g;
const RE_SEGMENTO_CMS = /cms-municipal(?:\/|%2f)([a-z0-9][a-z0-9_-]*)(?:\/|%2f)/g;

const RE_CORREO =
  /(?<![\w.%+-])[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9_%+-])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?![\w-])/g;

const PREFIJO_52 = String.raw`(?:\+\s?52[\s.-]?(?:1[\s.-]?)?)?`;
const RE_TELEFONO = new RegExp(
  String.raw`(?<![\w+])(?<!\d[.,-])(?:` +
    [
      String.raw`tel:\s*\+?[\d\s().-]{8,20}\d`,
      String.raw`wa\.me\/\d{10,13}`,
      PREFIJO_52 + String.raw`\(\d{2,3}\)\s?\d{3,4}[\s.-]?\d{2}[\s.-]?\d{2}`,
      PREFIJO_52 + String.raw`\d{3}([ .-])\d{3}\1\d{4}`,
      PREFIJO_52 + String.raw`\d{3}([ .-])\d{3}\2\d{2}\2\d{2}`,
      PREFIJO_52 + String.raw`\d{2}([ .-])\d{4}\3\d{4}`,
      String.raw`\+\s?52\s?(?:1\s?)?\d{10}`,
    ].join('|') +
    String.raw`)(?!\w)(?![.,-]\d)`,
  'g',
);

/** true si el correo es un marcador de posición obvio (tu@correo.com, ejemplo@...). */
export function esCorreoPlaceholder(correo) {
  const [local, dominio = ''] = String(correo).toLowerCase().split('@');
  if (DOMINIOS_CORREO_PLACEHOLDER.has(dominio)) return true;
  if (/^(?:ejemplo|example)\./.test(dominio)) return true;
  if (RE_LOCAL_PLACEHOLDER.test(local)) return true;
  return false;
}

/** 10 dígitos nacionales o null si no parece un teléfono mexicano. */
export function digitosTelefono(texto) {
  let d = String(texto).replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length !== 10) return null;
  if (/^[01]/.test(d)) return null; // las claves LADA empiezan con 2-9
  if (/^(\d)\1+$/.test(d) || d === '1234567890') return null;
  return d;
}

export function formatearTelefono(d) {
  if (/^(?:55|56|33|81)/.test(d)) return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/**
 * Analiza un documento (HTML, JS, CSS, XML...). Función pura.
 * `conf` es el resultado de construirTerminos().
 * Devuelve { restos, correos, telefonos, cloudinary }, cada uno una lista de
 * { clave, ini, fin, contexto, coincidencia } (posiciones en el ORIGINAL).
 */
export function analizarDocumento(original, conf, { radio = RADIO_CONTEXTO } = {}) {
  const texto = String(original ?? '');
  const norm = normalizarConMapa(texto);
  const t = norm.texto;
  const hallazgo = (clave, a, b, extra = {}) => {
    const [ini, fin] = rangoOriginal(norm, a, b);
    return {
      clave,
      ini,
      fin,
      coincidencia: texto.slice(ini, fin),
      contexto: fragmento(texto, ini, fin, radio),
      ...extra,
    };
  };

  // Máscaras: apariciones del propio nombre y de frases permitidas (se ignoran
  // coincidencias contenidas en ellas) y segmentos cms-municipal/<slug>/ de
  // Cloudinary (se reportan como aviso, no como resto).
  const mascarasContenido = [];
  for (const p of [...conf.propio.terminos, ...conf.permitidos]) {
    if (p && t.includes(p.split(' ')[0])) mascarasContenido.push(...rangosDe(t, regexTermino(p)));
  }

  const cloudinary = [];
  const mascarasCloudinary = [];
  if (t.includes('cloudinary')) {
    for (const m of t.matchAll(RE_CLOUDINARY)) {
      for (const s of m[0].matchAll(RE_SEGMENTO_CMS)) {
        const a = m.index + s.index;
        const b = a + s[0].length;
        mascarasCloudinary.push([a, b]);
        const slug = s[1];
        if (slug !== conf.propio.slug) {
          cloudinary.push(hallazgo(`cms-municipal/${slug}/`, a, b, { slug, url: m[0].replace(/%2f/gi, '/') }));
        }
      }
    }
  }

  const restos = [];
  for (const term of conf.terminos) {
    const primera = term.termino.split(/[\s\-_]+/)[0];
    if (!t.includes(primera)) continue;
    for (const m of t.matchAll(regexTermino(term.termino))) {
      const a = m.index;
      const b = a + m[0].length;
      if (contenido(mascarasContenido, a, b)) continue;
      if (solapa(mascarasCloudinary, a, b)) continue;
      restos.push(hallazgo(term.termino, a, b));
    }
  }

  const correos = [];
  if (t.includes('@')) {
    for (const m of t.matchAll(RE_CORREO)) {
      const correo = m[0];
      const tld = correo.slice(correo.lastIndexOf('.') + 1);
      const dominio = correo.slice(correo.indexOf('@') + 1);
      if (TLD_ARCHIVO.has(tld)) continue;
      if (/(?:^|\.)sentry\.io$/.test(dominio)) continue;
      if (esCorreoPlaceholder(correo)) continue;
      correos.push(hallazgo(correo, m.index, m.index + correo.length));
    }
  }

  const telefonos = [];
  for (const m of t.matchAll(RE_TELEFONO)) {
    const d = digitosTelefono(m[0]);
    if (!d) continue;
    telefonos.push(hallazgo(formatearTelefono(d), m.index, m.index + m[0].length));
  }

  return { restos, correos, telefonos, cloudinary };
}

// ---------------------------------------------------------------------------
// Rutas y recursos
// ---------------------------------------------------------------------------

function decodificarEntidadesBasicas(s) {
  return String(s)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** Normaliza una ruta de página: sin query ni hash, sin barra final (salvo "/"). */
export function normalizarRuta(ruta) {
  let r = String(ruta ?? '').replace(/[?#].*$/, '');
  if (!r.startsWith('/')) r = `/${r}`;
  r = r.replace(/\/{2,}/g, '/');
  if (r.length > 1) r = r.replace(/\/+$/, '');
  return r || '/';
}

function esRutaDePagina(ruta) {
  return !(/^\/(?:_next|api)(?:\/|$)/.test(ruta) || RE_EXT_NO_PAGINA.test(ruta) || /^\/cdn-cgi\//.test(ruta));
}

/**
 * Extrae las <loc> de un sitemap. Devuelve { tipo: 'urlset'|'indice', locs }.
 */
export function extraerLocsSitemap(xml) {
  const texto = String(xml ?? '');
  const tipo = /<sitemapindex[\s>]/i.test(texto) ? 'indice' : 'urlset';
  const locs = [];
  for (const m of texto.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)) {
    locs.push(decodificarEntidadesBasicas(m[1]));
  }
  return { tipo, locs };
}

/**
 * Reescribe el host de una URL al del portal si difiere (p. ej. el sitemap
 * usa el dominio propio y se barre el *.vercel.app). Devuelve
 * { url, ruta, hostOriginal, reescrito } o null si no es http(s).
 */
export function reescribirHost(loc, origenPortal) {
  let u;
  try {
    u = new URL(String(loc).trim(), origenPortal);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const base = new URL(origenPortal);
  const reescrito = u.host !== base.host;
  const ruta = normalizarRuta(u.pathname);
  return { url: base.origin + ruta, ruta, hostOriginal: u.host, reescrito };
}

/** Enlaces internos href="/..." (o absolutos al mismo host) de un HTML, como rutas. */
export function extraerEnlacesInternos(html, origenPortal) {
  const base = new URL(origenPortal);
  const rutas = [];
  for (const m of String(html ?? '').matchAll(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const href = decodificarEntidadesBasicas((m[1] ?? m[2] ?? '').trim());
    if (!href || href.startsWith('#')) continue;
    let ruta = null;
    if (href.startsWith('/') && !href.startsWith('//')) {
      ruta = normalizarRuta(href);
    } else if (/^https?:\/\//i.test(href)) {
      try {
        const u = new URL(href);
        if (u.host === base.host) ruta = normalizarRuta(u.pathname);
      } catch {
        /* href inválido */
      }
    }
    if (ruta && esRutaDePagina(ruta)) rutas.push(ruta);
  }
  return [...new Set(rutas)];
}

/**
 * Referencias a /_next/static/**.js|.css de un HTML (incluye las del payload
 * RSC escapado). Devuelve [{ ruta, url }] únicos por ruta (sin query); la url
 * conserva la query (?dpl=...) de la primera aparición.
 */
export function extraerRecursosNext(html, origenPortal) {
  const base = new URL(origenPortal);
  const vistos = new Map();
  const texto = String(html ?? '').replace(/\\u002[fF]/g, '/').replace(/\\\//g, '/');
  const re =
    /(?:https?:\/\/[a-z0-9.-]+(?::\d+)?)?(?:\/_next\/|(?<![\w/.-])(?=static\/))(static\/[A-Za-z0-9_\-./~%@[\]()]+?\.(?:js|css))(?![\w-])((?:\?[^"'\s\\<>)]*)?)/gi;
  for (const m of texto.matchAll(re)) {
    const ruta = `/_next/${m[1]}`;
    if (vistos.has(ruta)) continue;
    const query = decodificarEntidadesBasicas(m[2] ?? '').replace(/[,;]+$/, '');
    vistos.set(ruta, { ruta, url: base.origin + ruta + query });
  }
  return [...vistos.values()];
}

/** Une listas de rutas sin duplicados, "/" primero, hasta `max`. */
export function planificarRutas(listas, max = MAX_RUTAS_POR_DEFECTO) {
  const out = ['/'];
  for (const lista of listas) {
    for (const r of lista) {
      const n = normalizarRuta(r);
      if (!esRutaDePagina(n)) continue;
      if (!out.includes(n)) out.push(n);
    }
  }
  return out.slice(0, Math.max(1, max));
}

// ---------------------------------------------------------------------------
// Red
// ---------------------------------------------------------------------------

/** Limita la cantidad de tareas simultáneas. */
export function crearLimitador(max = CONCURRENCIA_MAXIMA) {
  let activos = 0;
  const cola = [];
  const siguiente = () => {
    if (activos >= max || cola.length === 0) return;
    activos++;
    const { fn, resolver, rechazar } = cola.shift();
    Promise.resolve()
      .then(fn)
      .then(resolver, rechazar)
      .finally(() => {
        activos--;
        siguiente();
      });
  };
  return (fn) =>
    new Promise((resolver, rechazar) => {
      cola.push({ fn, resolver, rechazar });
      siguiente();
    });
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function describirError(e) {
  const causa = e?.cause;
  const partes = [causa?.code, causa?.message ?? e?.message].filter(Boolean);
  return [...new Set(partes)].join(': ') || String(e);
}

async function unaPeticion(url, fetchImpl, timeout) {
  const ctl = new AbortController();
  const reloj = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctl.signal,
      headers: { 'user-agent': AGENTE, accept: '*/*' },
    });
    const texto = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      texto,
      url: res.url || url,
      tipo: res.headers?.get?.('content-type') ?? '',
    };
  } catch (e) {
    const error = ctl.signal.aborted ? `tiempo agotado (${timeout} ms)` : describirError(e);
    return { ok: false, status: 0, error, url };
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * GET con timeout (AbortController) y reintento ante error de red, tiempo
 * agotado, 5xx o 429. Nunca lanza: devuelve { ok, status, texto?, error? }.
 */
export async function obtener(url, opciones = {}) {
  const {
    fetchImpl = globalThis.fetch,
    timeout = TIMEOUT_POR_DEFECTO,
    reintentos = REINTENTOS,
    esperaReintento = ESPERA_REINTENTO_MS,
    limitador = (fn) => fn(),
  } = opciones;
  let r;
  let intentos = 0;
  for (let intento = 0; intento <= reintentos; intento++) {
    if (intento > 0) await dormir(esperaReintento);
    intentos++;
    r = await limitador(() => unaPeticion(url, fetchImpl, timeout));
    const reintentable = r.status === 0 || r.status >= 500 || r.status === 429;
    if (!reintentable) break;
  }
  r.intentos = intentos;
  return r;
}

// ---------------------------------------------------------------------------
// Barrido
// ---------------------------------------------------------------------------

function nuevoGrupo(clave, extra = {}) {
  return { clave, total: 0, archivos: new Map(), ...extra };
}

function acumular(grupos, hallazgos, archivo, crearExtra) {
  for (const h of hallazgos) {
    let g = grupos.get(h.clave);
    if (!g) {
      g = nuevoGrupo(h.clave, crearExtra ? crearExtra(h) : {});
      grupos.set(h.clave, g);
    }
    g.total++;
    let a = g.archivos.get(archivo);
    if (!a) {
      a = { archivo, conteo: 0, contextos: [] };
      g.archivos.set(archivo, a);
    }
    a.conteo++;
    if (a.contextos.length < MAX_CONTEXTOS_POR_ARCHIVO && !a.contextos.includes(h.contexto)) {
      a.contextos.push(h.contexto);
    }
  }
}

function cerrarGrupos(grupos, renombrar = (g) => g) {
  return [...grupos.values()]
    .map((g) => renombrar({ ...g, archivos: [...g.archivos.values()] }))
    .sort((a, b) => b.total - a.total || String(a.clave).localeCompare(String(b.clave)));
}

/** Código de salida: 1 si hay restos; 3 si el barrido quedó incompleto; 0 si limpio. */
export function calcularCodigo(resultado) {
  if (resultado.restos.length > 0) return CODIGO.RESTOS;
  if (resultado.errores.length > 0) return CODIGO.ERROR;
  return CODIGO.LIMPIO;
}

/**
 * Ejecuta el barrido completo. Lanza ErrorBarrido si no se puede consultar la
 * API o descargar la portada. Los demás fallos quedan en `errores`.
 */
export async function ejecutarBarrido(op, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new ErrorBarrido('Este Node no tiene fetch global; usa Node >= 18.');
  }
  const limitador = crearLimitador(CONCURRENCIA_MAXIMA);
  const get = (url) =>
    obtener(url, {
      fetchImpl,
      timeout: op.timeout ?? TIMEOUT_POR_DEFECTO,
      esperaReintento: deps.esperaReintento ?? ESPERA_REINTENTO_MS,
      limitador,
    });
  const origen = new URL(op.portal).origin;
  const errores = [];
  const avisosGenerales = [];

  // 1. API de municipios.
  const urlApi = `${String(op.api ?? API_POR_DEFECTO).replace(/\/+$/, '')}/api/municipios`;
  const rApi = await get(urlApi);
  if (!rApi.ok) {
    throw new ErrorBarrido(
      `No se pudo consultar la API de municipios (${urlApi}): ${rApi.error ?? `HTTP ${rApi.status}`}.`,
    );
  }
  let municipios;
  try {
    municipios = listaMunicipios(JSON.parse(rApi.texto));
  } catch {
    municipios = null;
  }
  if (!municipios) {
    throw new ErrorBarrido(`La API de municipios (${urlApi}) no devolvió una lista JSON válida.`);
  }
  const conf = construirTerminos({
    municipios,
    slug: op.slug,
    nombre: op.nombre,
    extra: op.extra ?? [],
    permitir: op.permitir ?? [],
  });

  // 2. Portada, sitemap y robots.
  const [rHome, rSitemap, rRobots] = await Promise.all([
    get(`${origen}/`),
    get(`${origen}/sitemap.xml`),
    get(`${origen}/robots.txt`),
  ]);
  if (!rHome.ok) {
    throw new ErrorBarrido(
      `No se pudo descargar la portada ${origen}/: ${rHome.error ?? `HTTP ${rHome.status}`}.`,
    );
  }

  const documentos = []; // { archivo, tipo, texto }
  const hostsReescritos = new Set();
  let locsRutas = [];
  const sitemapInfo = { estado: rSitemap.status, rutas: 0, hijos: [] };
  if (rSitemap.ok && /<(?:urlset|sitemapindex)[\s>]/i.test(rSitemap.texto)) {
    documentos.push({ archivo: '/sitemap.xml', tipo: 'xml', texto: rSitemap.texto });
    const { tipo, locs } = extraerLocsSitemap(rSitemap.texto);
    let urls = locs;
    if (tipo === 'indice') {
      urls = [];
      const hijos = locs
        .map((l) => reescribirHost(l, origen))
        .filter(Boolean)
        .slice(0, MAX_SITEMAPS_HIJOS);
      const respuestas = await Promise.all(hijos.map((h) => get(h.url)));
      hijos.forEach((h, i) => {
        if (h.reescrito) hostsReescritos.add(h.hostOriginal);
        const r = respuestas[i];
        sitemapInfo.hijos.push({ ruta: h.ruta, estado: r.status });
        if (r.ok) {
          documentos.push({ archivo: h.ruta, tipo: 'xml', texto: r.texto });
          urls.push(...extraerLocsSitemap(r.texto).locs);
        } else {
          errores.push({ url: h.url, error: r.error ?? `HTTP ${r.status}` });
        }
      });
    }
    for (const loc of urls) {
      const r = reescribirHost(loc, origen);
      if (!r) continue;
      if (r.reescrito) hostsReescritos.add(r.hostOriginal);
      locsRutas.push(r.ruta);
    }
    sitemapInfo.rutas = locsRutas.length;
  } else if (rSitemap.status === 0) {
    errores.push({ url: `${origen}/sitemap.xml`, error: rSitemap.error });
  } else {
    avisosGenerales.push(`No hay sitemap.xml válido (HTTP ${rSitemap.status}); solo se usan los enlaces de la portada.`);
  }
  if (rRobots.ok && !/<html[\s>]/i.test(rRobots.texto)) {
    documentos.push({ archivo: '/robots.txt', tipo: 'txt', texto: rRobots.texto });
  } else if (rRobots.status === 0) {
    errores.push({ url: `${origen}/robots.txt`, error: rRobots.error });
  }
  if (hostsReescritos.size > 0) {
    avisosGenerales.push(
      `El sitemap usa ${[...hostsReescritos].join(', ')}; esas rutas se revisaron en ${new URL(origen).host}.`,
    );
  }

  // 3. Rutas: "/" + sitemap + enlaces internos de la portada.
  const enlaces = extraerEnlacesInternos(rHome.texto, origen);
  const max = op.maxRutas ?? MAX_RUTAS_POR_DEFECTO;
  const candidatas = planificarRutas([locsRutas, enlaces], Number.MAX_SAFE_INTEGER);
  const rutas = candidatas.slice(0, max);
  if (candidatas.length > rutas.length) {
    avisosGenerales.push(
      `Se revisaron ${rutas.length} de ${candidatas.length} rutas (límite --max-rutas ${max}).`,
    );
  }
  const infoRutas = [];
  const respuestasRutas = await Promise.all(
    rutas.map((ruta) => (ruta === '/' ? rHome : get(origen + ruta))),
  );
  rutas.forEach((ruta, i) => {
    const r = respuestasRutas[i];
    infoRutas.push({ ruta, estado: r.status, bytes: r.texto?.length ?? 0 });
    if (r.status === 0) {
      errores.push({ url: origen + ruta, error: r.error });
      return;
    }
    if (!r.ok) avisosGenerales.push(`La ruta ${ruta} respondió HTTP ${r.status} (se revisó igual su HTML).`);
    documentos.push({ archivo: ruta, tipo: 'html', texto: r.texto ?? '' });
  });

  // 4. Recursos /_next/static referenciados por cualquier HTML (una vez cada uno).
  const recursos = new Map();
  for (const d of documentos) {
    if (d.tipo !== 'html') continue;
    for (const rec of extraerRecursosNext(d.texto, origen)) {
      if (!recursos.has(rec.ruta)) recursos.set(rec.ruta, rec);
    }
  }
  const listaRecursos = [...recursos.values()];
  const respuestasRecursos = await Promise.all(listaRecursos.map((rec) => get(rec.url)));
  const infoRecursos = [];
  listaRecursos.forEach((rec, i) => {
    const r = respuestasRecursos[i];
    infoRecursos.push({ ruta: rec.ruta, estado: r.status, bytes: r.texto?.length ?? 0 });
    if (!r.ok) {
      errores.push({ url: rec.url, error: r.error ?? `HTTP ${r.status}` });
      return;
    }
    documentos.push({ archivo: rec.ruta, tipo: rec.ruta.endsWith('.css') ? 'css' : 'js', texto: r.texto });
  });

  // 5. Análisis.
  const gRestos = new Map();
  const gCorreos = new Map();
  const gTelefonos = new Map();
  const gCloudinary = new Map();
  const porTermino = new Map(conf.terminos.map((t) => [t.termino, t]));
  for (const d of documentos) {
    const a = analizarDocumento(d.texto, conf);
    acumular(gRestos, a.restos, d.archivo, (h) => {
      const t = porTermino.get(h.clave);
      return { etiqueta: t?.etiqueta, municipio: t?.municipio ?? null, origenes: t?.origenes ?? [] };
    });
    acumular(gCorreos, a.correos, d.archivo);
    acumular(gTelefonos, a.telefonos, d.archivo);
    acumular(gCloudinary, a.cloudinary, d.archivo, (h) => ({ slug: h.slug }));
  }

  const resultado = {
    portal: origen,
    slug: conf.propio.slug,
    nombre: conf.propio.nombre,
    fuenteNombre: conf.propio.fuenteNombre,
    api: urlApi,
    municipiosApi: municipios.length,
    rutas: infoRutas,
    recursos: infoRecursos,
    otros: documentos.filter((d) => d.tipo === 'xml' || d.tipo === 'txt').map((d) => d.archivo),
    sitemap: { ...sitemapInfo, hostsReescritos: [...hostsReescritos] },
    terminos: conf.terminos,
    permitidos: conf.permitidos,
    excluidos: conf.excluidos,
    restos: cerrarGrupos(gRestos, ({ clave, ...g }) => ({ termino: clave, ...g })),
    avisos: {
      correos: cerrarGrupos(gCorreos, ({ clave, ...g }) => ({ valor: clave, ...g })),
      telefonos: cerrarGrupos(gTelefonos, ({ clave, ...g }) => ({ valor: clave, ...g })),
      cloudinary: cerrarGrupos(gCloudinary, ({ clave, ...g }) => ({ valor: clave, ...g })),
      generales: avisosGenerales,
    },
    errores,
  };
  resultado.codigo = calcularCodigo(resultado);
  return resultado;
}

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

export const NOTA_REVISION =
  'El script NO distingue una mención legítima (colindancias, historia: "colindante con ' +
  'Sahuaripa", "adscrito a Villa Pesqueira (1931)") de un resto del molde. Revisa cada ' +
  'contexto a mano. Para las legítimas vuelve a correr con --permitir: un término ' +
  '(--permitir "sahuaripa") lo silencia en todo el portal; una frase ' +
  '(--permitir "colindante con sahuaripa") silencia solo las apariciones dentro de ella.';

function listaCorta(items, max = 6) {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} y ${items.length - max} más`;
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Parte una lista larga en líneas de ~100 caracteres. */
function envolver(prefijo, items, sangria, ancho = 100) {
  const lineas = [];
  let actual = prefijo;
  items.forEach((item, i) => {
    const pieza = item + (i < items.length - 1 ? ',' : '');
    if (actual.length + pieza.length + 1 > ancho && actual.trim() && actual !== prefijo) {
      lineas.push(actual.trimEnd());
      actual = sangria;
    }
    actual += (actual === prefijo || actual === sangria ? '' : ' ') + pieza;
  });
  lineas.push(actual.trimEnd());
  return lineas;
}

/** Agrupa los contextos de un grupo por texto: [{ contexto, archivos: ["/x (2)"] }]. */
function contextosAgrupados(grupo) {
  const mapa = new Map();
  for (const a of grupo.archivos) {
    for (const c of a.contextos) {
      if (!mapa.has(c)) mapa.set(c, []);
      mapa.get(c).push(a.conteo > 1 ? `${a.archivo} (${a.conteo})` : a.archivo);
    }
  }
  return [...mapa.entries()].map(([contexto, archivos]) => ({ contexto, archivos }));
}

function imprimirGrupo(lineas, g, titulo, maxContextos) {
  lineas.push(`  ${titulo} — ${plural(g.total, 'coincidencia', 'coincidencias')} en ${plural(g.archivos.length, 'archivo', 'archivos')}`);
  const ctx = contextosAgrupados(g);
  for (const { contexto, archivos } of ctx.slice(0, maxContextos)) {
    lineas.push(`      ${contexto}`);
    lineas.push(`        en: ${listaCorta([...new Set(archivos)])}`);
  }
  if (ctx.length > maxContextos) {
    lineas.push(`      (+${ctx.length - maxContextos} fragmentos distintos más; usa --json para verlos todos)`);
  }
}

/** Reporte legible en español. */
export function formatearReporte(r, { maxContextos = 5 } = {}) {
  const L = [];
  const js = r.recursos.filter((x) => x.ruta.endsWith('.js')).length;
  const css = r.recursos.filter((x) => x.ruta.endsWith('.css')).length;
  L.push('Barrido de restos de otros municipios');
  L.push(`  Portal:    ${r.portal}`);
  L.push(
    `  Municipio: ${r.nombre} (slug ${r.slug}; nombre tomado de ${r.fuenteNombre === 'api' ? 'la API' : '--nombre, no está en la API'})`,
  );
  L.push(`  Rutas (${r.rutas.length}): ${r.rutas.map((x) => (x.estado >= 200 && x.estado < 300 ? x.ruta : `${x.ruta} [${x.estado || 'error'}]`)).join(', ')}`);
  L.push(`  Recursos /_next/static: ${js} JS, ${css} CSS${r.otros.length ? `; además ${r.otros.join(', ')}` : ''}`);
  L.push(...envolver(`  Términos buscados (${r.terminos.length}): `, r.terminos.map((t) => t.termino), '      '));
  if (r.permitidos.length) L.push(`  Permitidos (--permitir): ${r.permitidos.join(', ')}`);
  L.push('');

  if (r.restos.length === 0) {
    L.push('RESTOS DE OTROS MUNICIPIOS: ninguno.');
  } else {
    const total = r.restos.reduce((s, g) => s + g.total, 0);
    L.push(`RESTOS DE OTROS MUNICIPIOS: ${plural(r.restos.length, 'término', 'términos')}, ${plural(total, 'coincidencia', 'coincidencias')}`);
    for (const g of r.restos) {
      const fuente = [g.municipio && g.municipio !== g.etiqueta ? `municipio ${g.municipio}` : null, g.origenes.join(', ')]
        .filter(Boolean)
        .join('; ');
      imprimirGrupo(L, g, `[RESTO] "${g.termino}" (${fuente})`, maxContextos);
    }
    L.push('');
    L.push(`IMPORTANTE: ${NOTA_REVISION}`);
  }
  L.push('');

  const { correos, telefonos, cloudinary, generales } = r.avisos;
  const hayAvisos = correos.length + telefonos.length + cloudinary.length + generales.length > 0;
  if (hayAvisos) {
    L.push('AVISOS (no cambian el código de salida; confirma que sean de este municipio):');
    for (const g of correos) imprimirGrupo(L, g, `[AVISO] correo ${g.valor}`, 2);
    for (const g of telefonos) imprimirGrupo(L, g, `[AVISO] teléfono ${g.valor}`, 2);
    for (const g of cloudinary) {
      imprimirGrupo(L, g, `[AVISO] Cloudinary con otro slug: ${g.valor}`, 2);
    }
    for (const a of generales) L.push(`  [AVISO] ${a}`);
    L.push('');
  }

  if (r.errores.length) {
    L.push(`ERRORES (${r.errores.length}; el barrido quedó incompleto):`);
    for (const e of r.errores) L.push(`  ${e.url}: ${e.error}`);
    L.push('');
  }

  if (r.codigo === CODIGO.RESTOS) L.push('Resultado: HAY POSIBLES RESTOS de otros municipios (código 1). Revísalos a mano.');
  else if (r.codigo === CODIGO.ERROR) L.push('Resultado: barrido INCOMPLETO por errores de red (código 3).');
  else L.push('Resultado: sin restos de otros municipios (código 0).');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export const AYUDA = `barrido-portal.mjs — busca restos de otros municipios en un portal publicado.

Uso:
  node barrido-portal.mjs --portal URL --slug SLUG [opciones]

Opciones:
  --portal URL       Portal a revisar (p. ej. https://villapesqueira.vercel.app). Obligatorio.
  --slug SLUG        Slug del municipio del portal (p. ej. villapesqueira). Obligatorio.
  --nombre NOMBRE    Nombre del municipio. Obligatorio si el slug aún no está en la API;
                     si está, se toma de ahí.
  --extra LISTA      Términos adicionales separados por coma
                     (p. ej. "1639,río sonora,misión jesuita").
  --permitir LISTA   Términos o frases permitidos, separados por coma. Un término que
                     coincide con uno buscado lo quita; una frase silencia solo las
                     apariciones contenidas en ella (p. ej. "colindante con sahuaripa").
  --max-rutas N      Máximo de rutas HTML a revisar (por defecto ${MAX_RUTAS_POR_DEFECTO}).
  --api URL          API de municipios (por defecto ${API_POR_DEFECTO}).
  --timeout MS       Tiempo máximo por petición (por defecto ${TIMEOUT_POR_DEFECTO}); 1 reintento.
  --json             Salida en JSON para máquinas.
  --ayuda, -h        Muestra esta ayuda.

Qué revisa:
  "/" + las <loc> de /sitemap.xml (con el host reescrito al de --portal) + los enlaces
  internos de la portada; el HTML de cada ruta, /sitemap.xml, /robots.txt y todos los
  /_next/static/**.js y .css que referencian. Solo hace peticiones GET (máx. ${CONCURRENCIA_MAXIMA} a la vez).

  Restos: nombres, slugs y dominios de los municipios de la API (menos el propio),
  un listado fijo de municipios de Sonora usados como molde y --extra. Se ignoran
  mayúsculas, acentos, escapes \\uXXXX y entidades HTML, con límites de palabra.
  Avisos: correos, teléfonos mexicanos y URLs de Cloudinary con cms-municipal/<otro-slug>/.

  El script no distingue menciones legítimas (colindancias, historia): revisa cada
  contexto a mano y usa --permitir para las legítimas.

Códigos de salida:
  0  sin restos de otros municipios (puede haber avisos)
  1  hay posibles restos
  3  error de red o de argumentos (incluye barrido incompleto sin restos)
`;

/** Interpreta argv. Devuelve { ayuda: true } o las opciones; lanza ErrorBarrido si son inválidas. */
export function parsearArgumentos(argv) {
  let valores;
  try {
    ({ values: valores } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        portal: { type: 'string' },
        slug: { type: 'string' },
        nombre: { type: 'string' },
        extra: { type: 'string', multiple: true },
        permitir: { type: 'string', multiple: true },
        'max-rutas': { type: 'string' },
        api: { type: 'string' },
        timeout: { type: 'string' },
        json: { type: 'boolean' },
        ayuda: { type: 'boolean', short: 'h' },
        help: { type: 'boolean' },
      },
    }));
  } catch (e) {
    throw new ErrorBarrido(`Argumentos inválidos: ${e.message}. Usa --ayuda.`);
  }
  if (valores.ayuda || valores.help) return { ayuda: true, json: Boolean(valores.json) };

  const json = Boolean(valores.json);
  if (!valores.portal) throw new ErrorBarrido('Falta --portal URL. Usa --ayuda.');
  let portal;
  try {
    portal = new URL(valores.portal);
  } catch {
    throw new ErrorBarrido(`--portal no es una URL válida: ${valores.portal}`);
  }
  if (portal.protocol !== 'http:' && portal.protocol !== 'https:') {
    throw new ErrorBarrido('--portal debe empezar con http:// o https://');
  }
  if (!valores.slug) throw new ErrorBarrido('Falta --slug. Usa --ayuda.');
  const slug = valores.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new ErrorBarrido(`--slug inválido: ${valores.slug}`);

  const entero = (nombre, valor, def) => {
    if (valor === undefined) return def;
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0) throw new ErrorBarrido(`--${nombre} debe ser un entero positivo (recibido: ${valor}).`);
    return n;
  };
  let api = API_POR_DEFECTO;
  if (valores.api !== undefined) {
    try {
      api = new URL(valores.api).href.replace(/\/+$/, '');
    } catch {
      throw new ErrorBarrido(`--api no es una URL válida: ${valores.api}`);
    }
  }
  return {
    ayuda: false,
    json,
    portal: portal.origin,
    slug,
    nombre: valores.nombre?.trim() || null,
    extra: separarLista(valores.extra),
    permitir: separarLista(valores.permitir),
    maxRutas: entero('max-rutas', valores['max-rutas'], MAX_RUTAS_POR_DEFECTO),
    timeout: entero('timeout', valores.timeout, TIMEOUT_POR_DEFECTO),
    api,
  };
}

/** Salida JSON serializable (los Map ya están convertidos por cerrarGrupos). */
export function aJson(resultado) {
  return JSON.stringify({ ...resultado, nota: NOTA_REVISION }, null, 2);
}

/**
 * Punto de entrada. Devuelve el código de salida; no llama a process.exit.
 * deps: { fetchImpl, salida(texto), error(texto), esperaReintento }
 */
export async function main(argv = process.argv.slice(2), deps = {}) {
  const salida = deps.salida ?? ((t) => process.stdout.write(`${t}\n`));
  const error = deps.error ?? ((t) => process.stderr.write(`${t}\n`));
  const quiereJson = argv.includes('--json');
  let op;
  try {
    op = parsearArgumentos(argv);
    if (op.ayuda) {
      salida(AYUDA);
      return CODIGO.LIMPIO;
    }
    const resultado = await ejecutarBarrido(op, deps);
    salida(op.json ? aJson(resultado) : formatearReporte(resultado));
    return resultado.codigo;
  } catch (e) {
    const mensaje = e instanceof ErrorBarrido ? e.message : `Error inesperado: ${e?.stack ?? e}`;
    if (quiereJson) salida(JSON.stringify({ codigo: CODIGO.ERROR, error: mensaje }, null, 2));
    else error(`ERROR: ${mensaje}`);
    return CODIGO.ERROR;
  }
}

function esPuntoDeEntrada() {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

if (esPuntoDeEntrada()) {
  main().then((codigo) => {
    process.exitCode = codigo;
  });
}
