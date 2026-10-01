#!/usr/bin/env node
// aplicar-facebook-historia.mjs
//
// Aplica en el repo del PORTAL de Villa Pesqueira (no en cmsmunicipal) tres cambios:
//   1. lib/municipalConfig.js  -> redes.facebook (botón de Facebook del pie)
//   2. lib/municipalConfig.js  -> historia.subtitulo y historia.parrafos
//   3. lib/hitos.js            -> hitos de la línea de tiempo
//
// Todo o nada: arma los cambios en memoria; si alguno no se puede aplicar con seguridad
// (no encuentra el bloque, el bloque ya tiene contenido distinto, el resultado no pasa
// `node --check`), no escribe NADA y explica por qué. Usa --dry-run para ver el cambio.
//
// Regla del molde (ver DATOS_PENDIENTES.md de San Javier): ningún dato entra al código sin
// fuente citable; cada valor lleva su URL en un comentario. Los hechos de una sola fuente
// van COMENTADOS hasta que el ayuntamiento los valide.
//
// Node >= 18, sin dependencias. Solo modifica archivos dentro de --raiz.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------

export const FACEBOOK_URL = 'https://www.facebook.com/ayuntamientodevillapesqueira';
export const FACEBOOK_FUENTE = 'Enlace oficial aportado por el ayuntamiento (octubre de 2026).';

const WP_MUN = 'https://es.wikipedia.org/wiki/Municipio_de_Villa_Pesqueira';
const WP_LOC = 'https://es.wikipedia.org/wiki/Villa_Pesqueira';
const BLOG = 'http://matapevillapesqueirason.blogspot.com/';
const GUIA = 'https://www.guiaturisticamexico.com/municipio.php?id_e=26&id_Municipio=02094';
const WIKIDATA = 'https://www.wikidata.org/wiki/Q3844354';
const INAH = 'https://revistavertice.unison.mx/index.php/rvu/article/view/254';
const SCIELO = 'https://www.scielo.org.mx/scielo.php?script=sci_arttext&pid=S1870-39252007000400012';
const DIALNET = 'https://dialnet.unirioja.es/descarga/articulo/7099244.pdf';
const NOTAS = 'http://notasdesonora.blogspot.com/2012/04/matape.html';

const N2 = 'NIVEL 2: una sola fuente. Descomentar tras validar con el ayuntamiento.';

export const HISTORIA = {
  fuentes: [WP_MUN, WP_LOC, BLOG, GUIA, INAH, SCIELO, DIALNET],
  subtitulo: 'De la misión jesuita de San José de Mátape, en 1629, a Villa Pesqueira, en 1867.',
  parrafos: [
    {
      texto:
        'Villa Pesqueira, también llamada Mátape, se encuentra al pie de la sierra baja de Sonora, a unos 100 km de Hermosillo. Su origen es la misión de San José de Mátapa, fundada en 1629 por el padre jesuita Martín de Azpilcueta.',
    },
    {
      texto:
        'Mátapa viene del opata: «mata», metal, y «pa», lugar; es decir, «lugar de metales». En el siglo XVII la misión creció hasta contar con un colegio incoado jesuita y una importante actividad ganadera: en 1681, misioneros como Daniel Ángelo Marras llevaron ganado desde el colegio de San José de Mátape hasta Puebla de los Ángeles, en un viaje que tomaba cerca de un año.',
    },
    {
      texto:
        'En 1767, con el decreto de expulsión de la Compañía de Jesús, los misioneros de Sonora fueron reunidos en Mátape antes de ser llevados a Guaymas para su deportación a Europa.',
    },
    {
      texto:
        'El 11 de febrero de 1867, por decreto del Congreso del Estado y a petición de sus habitantes, el pueblo de Mátape se erigió en Villa Pesqueira.',
    },
    {
      texto:
        'Entre sus tradiciones destacan la Semana Santa, con procesiones, los fariseos y la danza de los matachines, y las fiestas de la Virgen en septiembre.',
    },
    {
      pendiente: `${N2} (Notas de Sonora; va después del párrafo 2.)`,
      texto:
        'El padre Pedro Bueno terminó en 1646 el templo de la misión, descrito treinta años después como una de las iglesias más hermosas y espaciosas de la provincia. Hacia 1726, el padre Cayetano Guerrero levantó junto a él una iglesia dedicada a la Virgen de Loreto.',
    },
    {
      pendiente: `${N2} (blog de Mátape; va después del párrafo 3.)`,
      texto:
        'Durante la Intervención Francesa, en 1865, Mátape fue sitiado por jefes imperialistas; el general Jesús García Morales y los matapeños, a las órdenes de Ignacio Pesqueira, rechazaron el sitio. Al año siguiente, una columna de matapeños, baviácoras y nácoris participó en la toma de Hermosillo.',
    },
  ],
};

export const HITOS = [
  {
    fuente: `${WP_LOC} ; ${BLOG} ; ${GUIA}`,
    ano: '1629',
    titulo: 'Fundación de San José de Mátapa',
    descripcion:
      'El misionero jesuita Martín de Azpilcueta funda la misión de San José de Mátapa, hoy Villa Pesqueira (Mátape).',
  },
  {
    pendiente: N2,
    fuente: NOTAS,
    ano: '1646',
    titulo: 'Templo de la misión',
    descripcion:
      'El padre Pedro Bueno termina el templo de la misión; treinta años después se le describía como una de las iglesias más hermosas y espaciosas de la provincia.',
  },
  {
    pendiente: N2,
    fuente: NOTAS,
    ano: '1656',
    titulo: 'Colegio incoado de Mátape',
    descripcion:
      'El padre Daniel Ángelo Marras sucede al padre Bueno; bajo su dirección, la escuela de la misión alcanza el rango de colegio incoado.',
  },
  {
    fuente: INAH,
    ano: '1681',
    titulo: 'Ganado de Mátape a Puebla',
    descripcion:
      'Misioneros como Daniel Ángelo Marras llevan ganado desde el colegio incoado de San José de Mátape hasta Puebla de los Ángeles, en un viaje de cerca de un año.',
  },
  {
    pendiente: N2,
    fuente: NOTAS,
    ano: '1726',
    titulo: 'Iglesia de la Virgen de Loreto',
    descripcion:
      'Hacia 1726, el padre Cayetano Guerrero construye junto al templo principal una iglesia dedicada a la Virgen de Loreto.',
  },
  {
    fuente: `${SCIELO} ; ${DIALNET}`,
    ano: '1767',
    titulo: 'Los jesuitas de Sonora, reunidos en Mátape',
    descripcion:
      'Con el decreto de expulsión de la Compañía de Jesús, los misioneros de Sonora son reunidos en Mátape antes de ser llevados a Guaymas para su deportación a Europa.',
  },
  {
    pendiente: N2,
    fuente: BLOG,
    ano: '1865',
    titulo: 'Sitio de Mátape',
    descripcion:
      'Los jefes imperialistas Francisco Barceló y Santiago Campillo sitian Mátape; el general Jesús García Morales y los matapeños, a las órdenes de Ignacio Pesqueira, rechazan el sitio.',
  },
  {
    pendiente: N2,
    fuente: BLOG,
    ano: '1866',
    titulo: 'Toma de Hermosillo',
    descripcion:
      'Una columna de matapeños, baviácoras y nácoris, al mando del general Jesús García Morales, participa en la toma de Hermosillo, ocupada por los franceses.',
  },
  {
    fuente: `${WP_MUN} ; ${BLOG} ; ${GUIA}`,
    ano: '1867-02-11',
    titulo: 'Se erige la Villa Pesqueira',
    descripcion:
      'Por decreto del Congreso del Estado, y a petición de sus habitantes, el pueblo de Mátape se erige en Villa Pesqueira.',
  },
];

export const NOTA_NIVEL_3 = [
  'NIVEL 3 (NO publicar): fecha en que Villa Pesqueira adquiere la categoría de municipio.',
  `Wikipedia dice 11-dic-1930 (${WP_MUN}); Wikidata, citando a INAFED, dice 26-jun-1934 (${WIKIDATA}).`,
  'Falta el decreto del Congreso de Sonora o la confirmación del ayuntamiento.',
];

// ---------------------------------------------------------------------------
// Análisis de código (cadenas, comentarios y bloques balanceados)
// ---------------------------------------------------------------------------

/** Si en `i` empieza una cadena o un comentario, devuelve el índice siguiente a su final. */
export function saltar(src, i) {
  const c = src[i];
  const d = src[i + 1];
  if (c === '/' && d === '/') {
    const f = src.indexOf('\n', i);
    return f === -1 ? src.length : f;
  }
  if (c === '/' && d === '*') {
    const f = src.indexOf('*/', i + 2);
    return f === -1 ? src.length : f + 2;
  }
  if (c === "'" || c === '"' || c === '`') {
    let j = i + 1;
    while (j < src.length) {
      if (src[j] === '\\') j += 2;
      else if (src[j] === c) return j + 1;
      else j++;
    }
    return src.length;
  }
  return i;
}

/** Dado el índice de `{` o `[`, devuelve el índice de su cierre; -1 si no cierra. */
export function cierreDe(src, abre) {
  const a = src[abre];
  const z = a === '{' ? '}' : ']';
  let prof = 0;
  for (let i = abre; i < src.length; ) {
    const n = saltar(src, i);
    if (n !== i) {
      i = n;
      continue;
    }
    if (src[i] === a) prof++;
    else if (src[i] === z && --prof === 0) return i;
    i++;
  }
  return -1;
}

/** Quita comentarios (no toca el contenido de las cadenas). */
export function sinComentarios(src) {
  let out = '';
  for (let i = 0; i < src.length; ) {
    const n = saltar(src, i);
    if (n !== i) {
      const trozo = src.slice(i, n);
      out += trozo.startsWith('//') || trozo.startsWith('/*') ? ' ' : trozo;
      i = n;
    } else out += src[i++];
  }
  return out;
}

/** Comillas dominantes del archivo: la que más delimita cadenas. */
export function comillasDe(src, defecto = '"') {
  const s = (sinComentarios(src).match(/(^|[\s,:[(=])'[^'\n]*'/g) || []).length;
  const d = (sinComentarios(src).match(/(^|[\s,:[(=])"[^"\n]*"/g) || []).length;
  if (s === d) return defecto;
  return s > d ? "'" : '"';
}

export function lit(texto, q) {
  const esc = texto
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .split(q)
    .join('\\' + q);
  return q + esc + q;
}

function eolDe(src) {
  return /\r\n/.test(src) ? '\r\n' : '\n';
}

function sangriaDeLinea(src, idx) {
  const ini = src.lastIndexOf('\n', idx - 1) + 1;
  return /^[ \t]*/.exec(src.slice(ini, idx))[0];
}

function unidadSangria(src, abre, ind) {
  const resto = src.slice(abre + 1);
  const m = /\n([ \t]+)\S/.exec(resto);
  if (m && m[1].length > ind.length && m[1].startsWith(ind)) return m[1].slice(ind.length);
  return '  ';
}

function unico(src, re, nombre) {
  const m = [...src.matchAll(re)];
  if (m.length === 0) return { error: `no encontré «${nombre}»` };
  if (m.length > 1) return { error: `hay ${m.length} coincidencias de «${nombre}»; no puedo elegir una con seguridad` };
  return { m: m[0] };
}

const EN_LINEAS = (txt, pref, eol) => txt.split(/\r?\n/).map((l) => pref + l).join(eol);

// ---------------------------------------------------------------------------
// Planes de cambio. Cada uno devuelve { estado, mensaje, src, antes, despues }
//   estado: 'aplicar' | 'ya-estaba' | 'error'
// ---------------------------------------------------------------------------

export function planFacebook(src, url = FACEBOOK_URL, forzar = false) {
  const r = unico(src, /(^|[^\w$.])redes\s*:\s*\{/g, 'redes: {');
  if (r.error) return { estado: 'error', mensaje: r.error };
  const abre = r.m.index + r.m[0].length - 1;
  const cierre = cierreDe(src, abre);
  if (cierre === -1) return { estado: 'error', mensaje: 'el bloque «redes» no cierra' };
  const cuerpo = src.slice(abre, cierre + 1);
  const f = unico(cuerpo, /(\bfacebook\s*:\s*)(null|undefined|''|""|'[^'\n]*'|"[^"\n]*")/g, 'facebook dentro de redes');
  if (f.error) return { estado: 'error', mensaje: f.error };
  const valor = f.m[2];
  const vacio = /^(null|undefined|''|"")$/.test(valor);
  if (!vacio) {
    const actual = valor.slice(1, -1);
    if (actual === url) return { estado: 'ya-estaba', mensaje: 'redes.facebook ya tiene el enlace' };
    if (!forzar) return { estado: 'error', mensaje: `redes.facebook ya vale ${actual}; usa --forzar para reemplazarlo` };
  }
  const q = comillasDe(src, "'");
  const ini = abre + f.m.index + f.m[1].length;
  const fin = ini + valor.length;
  const nuevo = src.slice(0, ini) + lit(url, q) + src.slice(fin);
  return { estado: 'aplicar', mensaje: 'redes.facebook', src: nuevo, antes: src.slice(abre + f.m.index, fin), despues: f.m[1] + lit(url, q) };
}

const HISTORIA_VACIA = new Set(["{subtitulo:'',parrafos:[]}", "{parrafos:[],subtitulo:''}", "{subtitulo:null,parrafos:[]}", "{parrafos:[]}", "{subtitulo:''}", '{}']);

export function planHistoria(src, h = HISTORIA, forzar = false) {
  const r = unico(src, /(^|[^\w$.])historia\s*:\s*\{/g, 'historia: {');
  if (r.error) return { estado: 'error', mensaje: r.error };
  const abre = r.m.index + r.m[0].length - 1;
  const cierre = cierreDe(src, abre);
  if (cierre === -1) return { estado: 'error', mensaje: 'el bloque «historia» no cierra' };
  const cuerpo = src.slice(abre, cierre + 1);
  const norm = sinComentarios(cuerpo).replace(/\s+/g, '').replace(/,(?=[}\]])/g, '').replace(/""/g, "''");
  const activos = h.parrafos.filter((p) => !p.pendiente);
  const qh = comillasDe(src, "'");
  const esta = (t) => cuerpo.includes(lit(t, qh).slice(1, -1));
  if (esta(h.subtitulo) && activos.every((p) => esta(p.texto))) {
    return { estado: 'ya-estaba', mensaje: 'historia ya tiene todo el texto' };
  }
  if (!HISTORIA_VACIA.has(norm) && !forzar) {
    return { estado: 'error', mensaje: 'historia ya tiene contenido distinto; usa --forzar para reemplazarlo' };
  }
  const eol = eolDe(src);
  const q = comillasDe(src, "'");
  const ind = sangriaDeLinea(src, r.m.index + r.m[1].length);
  const u = unidadSangria(src, abre, ind);
  const i1 = ind + u;
  const i2 = i1 + u;
  const L = [];
  L.push('{');
  L.push(`${i1}// Fuentes: ${h.fuentes.join(' ; ')}`);
  L.push(`${i1}// Borrador investigado el 1-oct-2026; el ayuntamiento debe validarlo.`);
  L.push(`${i1}subtitulo: ${lit(h.subtitulo, q)},`);
  L.push(`${i1}parrafos: [`);
  for (const p of h.parrafos) {
    if (p.pendiente) {
      L.push(`${i2}// ${p.pendiente}`);
      L.push(`${i2}// ${lit(p.texto, q)},`);
    } else L.push(`${i2}${lit(p.texto, q)},`);
  }
  L.push(`${i1}],`);
  L.push(`${ind}}`);
  const despues = L.join(eol);
  const nuevo = src.slice(0, abre) + despues + src.slice(cierre + 1);
  return { estado: 'aplicar', mensaje: 'historia.subtitulo y historia.parrafos', src: nuevo, antes: cuerpo, despues };
}

export function planHitos(src, hitos = HITOS, forzar = false) {
  const r = unico(src, /(^|[^\w$.])export\s+const\s+hitos\s*=\s*\[/g, 'export const hitos = [');
  if (r.error) return { estado: 'error', mensaje: r.error };
  const abre = r.m.index + r.m[0].length - 1;
  const cierre = cierreDe(src, abre);
  if (cierre === -1) return { estado: 'error', mensaje: 'el arreglo «hitos» no cierra' };
  const cuerpo = src.slice(abre, cierre + 1);
  const activos = hitos.filter((x) => !x.pendiente);
  const qa = comillasDe(src, '"');
  const limpio = sinComentarios(cuerpo);
  const hitoPresente = (x) => [x.ano, x.titulo, x.descripcion].every((t) => limpio.includes(lit(t, qa).slice(1, -1)));
  if (activos.every(hitoPresente)) {
    return { estado: 'ya-estaba', mensaje: 'hitos ya tiene todos los hitos' };
  }
  const norm = sinComentarios(cuerpo).replace(/\s+/g, '');
  if (norm !== '[]' && !forzar) return { estado: 'error', mensaje: 'hitos ya tiene contenido distinto; usa --forzar para reemplazarlo' };
  const eol = eolDe(src);
  const q = comillasDe(src, '"');
  const ind = sangriaDeLinea(src, r.m.index + r.m[1].length);
  const u = unidadSangria(src, abre, ind);
  const i1 = ind + u;
  const L = ['['];
  for (const x of hitos) {
    const item = [
      '{',
      `${u}// Fuente: ${x.fuente}`,
      `${u}ano: ${lit(x.ano, q)},`,
      `${u}titulo: ${lit(x.titulo, q)},`,
      `${u}descripcion:`,
      `${u}${u}${lit(x.descripcion, q)},`,
      '},',
    ];
    if (x.pendiente) {
      // Comentado con `// ` en una sola columna: para activarlo basta quitar `// ` de estas 7 líneas.
      L.push(`${i1}// ${x.pendiente}`);
      for (const l of item) L.push(`${i1}// ${l}`);
    } else for (const l of item) L.push(`${i1}${l}`);
  }
  for (const l of NOTA_NIVEL_3) L.push(`${i1}// ${l}`);
  L.push(`${ind}]`);
  const despues = L.join(eol);
  const nuevo = src.slice(0, abre) + despues + src.slice(cierre + 1);
  return { estado: 'aplicar', mensaje: 'hitos de la línea de tiempo', src: nuevo, antes: cuerpo, despues };
}

// ---------------------------------------------------------------------------
// Verificación de sintaxis y escritura
// ---------------------------------------------------------------------------

export function sintaxisOk(codigo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aplicar-fh-'));
  try {
    const f = path.join(dir, 'x.mjs');
    fs.writeFileSync(f, codigo);
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    return { ok: r.status === 0, detalle: (r.stderr || '').split('\n').slice(0, 4).join('\n') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function gitSucio(raiz, archivos) {
  if (!fs.existsSync(path.join(raiz, '.git'))) return null;
  const r = spawnSync('git', ['status', '--porcelain', '--', ...archivos], { cwd: raiz, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.trim();
}

function escribirAtomico(ruta, contenido) {
  const tmp = `${ruta}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, contenido);
  fs.renameSync(tmp, ruta);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const AYUDA = `aplicar-facebook-historia.mjs — botón de Facebook, historia y línea de tiempo del portal de Villa Pesqueira

USO (desde la raíz del repo del PORTAL, no de cmsmunicipal)
  node aplicar-facebook-historia.mjs --dry-run     # muestra el cambio sin escribir
  node aplicar-facebook-historia.mjs               # aplica

OPCIONES
  --raiz <ruta>     Raíz del repo del portal (por defecto, el directorio actual).
  --dry-run         No escribe nada; muestra lo que cambiaría.
  --solo <lista>    Aplica solo una parte: facebook, historia, hitos (separadas por coma).
  --forzar          Reemplaza contenido que ya existe y permite archivos con cambios sin guardar.
  --ayuda           Esta ayuda.

Todo o nada: si una parte no se puede aplicar con seguridad, no se escribe ninguna.
Archivos: lib/municipalConfig.js (facebook, historia) y lib/hitos.js (línea de tiempo).
Códigos de salida: 0 todo aplicado o ya estaba; 1 no se aplicó; 3 uso incorrecto.
`;

export function leerArgs(argv) {
  const o = { raiz: process.cwd(), dry: false, forzar: false, solo: null, ayuda: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') o.dry = true;
    else if (a === '--forzar') o.forzar = true;
    else if (a === '--ayuda' || a === '-h') o.ayuda = true;
    else if (a === '--raiz' || a === '--solo') {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} requiere un valor`);
      if (a === '--raiz') o.raiz = path.resolve(v);
      else o.solo = v.split(',').map((x) => x.trim()).filter(Boolean);
    } else throw new Error(`opción desconocida: ${a}`);
  }
  if (o.solo) {
    const malos = o.solo.filter((x) => !['facebook', 'historia', 'hitos'].includes(x));
    if (malos.length) throw new Error(`--solo acepta facebook, historia y hitos; recibí: ${malos.join(', ')}`);
  }
  return o;
}

function mostrar(titulo, p) {
  const out = [`\n  ${titulo}`];
  const rec = (t) => (t.length > 600 ? t.slice(0, 600) + ' […]' : t);
  for (const l of rec(p.antes).split(/\r?\n/)) out.push(`    - ${l}`);
  for (const l of p.despues.split(/\r?\n/)) out.push(`    + ${l}`);
  return out.join('\n');
}

export function main(argv = process.argv.slice(2), io = { out: (s) => console.log(s), err: (s) => console.error(s) }) {
  let o;
  try {
    o = leerArgs(argv);
  } catch (e) {
    io.err(`Error: ${e.message}\n\n${AYUDA}`);
    return 3;
  }
  if (o.ayuda) {
    io.out(AYUDA);
    return 0;
  }
  const quiere = (k) => !o.solo || o.solo.includes(k);
  const fCfg = path.join(o.raiz, 'lib', 'municipalConfig.js');
  const fHit = path.join(o.raiz, 'lib', 'hitos.js');
  const necesarios = [];
  if (quiere('facebook') || quiere('historia')) necesarios.push(fCfg);
  if (quiere('hitos')) necesarios.push(fHit);
  const faltan = necesarios.filter((f) => !fs.existsSync(f));
  if (faltan.length) {
    io.err(`No encuentro: ${faltan.map((f) => path.relative(o.raiz, f)).join(', ')}.\nEjecuta el script desde la raíz del repo del portal o usa --raiz. Si la línea de tiempo vive en otro archivo, usa --solo facebook,historia y agrégala a mano (ver HISTORIA_VILLAPESQUEIRA_BORRADOR.md).`);
    return 1;
  }
  if (!o.forzar) {
    const sucio = gitSucio(o.raiz, necesarios.map((f) => path.relative(o.raiz, f)));
    if (sucio) {
      io.err(`Estos archivos tienen cambios sin guardar en git; no los toco para no mezclarlos:\n${sucio}\nHaz commit o stash, o usa --forzar.`);
      return 1;
    }
  }

  const resultados = []; // { archivo, nombre, plan }
  const nuevos = new Map(); // archivo -> contenido
  const leer = (f) => (nuevos.has(f) ? nuevos.get(f) : fs.readFileSync(f, 'utf8'));
  const aplicar = (clave, archivo, fn) => {
    if (!quiere(clave)) return;
    const plan = fn(leer(archivo));
    resultados.push({ clave, archivo, plan });
    if (plan.estado === 'aplicar') nuevos.set(archivo, plan.src);
  };
  aplicar('facebook', fCfg, (s) => planFacebook(s, FACEBOOK_URL, o.forzar));
  aplicar('historia', fCfg, (s) => planHistoria(s, HISTORIA, o.forzar));
  aplicar('hitos', fHit, (s) => planHitos(s, HITOS, o.forzar));

  io.out(`Portal: ${o.raiz}${o.dry ? '  (--dry-run: no se escribe nada)' : ''}`);
  let hayError = false;
  for (const { clave, archivo, plan } of resultados) {
    const rel = path.relative(o.raiz, archivo);
    if (plan.estado === 'error') {
      hayError = true;
      io.out(`\n  [ERROR]     ${clave} (${rel}): ${plan.mensaje}`);
    } else if (plan.estado === 'ya-estaba') io.out(`\n  [YA ESTABA] ${clave} (${rel}): ${plan.mensaje}`);
    else io.out(mostrar(`[CAMBIO]     ${clave} (${rel})`, plan));
  }
  if (hayError) {
    io.err('\nNo se escribió nada: al menos una parte no se pudo aplicar con seguridad.');
    return 1;
  }
  for (const [f, contenido] of nuevos) {
    const v = sintaxisOk(contenido);
    if (!v.ok) {
      io.err(`\nEl resultado de ${path.relative(o.raiz, f)} no pasa la revisión de sintaxis; no se escribió nada.\n${v.detalle}`);
      return 1;
    }
  }
  if (!nuevos.size) {
    io.out('\nNada que cambiar: todo ya estaba aplicado.');
    return 0;
  }
  if (o.dry) {
    io.out('\n--dry-run: no se escribió nada. Quita --dry-run para aplicar.');
    return 0;
  }
  for (const [f, contenido] of nuevos) escribirAtomico(f, contenido);
  io.out(`\nListo: ${nuevos.size} archivo(s) modificado(s).`);
  io.out('Siguiente: revisa con `git diff`, corre `npm run lint` y `npm run build`, haz commit y push (Vercel despliega solo).');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main();
}
