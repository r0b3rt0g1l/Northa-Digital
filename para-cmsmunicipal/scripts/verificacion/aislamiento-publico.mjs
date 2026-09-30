#!/usr/bin/env node
// aislamiento-publico.mjs
//
// Prueba de aislamiento entre tenants SOLO sobre la superficie PÚBLICA (GET) de
// la CMS Municipal API. Complementa —no reemplaza— a suite-aislamiento.mjs, que
// cubre las rutas autenticadas.
//
// Qué verifica:
//   1. Tenants = GET /api/municipios (+ los de --incluir, resueltos con
//      GET /api/municipios/<slug>; un 404 ahí es "aún no dado de alta").
//   2. En cada lista, todo municipioId presente es igual al id del tenant.
//   3. Ningún id de elemento se repite entre tenants distintos en la misma colección.
//   4. Detalle cruzado: muestras de noticias y atractivos (por slug) y de
//      funcionarios (por id) responden 200 bajo su tenant y 404 "… no encontrado"
//      bajo otro tenant (el siguiente de la lista, circular, que esté activo y cuyas
//      listas respondan). Si el otro tenant tiene un elemento PROPIO con el mismo
//      slug, no es fuga (se reporta como INFO). Un 404 solo cuenta como aislamiento
//      si el detalle propio respondió 200 con datos y el cuerpo es el JSON de
//      "no encontrado" de esa colección; si en una colección muestreada ningún
//      cruzado es concluyente, es ERROR (la prueba no demostró nada).
//
// SOLO LECTURA: únicamente GET. Node >= 18 (incluido 18.0: no usa util.parseArgs),
// sin dependencias. Cortacircuitos: tras varios fallos de red seguidos deja de pedir.
//
// Uso:
//   node scripts/verificacion/aislamiento-publico.mjs [--incluir villapesqueira[,otro]]
//        [--solo carbo,sanjavier] [--muestras 3] [--api URL] [--json] [--timeout ms]
//        [--concurrencia 3] [--max-peticiones 500]
//
// Códigos de salida: 0 sin fugas · 1 fuga detectada ·
//                    3 error de red, respuesta inesperada, revisión no concluyente
//                      o argumentos no válidos.

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const VERSION = '1.1.0';
export const API_POR_DEFECTO = 'https://api.northadigital.com';

/** Subrutas públicas por tenant; todas responden un arreglo. */
export const COLECCIONES = [
  'hero', 'noticias', 'sevac', 'estadisticas', 'documentos', 'funcionarios', 'atractivos', 'imagenes',
];

/** Colecciones cuyos elementos DEBEN traer municipioId (si falta: AVISO, no verificable). */
export const COLECCIONES_CON_MUNICIPIO_ID = new Set(['hero', 'estadisticas', 'funcionarios', 'atractivos', 'sevac']);

/** Colecciones con detalle público y la clave con la que se pide cada elemento. */
export const DETALLES = [
  { coleccion: 'noticias', clave: 'slug' },
  { coleccion: 'atractivos', clave: 'slug' },
  { coleccion: 'funcionarios', clave: 'id' },
];

/**
 * Mensaje exacto del 404 de la API cuando el elemento no existe bajo ese tenant.
 * Solo este 404 (JSON) demuestra aislamiento; cualquier otro 404 no es concluyente.
 */
export const MENSAJE_NO_ENCONTRADO = Object.freeze({
  noticias: 'Noticia no encontrada',
  atractivos: 'Atractivo no encontrado',
  funcionarios: 'Funcionario no encontrado',
});

// Uso incorrecto comparte el código 3 con los errores, como el resto de la suite
// (en verificar-alta el 2 es ALTA_PENDIENTE y en medir-publicacion NO_APARECIO).
export const CODIGOS = Object.freeze({ SIN_FUGAS: 0, FUGA: 1, ERROR: 3, USO: 3 });

/** Tipos de hallazgo, de mayor a menor severidad. */
export const TIPOS = ['FUGA', 'ERROR', 'AVISO', 'INFO'];

export const PREDETERMINADOS = Object.freeze({
  muestras: 3,
  timeout: 15000,
  concurrencia: 3,
  maxPeticiones: 500,
  retrasoReintento: 500,
  /** Fallos de red/timeouts seguidos (ya con su reintento) que abren el cortacircuitos. */
  fallosSeguidos: 5,
});

/**
 * Máximo de tenants FUERA de la selección cuyas listas se cargan para usarlos como
 * "otro" en el detalle cruzado (p. ej. con --solo de un único tenant).
 */
export const MAX_OTROS_EXTERNOS = 3;

const PATRON_SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export class ErrorUso extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorUso';
  }
}

export const AYUDA = `aislamiento-publico.mjs v${VERSION}
Prueba de aislamiento entre tenants sobre la API PÚBLICA (solo GET) de CMS Municipal.
Complementa a suite-aislamiento.mjs (rutas autenticadas); no la reemplaza.

Uso:
  node aislamiento-publico.mjs [opciones]

Opciones:
  --incluir a[,b]        Slugs a revisar aunque no aparezcan en /api/municipios. Se
                         resuelven con GET /api/municipios/<slug>; si responde 404 se
                         avisa "aún no dado de alta" y se omiten. Repetible.
  --solo a[,b]           Revisa solo estos slugs (sensible a mayúsculas). Repetible.
                         Si ninguno existe es ERROR (código 3), salvo que todos estén
                         pendientes de alta vía --incluir (AVISO).
  --muestras N           Elementos por colección para el detalle cruzado (por
                         defecto ${PREDETERMINADOS.muestras}; 0 desactiva el detalle).
  --api URL              Base de la API (por defecto ${API_POR_DEFECTO}).
  --json                 Salida JSON (máquina) en lugar de texto.
  --timeout ms           Tiempo máximo por petición (por defecto ${PREDETERMINADOS.timeout}).
  --concurrencia N       Peticiones simultáneas máximas, 1 a 10 (por defecto ${PREDETERMINADOS.concurrencia}).
  --max-peticiones N     Tope de peticiones de la corrida (por defecto ${PREDETERMINADOS.maxPeticiones}).
  -h, --ayuda            Muestra esta ayuda.

Qué revisa:
  1. municipioId de cada elemento de hero, estadisticas, funcionarios, atractivos,
     sevac (y documentos/imagenes/noticias si lo traen) = id del tenant.
  2. Ids repetidos entre tenants distintos en la misma colección.
  3. Detalle de noticias/atractivos (por slug) y funcionarios (por id): 200 bajo su
     tenant y 404 {"error":"… no encontrado"} bajo el siguiente tenant (circular)
     que esté activo y cuyas listas respondan. Un 404 solo cuenta como aislamiento
     si el detalle propio dio 200; si en una colección ningún cruzado es
     concluyente, es ERROR.

Códigos de salida:
  0  sin fugas
  1  fuga detectada
  3  error de red, respuesta inesperada, revisión no concluyente (p. ej. 0 tenants
     revisados) o argumentos no válidos
Una FUGA tiene prioridad sobre un ERROR al elegir el código.

Tras ${PREDETERMINADOS.fallosSeguidos} fallos de red o timeouts seguidos se da la API por caída y no se
hacen más peticiones (ERROR, código 3).
Colores solo en terminal (TTY) y si NO_COLOR no está definida.

Ejemplos:
  node aislamiento-publico.mjs --solo carbo,sanjavier,bacadehuachi --muestras 2
  node aislamiento-publico.mjs --incluir villapesqueira --solo carbo,villapesqueira --muestras 1
  node aislamiento-publico.mjs --json > aislamiento.json
`;

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

function enteroEnRango(texto, nombre, min, max, predeterminado) {
  if (texto === undefined) return predeterminado;
  const limpio = String(texto).trim();
  if (!/^\d+$/.test(limpio)) throw new ErrorUso(`--${nombre} debe ser un entero (recibido: "${texto}")`);
  const n = Number(limpio);
  if (n < min || n > max) throw new ErrorUso(`--${nombre} debe estar entre ${min} y ${max} (recibido: ${n})`);
  return n;
}

/** Une valores repetidos y separados por comas; valida y quita duplicados conservando el orden. */
export function listaDeSlugs(valores, nombre = 'slug') {
  const salida = [];
  for (const valor of [valores].flat()) {
    if (valor === undefined || valor === null) continue;
    for (const parte of String(valor).split(',')) {
      const slug = parte.trim();
      if (!slug) continue;
      if (!PATRON_SLUG.test(slug)) throw new ErrorUso(`--${nombre}: slug no válido "${slug}"`);
      if (!salida.includes(slug)) salida.push(slug);
    }
  }
  return salida;
}

/** Normaliza la base de la API: sin barra final, sin query y sin un "/api" final. */
export function normalizarApi(texto) {
  let url;
  try {
    url = new URL(String(texto));
  } catch {
    throw new ErrorUso(`--api no es una URL válida: "${texto}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ErrorUso(`--api debe usar http o https (recibido: ${url.protocol})`);
  }
  let ruta = url.pathname.replace(/\/+$/, '');
  if (ruta.endsWith('/api')) ruta = ruta.slice(0, -4);
  return url.origin + ruta;
}

/** Opciones del CLI: 'texto' lleva valor; 'bandera' no. */
const OPCIONES_CLI = Object.freeze({
  incluir: { tipo: 'texto', multiple: true },
  solo: { tipo: 'texto', multiple: true },
  muestras: { tipo: 'texto' },
  api: { tipo: 'texto' },
  json: { tipo: 'bandera' },
  timeout: { tipo: 'texto' },
  concurrencia: { tipo: 'texto' },
  'max-peticiones': { tipo: 'texto' },
  ayuda: { tipo: 'bandera' },
});
const OPCIONES_CORTAS = Object.freeze({ h: 'ayuda' });

/**
 * Lee argv sin dependencias (util.parseArgs no existe en Node 18.0–18.2 y su
 * import estático rompería el script antes de poder dar un código de salida).
 * Acepta "--opcion valor" y "--opcion=valor"; --incluir y --solo se pueden repetir;
 * en las demás gana la última aparición. Lanza ErrorUso ante opciones desconocidas,
 * posicionales o una opción de texto sin valor.
 */
export function leerArgv(argv) {
  const valores = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = String(argv[i]);
    let nombre;
    let valor;
    if (arg.startsWith('--') && arg.length > 2) {
      const igual = arg.indexOf('=');
      nombre = igual === -1 ? arg.slice(2) : arg.slice(2, igual);
      valor = igual === -1 ? undefined : arg.slice(igual + 1);
    } else if (/^-[A-Za-z]$/.test(arg)) {
      nombre = OPCIONES_CORTAS[arg[1]];
      if (!nombre) throw new ErrorUso(`opción desconocida: ${arg}`);
    } else {
      throw new ErrorUso(`argumento inesperado: "${arg}" (las opciones empiezan con --)`);
    }
    const def = Object.prototype.hasOwnProperty.call(OPCIONES_CLI, nombre) ? OPCIONES_CLI[nombre] : null;
    if (!def) throw new ErrorUso(`opción desconocida: --${nombre}`);
    if (def.tipo === 'bandera') {
      if (valor !== undefined) throw new ErrorUso(`--${nombre} no lleva valor`);
      valores[nombre] = true;
      continue;
    }
    if (valor === undefined) {
      const siguiente = argv[i + 1];
      if (siguiente === undefined || String(siguiente).startsWith('-')) {
        throw new ErrorUso(`--${nombre} necesita un valor (para un valor que empiece con "-" usa --${nombre}=valor)`);
      }
      valor = String(siguiente);
      i++;
    }
    if (def.multiple) {
      if (!valores[nombre]) valores[nombre] = [];
      valores[nombre].push(valor);
    } else {
      valores[nombre] = valor;
    }
  }
  return valores;
}

export function parsearArgumentos(argv) {
  const valores = leerArgv(argv);
  if (valores.ayuda) return { ayuda: true };
  const solo = valores.solo ? listaDeSlugs(valores.solo, 'solo') : null;
  if (solo && solo.length === 0) throw new ErrorUso('--solo necesita al menos un slug');
  return {
    ayuda: false,
    api: normalizarApi(valores.api ?? API_POR_DEFECTO),
    incluir: listaDeSlugs(valores.incluir ?? [], 'incluir'),
    solo,
    muestras: enteroEnRango(valores.muestras, 'muestras', 0, 50, PREDETERMINADOS.muestras),
    json: Boolean(valores.json),
    timeout: enteroEnRango(valores.timeout, 'timeout', 1, 600000, PREDETERMINADOS.timeout),
    concurrencia: enteroEnRango(valores.concurrencia, 'concurrencia', 1, 10, PREDETERMINADOS.concurrencia),
    maxPeticiones: enteroEnRango(valores['max-peticiones'], 'max-peticiones', 1, 100000, PREDETERMINADOS.maxPeticiones),
  };
}

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

export const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

const esVacio = (v) => v === undefined || v === null || v === '';

/**
 * Máximo de peticiones que hará la corrida (sin contar reintentos).
 * `otrosExternos`: tenants que NO están en la selección y podrían usarse como "otro"
 * del detalle cruzado; de cada uno (hasta MAX_OTROS_EXTERNOS) se cargan las listas
 * de las colecciones con detalle.
 */
export function estimarPeticiones({ tenants, muestras, resoluciones = 0, otrosExternos = 0 }) {
  const externos = muestras > 0 && tenants > 0 ? Math.min(Math.max(otrosExternos, 0), MAX_OTROS_EXTERNOS) : 0;
  return 1 + resoluciones + tenants * COLECCIONES.length + tenants * DETALLES.length * muestras * 2 +
    externos * DETALLES.length;
}

/**
 * Candidatos a tenant "otro" para el detalle cruzado de `slug`, en orden de
 * preferencia (determinista): primero los demás de la selección, en orden circular
 * desde `slug`; después los de la lista completa que no están en la selección,
 * también en orden circular. Los inactivos (activo === false) se excluyen.
 */
export function candidatosOtro(seleccion, todos, slug) {
  const circular = (base) => {
    const i = base.findIndex((t) => t.slug === slug);
    const salida = [];
    for (let k = 1; k <= base.length; k++) {
      const t = base[((i === -1 ? -1 : i) + k + base.length) % base.length];
      if (t && t.slug !== slug) salida.push(t);
    }
    return salida;
  };
  const enSeleccion = new Set(seleccion.map((t) => t.slug));
  const deSeleccion = circular(seleccion);
  const externos = circular(todos).filter((t) => !enSeleccion.has(t.slug));
  return [...deSeleccion, ...externos].filter((t) => t.activo !== false);
}

/** Primer candidato de `candidatosOtro` (sin mirar si sus listas responden). */
export function elegirOtro(seleccion, todos, slug) {
  return candidatosOtro(seleccion, todos, slug)[0] ?? null;
}

/** Primeros n elementos con clave utilizable (string o número no vacío), sin repetir clave. */
export function muestrear(elementos, clave, n) {
  const salida = [];
  const vistos = new Set();
  if (!Array.isArray(elementos) || n <= 0) return salida;
  for (const el of elementos) {
    if (salida.length >= n) break;
    if (!esObjeto(el)) continue;
    const valor = el[clave];
    if ((typeof valor !== 'string' && typeof valor !== 'number') || String(valor) === '') continue;
    if (vistos.has(String(valor))) continue;
    vistos.add(String(valor));
    salida.push(el);
  }
  return salida;
}

export function hallazgo(tipo, { tenants = [], coleccion = null, mensaje, datos } = {}) {
  const h = { tipo, tenants: [...new Set(tenants.filter(Boolean))], coleccion, mensaje };
  if (datos !== undefined) h.datos = datos;
  return h;
}

/** Nombre legible del dueño de un municipioId. */
function nombreDueno(municipioId, duenoPorId) {
  return duenoPorId?.get(municipioId) ?? 'desconocido';
}

/** Regla 2: todo municipioId presente en la lista debe ser el del tenant. */
export function revisarMunicipioIds(tenant, coleccion, elementos, duenoPorId = new Map()) {
  const hallazgos = [];
  let sinMunicipioId = 0;
  let noObjetos = 0;
  for (const el of Array.isArray(elementos) ? elementos : []) {
    if (!esObjeto(el)) {
      noObjetos++;
      continue;
    }
    if (esVacio(el.municipioId)) {
      sinMunicipioId++;
      continue;
    }
    if (el.municipioId !== tenant.id) {
      const dueno = duenoPorId.get(el.municipioId);
      hallazgos.push(hallazgo('FUGA', {
        tenants: [tenant.slug, dueno],
        coleccion,
        mensaje: `${tenant.slug}/${coleccion}: el elemento ${el.id ?? '(sin id)'} trae municipioId ` +
          `${el.municipioId} (${dueno ?? 'desconocido'}); se esperaba ${tenant.id}`,
        datos: { elementoId: el.id ?? null, municipioId: el.municipioId, esperado: tenant.id, duenoAparente: dueno ?? null },
      }));
    }
  }
  if (sinMunicipioId > 0 && COLECCIONES_CON_MUNICIPIO_ID.has(coleccion)) {
    hallazgos.push(hallazgo('AVISO', {
      tenants: [tenant.slug],
      coleccion,
      mensaje: `${tenant.slug}/${coleccion}: ${sinMunicipioId} elemento(s) sin municipioId; no se puede verificar su pertenencia`,
      datos: { sinMunicipioId },
    }));
  }
  if (noObjetos > 0) {
    hallazgos.push(hallazgo('AVISO', {
      tenants: [tenant.slug],
      coleccion,
      mensaje: `${tenant.slug}/${coleccion}: ${noObjetos} elemento(s) no son objetos; se ignoran`,
    }));
  }
  return hallazgos;
}

/**
 * Regla 3: ids repetidos entre tenants distintos en la misma colección.
 * @param {{slug: string, listas: Record<string, any[]|null>}[]} tenants  en orden.
 */
export function detectarIdsRepetidos(tenants) {
  const hallazgos = [];
  for (const coleccion of COLECCIONES) {
    const porId = new Map();
    for (const t of tenants) {
      const lista = t.listas?.[coleccion];
      if (!Array.isArray(lista)) continue;
      for (const el of lista) {
        if (!esObjeto(el) || esVacio(el.id)) continue;
        const id = String(el.id);
        if (!porId.has(id)) porId.set(id, []);
        const slugs = porId.get(id);
        if (!slugs.includes(t.slug)) slugs.push(t.slug);
      }
    }
    for (const [id, slugs] of porId) {
      if (slugs.length < 2) continue;
      hallazgos.push(hallazgo('FUGA', {
        tenants: slugs,
        coleccion,
        mensaje: `${coleccion}: el id ${id} aparece en ${slugs.length} tenants (${slugs.join(', ')})`,
        datos: { id, tenants: slugs },
      }));
    }
  }
  return hallazgos;
}

/** Un 404 que no prueba aislamiento: la ruta o el municipio no existen. */
export function es404NoConcluyente(cuerpo) {
  const msg = esObjeto(cuerpo) && typeof cuerpo.error === 'string' ? cuerpo.error : '';
  return /^Ruta no encontrada/i.test(msg) || /^Municipio\b.*no encontrado/i.test(msg);
}

/**
 * ¿Es el 404 que la API da cuando el ELEMENTO no existe bajo ese tenant?
 * Exige cuerpo JSON con `error` igual al mensaje de la colección (MENSAJE_NO_ENCONTRADO);
 * un 404 HTML de un proxy, `{}` o `{"message":"Not Found"}` no cuentan.
 */
export function es404DeElemento(coleccion, r) {
  if (!r || r.estado !== 404 || r.jsonInvalido || !esObjeto(r.cuerpo) || typeof r.cuerpo.error !== 'string') return false;
  const esperado = MENSAJE_NO_ENCONTRADO[coleccion];
  if (!esperado) return false;
  return r.cuerpo.error.trim().replace(/\.$/, '').toLowerCase() === esperado.toLowerCase();
}

/** Motivo legible por el que un 404 no demuestra aislamiento. */
function motivo404(coleccion, r) {
  if (es404NoConcluyente(r.cuerpo)) return 'la ruta o el municipio no existen';
  const esperado = MENSAJE_NO_ENCONTRADO[coleccion];
  const pista = esperado ? `se esperaba {"error":"${esperado}"}` : 'colección sin detalle';
  if (r.jsonInvalido || r.cuerpo === undefined) return `cuerpo no JSON; ${pista}`;
  return `mensaje inesperado; ${pista}`;
}

export function describirRespuesta(r) {
  if (!r) return 'sin respuesta';
  if (r.estado === 0) return r.error ?? 'error de red';
  const msg = esObjeto(r.cuerpo) && typeof r.cuerpo.error === 'string' ? ` "${r.cuerpo.error}"` : '';
  const extra = r.jsonInvalido ? ' (cuerpo no JSON)' : '';
  return `HTTP ${r.estado}${msg}${extra}`;
}

/**
 * Cuerpo de un detalle con 200: 'datos' (objeto con claves), 'vacio' (null, {}, [])
 * o 'inesperado' (no JSON, arreglo con elementos, primitivo).
 */
export function tipoCuerpoDetalle(r) {
  if (r.jsonInvalido) return 'inesperado';
  const d = r.cuerpo;
  if (d === undefined || d === null) return 'vacio';
  if (Array.isArray(d)) return d.length === 0 ? 'vacio' : 'inesperado';
  if (esObjeto(d)) return Object.keys(d).length === 0 ? 'vacio' : 'datos';
  return 'inesperado';
}

const mismoValor = (a, b) => !esVacio(a) && !esVacio(b) && String(a) === String(b);

/**
 * Detalle de un elemento pedido bajo SU tenant: se espera 200 y municipioId propio.
 * `valido` indica si hubo 200 con datos: solo entonces un 404 bajo otro tenant
 * demuestra aislamiento (si el propio tampoco responde, el 404 cruzado no prueba nada).
 */
export function clasificarDetallePropio({ tenant, coleccion, clave, valor, elemento, respuesta, duenoPorId = new Map() }) {
  const r = respuesta;
  const ref = `${tenant.slug}/${coleccion}/${valor}`;
  const ruta = r.ruta ?? rutaDetalle(tenant.slug, coleccion, valor);
  const base = { tenants: [tenant.slug], coleccion };
  if (r.estado === 404 && es404DeElemento(coleccion, r)) {
    // La lista lo muestra y el detalle dice que no existe: incoherencia de la API, no fuga.
    return {
      resultado: 'aviso',
      valido: false,
      hallazgos: [hallazgo('AVISO', {
        ...base,
        mensaje: `${ref}: aparece en la lista pero su detalle respondió ${describirRespuesta(r)}; no se pudo verificar`,
      })],
    };
  }
  if (r.estado !== 200) {
    const extra = r.estado === 404 ? `; ${motivo404(coleccion, r)}` : '';
    return {
      resultado: 'error',
      valido: false,
      hallazgos: [hallazgo('ERROR', {
        ...base,
        mensaje: `GET ${ruta} → ${describirRespuesta(r)} (se esperaba 200: el elemento aparece en la lista de ${tenant.slug}${extra})`,
      })],
    };
  }
  const tipo = tipoCuerpoDetalle(r);
  if (tipo === 'inesperado') {
    return {
      resultado: 'error',
      valido: false,
      hallazgos: [hallazgo('ERROR', { ...base, mensaje: `${ref}: el detalle respondió 200 con un cuerpo inesperado` })],
    };
  }
  if (tipo === 'vacio') {
    return {
      resultado: 'aviso',
      valido: false,
      hallazgos: [hallazgo('AVISO', { ...base, mensaje: `${ref}: el detalle respondió 200 sin datos` })],
    };
  }
  const d = r.cuerpo;
  if (!esVacio(d.municipioId) && d.municipioId !== tenant.id) {
    const dueno = duenoPorId.get(d.municipioId);
    return {
      resultado: 'fuga',
      valido: true,
      hallazgos: [hallazgo('FUGA', {
        tenants: [tenant.slug, dueno],
        coleccion,
        mensaje: `${ref}: el detalle trae municipioId ${d.municipioId} (${dueno ?? 'desconocido'}); se esperaba ${tenant.id}`,
        datos: { municipioId: d.municipioId, esperado: tenant.id, id: d.id ?? null },
      })],
    };
  }
  const avisos = [];
  if (esVacio(d.municipioId)) {
    avisos.push(hallazgo('AVISO', { ...base, mensaje: `${ref}: el detalle no trae municipioId; no se puede verificar su pertenencia` }));
  }
  if (!esVacio(d[clave]) && String(d[clave]) !== String(valor)) {
    avisos.push(hallazgo('AVISO', { ...base, mensaje: `${ref}: el detalle devolvió ${clave} "${d[clave]}" (se pidió "${valor}")` }));
  } else if (!esVacio(elemento?.id) && !esVacio(d.id) && String(d.id) !== String(elemento.id)) {
    avisos.push(hallazgo('AVISO', { ...base, mensaje: `${ref}: el detalle trae id ${d.id} y la lista ${elemento.id}` }));
  }
  return { resultado: avisos.length ? 'aviso' : 'ok', valido: true, hallazgos: avisos };
}

/**
 * Detalle de un elemento de `tenant` pedido bajo la ruta de `otro`: se espera 404
 * con el JSON de "no encontrado" de la colección ('aislado'). Cualquier otro 404
 * (ruta o municipio inexistentes, HTML de un proxy, mensaje distinto) es 'aviso'
 * no concluyente. `listaOtro` es la lista pública de `otro` para esa colección
 * (o null si no se pudo leer); solo hace falta cuando la respuesta es 200.
 * Ojo: 'aislado' solo demuestra aislamiento si el detalle propio respondió 200
 * (eso lo decide ejecutar() con `valido` de clasificarDetallePropio).
 */
export function clasificarDetalleCruzado({
  tenant, otro, coleccion, clave, valor, elemento, respuesta, listaOtro = null, duenoPorId = new Map(),
}) {
  const r = respuesta;
  const ruta = r.ruta ?? rutaDetalle(otro.slug, coleccion, valor);
  const ref = `${tenant.slug}/${coleccion}/${valor}`;
  const base = { tenants: [tenant.slug, otro.slug], coleccion };
  if (r.estado === 404) {
    if (es404DeElemento(coleccion, r)) return { resultado: 'aislado', hallazgos: [] };
    return {
      resultado: 'aviso',
      hallazgos: [hallazgo('AVISO', {
        ...base,
        mensaje: `GET ${ruta} → ${describirRespuesta(r)}: 404 no concluyente (${motivo404(coleccion, r)})`,
      })],
    };
  }
  if (r.estado !== 200) {
    return {
      resultado: 'error',
      hallazgos: [hallazgo('ERROR', { ...base, mensaje: `GET ${ruta} → ${describirRespuesta(r)} (se esperaba 404)` })],
    };
  }
  const tipo = tipoCuerpoDetalle(r);
  if (tipo === 'inesperado') {
    return {
      resultado: 'error',
      hallazgos: [hallazgo('ERROR', { ...base, mensaje: `GET ${ruta} → 200 con un cuerpo inesperado (se esperaba 404)` })],
    };
  }
  if (tipo === 'vacio') {
    return {
      resultado: 'aviso',
      hallazgos: [hallazgo('AVISO', { ...base, mensaje: `GET ${ruta} → 200 sin datos (se esperaba 404)` })],
    };
  }

  const d = r.cuerpo;
  const datos = { ruta, pedido: valor, idOrigen: elemento?.id ?? null, idRespuesta: d.id ?? null, municipioIdRespuesta: d.municipioId ?? null };
  const fuga = (mensaje) => ({ resultado: 'fuga', hallazgos: [hallazgo('FUGA', { ...base, mensaje, datos })] });

  if (mismoValor(d.id, elemento?.id)) {
    return fuga(`GET ${ruta} → 200 con el MISMO elemento (id ${d.id}) de ${ref}: el detalle de ${tenant.slug} es accesible bajo ${otro.slug}`);
  }
  const propioOtro = Array.isArray(listaOtro)
    ? listaOtro.find((x) => esObjeto(x) && mismoValor(x[clave], valor))
    : undefined;

  if (!esVacio(d.municipioId)) {
    if (d.municipioId === otro.id) {
      if (propioOtro) {
        return {
          resultado: 'info',
          hallazgos: [hallazgo('INFO', {
            ...base,
            mensaje: `${otro.slug} tiene su propio elemento en ${coleccion} con ${clave} "${valor}" ` +
              `(id ${d.id ?? '?'}, distinto de ${elemento?.id ?? '?'} de ${tenant.slug}); coincidencia legítima, no es fuga`,
            datos,
          })],
        };
      }
      return {
        resultado: 'aviso',
        hallazgos: [hallazgo('AVISO', {
          ...base,
          mensaje: `GET ${ruta} → 200 con un elemento de ${otro.slug} que no aparece en su lista pública` +
            `${Array.isArray(listaOtro) ? '' : ' (no se pudo leer esa lista)'}; no es fuga de ${tenant.slug}, ` +
            'pero revisa si expone un borrador',
          datos,
        })],
      };
    }
    const dueno = d.municipioId === tenant.id ? tenant.slug : nombreDueno(d.municipioId, duenoPorId);
    return fuga(`GET ${ruta} → 200 con un elemento de ${dueno} (municipioId ${d.municipioId}) bajo la ruta de ${otro.slug}`);
  }

  // Sin municipioId en la respuesta: solo se acepta si coincide con un elemento propio del otro tenant.
  if (propioOtro && mismoValor(propioOtro.id, d.id)) {
    return {
      resultado: 'info',
      hallazgos: [hallazgo('INFO', {
        ...base,
        mensaje: `${otro.slug} tiene su propio elemento en ${coleccion} con ${clave} "${valor}" (id ${d.id}); ` +
          'coincidencia legítima, no es fuga',
        datos,
      })],
    };
  }
  return fuga(`GET ${ruta} → 200 con datos sin municipioId que no corresponden a ningún elemento propio de ${otro.slug} (se esperaba 404)`);
}

/** 0 sin fugas, 1 si hay alguna FUGA, 3 si hay ERROR y ninguna FUGA. */
export function calcularCodigo(hallazgos) {
  if (hallazgos.some((h) => h.tipo === 'FUGA')) return CODIGOS.FUGA;
  if (hallazgos.some((h) => h.tipo === 'ERROR')) return CODIGOS.ERROR;
  return CODIGOS.SIN_FUGAS;
}

export function contarPorTipo(hallazgos) {
  const cuenta = { FUGA: 0, ERROR: 0, AVISO: 0, INFO: 0 };
  for (const h of hallazgos) cuenta[h.tipo] = (cuenta[h.tipo] ?? 0) + 1;
  return cuenta;
}

// ---------------------------------------------------------------------------
// HTTP (solo GET) con timeout, 1 reintento y concurrencia limitada
// ---------------------------------------------------------------------------

export function crearLimitador(maximo) {
  let activos = 0;
  const cola = [];
  const siguiente = () => {
    while (activos < maximo && cola.length > 0) {
      const { fn, resolver, rechazar } = cola.shift();
      activos++;
      Promise.resolve()
        .then(fn)
        .then(resolver, rechazar)
        .finally(() => {
          activos--;
          siguiente();
        });
    }
  };
  return (fn) => new Promise((resolver, rechazar) => {
    cola.push({ fn, resolver, rechazar });
    siguiente();
  });
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function describirErrorRed(err) {
  const causa = err?.cause;
  const codigo = causa?.code ?? err?.code;
  const detalle = codigo ?? causa?.message ?? err?.message ?? String(err);
  return `error de red: ${detalle}`;
}

/**
 * Cliente de solo lectura. `get(ruta)` nunca lanza: devuelve
 * { ruta, estado (0 = sin respuesta), ok, cuerpo, jsonInvalido, error, intentos, ms, omitida }.
 *
 * `omitida: true` = la petición no se hizo (o quedó a medias) porque se alcanzó el
 * tope (--max-peticiones) o porque el cortacircuitos está abierto: tras
 * `fallosSeguidos` get() seguidos sin respuesta (error de red o timeout, ya con su
 * reintento) se da la API por caída y el resto se omite al instante, sin esperar
 * timeouts. Cualquier respuesta HTTP (incluso 5xx) reinicia la cuenta. 0 lo desactiva.
 */
export function crearCliente({
  api,
  timeout = PREDETERMINADOS.timeout,
  concurrencia = PREDETERMINADOS.concurrencia,
  maxPeticiones = Infinity,
  retrasoReintento = PREDETERMINADOS.retrasoReintento,
  fallosSeguidos = PREDETERMINADOS.fallosSeguidos,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch no disponible: se requiere Node >= 18');
  const estadisticas = {
    peticiones: 0,
    reintentos: 0,
    agotado: false,
    cortado: false,
    fallosSeguidos: 0,
    omitidas: 0,
    motivoCorte: null,
  };
  const limitar = crearLimitador(concurrencia);

  async function intento(url) {
    if (estadisticas.cortado) {
      return { estado: 0, error: 'omitida: la API dejó de responder (cortacircuitos abierto)', omitida: true };
    }
    if (estadisticas.peticiones >= maxPeticiones) {
      estadisticas.agotado = true;
      return { estado: 0, error: `omitida: tope de peticiones alcanzado (--max-peticiones ${maxPeticiones})`, omitida: true };
    }
    estadisticas.peticiones++;
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), timeout);
    const t0 = Date.now();
    try {
      const resp = await fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: control.signal,
      });
      const texto = await resp.text();
      let cuerpo;
      let jsonInvalido = false;
      if (texto.trim() !== '') {
        try {
          cuerpo = JSON.parse(texto);
        } catch {
          jsonInvalido = true;
        }
      }
      return { estado: resp.status, cuerpo, jsonInvalido, ms: Date.now() - t0 };
    } catch (err) {
      const error = control.signal.aborted ? `sin respuesta en ${timeout} ms (timeout)` : describirErrorRed(err);
      return { estado: 0, error, ms: Date.now() - t0 };
    } finally {
      clearTimeout(temporizador);
    }
  }

  function get(ruta) {
    return limitar(async () => {
      const url = api + ruta;
      let r = await intento(url);
      let intentos = 1;
      if (!r.omitida && (r.estado === 0 || r.estado >= 500)) {
        if (retrasoReintento > 0) await esperar(retrasoReintento);
        const r2 = await intento(url);
        // Si el reintento se omite (tope o cortacircuitos), vale el resultado real del primero.
        if (!r2.omitida) {
          estadisticas.reintentos++;
          r = r2;
          intentos = 2;
        }
      }
      if (r.omitida) {
        estadisticas.omitidas++;
      } else if (r.estado === 0) {
        estadisticas.fallosSeguidos++;
        if (fallosSeguidos > 0 && estadisticas.fallosSeguidos >= fallosSeguidos && !estadisticas.cortado) {
          estadisticas.cortado = true;
          estadisticas.motivoCorte = r.error ?? 'sin respuesta';
        }
      } else {
        estadisticas.fallosSeguidos = 0;
      }
      return {
        ruta,
        estado: r.estado,
        ok: r.estado >= 200 && r.estado < 300,
        cuerpo: r.cuerpo,
        jsonInvalido: Boolean(r.jsonInvalido),
        error: r.error ?? null,
        intentos,
        ms: r.ms ?? 0,
        omitida: Boolean(r.omitida),
      };
    });
  }

  return { get, estadisticas };
}

const seg = (s) => encodeURIComponent(String(s));
const rutaMunicipio = (slug) => `/api/municipios/${seg(slug)}`;
const rutaLista = (slug, coleccion) => `${rutaMunicipio(slug)}/${coleccion}`;
const rutaDetalle = (slug, coleccion, valor) => `${rutaLista(slug, coleccion)}/${seg(valor)}`;

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

/**
 * Corre la prueba completa y devuelve el informe (no escribe en consola).
 * Lanza ErrorUso si el presupuesto estimado supera --max-peticiones.
 * `dependencias`: { fetchImpl, retrasoReintento, fallosSeguidos } (para pruebas).
 */
export async function ejecutar(opciones, dependencias = {}) {
  const o = {
    api: API_POR_DEFECTO,
    incluir: [],
    solo: null,
    muestras: PREDETERMINADOS.muestras,
    timeout: PREDETERMINADOS.timeout,
    concurrencia: PREDETERMINADOS.concurrencia,
    maxPeticiones: PREDETERMINADOS.maxPeticiones,
    ...opciones,
  };
  const inicio = Date.now();
  const limiteFallos = dependencias.fallosSeguidos ?? PREDETERMINADOS.fallosSeguidos;
  const cliente = crearCliente({
    api: o.api,
    timeout: o.timeout,
    concurrencia: o.concurrencia,
    maxPeticiones: o.maxPeticiones,
    retrasoReintento: dependencias.retrasoReintento ?? PREDETERMINADOS.retrasoReintento,
    fallosSeguidos: limiteFallos,
    fetchImpl: dependencias.fetchImpl ?? globalThis.fetch,
  });
  const est = cliente.estadisticas;
  const hallazgos = [];
  const informe = {
    herramienta: 'aislamiento-publico',
    version: VERSION,
    api: o.api,
    fecha: new Date().toISOString(),
    parametros: {
      muestras: o.muestras,
      concurrencia: o.concurrencia,
      timeout: o.timeout,
      maxPeticiones: o.maxPeticiones,
      incluir: o.incluir,
      solo: o.solo,
    },
    tenantsListados: null,
    tenants: [],
    omitidos: [],
    hallazgos,
    peticiones: null,
    resumen: null,
    codigo: null,
    resultado: null,
    duracionMs: null,
  };
  let estimado = null;
  /** Tenants con alguna petición omitida (tope o cortacircuitos): su revisión quedó incompleta. */
  const incompletos = new Set();
  const incompleta = () => est.cortado || est.agotado;

  const cerrar = () => {
    if (incompleta()) {
      const motivo = est.cortado
        ? `la API dejó de responder (${limiteFallos} peticiones seguidas sin respuesta; última: ${est.motivoCorte}) ` +
          'y se cortaron las demás para no esperar sus timeouts'
        : `se alcanzó el tope de ${o.maxPeticiones} peticiones (--max-peticiones)`;
      hallazgos.push(hallazgo('ERROR', {
        tenants: [...incompletos],
        mensaje: `Revisión incompleta: ${motivo}; ${est.omitidas} petición(es) omitida(s)`,
        datos: { cortacircuitos: est.cortado, topeAlcanzado: est.agotado, omitidas: est.omitidas },
      }));
    }
    const cuenta = contarPorTipo(hallazgos);
    for (const t of informe.tenants) {
      const propios = hallazgos.filter((h) => h.tenants.includes(t.slug));
      const c = contarPorTipo(propios);
      t.fugas = c.FUGA;
      t.errores = c.ERROR;
      t.avisos = c.AVISO;
      t.infos = c.INFO;
      t.estado = c.FUGA ? 'FUGA' : c.ERROR ? 'ERROR' : 'OK';
    }
    informe.peticiones = {
      total: est.peticiones,
      reintentos: est.reintentos,
      omitidas: est.omitidas,
      cortacircuitos: est.cortado,
      estimadoMaximo: estimado,
      maximoPermitido: o.maxPeticiones,
    };
    informe.resumen = {
      tenantsRevisados: informe.tenants.length,
      tenantsConFuga: informe.tenants.filter((t) => t.estado === 'FUGA').map((t) => t.slug),
      fugas: cuenta.FUGA,
      errores: cuenta.ERROR,
      avisos: cuenta.AVISO,
      infos: cuenta.INFO,
    };
    informe.codigo = calcularCodigo(hallazgos);
    informe.resultado = informe.codigo === CODIGOS.FUGA ? 'FUGA DETECTADA'
      : informe.codigo === CODIGOS.ERROR ? 'ERROR' : 'SIN FUGAS';
    informe.duracionMs = Date.now() - inicio;
    return informe;
  };

  // 1. Lista de tenants --------------------------------------------------------
  const rLista = await cliente.get('/api/municipios');
  if (rLista.estado !== 200 || !Array.isArray(rLista.cuerpo)) {
    hallazgos.push(hallazgo('ERROR', {
      mensaje: `No se pudo obtener la lista de municipios: GET /api/municipios → ${describirRespuesta(rLista)}` +
        (rLista.estado === 200 ? ' (no es un arreglo)' : ''),
    }));
    return cerrar();
  }
  informe.tenantsListados = rLista.cuerpo.length;
  const listaVacia = rLista.cuerpo.length === 0;
  if (listaVacia) {
    // Con 14 tenants dados de alta, un [] es una falla (caché, base de datos o despliegue), no "sin fugas".
    hallazgos.push(hallazgo('ERROR', {
      mensaje: 'GET /api/municipios respondió una lista vacía: la API no expone ningún tenant (¿caché o base de datos vacía?)',
    }));
  }
  const todos = [];
  for (const m of rLista.cuerpo) {
    if (!esObjeto(m) || typeof m.id !== 'string' || !m.id || typeof m.slug !== 'string' || !m.slug) {
      hallazgos.push(hallazgo('AVISO', { mensaje: 'GET /api/municipios trae un elemento sin id o slug válidos; se ignora' }));
      continue;
    }
    const repetido = todos.find((t) => t.slug === m.slug || t.id === m.id);
    if (repetido) {
      hallazgos.push(hallazgo('AVISO', {
        tenants: [m.slug, repetido.slug],
        mensaje: `GET /api/municipios repite slug o id (${m.slug} / ${m.id}); se usa la primera aparición`,
      }));
      continue;
    }
    todos.push({ id: m.id, slug: m.slug, nombre: m.nombre ?? null, activo: m.activo, origen: 'lista' });
  }

  // 1b. --incluir -------------------------------------------------------------
  const omitidos = new Set();
  /** Slugs de --incluir que respondieron 404: aún no dados de alta. */
  const pendientes = new Set();
  const aResolver = o.incluir.filter((slug) => !todos.some((t) => t.slug === slug));
  for (const slug of o.incluir) {
    if (!aResolver.includes(slug)) {
      hallazgos.push(hallazgo('INFO', { tenants: [slug], mensaje: `--incluir ${slug}: ya aparece en /api/municipios` }));
    }
  }
  const resoluciones = await Promise.all(aResolver.map(async (slug) => ({ slug, r: await cliente.get(rutaMunicipio(slug)) })));
  for (const { slug, r } of resoluciones) {
    if (r.omitida) {
      omitidos.add(slug);
      informe.omitidos.push({ slug, motivo: 'petición omitida' });
    } else if (r.estado === 404) {
      omitidos.add(slug);
      pendientes.add(slug);
      informe.omitidos.push({ slug, motivo: 'aún no dado de alta' });
      hallazgos.push(hallazgo('AVISO', {
        tenants: [slug],
        mensaje: `${slug}: aún no dado de alta (GET /api/municipios/${slug} → ${describirRespuesta(r)}); se omite`,
      }));
    } else if (r.estado === 200 && esObjeto(r.cuerpo) && typeof r.cuerpo.id === 'string' && r.cuerpo.id) {
      if (r.cuerpo.slug !== undefined && r.cuerpo.slug !== slug) {
        hallazgos.push(hallazgo('AVISO', {
          tenants: [slug],
          mensaje: `GET /api/municipios/${slug} devolvió el slug "${r.cuerpo.slug}"; se usa "${slug}" para las rutas`,
        }));
      }
      if (todos.some((t) => t.id === r.cuerpo.id)) {
        const dueno = todos.find((t) => t.id === r.cuerpo.id);
        hallazgos.push(hallazgo('AVISO', {
          tenants: [slug, dueno.slug],
          mensaje: `--incluir ${slug}: resuelve al mismo id que ${dueno.slug} (${r.cuerpo.id}); se omite`,
        }));
        omitidos.add(slug);
        informe.omitidos.push({ slug, motivo: `mismo id que ${dueno.slug}` });
        continue;
      }
      todos.push({ id: r.cuerpo.id, slug, nombre: r.cuerpo.nombre ?? null, activo: r.cuerpo.activo, origen: 'incluir' });
      hallazgos.push(hallazgo('INFO', {
        tenants: [slug],
        mensaje: `${slug}: no aparece en /api/municipios pero GET /api/municipios/${slug} responde 200; se incluye`,
      }));
    } else {
      hallazgos.push(hallazgo('ERROR', {
        tenants: [slug],
        mensaje: `--incluir ${slug}: GET /api/municipios/${slug} → ${describirRespuesta(r)} (se esperaba 200 o 404)`,
      }));
      omitidos.add(slug);
      informe.omitidos.push({ slug, motivo: 'no se pudo resolver' });
    }
  }

  // 1c. --solo ----------------------------------------------------------------
  let seleccion = todos;
  if (o.solo) {
    seleccion = todos.filter((t) => o.solo.includes(t.slug));
    for (const slug of o.solo) {
      if (!todos.some((t) => t.slug === slug) && !omitidos.has(slug)) {
        hallazgos.push(hallazgo('AVISO', {
          tenants: [slug],
          mensaje: `--solo ${slug}: no está entre los tenants (el slug distingue mayúsculas; usa --incluir si no aparece en /api/municipios)`,
        }));
      }
    }
  }
  if (seleccion.length === 0) {
    estimado = estimarPeticiones({ tenants: 0, muestras: o.muestras, resoluciones: aResolver.length });
    // Revisar 0 tenants no demuestra nada: es ERROR, salvo que todo lo pedido con --solo
    // esté pendiente de alta (--incluir con 404), que es el caso "aún no dado de alta".
    const soloPendientes = Boolean(o.solo) && o.solo.every((slug) => pendientes.has(slug));
    if (soloPendientes) {
      hallazgos.push(hallazgo('AVISO', { mensaje: 'No hay tenants que revisar: los de --solo aún no están dados de alta' }));
    } else if (!listaVacia) {
      hallazgos.push(hallazgo('ERROR', {
        mensaje: 'No hay tenants que revisar: ' + (o.solo
          ? `ningún slug de --solo (${o.solo.join(', ')}) está entre los tenants (el slug distingue mayúsculas)`
          : 'ningún elemento de /api/municipios trae id y slug válidos'),
      }));
    }
    return cerrar();
  }

  // 5. Presupuesto ------------------------------------------------------------
  const otrosExternos = todos.filter((t) => !seleccion.includes(t) && t.activo !== false).length;
  estimado = estimarPeticiones({
    tenants: seleccion.length, muestras: o.muestras, resoluciones: aResolver.length, otrosExternos,
  });
  if (estimado > o.maxPeticiones) {
    throw new ErrorUso(
      `el máximo estimado de peticiones (${estimado}) supera --max-peticiones ${o.maxPeticiones}; ` +
      'reduce --muestras, usa --solo o sube el tope',
    );
  }

  const duenoPorId = new Map(todos.map((t) => [t.id, t.slug]));
  const resumenPorSlug = new Map();
  for (const t of seleccion) {
    const resumen = {
      slug: t.slug,
      id: t.id,
      nombre: t.nombre,
      origen: t.origen,
      otro: null,
      colecciones: Object.fromEntries(COLECCIONES.map((c) => [c, null])),
      detalle: { propios: 0, propiosOk: 0, cruzados: 0, aislados: 0, infos: 0, noConcluyentes: 0 },
      fugas: 0,
      errores: 0,
      avisos: 0,
      infos: 0,
      estado: 'OK',
    };
    resumenPorSlug.set(t.slug, resumen);
    informe.tenants.push(resumen);
  }

  // 2. Listas -----------------------------------------------------------------
  const listas = new Map(seleccion.map((t) => [t.slug, {}]));
  const respuestasListas = await Promise.all(
    seleccion.flatMap((t) => COLECCIONES.map(async (coleccion) => ({ t, coleccion, r: await cliente.get(rutaLista(t.slug, coleccion)) }))),
  );
  for (const { t, coleccion, r } of respuestasListas) {
    listas.get(t.slug)[coleccion] = null;
    if (r.omitida) {
      incompletos.add(t.slug);
      continue;
    }
    if (r.estado === 200 && Array.isArray(r.cuerpo)) {
      listas.get(t.slug)[coleccion] = r.cuerpo;
      resumenPorSlug.get(t.slug).colecciones[coleccion] = r.cuerpo.length;
      hallazgos.push(...revisarMunicipioIds(t, coleccion, r.cuerpo, duenoPorId));
      continue;
    }
    const inactivo = t.activo === false && r.estado === 404;
    hallazgos.push(hallazgo(inactivo ? 'AVISO' : 'ERROR', {
      tenants: [t.slug],
      coleccion,
      mensaje: `GET ${r.ruta} → ${describirRespuesta(r)}` +
        (r.estado === 200 ? ' (se esperaba un arreglo)' : inactivo ? ' (tenant inactivo)' : ' (se esperaba 200)'),
    }));
  }

  // 3. Ids repetidos entre tenants --------------------------------------------
  hallazgos.push(...detectarIdsRepetidos(seleccion.map((t) => ({ slug: t.slug, listas: listas.get(t.slug) }))));

  // 4. Detalle cruzado --------------------------------------------------------
  const tareas = [];
  if (o.muestras > 0) {
    for (const t of seleccion) {
      for (const { coleccion, clave } of DETALLES) {
        for (const elemento of muestrear(listas.get(t.slug)[coleccion], clave, o.muestras)) {
          tareas.push({ t, coleccion, clave, valor: String(elemento[clave]), elemento });
        }
      }
    }
  }

  // 4a. Tenant de contraste ("otro"): el siguiente (circular) que esté activo y cuyas
  // listas de noticias/atractivos/funcionarios respondan; si no hay en la selección,
  // se prueban hasta MAX_OTROS_EXTERNOS de la lista completa (sus listas se cargan
  // aquí y ya cuentan en el estimado).
  const enSeleccion = new Set(seleccion.map((t) => t.slug));
  const listasDetalleOk = (slug) => DETALLES.every(({ coleccion }) => Array.isArray(listas.get(slug)?.[coleccion]));
  const externos = new Map();
  const cargarExterno = (t) => {
    if (!externos.has(t.slug)) {
      if (externos.size >= MAX_OTROS_EXTERNOS) return Promise.resolve(false);
      externos.set(t.slug, (async () => {
        const rs = await Promise.all(DETALLES.map(async ({ coleccion }) => ({ coleccion, r: await cliente.get(rutaLista(t.slug, coleccion)) })));
        const propias = {};
        const fallidas = [];
        for (const { coleccion, r } of rs) {
          const ok = r.estado === 200 && Array.isArray(r.cuerpo);
          propias[coleccion] = ok ? r.cuerpo : null;
          if (!ok && !r.omitida) fallidas.push(`GET ${r.ruta} → ${describirRespuesta(r)}`);
        }
        listas.set(t.slug, propias);
        if (fallidas.length) {
          hallazgos.push(hallazgo('AVISO', {
            tenants: [t.slug],
            mensaje: `${t.slug} no sirve como tenant de contraste: ${fallidas.join('; ')}`,
          }));
        }
        return listasDetalleOk(t.slug);
      })());
    }
    return externos.get(t.slug);
  };

  const otroPorSlug = new Map();
  let avisadoUnico = false;
  for (const t of seleccion.filter((x) => tareas.some((tarea) => tarea.t === x))) {
    let otro = null;
    for (const candidato of candidatosOtro(seleccion, todos, t.slug)) {
      if (enSeleccion.has(candidato.slug)) {
        if (listasDetalleOk(candidato.slug)) {
          otro = candidato;
          break;
        }
        continue;
      }
      if (await cargarExterno(candidato)) {
        otro = candidato;
        break;
      }
    }
    resumenPorSlug.get(t.slug).otro = otro?.slug ?? null;
    if (otro) {
      otroPorSlug.set(t.slug, otro);
    } else if (incompleta()) {
      incompletos.add(t.slug);
    } else if (todos.length < 2) {
      if (!avisadoUnico) {
        avisadoUnico = true;
        hallazgos.push(hallazgo('AVISO', { mensaje: 'Solo hay un tenant en la API: no se puede probar el detalle cruzado' }));
      }
    } else {
      hallazgos.push(hallazgo('ERROR', {
        tenants: [t.slug],
        mensaje: `${t.slug}: no hay tenant de contraste para el detalle cruzado (los demás están inactivos o sus ` +
          `listas no respondieron; se probaron hasta ${MAX_OTROS_EXTERNOS} fuera de la selección); no se probó el aislamiento del detalle`,
      }));
    }
  }

  // 4b. Propio y cruzado ------------------------------------------------------
  const resultados = await Promise.all(tareas.map(async (tarea) => {
    const { t, coleccion, valor } = tarea;
    const otro = otroPorSlug.get(t.slug) ?? null;
    const [propia, cruzada] = await Promise.all([
      cliente.get(rutaDetalle(t.slug, coleccion, valor)),
      otro ? cliente.get(rutaDetalle(otro.slug, coleccion, valor)) : Promise.resolve(null),
    ]);
    return { tarea, otro, propia, cruzada };
  }));
  /** slug → colección → { cruzados, concluyentes } */
  const evidencia = new Map();
  const anotar = (slug, coleccion, concluyente) => {
    if (!evidencia.has(slug)) evidencia.set(slug, {});
    const e = evidencia.get(slug);
    if (!e[coleccion]) e[coleccion] = { cruzados: 0, concluyentes: 0 };
    e[coleccion].cruzados++;
    if (concluyente) e[coleccion].concluyentes++;
  };
  for (const { tarea, otro, propia, cruzada } of resultados) {
    const { t, coleccion, clave, valor, elemento } = tarea;
    const det = resumenPorSlug.get(t.slug).detalle;
    let p = null;
    if (propia.omitida) {
      incompletos.add(t.slug);
    } else {
      p = clasificarDetallePropio({ tenant: t, coleccion, clave, valor, elemento, respuesta: propia, duenoPorId });
      det.propios++;
      if (p.resultado === 'ok') det.propiosOk++;
      hallazgos.push(...p.hallazgos);
    }
    if (!cruzada) continue;
    if (cruzada.omitida) {
      incompletos.add(t.slug);
      continue;
    }
    const c = clasificarDetalleCruzado({
      tenant: t, otro, coleccion, clave, valor, elemento, respuesta: cruzada,
      listaOtro: listas.get(otro.slug)?.[coleccion] ?? null, duenoPorId,
    });
    det.cruzados++;
    hallazgos.push(...c.hallazgos);
    if (c.resultado === 'aislado' && p?.valido) {
      // 404 "no encontrado" bajo el otro Y 200 con datos bajo el propio: aislamiento demostrado.
      det.aislados++;
      anotar(t.slug, coleccion, true);
    } else if (c.resultado === 'info') {
      det.infos++;
      anotar(t.slug, coleccion, true);
    } else if (c.resultado === 'aislado' || c.resultado === 'aviso') {
      // Un 404 cruzado sin 200 propio (o un 404/200 raro) no demuestra nada.
      det.noConcluyentes++;
      anotar(t.slug, coleccion, false);
    } else {
      anotar(t.slug, coleccion, false);
    }
  }

  // 4c. Colecciones muestreadas sin ninguna evidencia de aislamiento → ERROR.
  // (Si la corrida quedó incompleta, el ERROR de "revisión incompleta" ya lo cubre.)
  if (!incompleta()) {
    for (const t of seleccion) {
      const otro = otroPorSlug.get(t.slug);
      const e = evidencia.get(t.slug);
      if (!otro || !e) continue;
      const sinEvidencia = DETALLES.map((d) => d.coleccion).filter((c) => e[c] && e[c].concluyentes === 0);
      if (!sinEvidencia.length) continue;
      hallazgos.push(hallazgo('ERROR', {
        tenants: [t.slug],
        mensaje: `${t.slug}: el detalle cruzado bajo ${otro.slug} no fue concluyente en ${sinEvidencia.join(', ')} ` +
          `(ningún elemento dio 200 bajo ${t.slug} y 404 "… no encontrado" bajo ${otro.slug}); no se demostró el aislamiento`,
        datos: { otro: otro.slug, colecciones: sinEvidencia },
      }));
    }
  }

  return cerrar();
}

// ---------------------------------------------------------------------------
// Salida de texto
// ---------------------------------------------------------------------------

export function usarColor(stream, env = process.env) {
  return Boolean(stream?.isTTY) && env.NO_COLOR === undefined && env.TERM !== 'dumb';
}

function crearPintor(color) {
  const envolver = (codigo) => (texto) => (color ? `\x1b[${codigo}m${texto}\x1b[0m` : String(texto));
  return { rojo: envolver('31'), verde: envolver('32'), amarillo: envolver('33'), cian: envolver('36'), negrita: envolver('1'), tenue: envolver('2') };
}

export function formatearTexto(informe, { color = false } = {}) {
  const c = crearPintor(color);
  const pintarTipo = { FUGA: c.rojo, ERROR: c.rojo, AVISO: c.amarillo, INFO: c.cian, OK: c.verde };
  const etiqueta = (tipo) => (pintarTipo[tipo] ?? String)(tipo.padEnd(5));
  const p = informe.parametros;
  const l = [];

  l.push(c.negrita('Aislamiento público entre tenants') + ` · ${informe.api}`);
  l.push(
    `Tenants en /api/municipios: ${informe.tenantsListados ?? '?'} · revisados: ${informe.tenants.length}` +
    ` · muestras: ${p.muestras} · concurrencia: ${p.concurrencia} · timeout: ${p.timeout} ms`,
  );
  if (p.solo) l.push(`--solo: ${p.solo.join(', ')}`);
  if (p.incluir?.length) l.push(`--incluir: ${p.incluir.join(', ')}`);

  if (informe.tenants.length) {
    l.push('', c.negrita('Por tenant'));
    for (const t of informe.tenants) {
      l.push(`  ${etiqueta(t.estado)}  ${c.negrita(t.slug)}${t.nombre ? ` (${t.nombre})` : ''}  ${c.tenue(t.id)}` +
        (t.origen === 'incluir' ? c.tenue('  [--incluir]') : ''));
      l.push(`         listas: ${COLECCIONES.map((k) => `${k} ${t.colecciones[k] ?? '—'}`).join(' · ')}`);
      const d = t.detalle;
      if (p.muestras === 0) {
        l.push('         detalle: desactivado (--muestras 0)');
      } else if (d.propios === 0) {
        l.push('         detalle: sin elementos que muestrear');
      } else {
        const cruz = t.otro
          ? `cruzado bajo ${t.otro}: ${d.aislados}/${d.cruzados} con 404 concluyente` +
            (d.infos ? ` · ${d.infos} coincidencia(s) legítima(s)` : '') +
            (d.noConcluyentes ? ` · ${d.noConcluyentes} no concluyente(s)` : '')
          : 'cruzado: sin tenant de contraste';
        l.push(`         detalle: propio ${d.propiosOk}/${d.propios} con 200 · ${cruz}`);
      }
      const partes = [];
      if (t.fugas) partes.push(c.rojo(`${t.fugas} FUGA`));
      if (t.errores) partes.push(c.rojo(`${t.errores} ERROR`));
      if (t.avisos) partes.push(c.amarillo(`${t.avisos} AVISO`));
      if (t.infos) partes.push(c.cian(`${t.infos} INFO`));
      if (partes.length) l.push(`         hallazgos: ${partes.join(' · ')}`);
    }
  }

  if (informe.hallazgos.length) {
    l.push('', c.negrita('Hallazgos'));
    for (const tipo of TIPOS) {
      for (const h of informe.hallazgos.filter((x) => x.tipo === tipo)) {
        l.push(`  ${etiqueta(tipo)}  ${h.mensaje}`);
      }
    }
  }

  const r = informe.resumen;
  const pet = informe.peticiones;
  l.push('', c.negrita('Resumen'));
  l.push(`  Tenants revisados: ${r.tenantsRevisados}` +
    (r.tenantsConFuga.length ? ` · con fuga: ${r.tenantsConFuga.join(', ')}` : ''));
  l.push(`  Hallazgos: ${r.fugas} FUGA · ${r.errores} ERROR · ${r.avisos} AVISO · ${r.infos} INFO`);
  l.push(`  Peticiones GET: ${pet.total} (reintentos: ${pet.reintentos}` +
    (pet.omitidas ? ` · omitidas: ${pet.omitidas}${pet.cortacircuitos ? ' por cortacircuitos' : ''}` : '') +
    (pet.estimadoMaximo !== null ? ` · máximo estimado: ${pet.estimadoMaximo}` : '') +
    ` · tope: ${pet.maximoPermitido}) · ${(informe.duracionMs / 1000).toFixed(1)} s`);
  const color_ = informe.codigo === CODIGOS.SIN_FUGAS ? c.verde : c.rojo;
  l.push(`  Resultado: ${color_(c.negrita(informe.resultado))} (código ${informe.codigo})`);
  return l.join('\n');
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

export async function main(argv = process.argv.slice(2)) {
  let opciones;
  try {
    opciones = parsearArgumentos(argv);
  } catch (err) {
    if (!(err instanceof ErrorUso)) throw err;
    process.stderr.write(`Error: ${err.message}\nUsa --ayuda para ver las opciones.\n`);
    return CODIGOS.USO;
  }
  if (opciones.ayuda) {
    process.stdout.write(AYUDA);
    return CODIGOS.SIN_FUGAS;
  }
  if (typeof globalThis.fetch !== 'function') {
    process.stderr.write('Error: este Node no tiene fetch global; se requiere Node >= 18.\n');
    return CODIGOS.ERROR;
  }
  let informe;
  try {
    informe = await ejecutar(opciones);
  } catch (err) {
    if (err instanceof ErrorUso) {
      process.stderr.write(`Error: ${err.message}\n`);
      return CODIGOS.USO;
    }
    process.stderr.write(`Error inesperado: ${err?.stack ?? err}\n`);
    return CODIGOS.ERROR;
  }
  const salida = opciones.json
    ? JSON.stringify(informe, null, 2)
    : formatearTexto(informe, { color: usarColor(process.stdout) });
  process.stdout.write(`${salida}\n`);
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
    (codigo) => { process.exitCode = codigo; },
    (err) => {
      process.stderr.write(`Error inesperado: ${err?.stack ?? err}\n`);
      process.exitCode = CODIGOS.ERROR;
    },
  );
}
