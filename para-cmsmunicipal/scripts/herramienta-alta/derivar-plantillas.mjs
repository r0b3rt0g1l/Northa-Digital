#!/usr/bin/env node
// derivar-plantillas.mjs
//
// Deriva plantillas genéricas de alta de municipio a partir de los archivos
// reales de un municipio ya validado. Sustituye SOLO:
//   - variantes del nombre y del slug  -> {{NOMBRE}}, {{SLUG}}, ...
//   - UUIDs                            -> {{UUID_1}}, {{UUID_2}}, ... (consistentes entre archivos)
// Todo lo demás se deja intacto y se lista en un reporte de residuos para
// revisión manual (LEEME.md). Nunca modifica los archivos de entrada.
//
// Requisitos: Node >= 18.3 (util.parseArgs), sin dependencias (solo módulos nativos).
// Las pruebas (derivar-plantillas.test.mjs) requieren Node >= 18.20 o 20+.
// Ejecutar desde la raíz de cmsmunicipal:
//   node scripts/herramienta-alta/derivar-plantillas.mjs --slug villapesqueira --nombre "Villa Pesqueira"
// Ayuda: --ayuda

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import * as util from 'node:util';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const NODE_MINIMO = '18.3.0';
export const SALIDA_POR_DEFECTO = 'scripts/herramienta-alta/plantillas';
export const ARCHIVO_LEEME = 'LEEME.md';
/** Todas las salidas que puede producir la herramienta (se comprueban siempre, se generen o no). */
export const SALIDAS_CONOCIDAS = [
  'plantilla-contrato.json',
  'plantilla-db-alta.js',
  'plantilla-operador.json',
  'plantilla-README-material.md',
  ARCHIVO_LEEME,
];
const LIMITE_RESIDUOS_CONSOLA = 25;
const LIMITE_RESIDUOS_LEEME_POR_TIPO = 100;
/** Términos del nombre con al menos esta longitud se buscan también dentro de otras palabras. */
const LONGITUD_TERMINO_LIBRE = 8;

/** Palabras del nombre que NO se vigilan como residuo por ser demasiado comunes (sin acentos, minúsculas). */
export const PALABRAS_GENERICAS = new Set([
  'villa', 'san', 'santa', 'santo', 'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e',
  'heroica', 'general', 'ciudad', 'pueblo', 'puerto', 'municipio', 'ayuntamiento',
  'agua', 'grande', 'chico', 'calles', 'rio', 'viejo', 'nuevo',
]);

/** Orden de prioridad de las variantes: si dos coinciden, gana la primera. */
export const ORDEN_VARIANTES = [
  'NOMBRE', 'NOMBRE_SIN_ACENTOS', 'NOMBRE_MAYUS', 'NOMBRE_MAYUS_SIN_ACENTOS', 'NOMBRE_MINUS',
  'SLUG', 'SLUG_MAYUS', 'SLUG_GUION', 'NOMBRE_CAMEL',
];

export const DESCRIPCION_MARCADOR = {
  NOMBRE: 'Nombre oficial tal cual (con acentos)',
  NOMBRE_SIN_ACENTOS: 'Nombre sin acentos',
  NOMBRE_MAYUS: 'Nombre en MAYÚSCULAS (con acentos)',
  NOMBRE_MAYUS_SIN_ACENTOS: 'Nombre en MAYÚSCULAS sin acentos',
  NOMBRE_MINUS: 'Nombre en minúsculas (con acentos)',
  SLUG: 'Slug del municipio',
  SLUG_MAYUS: 'Slug en MAYÚSCULAS',
  SLUG_GUION: 'Nombre en minúsculas, sin acentos, con guiones',
  NOMBRE_CAMEL: 'Nombre sin acentos, palabras juntas con inicial mayúscula',
};
const DESCRIPCION_UUID = 'UUID nuevo (crypto.randomUUID()); mismo valor en todas sus apariciones';

// Delimitadores internos para proteger lo ya sustituido (no-caracteres Unicode).
const INI = '\uFDD0';
const FIN = '\uFDD1';

/**
 * Lookbehind: posición justo después de una secuencia de escape \n \r \t \b \f \v
 * (con un número par de barras antes de la barra del escape). En JSON/JS la letra
 * del escape no forma parte de la palabra siguiente: "Hola\nVilla Pesqueira".
 */
const TRAS_ESCAPE = String.raw`(?<=(?:^|[^\\])(?:\\\\)*\\[nrtbfv])`;

const patronUuid = () =>
  new RegExp(
    String.raw`(?:(?<![0-9a-f])|${TRAS_ESCAPE})[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![0-9a-f])`,
    'gi',
  );
const patronMarcador = () => /\{\{[A-Z0-9_]+\}\}/g;

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

/** Quita diacríticos (NFD + elimina marcas combinantes). "Bacadéhuachi" -> "Bacadehuachi". */
export function quitarAcentos(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC');
}

export function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normaliza (minúsculas, sin acentos) conservando un mapa de cada unidad del
 * texto normalizado a su posición [inicio, fin) en el texto recibido.
 */
export function normalizarConMapa(texto) {
  let norm = '';
  const inicio = [];
  const fin = [];
  let offset = 0;
  for (const cp of String(texto)) {
    const n = cp.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (let k = 0; k < n.length; k++) {
      inicio.push(offset);
      fin.push(offset + cp.length);
    }
    norm += n;
    offset += cp.length;
  }
  return { norm, inicio, fin };
}

const normalizar = (texto) => normalizarConMapa(texto).norm;

export function sha256(contenido) {
  return crypto.createHash('sha256').update(contenido).digest('hex');
}

function rutaVisible(desde, ruta) {
  const r = path.relative(desde, ruta) || '.';
  return r.split(path.sep).join('/');
}

function tipoPorExtension(archivo) {
  const ext = path.extname(String(archivo)).toLowerCase();
  if (ext === '.json') return 'json';
  if (['.js', '.mjs', '.cjs', '.ts'].includes(ext)) return 'js';
  return 'texto';
}

// --- Decodificación (solo para detectar residuos escritos con escapes) ----------

const ENTIDADES_BASICAS = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', szlig: 'ß' };
const MARCA_ENTIDAD = {
  acute: '\u0301', grave: '\u0300', circ: '\u0302', uml: '\u0308', tilde: '\u0303', cedil: '\u0327', ring: '\u030a',
};

function decodificarEntidad(nombre) {
  if (nombre[0] === '#') {
    const hex = nombre[1] === 'x' || nombre[1] === 'X';
    const cp = parseInt(nombre.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : null;
  }
  if (Object.prototype.hasOwnProperty.call(ENTIDADES_BASICAS, nombre)) return ENTIDADES_BASICAS[nombre];
  const m = /^([A-Za-z])(acute|grave|circ|uml|tilde|cedil|ring)$/.exec(nombre);
  return m ? (m[1] + MARCA_ENTIDAD[m[2]]).normalize('NFC') : null;
}

const RE_ESC_U4 = /\\u([0-9a-fA-F]{4})/y;
const RE_ESC_UL = /\\u\{([0-9a-fA-F]{1,6})\}/y;
const RE_ESC_X = /\\x([0-9a-fA-F]{2})/y;
const RE_ENTIDAD = /&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/y;
const RE_PORCENTAJE = /(?:%[0-9a-fA-F]{2})+/y;
const ESCAPES_SIMPLES = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' };

/**
 * Decodifica una línea para buscar residuos: \uXXXX, \xXX y escapes simples (JSON/JS),
 * entidades HTML (&aacute; &#225; &#xE1;) y percent-encoding (%C3%A1, o Latin-1 %E1).
 * Devuelve { texto, ini, fin }: para cada unidad del texto decodificado, el rango
 * [ini, fin) que ocupa en la línea original.
 */
export function decodificarConMapa(linea, tipo = 'texto') {
  const s = String(linea);
  const escapes = tipo === 'json' || tipo === 'js';
  let texto = '';
  const ini = [];
  const fin = [];
  const emitir = (cadena, a, b) => {
    for (let k = 0; k < cadena.length; k++) {
      ini.push(a);
      fin.push(b);
    }
    texto += cadena;
  };
  const probar = (re, i) => {
    re.lastIndex = i;
    return re.exec(s);
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (escapes && c === '\\' && i + 1 < s.length) {
      let m;
      if ((m = probar(RE_ESC_U4, i))) {
        emitir(String.fromCharCode(parseInt(m[1], 16)), i, i + m[0].length);
        i += m[0].length;
        continue;
      }
      if ((m = probar(RE_ESC_UL, i)) && parseInt(m[1], 16) <= 0x10ffff) {
        emitir(String.fromCodePoint(parseInt(m[1], 16)), i, i + m[0].length);
        i += m[0].length;
        continue;
      }
      if ((m = probar(RE_ESC_X, i))) {
        emitir(String.fromCharCode(parseInt(m[1], 16)), i, i + m[0].length);
        i += m[0].length;
        continue;
      }
      const d = s[i + 1];
      emitir(ESCAPES_SIMPLES[d] ?? d, i, i + 2);
      i += 2;
      continue;
    }
    if (c === '&') {
      const m = probar(RE_ENTIDAD, i);
      const dec = m && decodificarEntidad(m[1]);
      if (dec != null && m) {
        emitir(dec, i, i + m[0].length);
        i += m[0].length;
        continue;
      }
    }
    if (c === '%') {
      const m = probar(RE_PORCENTAJE, i);
      if (m) {
        let dec = null;
        try {
          dec = decodeURIComponent(m[0]);
        } catch {
          dec = null; // no es UTF-8: se decodifica cada byte como Latin-1 (abajo)
        }
        if (dec != null) {
          emitir(dec, i, i + m[0].length);
        } else {
          for (let k = 0; k < m[0].length; k += 3) emitir(String.fromCharCode(parseInt(m[0].slice(k + 1, k + 3), 16)), i + k, i + k + 3);
        }
        i += m[0].length;
        continue;
      }
    }
    emitir(c, i, i + 1);
    i += 1;
  }
  return { texto, ini, fin };
}

const esLetraOMarca = (ch) => ch !== undefined && /[\p{L}\p{M}]/u.test(ch);
const esMinuscula = (ch) => ch !== undefined && /\p{Ll}/u.test(ch);
const esMayuscula = (ch) => ch !== undefined && /\p{Lu}/u.test(ch);

/** Hay borde de palabra antes de la posición p (no-letra, o transición camelCase minúscula->Mayúscula). */
function bordeIzquierdo(texto, p) {
  if (p <= 0) return true;
  const prev = texto[p - 1];
  if (!esLetraOMarca(prev)) return true;
  return esMinuscula(prev) && esMayuscula(texto[p]);
}

/** Hay borde de palabra en la posición q (fin exclusivo del término). */
function bordeDerecho(texto, q) {
  if (q >= texto.length) return true;
  const sig = texto[q];
  if (!esLetraOMarca(sig)) return true;
  return esMinuscula(texto[q - 1]) && esMayuscula(sig);
}

// ---------------------------------------------------------------------------
// Variantes y sustitución
// ---------------------------------------------------------------------------

/**
 * Todas las variantes candidatas, en orden de prioridad. Las que repiten una
 * cadena ya producida por una variante anterior llevan `igualA` (se descartan).
 */
export function calcularCandidatas(nombre, slug) {
  const n = String(nombre ?? '').trim().normalize('NFC');
  const s = String(slug ?? '').trim();
  const sinAcentos = quitarAcentos(n);
  const palabras = sinAcentos.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const valores = {
    NOMBRE: n,
    NOMBRE_SIN_ACENTOS: sinAcentos,
    NOMBRE_MAYUS: n.toUpperCase(),
    NOMBRE_MAYUS_SIN_ACENTOS: sinAcentos.toUpperCase(),
    NOMBRE_MINUS: n.toLowerCase(),
    SLUG: s,
    SLUG_MAYUS: s.toUpperCase(),
    SLUG_GUION: sinAcentos.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    NOMBRE_CAMEL: palabras.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(''),
  };
  const vistos = new Map();
  const candidatas = [];
  for (const marcador of ORDEN_VARIANTES) {
    const valor = valores[marcador];
    if (!valor) continue;
    if (vistos.has(valor)) {
      candidatas.push({ marcador, valor, igualA: vistos.get(valor) });
    } else {
      vistos.set(valor, marcador);
      candidatas.push({ marcador, valor });
    }
  }
  return candidatas;
}

/** Variantes efectivas [{marcador, valor}] en orden de prioridad, sin duplicados. */
export function calcularVariantes(nombre, slug) {
  return calcularCandidatas(nombre, slug)
    .filter((c) => !c.igualA)
    .map(({ marcador, valor }) => ({ marcador, valor }));
}

/**
 * Marcadores cuyo valor es exactamente el slug: SLUG y, si el slug coincidió con una
 * variante de mayor prioridad (p. ej. NOMBRE_MINUS en "Naco"/"naco"), también esa.
 */
export function marcadoresDelSlug(nombre, slug) {
  const c = calcularCandidatas(nombre, slug).find((x) => x.marcador === 'SLUG');
  return c?.igualA ? ['SLUG', c.igualA] : ['SLUG'];
}

/**
 * Asigna UUID_1, UUID_2... por orden de aparición recorriendo los textos en el
 * orden dado. Insensible a mayúsculas. Devuelve Map(uuidEnMinusculas -> marcador).
 */
export function crearMapaUuids(textos) {
  const mapa = new Map();
  for (const texto of textos) {
    for (const m of String(texto).matchAll(patronUuid())) {
      const clave = m[0].toLowerCase();
      if (!mapa.has(clave)) mapa.set(clave, `UUID_${mapa.size + 1}`);
    }
  }
  return mapa;
}

/**
 * Sustituye UUIDs y variantes de nombre/slug por marcadores.
 * - Variantes exactas (sensibles a mayúsculas), de la más larga a la más corta.
 * - Solo apariciones no pegadas a otras letras (evita "naco" dentro de "nacional");
 *   la letra de un escape \n, \t... no cuenta como letra pegada.
 * - Lo ya sustituido queda protegido y no se vuelve a tocar.
 * Devuelve { texto, conteo: { MARCADOR: n } }.
 */
export function sustituir(texto, variantes, mapaUuids) {
  let t = String(texto);
  if (t.includes(INI) || t.includes(FIN)) {
    throw new Error('el texto contiene caracteres reservados U+FDD0/U+FDD1; no se puede procesar');
  }
  const mapa = mapaUuids ?? crearMapaUuids([t]);
  const nombres = [];
  const conteo = {};
  const ficha = (marcador) => {
    let i = nombres.indexOf(marcador);
    if (i < 0) i = nombres.push(marcador) - 1;
    conteo[marcador] = (conteo[marcador] ?? 0) + 1;
    return `${INI}${i}${FIN}`;
  };

  t = t.replace(patronUuid(), (m) => {
    const marcador = mapa.get(m.toLowerCase());
    return marcador ? ficha(marcador) : m;
  });

  const ordenadas = variantes
    .map((v, i) => ({ ...v, i }))
    .filter((v) => v.valor)
    .sort((a, b) => b.valor.length - a.valor.length || a.i - b.i);
  for (const v of ordenadas) {
    const formas = new Set([v.valor.normalize('NFC'), v.valor.normalize('NFD')]);
    for (const forma of formas) {
      const re = new RegExp(
        String.raw`(?:(?<![\p{L}\p{M}])|${TRAS_ESCAPE})${escaparRegex(forma)}(?![\p{L}\p{M}])`,
        'gu',
      );
      t = t.replace(re, () => ficha(v.marcador));
    }
  }

  t = t.replace(new RegExp(`${INI}(\\d+)${FIN}`, 'g'), (_, i) => `{{${nombres[Number(i)]}}}`);
  return { texto: t, conteo };
}

/** ¿Es `nombre` uno de los marcadores que genera esta herramienta? */
export function esMarcadorGenerado(nombre) {
  return ORDEN_VARIANTES.includes(nombre) || /^UUID_\d+$/.test(nombre);
}

/**
 * Busca "{{" ya presentes en una fuente (placeholders propios del CMS, etc.).
 * Devuelve [{linea, texto, nombre}] (nombre = contenido entre llaves, o null).
 */
export function buscarMarcadoresPreexistentes(texto) {
  const r = [];
  String(texto)
    .split(/\r\n|\n|\r/)
    .forEach((l, i) => {
      if (!l.includes('{{')) return;
      for (const m of l.matchAll(/\{\{([^{}\n]{0,80}?)\}\}|\{\{/g)) {
        r.push({ linea: i + 1, texto: m[0], nombre: m[1] !== undefined ? m[1].trim() : null });
      }
    });
  return r;
}

// ---------------------------------------------------------------------------
// Detección de secretos
// ---------------------------------------------------------------------------

const PALABRA_SENSIBLE = String.raw`(?:passw(?:or)?d|pass(?:phrase)?(?![a-z])|pwd|contrase(?:ñ|n\u0303?)a|secret(?!ar[ií])|token|api[_-]?key|access[_-]?key|private[_-]?key|authorization|clave[ _-]?(?:de[ _-]?)?acceso|clave[ _-]?secreta|clave[ _-]?privada)`;
const RE_PALABRA_RAPIDA = new RegExp(PALABRA_SENSIBLE, 'iu');
const RE_PALABRA_CELDA = new RegExp(String.raw`(?<![\p{L}\p{N}_])${PALABRA_SENSIBLE}`, 'iu');

function crearReClave(tipo) {
  // En texto libre se admiten hasta 4 palabras entre la palabra sensible y ':' ("Contraseña del correo:").
  const entre = tipo === 'texto' ? String.raw`((?:[ \t]+[^\s:=|\x60"'*]{1,25}){0,4}?)` : '()';
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}_$])(["'\x60]?)([\p{L}\p{N}_$.-]{0,40}?${PALABRA_SENSIBLE}[\p{L}\p{N}_$.-]{0,40})\1${entre}(?:\*\*|__)?[ \t]*(?::|=(?![=>]))(?:\*\*|__)?[ \t]*`,
    'giu',
  );
}

const RE_URL_CREDENCIAL = () => /\b[a-z][a-z0-9+.-]*:(?:\\?\/){2}[^\s:@/\\'"`]+:([^\s@/\\'"`]+)@/gi;
const RE_PARAM_SENSIBLE = () =>
  /[?&]([\w.-]{0,30}?(?:token|api[_-]?key|key|secret|password|passwd|pwd|pass|sig|signature|auth))=([^&\s'"`#<>\\]+)/gi;

const RE_PLACEHOLDER =
  /^(?:x{3,}|\*+|•+|-+|—|–|\.{3}|…|n\/?a|null|none|nil|undefined|pendiente|ninguna?|por definir|no aplica|sin contrase(?:ñ|n)a|\(?vac[ií]a\)?|%[\w.]+%)$/i;

/** ¿El valor parece un secreto real (no vacío ni un marcador de posición)? */
function esValorSecreto(valor) {
  const t = String(valor)
    // placeholders ajenos: {{PASSWORD}}, ${VAR}, <tu-contraseña> (los marcadores propios SÍ cuentan)
    .replace(/\{\{(?!\s*(?:NOMBRE|SLUG|UUID)[A-Z0-9_]*\s*\}\})[^{}]*\}\}/g, '')
    .replace(/\$\{[^{}]*\}/g, '')
    .replace(/<[^<>]*>/g, '')
    .trim();
  if (!t) return false;
  if (/^(?:Bearer|Basic|Token)$/i.test(t)) return false;
  return !RE_PLACEHOLDER.test(t);
}

const PARTES_METADATOS = new Set([
  'ttl', 'exp', 'expira', 'expiracion', 'expire', 'expires', 'expiry', 'vigencia', 'duracion', 'length', 'len',
  'longitud', 'min', 'max', 'minimo', 'maximo', 'rounds', 'round', 'cost', 'costo', 'intentos', 'attempts',
  'size', 'tamano', 'timeout', 'version', 'count', 'limit', 'limite', 'type', 'tipo',
]);

/** Claves como tokenTTL o passwordMinLength: su valor numérico es configuración, no un secreto. */
function claveDeMetadatos(clave) {
  return quitarAcentos(clave)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((p) => PARTES_METADATOS.has(p));
}

const PALABRAS_VACIAS = new Set([
  'se', 'por', 'en', 'el', 'la', 'los', 'las', 'de', 'del', 'al', 'a', 'con', 'sin', 'que', 'no', 'es', 'ver',
  'pedir', 'solicitar', 'sera', 'esta', 'lo', 'un', 'una', 'su', 'sus', 'para', 'y', 'o', 'the', 'is', 'to', 'see',
  'ask',
]);

/** "se entrega por separado": frase, no un secreto. */
function esProsa(t) {
  const palabras = t.split(/\s+/).filter(Boolean);
  if (palabras.length < 2) return false;
  if (!palabras.every((p) => /^\(?\p{L}+[).,;:]?$/u.test(p))) return false;
  return palabras.some((p) => PALABRAS_VACIAS.has(quitarAcentos(p.replace(/[().,;:]/g, '')).toLowerCase()));
}

const digitos = (s) => s.replace(/\D/g, '').length;
const RE_NUMERO_LITERAL = /-?(?:0[xX][0-9a-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)n?(?![\p{L}\p{N}_$])/uy;

function numeroEn(linea, p) {
  RE_NUMERO_LITERAL.lastIndex = p;
  return RE_NUMERO_LITERAL.exec(linea)?.[0] ?? null;
}

const esComilla = (c) => c === '"' || c === "'" || c === '`';

/** Literal entre comillas que empieza en p: contenido [a, b) y posición tras la comilla de cierre. */
function leerLiteral(linea, p) {
  const q = linea[p];
  let j = p + 1;
  while (j < linea.length && linea[j] !== q) j += linea[j] === '\\' ? 2 : 1;
  const b = Math.min(j, linea.length);
  return { a: p + 1, b, fin: Math.min(b + 1, linea.length) };
}

/** Literales (cadenas no vacías y números de 3+ dígitos) dentro de un [..] o {..} que empieza en p. */
function literalesEnBloque(linea, p) {
  const r = [];
  let prof = 0;
  for (let j = p; j < linea.length; ) {
    const ch = linea[j];
    if (esComilla(ch)) {
      const l = leerLiteral(linea, j);
      const esClave = /^\s*:/.test(linea.slice(l.fin, l.fin + 20));
      if (!esClave && esValorSecreto(linea.slice(l.a, l.b))) r.push([l.a, l.b]);
      j = l.fin;
      continue;
    }
    if (ch === '[' || ch === '{' || ch === '(') prof++;
    else if (ch === ']' || ch === '}' || ch === ')') {
      prof--;
      if (prof <= 0) break;
    } else if (/\d/.test(ch) && !/[\p{L}\p{N}_$.]/u.test(linea[j - 1] ?? '')) {
      const n = numeroEn(linea, j);
      if (n) {
        if (digitos(n) >= 3) r.push([j, j + n.length]);
        j += n.length;
        continue;
      }
    }
    j++;
  }
  return r;
}

/** En JS: literales de respaldo tras || o ?? ("process.env.X || 'secreto'"). */
function respaldosEnExpresion(linea, p) {
  const r = [];
  let prof = 0;
  for (let j = p; j < linea.length; ) {
    const ch = linea[j];
    if (esComilla(ch)) {
      j = leerLiteral(linea, j).fin;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') prof++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (prof === 0) break;
      prof--;
    } else if (prof === 0 && (ch === ',' || ch === ';')) break;
    else if (linea.startsWith('||', j) || linea.startsWith('??', j)) {
      let k = j + 2;
      while (k < linea.length && (linea[k] === ' ' || linea[k] === '\t')) k++;
      if (esComilla(linea[k])) {
        const l = leerLiteral(linea, k);
        if (esValorSecreto(linea.slice(l.a, l.b))) r.push([l.a, l.b]);
        j = l.fin;
        continue;
      }
      const n = numeroEn(linea, k);
      if (n && digitos(n) >= 3) r.push([k, k + n.length]);
      j = n ? k + n.length : k;
      continue;
    }
    j++;
  }
  return r;
}

/** Valor tras "clave:" en JSON/JS. `vacio` = la línea termina ahí (el valor está en la línea siguiente). */
function rangosValorCodigo(linea, pos, tipo, clave) {
  let p = pos;
  while (p < linea.length && (linea[p] === ' ' || linea[p] === '\t')) p++;
  const resto = linea.slice(p);
  if (!resto.trim() || resto.startsWith('//') || resto.startsWith('/*')) return { rangos: [], vacio: true };
  const c = linea[p];
  if (esComilla(c)) {
    const l = leerLiteral(linea, p);
    return { rangos: esValorSecreto(linea.slice(l.a, l.b)) ? [[l.a, l.b]] : [], vacio: false };
  }
  const n = numeroEn(linea, p);
  if (n) return { rangos: !claveDeMetadatos(clave) && digitos(n) >= 3 ? [[p, p + n.length]] : [], vacio: false };
  if (c === '[' || c === '{') return { rangos: literalesEnBloque(linea, p), vacio: false };
  if (tipo === 'js') return { rangos: respaldosEnExpresion(linea, p), vacio: false };
  return { rangos: [], vacio: false };
}

const esFilaTabla = (l) => /^\s*\|.*\|\s*$/.test(l);
const esSeparadorTabla = (l) => esFilaTabla(l) && /^[\s|:-]+$/.test(l) && /-{3,}/.test(l);

function celdasTabla(linea) {
  const tubos = [];
  for (let k = 0; k < linea.length; k++) {
    if (linea[k] === '\\') {
      k++;
      continue;
    }
    if (linea[k] === '|') tubos.push(k);
  }
  const celdas = [];
  for (let k = 0; k + 1 < tubos.length; k++) celdas.push({ a: tubos[k] + 1, b: tubos[k + 1] });
  return celdas;
}

/** Valor tras "Contraseña ...:" en texto libre: literal entre comillas o el resto de la línea. */
function rangosValorTexto(linea, pos, clave) {
  let p = pos;
  while (p < linea.length && (linea[p] === ' ' || linea[p] === '\t')) p++;
  if (p >= linea.length) return [];
  if (esComilla(linea[p])) {
    const l = leerLiteral(linea, p);
    return esValorSecreto(linea.slice(l.a, l.b)) ? [[l.a, l.b]] : [];
  }
  let fin = linea.length;
  if (esFilaTabla(linea)) {
    const k = linea.indexOf('|', p);
    if (k >= 0) fin = k;
  }
  const kb = linea.indexOf('`', p);
  if (kb >= 0 && kb < fin) fin = kb;
  const v = linea.slice(p, fin).replace(/\s+$/, '');
  const t = v.replace(/(?:\*\*|__)$/, '').trim();
  if (!esValorSecreto(t)) return [];
  if (/^(?:true|false|s[ií]|no|yes)$/i.test(t)) return [];
  if (/^-?\d[\d.,]*$/.test(t) && (claveDeMetadatos(clave) || digitos(t) < 3)) return [];
  if (/^process\.env\.[\w$]+[;,]?$/.test(t)) return [];
  if (esProsa(t)) return [];
  return [[p, p + v.length]];
}

/** Une hallazgos solapados (se oculta la unión; se conserva el primer motivo). */
function fusionarHallazgos(lista) {
  const orden = [...lista].sort((x, y) => x.inicio - y.inicio || y.fin - x.fin);
  const r = [];
  for (const h of orden) {
    const u = r[r.length - 1];
    if (u && h.inicio < u.fin) u.fin = Math.max(u.fin, h.fin);
    else r.push({ ...h });
  }
  return r;
}

/**
 * Busca secretos en un texto ya dividido en líneas. Devuelve, por línea,
 * [{inicio, fin, motivo, coincidencia}] donde [inicio, fin) es el valor secreto
 * (que se oculta en todos los reportes). Cubre: clave sensible con cualquier valor
 * no vacío (cadena, número, bloque, respaldo tras ||/??, valor en la línea
 * siguiente), texto libre "Contraseña <hasta 4 palabras>: valor", columnas
 * sensibles de tablas Markdown, credenciales en URLs, parámetros ?token= y
 * patrones de hashes, JWT y claves privadas.
 */
export function detectarSecretosEnLineas(lineas, tipo = 'texto') {
  const res = lineas.map(() => []);
  const agregar = (i, inicio, fin, motivo, coincidencia) => {
    if (fin > inicio) res[i].push({ inicio, fin, motivo, coincidencia });
  };
  const reClave = crearReClave(tipo);
  let tabla = null; // columnas sensibles de la tabla Markdown en curso
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];

    // 1) clave sensible: valor
    if (RE_PALABRA_RAPIDA.test(linea)) {
      for (const m of linea.matchAll(reClave)) {
        const clave = m[2];
        const pos = m.index + m[0].length;
        const motivo = `ALERTA seguridad: clave "${clave}" con valor no vacío`;
        const coincidencia = `${clave}: [valor oculto]`;
        if (tipo === 'texto') {
          for (const [a, b] of rangosValorTexto(linea, pos, clave)) agregar(i, a, b, motivo, coincidencia);
          continue;
        }
        if (tipo === 'json' && !m[1]) continue; // en JSON las claves van entre comillas
        const v = rangosValorCodigo(linea, pos, tipo, clave);
        for (const [a, b] of v.rangos) agregar(i, a, b, motivo, coincidencia);
        if (v.vacio) {
          let j = i + 1;
          while (j < lineas.length && !lineas[j].trim()) j++;
          if (j < lineas.length) {
            const w = rangosValorCodigo(lineas[j], lineas[j].search(/\S/), tipo, clave);
            const motivoSig = `ALERTA seguridad: clave "${clave}" (línea ${i + 1}) con valor no vacío`;
            for (const [a, b] of w.rangos) agregar(j, a, b, motivoSig, coincidencia);
          }
        }
      }
    }

    // 2) credenciales dentro de URLs y parámetros sensibles
    if (linea.includes('@')) {
      for (const m of linea.matchAll(RE_URL_CREDENCIAL())) {
        if (!esValorSecreto(m[1])) continue;
        const b = m.index + m[0].length - 1;
        agregar(i, b - m[1].length, b, 'ALERTA seguridad: contraseña dentro de una URL de conexión', 'usuario:[valor oculto]@…');
      }
    }
    if (linea.includes('=')) {
      for (const m of linea.matchAll(RE_PARAM_SENSIBLE())) {
        if (!esValorSecreto(m[2])) continue;
        const b = m.index + m[0].length;
        agregar(i, b - m[2].length, b, `ALERTA seguridad: parámetro "${m[1]}" con valor en una URL`, `${m[1]}=[valor oculto]`);
      }
    }

    // 3) tablas Markdown con una columna sensible (Password, Contraseña, Token...)
    if (tipo === 'texto') {
      if (!esFilaTabla(linea)) {
        tabla = null;
      } else if (!esSeparadorTabla(linea)) {
        if (tabla === null) {
          if (i + 1 < lineas.length && esSeparadorTabla(lineas[i + 1])) {
            tabla = celdasTabla(linea)
              .map((c, idx) => ({ idx, nombre: linea.slice(c.a, c.b).replace(/[*_`]/g, '').trim() }))
              .filter((c) => RE_PALABRA_CELDA.test(c.nombre));
          }
        } else if (tabla.length) {
          const celdas = celdasTabla(linea);
          for (const col of tabla) {
            const c = celdas[col.idx];
            if (!c) continue;
            const txt = linea.slice(c.a, c.b);
            const a = c.a + (txt.length - txt.trimStart().length);
            const b = c.b - (txt.length - txt.trimEnd().length);
            if (b > a && esValorSecreto(linea.slice(a, b).replace(/^`+|`+$/g, ''))) {
              agregar(i, a, b, `ALERTA seguridad: columna "${col.nombre}" de una tabla con valor no vacío`, `${col.nombre}: [valor oculto]`);
            }
          }
        }
      }
    }

    // 4) patrones fijos
    const patrones = [
      [/\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}/g, 'ALERTA seguridad: posible hash de contraseña (bcrypt)'],
      [/\$argon2(?:id|i|d)\$[^\s'"`]+/g, 'ALERTA seguridad: posible hash de contraseña (argon2)'],
      [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, 'ALERTA seguridad: posible token JWT'],
      [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, 'ALERTA seguridad: clave privada'],
    ];
    for (const [re, motivo] of patrones) {
      if (!/\$2|\$argon2|eyJ|-----BEGIN/.test(linea)) break;
      for (const m of linea.matchAll(re)) agregar(i, m.index, m.index + m[0].length, motivo, '[valor oculto]');
    }
  }
  return res.map(fusionarHallazgos);
}

/** Secretos de una sola línea (atajo de detectarSecretosEnLineas). */
export function detectarSecretos(linea, tipo = 'texto') {
  return detectarSecretosEnLineas([String(linea)], tipo)[0];
}

// ---------------------------------------------------------------------------
// Detección de residuos
// ---------------------------------------------------------------------------

/** Términos del nombre/slug a vigilar: slug completo + palabras significativas (>= 4 letras, no genéricas). */
export function terminosSignificativos(nombre, slug) {
  const terminos = new Map();
  const agregar = (original) => {
    const norm = normalizar(original);
    if (norm && !terminos.has(norm)) terminos.set(norm, { norm, original });
  };
  if (slug) agregar(String(slug));
  const palabras = [
    ...normalizar(nombre ?? '').split(/[^\p{L}\p{N}]+/u),
    ...normalizar(slug ?? '').split(/[^\p{L}\p{N}]+/u),
  ];
  for (const p of palabras) {
    if (p.length >= 4 && !PALABRAS_GENERICAS.has(p)) agregar(p);
  }
  return [...terminos.values()].sort((a, b) => b.norm.length - a.norm.length);
}

function contexto(linea, a, b, ancho = 32) {
  const desde = Math.max(0, a - ancho);
  const hasta = Math.min(linea.length, b + ancho);
  let c = linea.slice(desde, hasta).replace(/•{3,}/g, '•••').replace(/\s+/g, ' ').trim();
  if (desde > 0) c = `…${c}`;
  if (hasta < linea.length) c = `${c}…`;
  return c;
}

function recortar(texto, max = 70) {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

// Patrones "de datos" (cobertura compartida: lo ya reportado por uno no se repite en otro).
// Todos empiezan en un borde para que el coste sea lineal incluso en líneas muy largas.
const RE_CORREO = () => /(?<![\p{L}\p{N}._%+{}-])[\p{L}\p{N}._%+{}-]+@[\p{L}\p{N}{}-]+(?:\.[\p{L}\p{N}{}-]+)+/gu;
const RE_TOKEN_URL = () => /[^\s"'`<>()]+/g;
const RE_SEGMENTO_VERSION = /(?:^|[/\\])v(\d{6,})(?=\\?\/)/;
const RE_FECHA_ISO = () =>
  /(?<!\d)\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?(?!\d)/g;
const RE_FECHA_DMY = () => /(?<![\d/])(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])\/\d{4}(?![\d/])/g;
const RE_COORDENADA = () => /(?<![\w.])-?\d{1,3}\.\d{4,}(?![\w.])/g;
const RE_TELEFONO = () =>
  /(?<![\w.+])(?:\+?52[ .-]?)?(?:\(\d{2,3}\)[ .-]?|\d{2,3}[ .-])\d{3,4}[ .-]?\d{4}(?!\w)/g;
// Número: 1,043 (miles) | 1124.3 | 1629. Borde izquierdo: no letra/dígito/_ (sí ',', '.', '#', '(' ...)
// o justo tras un escape \n. Así se detectan "1043,1124.3,1629", "#210" y "C.P.83900".
const RE_NUMERO = () =>
  new RegExp(
    String.raw`(?:(?<![\p{L}\p{N}_])|${TRAS_ESCAPE})(?:\d{1,3}(?:,\d{3}(?!\d))+(?:\.\d+)?|\d+(?:\.\d+)?)(?![\p{L}\p{N}_])`,
    'gu',
  );
const RE_COLOR_HEX = () => /#[0-9a-fA-F]{3,8}(?![\p{L}\p{N}_])/gu;
const RE_ENTIDAD_NUMERICA = () => /&#(?:\d+|[xX][0-9a-fA-F]+);/g;

function clasificarNumero(token) {
  const digitosToken = token.replace(/\D/g, '');
  if (/^(?:1[5-9]\d\d|20\d\d)$/.test(token)) return ['anio', 'año (1500-2099)'];
  if (/^1\d{9}$|^1\d{12}$/.test(token)) return ['timestamp', 'posible timestamp (epoch)'];
  if (/^[2-9]\d{9}$/.test(token)) return ['telefono', 'posible teléfono'];
  if (/^0[.,]\d+$/.test(token)) return null;
  if (digitosToken.length >= 3) return ['numero', 'número de 3+ dígitos'];
  return null;
}

/**
 * Detecta restos específicos del municipio que NO se sustituyeron.
 * Opciones: archivo, nombre, slug, extra (valores de --extra), tipoArchivo
 * ('json' | 'js' | 'texto'; por defecto según la extensión de `archivo`) y
 * marcadoresSlug (marcadores que valen lo mismo que el slug; admin-{{X}}@... no se reporta).
 * Devuelve [{archivo, linea, columna, tipo, motivo, coincidencia, contexto, alerta}].
 */
export function detectarResiduos(
  texto,
  { archivo = '', nombre = '', slug = '', extra = [], tipoArchivo, marcadoresSlug = ['SLUG'] } = {},
) {
  const tipo = tipoArchivo ?? tipoPorExtension(archivo);
  const terminosExtra = [...new Set((extra ?? []).map((v) => String(v).trim()).filter(Boolean))]
    .map((original) => ({ norm: normalizar(original), original }))
    .filter((t) => t.norm);
  const terminosNombre = terminosSignificativos(nombre, slug);
  const reAdmin = new RegExp(
    `^admin-\\{\\{(?:${[...new Set(['SLUG', ...marcadoresSlug])].map(escaparRegex).join('|')})\\}\\}@`,
  );
  const residuos = [];
  const lineas = String(texto).split(/\r\n|\n|\r/);
  const secretos = detectarSecretosEnLineas(lineas, tipo);

  lineas.forEach((linea, i) => {
    // 1) Seguridad: se detecta primero y el valor se oculta para todo lo demás.
    let visible = linea;
    for (const s of secretos[i]) {
      visible = visible.slice(0, s.inicio) + '•'.repeat(s.fin - s.inicio) + visible.slice(s.fin);
    }
    const nuevo = (tipoResiduo, motivo, a, b, coincidencia, alerta = false) =>
      residuos.push({
        archivo,
        linea: i + 1,
        columna: a + 1,
        tipo: tipoResiduo,
        motivo,
        coincidencia: recortar(coincidencia ?? visible.slice(a, b)),
        contexto: contexto(visible, a, b),
        alerta,
      });
    for (const s of secretos[i]) nuevo('seguridad', s.motivo, s.inicio, s.fin, s.coincidencia, true);

    // Cobertura por posición (O(1) por carácter): evita el coste cuadrático en líneas largas.
    const n = visible.length;
    const marcado = new Uint8Array(n);
    for (const m of visible.matchAll(patronMarcador())) marcado.fill(1, m.index, m.index + m[0].length);
    const cubierto = new Uint8Array(n);
    const libre = (arr, a, b) => {
      for (let k = a; k < b; k++) if (arr[k]) return false;
      return true;
    };

    // 2) Datos: correos, URLs/segmentos de versión, fechas, coordenadas, teléfonos, números.
    if (visible.includes('@')) {
      for (const m of visible.matchAll(RE_CORREO())) {
        const a = m.index;
        const b = a + m[0].length;
        cubierto.fill(1, a, b);
        if (reAdmin.test(m[0])) continue;
        nuevo('correo', 'correo electrónico', a, b);
      }
    }
    if (/cloudinary/i.test(visible) || /v\d{6}/.test(visible)) {
      for (const m of visible.matchAll(RE_TOKEN_URL())) {
        const tok = m[0];
        const esCloud = /cloudinary/i.test(tok);
        const ver = RE_SEGMENTO_VERSION.exec(tok);
        if (!esCloud && !ver) continue;
        const a = m.index;
        const b = a + tok.length;
        cubierto.fill(1, a, b);
        if (ver) {
          nuevo(
            'cloudinary',
            esCloud ? `URL de Cloudinary con versión (/v${ver[1]}/)` : `segmento de versión tipo Cloudinary (/v${ver[1]}/)`,
            a,
            b,
          );
        }
      }
    }
    if (visible.includes('#')) {
      for (const m of visible.matchAll(RE_ENTIDAD_NUMERICA())) cubierto.fill(1, m.index, m.index + m[0].length);
      for (const m of visible.matchAll(RE_COLOR_HEX())) {
        const hex = m[0].slice(1);
        // #123456 / #ffffffff / #abc son colores; "#210" (3-4 dígitos decimales) es un número (dirección).
        if (hex.length === 6 || hex.length === 8 || /[a-f]/i.test(hex)) cubierto.fill(1, m.index, m.index + m[0].length);
      }
    }
    const porPatron = [
      [RE_FECHA_ISO, 'fecha', 'fecha/timestamp'],
      [RE_FECHA_DMY, 'fecha', 'fecha'],
      [RE_COORDENADA, 'coordenada', 'posible coordenada'],
      [RE_TELEFONO, 'telefono', 'posible teléfono'],
    ];
    const hayDigitos = /\d/.test(visible);
    for (const [re, tipoResiduo, motivo] of porPatron) {
      if (!hayDigitos) break;
      for (const m of visible.matchAll(re())) {
        const a = m.index;
        const b = a + m[0].length;
        if (!libre(cubierto, a, b) || !libre(marcado, a, b)) continue;
        cubierto.fill(1, a, b);
        nuevo(tipoResiduo, motivo, a, b);
      }
    }
    if (hayDigitos) {
      for (const m of visible.matchAll(RE_NUMERO())) {
        const a = m.index;
        const b = a + m[0].length;
        if (!libre(cubierto, a, b) || !libre(marcado, a, b)) continue;
        const clase = clasificarNumero(m[0]);
        if (!clase) continue;
        cubierto.fill(1, a, b);
        nuevo(clase[0], clase[1], a, b);
      }
    }

    // 3) Texto: valores de --extra y restos del nombre/slug, insensibles a mayúsculas y
    //    acentos, también si están escritos con escapes (\u00e9), entidades (&eacute;) o %C3%A9.
    if (!terminosExtra.length && !terminosNombre.length) return;
    const dec = decodificarConMapa(visible, tipo);
    const nm = normalizarConMapa(dec.texto);
    const cubiertoTexto = new Uint8Array(n);
    const buscar = (terminos, alHallar) => {
      for (const t of terminos) {
        for (let k = nm.norm.indexOf(t.norm); k !== -1; k = nm.norm.indexOf(t.norm, k + 1)) {
          const dA = nm.inicio[k];
          let dB = nm.fin[k + t.norm.length - 1];
          while (dB < dec.texto.length && /\p{M}/u.test(dec.texto[dB])) dB++;
          const a = dec.ini[dA];
          const b = dec.fin[dB - 1];
          if (!libre(cubiertoTexto, a, b) || !libre(marcado, a, b)) continue;
          const motivo = alHallar(t, dA, dB);
          if (!motivo) continue;
          cubiertoTexto.fill(1, a, b);
          const codificado = visible.slice(a, b) !== dec.texto.slice(dA, dB) ? ' (escrito codificado)' : '';
          nuevo(motivo[0], motivo[1] + codificado, a, b);
        }
      }
    };
    buscar(terminosExtra, (t) => ['extra', `valor de --extra ("${t.original}")`]);
    buscar(terminosNombre, (t, dA, dB) => {
      const izq = bordeIzquierdo(dec.texto, dA);
      const der = bordeDerecho(dec.texto, dB);
      if (!izq) {
        // Términos cortos ("átil", "ures") dentro de otra palabra: casi siempre falsos positivos.
        return t.norm.length >= LONGITUD_TERMINO_LIBRE ? ['nombre', `"${t.norm}" dentro de otra palabra`] : null;
      }
      if (!der) return ['nombre', `palabra que empieza por "${t.norm}" (¿derivada del nombre?)`];
      return ['nombre', `resto del nombre/slug ("${t.norm}")`];
    });
  });

  return residuos.sort((x, y) => x.linea - y.linea || x.columna - y.columna);
}

// ---------------------------------------------------------------------------
// Validaciones
// ---------------------------------------------------------------------------

export function validarJson(texto) {
  try {
    JSON.parse(String(texto).replace(/^\uFEFF/, ''));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** 'mjs' o 'cjs' según el package.json más cercano o, si no lo hay, según la sintaxis. */
export function detectarTipoModulo(rutaFuente, contenido = '') {
  let dir = path.dirname(path.resolve(rutaFuente));
  for (;;) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const tipo = JSON.parse(fs.readFileSync(pkg, 'utf8')).type;
        if (tipo === 'module') return 'mjs';
        if (tipo === 'commonjs') return 'cjs';
      } catch {
        /* package.json ilegible: se decide por la sintaxis */
      }
      break;
    }
    const padre = path.dirname(dir);
    if (padre === dir) break;
    dir = padre;
  }
  const pareceEsm = /^\s*(?:import\s*[\w{*'"]|export\s+(?:default|const|let|var|function|async|class|\{|\*))/m;
  return pareceEsm.test(contenido) ? 'mjs' : 'cjs';
}

/**
 * Comprueba la sintaxis con `node --check` sobre una COPIA temporal en os.tmpdir()
 * (el código no se ejecuta). Devuelve { ok, error?, noVerificado? }; noVerificado
 * indica que la comprobación no se pudo hacer (p. ej. TMPDIR inválido).
 */
export function verificarSintaxisJs(texto, { tipoModulo = 'cjs', nombreArchivo = 'plantilla-db-alta' } = {}) {
  let dir;
  try {
    // realpath: en macOS os.tmpdir() es un enlace (/var -> /private/var) y node imprime la ruta real.
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'derivar-plantillas-')));
  } catch (e) {
    return { ok: false, noVerificado: true, error: `no se pudo crear la copia temporal en ${os.tmpdir()}: ${e.code ?? e.message}` };
  }
  const base = `${nombreArchivo}.${tipoModulo}`;
  const archivo = path.join(dir, base);
  try {
    fs.writeFileSync(archivo, texto, 'utf8');
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    return { ok: false, noVerificado: true, error: `no se pudo escribir la copia temporal: ${e.code ?? e.message}` };
  }
  try {
    execFileSync(process.execPath, ['--check', archivo], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 30000,
    });
    return { ok: true };
  } catch (e) {
    if (e.status == null && !e.stderr) {
      return { ok: false, noVerificado: true, error: `no se pudo ejecutar node --check: ${e.code ?? e.message}` };
    }
    const salida = String(e.stderr || e.message || '');
    const linea = new RegExp(`${escaparRegex(base)}:(\\d+)`).exec(salida)?.[1];
    const mensaje = /^\w*Error: .*$/m.exec(salida)?.[0] ?? salida.trim().split('\n')[0];
    return { ok: false, error: `${linea ? `línea ${linea}: ` : ''}${mensaje}` };
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* limpieza best-effort */
    }
  }
}

// ---------------------------------------------------------------------------
// LEEME.md
// ---------------------------------------------------------------------------

function codigoMd(texto) {
  const s = String(texto).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const maxTildes = Math.max(0, ...[...s.matchAll(/`+/g)].map((m) => m[0].length));
  const cerca = '`'.repeat(maxTildes + 1);
  const pad = s.startsWith('`') || s.endsWith('`') ? ' ' : '';
  return `${cerca}${pad}${s}${pad}${cerca}`;
}

const celda = (texto) => String(texto).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** Genera el contenido de LEEME.md (función pura). */
export function generarLeeme(d) {
  const L = [];
  const origen = `**${d.nombre}** (\`${d.slug}\`)`;
  L.push('# Plantillas de alta de municipio', '');
  L.push(`Generadas automáticamente por \`derivar-plantillas.mjs\` a partir de ${origen}.`, '');
  L.push(`- Fecha: ${d.fecha}`);
  L.push('- Comando usado:', '');
  L.push('```sh', d.comando, '```', '');
  L.push(
    '> Estas plantillas no se usan tal cual: reemplaza cada `{{...}}` y revisa a mano cada residuo listado abajo.',
    '> Solo se sustituyeron automáticamente el nombre, el slug (con sus variantes) y los UUIDs.',
    '',
  );

  L.push('## Archivos fuente', '');
  L.push('| Plantilla | Fuente | SHA-256 |', '|---|---|---|');
  for (const f of d.fuentes) L.push(`| \`${f.salida}\` | \`${celda(f.ruta)}\` | \`${f.sha256}\` |`);
  if (d.faltantes?.length) {
    L.push('', 'Fuentes no encontradas u omitidas (sin plantilla):', '');
    for (const f of d.faltantes) {
      L.push(`- \`${celda(f.ruta)}\` → \`${f.salida}\` no generada${f.motivo ? ` (${celda(f.motivo)})` : ''}`);
    }
  }
  if (d.obsoletos?.length) {
    L.push('', 'Plantillas de una ejecución anterior eliminadas con `--forzar` (no se regeneraron en esta):', '');
    for (const o of d.obsoletos) L.push(`- \`${o}\``);
  }
  L.push('');

  L.push('## Marcadores', '');
  if (d.marcadores.length) {
    L.push('| Marcador | Valor original | Qué poner | Apariciones |', '|---|---|---|---|');
    for (const m of d.marcadores) {
      const detalle = Object.entries(m.porArchivo).map(([a, n]) => `${a}: ${n}`).join(', ');
      L.push(`| \`{{${m.marcador}}}\` | ${codigoMd(m.valor)} | ${celda(m.descripcion)} | ${m.total} (${celda(detalle)}) |`);
    }
  } else {
    L.push('No se sustituyó ningún marcador.');
  }
  if (d.sinUso?.length) {
    L.push('', `Variantes calculadas que no aparecen en las fuentes: ${d.sinUso.map((v) => `\`{{${v.marcador}}}\` (${codigoMd(v.valor)})`).join(', ')}.`);
  }
  if (d.coincidencias?.length) {
    L.push('', '### Variantes que coincidían en el municipio de origen', '');
    L.push(
      `En ${d.nombre} estas variantes producen la misma cadena, así que todas sus apariciones quedaron con el marcador de mayor prioridad. ` +
        'Si en el municipio nuevo difieren, revisa cada aparición y usa el marcador adecuado:',
      '',
    );
    for (const c of d.coincidencias) {
      L.push(`- \`{{${c.marcador}}}\` = \`{{${c.igualA}}}\` (${codigoMd(c.valor)}): se marcó como \`{{${c.igualA}}}\`.`);
    }
    const slug = d.coincidencias.find((c) => c.marcador === 'SLUG');
    if (slug) {
      L.push(
        '',
        `> **Ojo:** el slug coincidía con \`{{${slug.igualA}}}\`, así que las apariciones del slug (URLs, rutas, correos ` +
          `\`admin-…@\`) quedaron como \`{{${slug.igualA}}}\`. Si el municipio nuevo tiene acentos, espacios o mayúsculas, ` +
          'pon ahí el **slug**, no el nombre.',
      );
    }
  }
  L.push('');

  if (d.preexistentes?.length) {
    L.push('## Marcadores preexistentes en las fuentes (NO reemplazar)', '');
    L.push(
      'Las fuentes ya contenían estos `{{...}}` (propios del CMS u otra herramienta). Se conservaron tal cual: ' +
        'no son marcadores de esta herramienta y no hay que rellenarlos al dar de alta un municipio.',
      '',
    );
    L.push('| Ubicación | Texto |', '|---|---|');
    for (const p of d.preexistentes) L.push(`| \`${p.archivo}:${p.linea}\` | ${codigoMd(p.texto)} |`);
    L.push('');
  }

  L.push('## Validaciones', '');
  for (const v of d.validaciones) L.push(`- \`${v.archivo}\`: ${v.ok ? 'OK' : v.noVerificado ? 'NO VERIFICADO' : 'FALLO'} — ${celda(v.detalle)}`);
  if (!d.validaciones.length) L.push('- (sin archivos .json ni .js que validar)');
  L.push('');

  const alertas = d.residuos.filter((r) => r.alerta);
  const normales = d.residuos.filter((r) => !r.alerta);
  L.push(`## Residuos para revisión manual (${d.residuos.length})`, '');
  if (alertas.length) {
    L.push('### ALERTA DE SEGURIDAD', '');
    L.push(
      '**Se detectaron posibles secretos (contraseñas, tokens, claves).** Las plantillas generadas CONTIENEN esos valores ' +
        '(aquí se muestran ocultos). Elimínalos de la plantilla — y de la fuente si no deberían estar ahí — antes de compartirla o versionarla. ' +
        'El archivo del operador NO debe contener contraseña.',
      '',
    );
    L.push('| Ubicación | Motivo | Contexto |', '|---|---|---|');
    for (const r of alertas) L.push(`| \`${r.archivo}:${r.linea}\` | ${celda(r.motivo)} | ${codigoMd(r.contexto)} |`);
    L.push('');
  }
  if (normales.length) {
    L.push(
      'No se sustituyeron automáticamente. En cada caso decide si es un dato específico del municipio de origen ' +
        '(reemplázalo al usar la plantilla) o contenido genérico (déjalo). Las líneas coinciden con las de la fuente.',
      '',
    );
    const porGrupo = new Map();
    const omitidos = new Map();
    L.push('| Ubicación | Motivo | Coincidencia | Contexto |', '|---|---|---|---|');
    for (const r of normales) {
      const k = `${r.archivo}\u0000${r.tipo}`;
      const n = (porGrupo.get(k) ?? 0) + 1;
      porGrupo.set(k, n);
      if (n > LIMITE_RESIDUOS_LEEME_POR_TIPO) {
        const o = omitidos.get(k) ?? { archivo: r.archivo, tipo: r.tipo, n: 0 };
        o.n++;
        omitidos.set(k, o);
        continue;
      }
      L.push(`| \`${r.archivo}:${r.linea}\` | ${celda(r.motivo)} | ${codigoMd(r.coincidencia)} | ${codigoMd(r.contexto)} |`);
    }
    if (omitidos.size) {
      L.push('', `Para no hacer ilegible la tabla se listan como máximo ${LIMITE_RESIDUOS_LEEME_POR_TIPO} residuos por archivo y tipo:`, '');
      for (const o of omitidos.values()) L.push(`- \`${o.archivo}\`: ${o.n} residuos más de tipo \`${o.tipo}\` sin listar.`);
    }
  } else if (!alertas.length) {
    L.push('No se detectaron residuos.');
  }
  L.push('');

  L.push('## Cómo usar las plantillas', '');
  L.push('1. Copia cada plantilla a su destino con el slug del municipio nuevo (desde la raíz de cmsmunicipal):', '');
  L.push('   ```sh');
  for (const f of d.fuentes) L.push(`   cp ${d.salidaRel}/${f.salida} ${f.destino}`);
  L.push('   ```', '');
  L.push('2. Reemplaza cada `{{...}}` por el valor del municipio nuevo (ver la columna "Qué poner" de la tabla de marcadores).');
  L.push(
    '3. Para cada `{{UUID_n}}` genera un UUID nuevo con `node -e "console.log(crypto.randomUUID())"` ' +
      'y usa ese mismo valor en todas las apariciones del mismo marcador, en todos los archivos.',
  );
  L.push('4. Revisa uno por uno los residuos listados arriba.');
  const destinos = d.fuentes.map((f) => f.destino).join(' ');
  if (d.preexistentes?.length) {
    const nombres = [...new Set(d.marcadores.map((m) => (/^UUID_\d+$/.test(m.marcador) ? 'UUID_[0-9]+' : m.marcador)))];
    const alternativas = nombres.length ? nombres.join('|') : 'NOMBRE|SLUG|UUID_[0-9]+';
    L.push(
      '5. Verifica que no quede ningún marcador de esta herramienta (no debe imprimir nada). Las fuentes ya traían ' +
        '`{{...}}` propios que deben quedarse, por eso se buscan solo los nombres de esta herramienta:',
      '',
    );
    L.push('   ```sh', `   grep -nE "\\{\\{(${alternativas})\\}\\}" ${destinos}`, '   ```', '');
  } else {
    L.push('5. Verifica que no quede ningún marcador (no debe imprimir nada):', '');
    L.push('   ```sh', `   grep -n "{{" ${destinos}`, '   ```', '');
  }
  L.push('6. Nunca pongas contraseñas en `scripts/lotes-db/operador-<slug>.json`.', '');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export const TEXTO_AYUDA = `Uso:
  node scripts/herramienta-alta/derivar-plantillas.mjs --slug <slug> --nombre "<Nombre>" [opciones]

Deriva plantillas genéricas de alta de municipio a partir de los archivos reales de un
municipio ya validado. Sustituye nombre, slug (con sus variantes) y UUIDs por marcadores
{{...}}; todo lo demás queda igual y se lista como residuo para revisión manual en LEEME.md.

Opciones:
  --slug <slug>       Slug del municipio de origen (obligatorio). Ej.: villapesqueira
  --nombre <nombre>   Nombre oficial (obligatorio). Ej.: "Villa Pesqueira"
  --material <ruta>   README de material del ayuntamiento
                      (por defecto ../_material-ayuntamientos/<slug>/README.md, si existe)
  --salida <dir>      Carpeta de salida (por defecto ${SALIDA_POR_DEFECTO})
  --extra "<a,b>"     Valores adicionales a vigilar como residuo, separados por comas
                      (ej.: localidades como "Mátape,San José"). Se puede repetir.
  --raiz <dir>        Raíz de cmsmunicipal (por defecto, el directorio actual)
  --forzar            Sobrescribe las plantillas si ya existen y elimina las de una
                      ejecución anterior que esta vez no se generen
  --ayuda, -h         Muestra esta ayuda

Las rutas relativas de --material y --salida se resuelven desde --raiz.

Fuentes (solo lectura, nunca se modifican; deben estar en UTF-8):
  scripts/herramienta-alta/contratos/<slug>.json
  scripts/herramienta-alta/contratos/db-alta-<slug>.js
  scripts/lotes-db/operador-<slug>.json
Debe existir al menos una de estas tres; si falta alguna se avisa y se sigue.

Salidas: plantilla-contrato.json, plantilla-db-alta.js, plantilla-operador.json,
plantilla-README-material.md (si hay material) y ${ARCHIVO_LEEME}. Sin --forzar, si
existe cualquiera de ellas no se escribe nada.

Códigos de salida: 0 = correcto (aunque haya residuos), 1 = error.
Requiere Node >= ${NODE_MINIMO}.

Ejemplo:
  node scripts/herramienta-alta/derivar-plantillas.mjs --slug villapesqueira \\
    --nombre "Villa Pesqueira" --extra "Mátape"
`;

const OPCIONES = {
  slug: { type: 'string' },
  nombre: { type: 'string' },
  material: { type: 'string' },
  salida: { type: 'string' },
  extra: { type: 'string', multiple: true },
  raiz: { type: 'string' },
  forzar: { type: 'boolean' },
  ayuda: { type: 'boolean', short: 'h' },
  help: { type: 'boolean' },
};

/** Devuelve un mensaje de error si esta versión de Node no sirve, o null. */
export function requisitoNode(modUtil = util, version = process.versions.node) {
  const [may, men] = String(version).split('.').map(Number);
  const vieja = may < 18 || (may === 18 && men < 3);
  if (vieja || typeof modUtil?.parseArgs !== 'function') {
    return `se requiere Node >= ${NODE_MINIMO} (tienes ${version}).`;
  }
  return null;
}

function traducirErrorArgs(e) {
  const opcion = /'([^']+)'/.exec(e.message)?.[1];
  switch (e.code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION':
      return `opción desconocida: ${opcion ?? e.message}`;
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE':
      return `valor inválido o ausente para ${opcion ?? 'una opción'}`;
    case 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL':
      return `argumento inesperado: ${opcion ?? e.message}`;
    default:
      return e.message;
  }
}

export function parsearArgumentos(argv) {
  const { values } = util.parseArgs({ args: argv, options: OPCIONES, strict: true, allowPositionals: false });
  for (const k of ['salida', 'raiz', 'material']) {
    if (values[k] !== undefined && !values[k].trim()) {
      const e = new Error(`valor vacío para --${k}`);
      e.code = 'VALOR_VACIO';
      throw e;
    }
  }
  return {
    slug: values.slug?.trim(),
    nombre: values.nombre?.trim().normalize('NFC'),
    material: values.material,
    salida: values.salida ?? SALIDA_POR_DEFECTO,
    extra: (values.extra ?? []).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean),
    raiz: values.raiz ?? '.',
    forzar: Boolean(values.forzar),
    ayuda: Boolean(values.ayuda || values.help),
  };
}

function citarArg(arg) {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `"${arg.replace(/(["\\$`])/g, '\\$1')}"`;
}

function colores(flujo) {
  const activo = Boolean(flujo?.isTTY) && !('NO_COLOR' in process.env);
  const c = (codigo) => (s) => (activo ? `\x1b[${codigo}m${s}\x1b[0m` : String(s));
  return { negrita: c('1'), rojo: c('31'), verde: c('32'), amarillo: c('33'), tenue: c('2') };
}

function definirFuentes(raiz, slug, material) {
  return [
    {
      ruta: path.join(raiz, 'scripts', 'herramienta-alta', 'contratos', `${slug}.json`),
      destino: `scripts/herramienta-alta/contratos/<slug>.json`,
      salida: 'plantilla-contrato.json',
      principal: true,
    },
    {
      ruta: path.join(raiz, 'scripts', 'herramienta-alta', 'contratos', `db-alta-${slug}.js`),
      destino: `scripts/herramienta-alta/contratos/db-alta-<slug>.js`,
      salida: 'plantilla-db-alta.js',
      principal: true,
    },
    {
      ruta: path.join(raiz, 'scripts', 'lotes-db', `operador-${slug}.json`),
      destino: `scripts/lotes-db/operador-<slug>.json`,
      salida: 'plantilla-operador.json',
      principal: true,
    },
    {
      ruta: material
        ? path.resolve(raiz, material)
        : path.resolve(raiz, '..', '_material-ayuntamientos', slug, 'README.md'),
      destino: `../_material-ayuntamientos/<slug>/README.md`,
      salida: 'plantilla-README-material.md',
      opcional: !material,
      principal: false,
    },
  ];
}

/** stat sin excepciones: { st } si existe, {} si no existe, { error } si no se puede consultar. */
function consultar(ruta, { seguirEnlaces = true } = {}) {
  try {
    const st = (seguirEnlaces ? fs.statSync : fs.lstatSync)(ruta, { throwIfNoEntry: false });
    return st ? { st } : {};
  } catch (e) {
    return { error: e.code ?? e.message };
  }
}

const mismoArchivo = (a, b) => a.ino !== 0 && a.dev === b.dev && a.ino === b.ino;

function publicarSinSobrescribir(origen, destino) {
  try {
    fs.linkSync(origen, destino); // atómico: falla con EEXIST si ya hay algo (incluso un enlace roto)
  } catch (e) {
    if (!['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'EXDEV', 'ENOSYS', 'EMLINK'].includes(e.code)) throw e;
    fs.copyFileSync(origen, destino, fs.constants.COPYFILE_EXCL); // sistemas sin enlaces duros
  }
}

/**
 * Escribe todas las salidas o ninguna: primero en una carpeta temporal dentro de
 * `salidaDir` y luego las publica. Sin `forzar` no pisa nada (link/copy exclusivos);
 * con `forzar` aparta las existentes (y las obsoletas) y, si algo falla, las restaura.
 */
function escribirSalidas(salidaDir, archivos, obsoletos, forzar) {
  const existiaDir = fs.existsSync(salidaDir);
  fs.mkdirSync(salidaDir, { recursive: true });
  let temporal;
  let ok = false;
  const publicados = [];
  const apartados = [];
  try {
    temporal = fs.mkdtempSync(path.join(salidaDir, '.derivar-plantillas-'));
    for (const a of archivos) fs.writeFileSync(path.join(temporal, a.nombre), a.contenido, { encoding: 'utf8', flag: 'wx' });
    if (forzar) {
      const dirApartados = path.join(temporal, 'anteriores');
      fs.mkdirSync(dirApartados);
      for (const nombre of [...archivos.map((a) => a.nombre), ...obsoletos]) {
        const d = path.join(salidaDir, nombre);
        if (fs.lstatSync(d, { throwIfNoEntry: false })) {
          const b = path.join(dirApartados, nombre);
          fs.renameSync(d, b); // rename no sigue enlaces: mueve la entrada, no su destino
          apartados.push([d, b]);
        }
      }
      for (const a of archivos) {
        const d = path.join(salidaDir, a.nombre);
        fs.renameSync(path.join(temporal, a.nombre), d);
        publicados.push(d);
      }
    } else {
      for (const a of archivos) {
        const d = path.join(salidaDir, a.nombre);
        publicarSinSobrescribir(path.join(temporal, a.nombre), d);
        publicados.push(d);
      }
    }
    ok = true;
  } catch (e) {
    for (const d of publicados.reverse()) {
      try {
        fs.unlinkSync(d);
      } catch {
        /* se intenta deshacer todo lo posible */
      }
    }
    for (const [d, b] of apartados.reverse()) {
      try {
        fs.renameSync(b, d);
      } catch {
        /* idem */
      }
    }
    throw e;
  } finally {
    try {
      if (temporal) fs.rmSync(temporal, { recursive: true, force: true });
    } catch {
      /* limpieza best-effort de la carpeta temporal */
    }
    if (!ok && !existiaDir) {
      try {
        fs.rmdirSync(salidaDir);
      } catch {
        /* solo se borra si quedó vacía */
      }
    }
  }
}

/**
 * Punto de entrada del CLI. Devuelve el código de salida (0 ok, 1 error).
 */
export function main(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  try {
    return ejecutarCli(argv, cwd);
  } catch (e) {
    console.error(`Error inesperado: ${e?.message ?? e}`);
    return 1;
  }
}

function ejecutarCli(argv, cwd) {
  const out = (s = '') => console.log(s);
  const err = (s = '') => console.error(s);
  const co = colores(process.stdout);
  const ce = colores(process.stderr);
  const error = (mensaje) => {
    err(ce.rojo(`Error: ${mensaje}`));
    return 1;
  };
  const aviso = (mensaje) => err(ce.amarillo(mensaje));

  const faltaNode = requisitoNode();
  if (faltaNode) return error(faltaNode);

  let opts;
  try {
    opts = parsearArgumentos(argv);
  } catch (e) {
    err(ce.rojo(`Error: ${traducirErrorArgs(e)}`));
    err('Usa --ayuda para ver el uso.');
    return 1;
  }
  if (opts.ayuda) {
    out(TEXTO_AYUDA);
    return 0;
  }
  if (!opts.slug || !opts.nombre) {
    err(ce.rojo('Error: faltan --slug y/o --nombre (ambos son obligatorios).'));
    err('Usa --ayuda para ver el uso.');
    return 1;
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(opts.slug)) {
    return error(`--slug inválido "${opts.slug}": usa solo minúsculas, números, "-" o "_".`);
  }

  const raiz = path.resolve(cwd, opts.raiz);
  if (!consultar(raiz).st?.isDirectory()) return error(`la raíz no existe o no es una carpeta: ${raiz}`);
  const salidaDir = path.resolve(raiz, opts.salida);
  const salidaRel = rutaVisible(raiz, salidaDir);

  out(co.negrita(`Derivando plantillas de "${opts.nombre}" (slug ${opts.slug})`));
  if (raiz !== path.resolve(cwd)) out(co.tenue(`Raíz: ${raiz}`));
  out('');

  // --- Fuentes: existencia, lectura, UTF-8 y marcadores preexistentes ------------
  out(co.negrita('Fuentes'));
  const fuentes = definirFuentes(raiz, opts.slug, opts.material);
  const presentes = [];
  const faltantes = [];
  const decodificador = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const omitir = (f, motivo, detalle) => {
    faltantes.push({ salida: f.salida, ruta: f.rutaVisible, motivo });
    aviso(`  omite  ${f.rutaVisible}  (aviso: ${detalle ?? motivo}; se omite ${f.salida})`);
  };
  for (const f of fuentes) {
    f.rutaVisible = rutaVisible(raiz, f.ruta);
    const c = consultar(f.ruta);
    if (c.error) {
      f.existe = true;
      omitir(f, `no se puede leer: ${c.error}`);
      continue;
    }
    if (!c.st || !c.st.isFile()) {
      if (f.opcional) {
        out(co.tenue(`  --     ${f.rutaVisible}  (material opcional no encontrado; se omite)`));
      } else {
        faltantes.push({ salida: f.salida, ruta: f.rutaVisible, motivo: c.st ? 'no es un archivo' : 'no existe' });
        aviso(`  falta  ${f.rutaVisible}  (aviso: ${c.st ? 'no es un archivo' : 'no existe'}; se omite ${f.salida})`);
      }
      continue;
    }
    f.existe = true;
    f.stat = c.st;
    let bytes;
    try {
      bytes = fs.readFileSync(f.ruta);
    } catch (e) {
      omitir(f, `no se puede leer: ${e.code ?? e.message}`);
      continue;
    }
    let texto;
    try {
      texto = decodificador.decode(bytes);
    } catch {
      omitir(
        f,
        'no es UTF-8 válido',
        `no es UTF-8 válido; conviértelo, p. ej. iconv -f cp1252 -t utf-8 "${f.rutaVisible}" > copia-utf8 y revísala`,
      );
      continue;
    }
    if (texto.includes(INI) || texto.includes(FIN)) {
      omitir(f, 'contiene los caracteres reservados U+FDD0/U+FDD1');
      continue;
    }
    const preexistentes = buscarMarcadoresPreexistentes(texto);
    const choques = [...new Set(preexistentes.filter((p) => p.nombre && esMarcadorGenerado(p.nombre)).map((p) => p.texto))];
    if (choques.length) {
      omitir(
        f,
        `ya contiene ${choques.join(', ')}, que coincide con un marcador que genera esta herramienta (sería ambiguo)`,
      );
      continue;
    }
    f.bytes = bytes;
    f.sha256 = sha256(bytes);
    f.texto = texto;
    f.preexistentes = preexistentes;
    presentes.push(f);
    out(`  ${co.verde('ok   ')}  ${f.rutaVisible}`);
    if (preexistentes.length) {
      const lista = [...new Set(preexistentes.map((p) => p.texto))].slice(0, 5).join(', ');
      aviso(`         aviso: ya contiene ${preexistentes.length} "{{" propio(s) que se conservan (${lista}); ver LEEME.md`);
    }
  }
  out('');
  if (!fuentes.some((f) => f.existe)) {
    return error('no se encontró ningún archivo de entrada. Revisa --slug y --raiz (ejecuta desde la raíz de cmsmunicipal).');
  }
  if (!fuentes.some((f) => f.principal && f.existe)) {
    return error(
      'no parece la raíz de cmsmunicipal: no existe ninguna de las 3 fuentes principales (contrato, db-alta, operador). ' +
        'Ejecuta desde la raíz de cmsmunicipal o usa --raiz.',
    );
  }
  if (!presentes.some((f) => f.principal)) {
    return error('no se pudo procesar ninguna de las fuentes principales (ver avisos arriba).');
  }

  // --- Salidas: nunca sobrescribir sin --forzar, nunca tocar una entrada ------------
  const entradas = fuentes.filter((f) => f.stat).map((f) => ({ ruta: f.rutaVisible, st: f.stat }));
  const problemas = [];
  const existentes = [];
  for (const nombre of SALIDAS_CONOCIDAS) {
    const d = path.join(salidaDir, nombre);
    const dv = rutaVisible(raiz, d);
    const c = consultar(d, { seguirEnlaces: false });
    if (c.error) {
      problemas.push(`${dv}: no se puede comprobar (${c.error})`);
      continue;
    }
    if (!c.st) continue;
    existentes.push(nombre);
    if (c.st.isSymbolicLink()) {
      problemas.push(`${dv} es un enlace simbólico (no se sigue ni se sobrescribe; bórralo a mano)`);
    } else if (!c.st.isFile()) {
      problemas.push(`${dv} existe y no es un archivo normal`);
    } else {
      const entrada = entradas.find((e) => mismoArchivo(e.st, c.st));
      if (entrada) problemas.push(`${dv} es el mismo archivo que la entrada ${entrada.ruta}`);
    }
  }
  if (problemas.length) {
    err(ce.rojo('Error: problema con las rutas de salida; no se escribió nada:'));
    for (const p of problemas) err(`  ${p}`);
    return 1;
  }
  if (existentes.length && !opts.forzar) {
    err(ce.rojo('Error: ya existen estas salidas; no se escribió nada:'));
    for (const n of existentes) err(`  ${rutaVisible(raiz, path.join(salidaDir, n))}`);
    err('Usa --forzar para sobrescribirlas (también se eliminan las que esta vez no se generen).');
    return 1;
  }
  const generadas = new Set([...presentes.map((f) => f.salida), ARCHIVO_LEEME]);
  const obsoletos = existentes.filter((n) => !generadas.has(n));

  // --- Sustitución y residuos ----------------------------------------------------
  const candidatas = calcularCandidatas(opts.nombre, opts.slug);
  const variantes = calcularVariantes(opts.nombre, opts.slug);
  const marcadoresSlug = marcadoresDelSlug(opts.nombre, opts.slug);
  const mapaUuids = crearMapaUuids(presentes.map((f) => f.texto));

  const residuos = [];
  const validaciones = [];
  const totales = {};
  const porArchivo = {};
  for (const f of presentes) {
    const r = sustituir(f.texto, variantes, mapaUuids);
    f.plantilla = r.texto;
    for (const [marcador, n] of Object.entries(r.conteo)) {
      totales[marcador] = (totales[marcador] ?? 0) + n;
      (porArchivo[marcador] ??= {})[f.salida] = n;
    }
    const encontrados = detectarResiduos(f.plantilla, {
      archivo: f.salida,
      nombre: opts.nombre,
      slug: opts.slug,
      extra: opts.extra,
      marcadoresSlug,
    });
    for (const x of encontrados) residuos.push(x);

    if (f.salida.endsWith('.json')) {
      const v = validarJson(f.plantilla);
      const fuenteOk = validarJson(f.texto).ok;
      validaciones.push({
        archivo: f.salida,
        ok: v.ok,
        detalle: v.ok ? 'JSON válido' : `JSON inválido: ${v.error}${fuenteOk ? '' : ' (la fuente tampoco es JSON válido)'}`,
      });
    } else if (f.salida.endsWith('.js')) {
      const v = verificarSintaxisJs(f.plantilla, {
        tipoModulo: detectarTipoModulo(f.ruta, f.texto),
        nombreArchivo: 'plantilla-db-alta',
      });
      validaciones.push({
        archivo: f.salida,
        ok: v.ok,
        noVerificado: Boolean(v.noVerificado),
        detalle: v.ok
          ? 'node --check sin errores de sintaxis'
          : v.noVerificado
            ? `no se pudo verificar la sintaxis (${v.error})`
            : `node --check falló (${v.error})`,
      });
    }
  }

  const ordenMarcadores = [...variantes.map((v) => v.marcador), ...mapaUuids.values()];
  const valorDe = Object.fromEntries([
    ...variantes.map((v) => [v.marcador, v.valor]),
    ...[...mapaUuids.entries()].map(([uuid, m]) => [m, uuid]),
  ]);
  const marcadores = ordenMarcadores
    .filter((m) => totales[m])
    .map((m) => ({
      marcador: m,
      valor: valorDe[m],
      descripcion: DESCRIPCION_MARCADOR[m] ?? DESCRIPCION_UUID,
      total: totales[m],
      porArchivo: porArchivo[m],
    }));
  const sinUso = variantes.filter((v) => !totales[v.marcador]);
  const coincidencias = candidatas.filter((c) => c.igualA);
  const preexistentes = presentes.flatMap((f) => f.preexistentes.map((p) => ({ archivo: f.salida, ...p })));

  // --- LEEME ---------------------------------------------------------------------
  const scriptRel = rutaVisible(cwd, fileURLToPath(import.meta.url));
  const leeme = generarLeeme({
    nombre: opts.nombre,
    slug: opts.slug,
    fecha: new Date().toISOString(),
    comando: ['node', scriptRel, ...argv].map(citarArg).join(' '),
    salidaRel,
    fuentes: presentes.map((f) => ({ salida: f.salida, ruta: f.rutaVisible, sha256: f.sha256, destino: f.destino })),
    faltantes,
    obsoletos,
    marcadores,
    sinUso,
    coincidencias,
    preexistentes,
    validaciones,
    residuos,
  });

  // --- Escritura (todo o nada) -----------------------------------------------------
  try {
    escribirSalidas(
      salidaDir,
      [...presentes.map((f) => ({ nombre: f.salida, contenido: f.plantilla })), { nombre: ARCHIVO_LEEME, contenido: leeme }],
      obsoletos,
      opts.forzar,
    );
  } catch (e) {
    const donde = e.dest ?? e.path;
    return error(
      `no se pudieron escribir las salidas; no se dejó ningún archivo a medias: ${e.code ?? e.message}` +
        (donde ? ` (${rutaVisible(raiz, donde)})` : ''),
    );
  }

  // --- Resumen en consola ----------------------------------------------------------
  out(co.negrita('Marcadores'));
  const anchoM = Math.max(...marcadores.map((m) => m.marcador.length + 4), 10);
  const anchoV = Math.max(...marcadores.map((m) => m.valor.length), 10);
  for (const m of marcadores) {
    out(`  ${`{{${m.marcador}}}`.padEnd(anchoM)}  ${m.valor.padEnd(anchoV)}  ×${m.total}`);
  }
  if (!marcadores.length) out(co.tenue('  (ninguno)'));
  if (coincidencias.length) {
    const pares = coincidencias.map((c) => `${c.marcador}→${c.igualA}`).join(', ');
    out(co.tenue(`  Nota: variantes idénticas en ${opts.nombre}, marcadas con la de mayor prioridad: ${pares} (ver LEEME.md).`));
  }
  const slugCoincide = coincidencias.find((c) => c.marcador === 'SLUG');
  if (slugCoincide) {
    aviso(
      `  Aviso: el slug "${opts.slug}" es igual a {{${slugCoincide.igualA}}}; sus apariciones (URLs, correos admin-…@, rutas) ` +
        `quedaron como {{${slugCoincide.igualA}}}. En un municipio con acentos o espacios pon ahí el slug, no el nombre.`,
    );
  }
  out('');

  if (validaciones.length) {
    out(co.negrita('Validaciones'));
    for (const v of validaciones) {
      const linea = `  ${v.ok ? 'ok   ' : 'AVISO'}  ${v.archivo.padEnd(24)}  ${v.detalle}`;
      if (v.ok) out(linea.replace('ok   ', co.verde('ok   ')));
      else aviso(linea);
    }
    out('');
  }

  const normales = residuos.filter((r) => !r.alerta);
  const alertas = residuos.filter((r) => r.alerta);
  const extraAlertas = alertas.length ? ` (+${alertas.length} alerta(s) de seguridad, abajo)` : '';
  out(
    co.negrita(`Residuos para revisión manual: ${normales.length}${extraAlertas}`) +
      (residuos.length ? co.tenue(`  (detalle en ${ARCHIVO_LEEME})`) : ''),
  );
  if (normales.length) {
    const muestra = normales.slice(0, LIMITE_RESIDUOS_CONSOLA);
    const anchoU = Math.max(...muestra.map((r) => `${r.archivo}:${r.linea}`.length));
    const anchoMot = Math.max(...muestra.map((r) => r.motivo.length));
    for (const r of muestra) {
      out(`  ${`${r.archivo}:${r.linea}`.padEnd(anchoU)}  ${r.motivo.padEnd(anchoMot)}  ${recortar(r.coincidencia, 50)}`);
    }
    if (normales.length > muestra.length) out(co.tenue(`  … y ${normales.length - muestra.length} más`));
  }
  out('');

  out(co.negrita(`Escrito en ${salidaRel}/`));
  out(`  ${[...presentes.map((f) => f.salida), ARCHIVO_LEEME].join(', ')}`);
  if (obsoletos.length) aviso(`  Eliminadas (de una ejecución anterior, no regeneradas): ${obsoletos.join(', ')}`);
  out(`Siguiente paso: lee ${salidaRel}/${ARCHIVO_LEEME}, revisa los residuos y reemplaza los {{...}} al dar de alta un municipio nuevo.`);

  if (alertas.length) {
    const barra = '='.repeat(72);
    err('');
    err(ce.rojo(ce.negrita(barra)));
    err(ce.rojo(ce.negrita(`ALERTA DE SEGURIDAD: ${alertas.length} posible(s) secreto(s) en las fuentes`)));
    err(ce.rojo(ce.negrita(barra)));
    for (const r of alertas) err(ce.rojo(`  ${r.archivo}:${r.linea}  ${r.motivo}`));
    err(ce.rojo('  Las plantillas generadas CONTIENEN esos valores (en los reportes aparecen ocultos).'));
    err(ce.rojo('  Elimínalos antes de compartir o versionar. El operador NO debe llevar contraseña.'));
    err(ce.rojo(ce.negrita(barra)));
  }
  return 0;
}

function esPuntoDeEntrada() {
  if (!process.argv[1]) return false;
  if (import.meta.url === pathToFileURL(process.argv[1]).href) return true;
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (esPuntoDeEntrada()) {
  process.exitCode = main();
}
