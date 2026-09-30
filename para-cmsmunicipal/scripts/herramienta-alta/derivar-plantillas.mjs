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
// Requisitos: Node >= 18, sin dependencias (solo módulos nativos de Node).
// Ejecutar desde la raíz de cmsmunicipal:
//   node scripts/herramienta-alta/derivar-plantillas.mjs --slug villapesqueira --nombre "Villa Pesqueira"
// Ayuda: --ayuda

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const SALIDA_POR_DEFECTO = 'scripts/herramienta-alta/plantillas';
export const ARCHIVO_LEEME = 'LEEME.md';
const LIMITE_RESIDUOS_CONSOLA = 25;

/** Palabras del nombre que NO se vigilan como residuo por ser demasiado comunes. */
export const PALABRAS_GENERICAS = new Set([
  'villa', 'san', 'santa', 'santo', 'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e',
  'heroica', 'general', 'ciudad', 'pueblo', 'puerto', 'municipio', 'ayuntamiento',
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

const patronUuid = () =>
  /(?<![0-9a-f])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![0-9a-f])/gi;
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
 * texto normalizado a su posición en el original, para reportar fragmentos reales.
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

function solapa(rangos, a, b) {
  return rangos.some(([x, y]) => a < y && b > x);
}

function rangosDe(texto, re) {
  return [...texto.matchAll(re)].map((m) => [m.index, m.index + m[0].length]);
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
 * - Solo apariciones no pegadas a otras letras (evita "naco" dentro de "nacional").
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
      const re = new RegExp(`(?<![\\p{L}\\p{M}])${escaparRegex(forma)}(?![\\p{L}\\p{M}])`, 'gu');
      t = t.replace(re, () => ficha(v.marcador));
    }
  }

  t = t.replace(new RegExp(`${INI}(\\d+)${FIN}`, 'g'), (_, i) => `{{${nombres[Number(i)]}}}`);
  return { texto: t, conteo };
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

const PALABRA_SENSIBLE = String.raw`(?:passw(?:or)?d|pwd|contrase(?:ñ|n)a|secret(?!ar[ií])|token|api[_-]?key)`;

function tipoPorExtension(archivo) {
  const ext = path.extname(String(archivo)).toLowerCase();
  if (ext === '.json') return 'json';
  if (['.js', '.mjs', '.cjs', '.ts'].includes(ext)) return 'js';
  return 'texto';
}

/**
 * Busca secretos en una línea. Devuelve [{inicio, fin, motivo, coincidencia}]
 * donde [inicio, fin) es el valor secreto (que se oculta en los reportes).
 */
export function detectarSecretos(linea, tipo = 'texto') {
  const hallazgos = [];
  const reClave = new RegExp(
    String.raw`(?<![\p{L}\p{N}_$])(["'\x60]?)([\p{L}\p{N}_$.-]*?${PALABRA_SENSIBLE}[\p{L}\p{N}_$.-]*)\1(?:\*\*)?[ \t]*(?::|=(?![=>]))(?:\*\*)?[ \t]*`,
    'giu',
  );
  for (const m of linea.matchAll(reClave)) {
    const clave = m[2];
    const pos = m.index + m[0].length;
    const q = linea[pos];
    let inicio = -1;
    let valor = '';
    if (q === '"' || q === "'" || q === '`') {
      let j = pos + 1;
      while (j < linea.length && linea[j] !== q) j += linea[j] === '\\' ? 2 : 1;
      inicio = pos + 1;
      valor = linea.slice(inicio, Math.min(j, linea.length));
      if (!valor.trim()) continue;
    } else if (tipo === 'texto') {
      const mm = /^([^\s,;'"`{}()[\]<>]+)[ \t]*[,;]?[ \t]*$/.exec(linea.slice(pos));
      if (!mm) continue;
      valor = mm[1];
      if (/^(?:null|undefined|true|false|none|nil|\d+(?:\.\d+)?)$/i.test(valor)) continue;
      if (/^process\.env\b/.test(valor) || !/[\p{L}\p{N}]/u.test(valor)) continue;
      inicio = pos;
    } else {
      continue;
    }
    hallazgos.push({
      inicio,
      fin: inicio + valor.length,
      motivo: `ALERTA seguridad: clave "${clave}" con valor no vacío`,
      coincidencia: `${clave}: [valor oculto]`,
    });
  }
  const patrones = [
    [/\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}/g, 'ALERTA seguridad: posible hash de contraseña (bcrypt)'],
    [/\$argon2(?:id|i|d)\$[^\s'"`]+/g, 'ALERTA seguridad: posible hash de contraseña (argon2)'],
    [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, 'ALERTA seguridad: posible token JWT'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, 'ALERTA seguridad: clave privada'],
  ];
  for (const [re, motivo] of patrones) {
    for (const m of linea.matchAll(re)) {
      const a = m.index;
      const b = a + m[0].length;
      if (solapa(hallazgos.map((h) => [h.inicio, h.fin]), a, b)) continue;
      hallazgos.push({ inicio: a, fin: b, motivo, coincidencia: '[valor oculto]' });
    }
  }
  return hallazgos;
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

// Patrones "de datos" (familia con cobertura compartida; el primero que cubre gana).
const RE_CORREO = () => /[\p{L}\p{N}._%+{}-]+@[\p{L}\p{N}{}-]+(?:\.[\p{L}\p{N}{}-]+)+/gu;
const RE_URL_CLOUDINARY = () => /(?:https?:)?\/\/[^\s"'`<>()\\]*cloudinary[^\s"'`<>()\\]*/giu;
const RE_FECHA_ISO = () =>
  /(?<!\d)\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?(?!\d)/g;
const RE_FECHA_DMY = () => /(?<![\d/])(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])\/\d{4}(?![\d/])/g;
const RE_COORDENADA = () => /(?<![\w.])-?\d{1,3}\.\d{4,}(?![\w.])/g;
const RE_TELEFONO = () =>
  /(?<![\w.+])(?:\+?52[ .-]?)?(?:\(\d{2,3}\)[ .-]?|\d{2,3}[ .-])\d{3,4}[ .-]?\d{4}(?!\w)/g;
const RE_NUMERO = () => /(?<![\p{L}\p{N}_#.,])\d(?:[\d.,]*\d)?(?![\p{L}\p{N}_])/gu;

function clasificarNumero(token) {
  const digitos = token.replace(/\D/g, '');
  if (/^(?:1[5-9]\d\d|20\d\d)$/.test(token)) return ['anio', 'año (1500-2099)'];
  if (/^1\d{9}$|^1\d{12}$/.test(token)) return ['timestamp', 'posible timestamp (epoch)'];
  if (/^[2-9]\d{9}$/.test(token)) return ['telefono', 'posible teléfono'];
  if (/^0[.,]\d+$/.test(token)) return null;
  if (digitos.length >= 3) return ['numero', 'número de 3+ dígitos'];
  return null;
}

/**
 * Detecta restos específicos del municipio que NO se sustituyeron.
 * Devuelve [{archivo, linea, columna, tipo, motivo, coincidencia, contexto, alerta}].
 */
export function detectarResiduos(texto, { archivo = '', nombre = '', slug = '', extra = [], tipoArchivo } = {}) {
  const tipo = tipoArchivo ?? tipoPorExtension(archivo);
  const terminosExtra = [...new Set((extra ?? []).map((v) => String(v).trim()).filter(Boolean))]
    .map((original) => ({ norm: normalizar(original), original }))
    .filter((t) => t.norm);
  const terminosNombre = terminosSignificativos(nombre, slug);
  const residuos = [];
  const lineas = String(texto).split(/\r\n|\n|\r/);

  lineas.forEach((linea, i) => {
    const nuevo = (tipoResiduo, motivo, a, b, visible, coincidencia, alerta = false) =>
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

    // 1) Seguridad: se detecta primero y el valor se oculta para todo lo demás.
    const secretos = detectarSecretos(linea, tipo);
    let visible = linea;
    for (const s of secretos) {
      visible = visible.slice(0, s.inicio) + '•'.repeat(s.fin - s.inicio) + visible.slice(s.fin);
    }
    for (const s of secretos) nuevo('seguridad', s.motivo, s.inicio, s.fin, visible, s.coincidencia, true);

    const marcas = rangosDe(visible, patronMarcador());

    // 2) Datos: correos, URLs Cloudinary, fechas, coordenadas, teléfonos, números.
    const cubiertos = [];
    const cubrir = (a, b) => cubiertos.push([a, b]);

    for (const m of visible.matchAll(RE_CORREO())) {
      const a = m.index;
      const b = a + m[0].length;
      cubrir(a, b);
      if (m[0].startsWith('admin-{{SLUG}}@')) continue;
      nuevo('correo', 'correo electrónico', a, b, visible);
    }
    for (const m of visible.matchAll(RE_URL_CLOUDINARY())) {
      const a = m.index;
      const b = a + m[0].length;
      if (solapa(cubiertos, a, b)) continue;
      cubrir(a, b);
      const version = /\/(v\d+)\//.exec(m[0]);
      if (version) nuevo('cloudinary', `URL de Cloudinary con versión (/${version[1]}/)`, a, b, visible);
    }
    const porPatron = [
      [RE_FECHA_ISO, 'fecha', 'fecha/timestamp'],
      [RE_FECHA_DMY, 'fecha', 'fecha'],
      [RE_COORDENADA, 'coordenada', 'posible coordenada'],
      [RE_TELEFONO, 'telefono', 'posible teléfono'],
    ];
    for (const [re, tipoResiduo, motivo] of porPatron) {
      for (const m of visible.matchAll(re())) {
        const a = m.index;
        const b = a + m[0].length;
        if (solapa(cubiertos, a, b) || solapa(marcas, a, b)) continue;
        cubrir(a, b);
        nuevo(tipoResiduo, motivo, a, b, visible);
      }
    }
    for (const m of visible.matchAll(RE_NUMERO())) {
      const a = m.index;
      const b = a + m[0].length;
      if (solapa(cubiertos, a, b) || solapa(marcas, a, b)) continue;
      const clase = clasificarNumero(m[0]);
      if (!clase) continue;
      cubrir(a, b);
      nuevo(clase[0], clase[1], a, b, visible);
    }

    // 3) Texto: valores de --extra y restos del nombre/slug (insensible a mayúsculas y acentos).
    const { norm, inicio, fin } = normalizarConMapa(visible);
    const cubiertosTexto = [];
    const buscar = (terminos, tipoResiduo, motivoDe) => {
      for (const t of terminos) {
        for (let k = norm.indexOf(t.norm); k !== -1; k = norm.indexOf(t.norm, k + 1)) {
          const a = inicio[k];
          const b = fin[k + t.norm.length - 1];
          if (solapa(cubiertosTexto, a, b) || solapa(marcas, a, b)) continue;
          cubiertosTexto.push([a, b]);
          nuevo(tipoResiduo, motivoDe(t), a, b, visible);
        }
      }
    };
    buscar(terminosExtra, 'extra', (t) => `valor de --extra ("${t.original}")`);
    buscar(terminosNombre, 'nombre', (t) => `resto del nombre/slug ("${t.norm}")`);
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
 * (el código no se ejecuta). Devuelve { ok, error? }.
 */
export function verificarSintaxisJs(texto, { tipoModulo = 'cjs', nombreArchivo = 'plantilla-db-alta' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'derivar-plantillas-'));
  const archivo = path.join(dir, `${nombreArchivo}.${tipoModulo}`);
  try {
    fs.writeFileSync(archivo, texto, 'utf8');
    execFileSync(process.execPath, ['--check', archivo], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 30000,
    });
    return { ok: true };
  } catch (e) {
    const salida = String(e.stderr ?? e.message ?? '');
    const linea = new RegExp(`${escaparRegex(archivo)}:(\\d+)`).exec(salida)?.[1];
    const mensaje = /^\w*Error: .*$/m.exec(salida)?.[0] ?? salida.trim().split('\n')[0];
    return { ok: false, error: `${linea ? `línea ${linea}: ` : ''}${mensaje}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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
    L.push('', 'Fuentes no encontradas (sin plantilla):', '');
    for (const f of d.faltantes) L.push(`- \`${celda(f.ruta)}\` → \`${f.salida}\` no generada`);
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
  }
  L.push('');

  L.push('## Validaciones', '');
  for (const v of d.validaciones) L.push(`- \`${v.archivo}\`: ${v.ok ? 'OK' : 'FALLO'} — ${celda(v.detalle)}`);
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
    L.push('| Ubicación | Motivo | Coincidencia | Contexto |', '|---|---|---|---|');
    for (const r of normales) {
      L.push(`| \`${r.archivo}:${r.linea}\` | ${celda(r.motivo)} | ${codigoMd(r.coincidencia)} | ${codigoMd(r.contexto)} |`);
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
  L.push('5. Verifica que no quede ningún marcador (no debe imprimir nada):', '');
  L.push('   ```sh', `   grep -n "{{" ${d.fuentes.map((f) => f.destino).join(' ')}`, '   ```', '');
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
  --forzar            Sobrescribe las plantillas si ya existen
  --ayuda, -h         Muestra esta ayuda

Las rutas relativas de --material y --salida se resuelven desde --raiz.

Fuentes (solo lectura, nunca se modifican):
  scripts/herramienta-alta/contratos/<slug>.json
  scripts/herramienta-alta/contratos/db-alta-<slug>.js
  scripts/lotes-db/operador-<slug>.json

Salidas: plantilla-contrato.json, plantilla-db-alta.js, plantilla-operador.json,
plantilla-README-material.md (si hay material) y ${ARCHIVO_LEEME}.

Códigos de salida: 0 = correcto (aunque haya residuos), 1 = error.

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
  const { values } = parseArgs({ args: argv, options: OPCIONES, strict: true, allowPositionals: false });
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
    },
    {
      ruta: path.join(raiz, 'scripts', 'herramienta-alta', 'contratos', `db-alta-${slug}.js`),
      destino: `scripts/herramienta-alta/contratos/db-alta-<slug>.js`,
      salida: 'plantilla-db-alta.js',
    },
    {
      ruta: path.join(raiz, 'scripts', 'lotes-db', `operador-${slug}.json`),
      destino: `scripts/lotes-db/operador-<slug>.json`,
      salida: 'plantilla-operador.json',
    },
    {
      ruta: material
        ? path.resolve(raiz, material)
        : path.resolve(raiz, '..', '_material-ayuntamientos', slug, 'README.md'),
      destino: `../_material-ayuntamientos/<slug>/README.md`,
      salida: 'plantilla-README-material.md',
      opcional: !material,
    },
  ];
}

function existeArchivo(ruta) {
  try {
    return fs.statSync(ruta).isFile();
  } catch {
    return false;
  }
}

/**
 * Punto de entrada del CLI. Devuelve el código de salida (0 ok, 1 error).
 */
export function main(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const out = (s = '') => console.log(s);
  const err = (s = '') => console.error(s);
  const co = colores(process.stdout);
  const ce = colores(process.stderr);
  const error = (mensaje) => {
    err(ce.rojo(`Error: ${mensaje}`));
    return 1;
  };

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
  if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) {
    return error(`la raíz no existe o no es una carpeta: ${raiz}`);
  }
  const salidaDir = path.resolve(raiz, opts.salida);
  const salidaRel = rutaVisible(raiz, salidaDir);

  out(co.negrita(`Derivando plantillas de "${opts.nombre}" (slug ${opts.slug})`));
  if (raiz !== path.resolve(cwd)) out(co.tenue(`Raíz: ${raiz}`));
  out('');

  // --- Fuentes -------------------------------------------------------------
  out(co.negrita('Fuentes'));
  const fuentes = definirFuentes(raiz, opts.slug, opts.material);
  const presentes = [];
  const faltantes = [];
  for (const f of fuentes) {
    f.rutaVisible = rutaVisible(raiz, f.ruta);
    if (existeArchivo(f.ruta)) {
      presentes.push(f);
      out(`  ${co.verde('ok   ')}  ${f.rutaVisible}`);
    } else if (f.opcional) {
      out(co.tenue(`  --     ${f.rutaVisible}  (material opcional no encontrado; se omite)`));
    } else {
      faltantes.push(f);
      err(ce.amarillo(`  falta  ${f.rutaVisible}  (aviso: no existe; se omite ${f.salida})`));
    }
  }
  out('');
  if (!presentes.length) {
    return error('no se encontró ningún archivo de entrada. Revisa --slug y --raiz (ejecuta desde la raíz de cmsmunicipal).');
  }

  // --- Salidas: nunca sobrescribir sin --forzar ------------------------------
  const destinos = [...presentes.map((f) => path.join(salidaDir, f.salida)), path.join(salidaDir, ARCHIVO_LEEME)];
  const entradas = new Set(presentes.map((f) => path.resolve(f.ruta)));
  const choque = destinos.find((d) => entradas.has(path.resolve(d)));
  if (choque) return error(`la salida coincide con un archivo de entrada: ${rutaVisible(raiz, choque)}`);
  const existentes = destinos.filter((d) => fs.existsSync(d));
  if (existentes.length && !opts.forzar) {
    err(ce.rojo('Error: ya existen estas salidas; no se escribió nada:'));
    for (const d of existentes) err(`  ${rutaVisible(raiz, d)}`);
    err('Usa --forzar para sobrescribirlas.');
    return 1;
  }

  // --- Lectura y sustitución -------------------------------------------------
  for (const f of presentes) {
    f.bytes = fs.readFileSync(f.ruta);
    f.sha256 = sha256(f.bytes);
    f.texto = f.bytes.toString('utf8');
  }
  const candidatas = calcularCandidatas(opts.nombre, opts.slug);
  const variantes = calcularVariantes(opts.nombre, opts.slug);
  const mapaUuids = crearMapaUuids(presentes.map((f) => f.texto));

  const residuos = [];
  const validaciones = [];
  const totales = {};
  const porArchivo = {};
  for (const f of presentes) {
    let r;
    try {
      r = sustituir(f.texto, variantes, mapaUuids);
    } catch (e) {
      return error(`${f.rutaVisible}: ${e.message}`);
    }
    f.plantilla = r.texto;
    for (const [marcador, n] of Object.entries(r.conteo)) {
      totales[marcador] = (totales[marcador] ?? 0) + n;
      (porArchivo[marcador] ??= {})[f.salida] = n;
    }
    residuos.push(
      ...detectarResiduos(f.plantilla, { archivo: f.salida, nombre: opts.nombre, slug: opts.slug, extra: opts.extra }),
    );

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
        detalle: v.ok ? 'node --check sin errores de sintaxis' : `node --check falló (${v.error})`,
      });
    }
  }

  const ordenMarcadores = [
    ...variantes.map((v) => v.marcador),
    ...[...mapaUuids.values()],
  ];
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

  // --- LEEME -------------------------------------------------------------------
  const scriptRel = rutaVisible(cwd, fileURLToPath(import.meta.url));
  const leeme = generarLeeme({
    nombre: opts.nombre,
    slug: opts.slug,
    fecha: new Date().toISOString(),
    comando: ['node', scriptRel, ...argv].map(citarArg).join(' '),
    salidaRel,
    fuentes: presentes.map((f) => ({ salida: f.salida, ruta: f.rutaVisible, sha256: f.sha256, destino: f.destino })),
    faltantes: faltantes.map((f) => ({ salida: f.salida, ruta: f.rutaVisible })),
    marcadores,
    sinUso,
    coincidencias,
    validaciones,
    residuos,
  });

  // --- Escritura ---------------------------------------------------------------
  try {
    fs.mkdirSync(salidaDir, { recursive: true });
    const flag = opts.forzar ? 'w' : 'wx';
    for (const f of presentes) fs.writeFileSync(path.join(salidaDir, f.salida), f.plantilla, { encoding: 'utf8', flag });
    fs.writeFileSync(path.join(salidaDir, ARCHIVO_LEEME), leeme, { encoding: 'utf8', flag });
  } catch (e) {
    return error(`no se pudieron escribir las salidas: ${e.message}`);
  }

  // --- Resumen en consola --------------------------------------------------------
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
  out('');

  if (validaciones.length) {
    out(co.negrita('Validaciones'));
    for (const v of validaciones) {
      const linea = `  ${v.ok ? 'ok   ' : 'AVISO'}  ${v.archivo.padEnd(24)}  ${v.detalle}`;
      if (v.ok) out(linea.replace('ok   ', co.verde('ok   ')));
      else err(ce.amarillo(linea));
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
