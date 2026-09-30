// Pruebas de medir-publicacion.mjs con node:test y un servidor HTTP local (node:http, puerto 0)
// que simula la API de CMS Municipal y el portal Next.js, incluidos casos de fallo.
// Ejecutar (Node >= 18.6):
//   node --test scripts/verificacion/

import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as mp from './medir-publicacion.mjs';

const { test } = nodeTest;
// describe() llegó a node:test en Node 18.6: en versiones anteriores cada bloque se marca como omitido
// con el motivo, en vez de fallar la carga del archivo con un SyntaxError en inglés.
const describe = nodeTest.describe
  ?? ((nombre) => test(nombre, { skip: `se requiere Node >= 18.6 para estas pruebas (este es ${process.version})` }));

const SCRIPT = fileURLToPath(new URL('./medir-publicacion.mjs', import.meta.url));
const ID_MUNICIPIO = '11111111-2222-4333-8444-555555555555';
const ID_NOTICIA = '9f02194d-f2eb-4221-8682-b6c612f203f3';

// ---------------------------------------------------------------------------
// Servidor simulado (API + portal)
// ---------------------------------------------------------------------------

/** Escapa texto como lo hace React al renderizar (& < > " '). */
function escaparComoReact(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const NOTICIAS_BASE = [
  { id: 'n-vieja-1', titulo: 'Bacheo en la calle principal', slug: 'bacheo-en-la-calle-principal', extracto: null, imagenUrl: null, categoria: 'general', publicarEn: '2026-09-20T00:00:00.000Z', creadoEn: '2026-09-20T10:00:00.000Z' },
  { id: 'n-vieja-2', titulo: 'Jornada de salud', slug: 'jornada-de-salud', extracto: null, imagenUrl: null, categoria: 'general', publicarEn: '2026-09-18T00:00:00.000Z', creadoEn: '2026-09-18T10:00:00.000Z' },
];

/** creadoEn relativo al reloj de quien corre las pruebas (la verificación de copias viejas lo compara con Date). */
const haceUnaHora = () => new Date(Date.now() - 3_600_000).toISOString();

function noticiaDe(titulo, slug = 'prueba-villa-pesqueira', { id = ID_NOTICIA, creadoEn = haceUnaHora() } = {}) {
  return { id, titulo, slug, extracto: null, imagenUrl: null, categoria: 'general', publicarEn: '2026-09-30T00:00:00.000Z', creadoEn };
}

function paginaHtml(cuerpo, titulo = 'Portal municipal') {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title></head><body>${cuerpo}</body></html>`;
}

/** Tarjetas como las del portal real: cada título va dentro de un enlace a su detalle. */
function listaHtml(noticias) {
  return noticias.map((n) => `<article><a href="/acciones-de-gobierno/noticias/${n.slug}"><h3>${escaparComoReact(n.titulo)}</h3>`
    + '<p>Leer más</p></a></article>').join('\n');
}

/**
 * Escenario por defecto. Tiempos en ms:
 *  - apiDesdeMs: desde la primera petición recibida hasta que la noticia sale en la lista de la API.
 *  - portal[clave].retrasoMs: desde que la API entregó la noticia por primera vez hasta que la página la muestra.
 * Infinity = nunca.
 */
function escenarioBase(extra = {}) {
  const titulo = extra.titulo ?? 'Prueba Villa Pesqueira';
  const noticia = extra.noticia ?? noticiaDe(titulo);
  const conNoticia = (visible) => (visible ? [noticia] : []).concat(NOTICIAS_BASE);
  return {
    slug: 'villapesqueira',
    noticia,
    apiDesdeMs: 0,
    fallar500Api: 0,
    portal: {
      home: {
        retrasoMs: 0,
        html: (visible) => paginaHtml(`<h1>Bienvenidos</h1>${listaHtml(conNoticia(visible))}`),
        cabeceras: (visible) => (visible ? { 'x-vercel-cache': 'MISS', age: '0' } : { 'x-vercel-cache': 'HIT', age: '120' }),
      },
      acciones: {
        retrasoMs: 0,
        html: (visible) => paginaHtml(`<h1>Acciones de gobierno</h1>${listaHtml(conNoticia(visible))}`),
        cabeceras: (visible) => (visible ? { 'x-vercel-cache': 'REVALIDATED', age: '0' } : { 'x-vercel-cache': 'HIT', age: '45' }),
      },
      detalle: {
        retrasoMs: 0,
        html: () => paginaHtml(`<article><h1>${escaparComoReact(noticia.titulo)}</h1><p>Contenido</p></article>`, `${escaparComoReact(noticia.titulo)} · Municipio`),
        cabeceras: () => ({ 'x-vercel-cache': 'MISS' }),
      },
    },
    ...extra,
  };
}

function enviar(res, status, cuerpo, cabeceras = {}) {
  res.writeHead(status, cabeceras);
  res.end(cuerpo);
}

function enviarJson(res, status, cuerpo) {
  enviar(res, status, JSON.stringify(cuerpo), { 'content-type': 'application/json; charset=utf-8' });
}

function enviarHtml(res, status, html, cabeceras = {}) {
  enviar(res, status, html, { 'content-type': 'text/html; charset=utf-8', ...cabeceras });
}

/**
 * Levanta el servidor simulado. Registra cada petición recibida con:
 *   { metodo, ruta, t (ms desde la primera petición), noticiaYaEntregada (la API ya había
 *     devuelto la noticia en la lista antes de esta petición) }.
 */
async function iniciarServidor(e) {
  const registro = [];
  const estado = { t0: null, entregadaEn: null, peticionesApi: 0, isr: {} };

  const servidor = http.createServer((req, res) => {
    const ahora = Date.now();
    if (estado.t0 === null) estado.t0 = ahora;
    const url = new URL(req.url, 'http://local');
    const ruta = url.pathname;
    registro.push({ metodo: req.method, ruta, t: ahora - estado.t0, noticiaYaEntregada: estado.entregadaEn !== null });

    const partes = ruta.split('/').filter(Boolean).map(decodeURIComponent);
    // Gancho para escenarios especiales (caídas, redirecciones, cuelgues): si devuelve true, ya respondió.
    if (e.interceptar?.(req, res, { ruta, partes, estado, ahora })) return undefined;
    if (partes[0] === 'api' && partes[1] === 'municipios') {
      const slug = partes[2];
      if (slug !== e.slug) return enviarJson(res, 404, { error: `Municipio '${slug}' no encontrado` });
      if (partes.length !== 4 || partes[3] !== 'noticias') return enviarJson(res, 404, { error: 'Ruta no encontrada', path: ruta });
      estado.peticionesApi++;
      if (estado.peticionesApi <= e.fallar500Api) return enviarJson(res, 500, { error: 'Error interno' });
      const visible = ahora - estado.t0 >= e.apiDesdeMs;
      if (visible && estado.entregadaEn === null) estado.entregadaEn = ahora;
      return enviarJson(res, 200, visible ? [e.noticia, ...NOTICIAS_BASE] : NOTICIAS_BASE);
    }

    const visiblePara = (clave) => estado.entregadaEn !== null && ahora - estado.entregadaEn >= e.portal[clave].retrasoMs;
    // ISR como en Vercel (stale-while-revalidate): la copia se generó al arrancar; al vencer la
    // ventana se sirve una vez vencida (STALE) y se regenera con lo que haya en la API en ese momento.
    const paginaIsr = (clave) => {
      const cfg = e.portal[clave];
      const copia = estado.isr[clave] ?? (estado.isr[clave] = { generadaEn: estado.t0, visible: false });
      const edadMs = ahora - copia.generadaEn;
      let cache = 'HIT';
      if (edadMs >= cfg.isrS * 1000) {
        cache = 'STALE';
        estado.isr[clave] = { generadaEn: ahora, visible: estado.entregadaEn !== null };
      }
      return enviarHtml(res, 200, cfg.html(copia.visible), {
        'x-vercel-cache': cache, age: String(Math.floor(edadMs / 1000)), 'x-nextjs-stale-time': String(cfg.isrS),
      });
    };
    const pagina = (clave) => {
      if (e.portal[clave].isrS) return paginaIsr(clave);
      const visible = visiblePara(clave);
      return enviarHtml(res, 200, e.portal[clave].html(visible), e.portal[clave].cabeceras(visible));
    };
    if (ruta === '/') return pagina('home');
    if (ruta === '/acciones-de-gobierno') return pagina('acciones');
    if (partes[0] === 'acciones-de-gobierno' && partes[1] === 'noticias' && partes.length === 3) {
      if (partes[2] === e.noticia.slug && visiblePara('detalle')) {
        return enviarHtml(res, 200, e.portal.detalle.html(true), e.portal.detalle.cabeceras(true));
      }
      return enviarHtml(res, 404, paginaHtml('<h1>404</h1><p>Esta página no existe.</p>'), { 'x-vercel-cache': 'HIT', age: '5' });
    }
    return enviarHtml(res, 404, paginaHtml('<h1>404</h1>'));
  });

  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return {
    base,
    registro,
    estado,
    cerrar: () => new Promise((resolver) => {
      servidor.closeAllConnections?.();
      servidor.close(() => resolver());
    }),
  };
}

/** Un puerto local sin nadie escuchando (conexión rechazada). */
async function puertoCerrado() {
  const s = http.createServer();
  await new Promise((resolver) => s.listen(0, '127.0.0.1', resolver));
  const { port } = s.address();
  await new Promise((resolver) => s.close(resolver));
  return `http://127.0.0.1:${port}`;
}

function flujo({ tty = false } = {}) {
  let texto = '';
  return {
    isTTY: tty,
    write(trozo) {
      texto += trozo;
      return true;
    },
    get texto() {
      return texto;
    },
  };
}

/** Ejecuta main() en proceso contra el servidor simulado. */
async function correr(argv, { env = {}, senal } = {}) {
  const stdout = flujo();
  const stderr = flujo();
  const codigo = await mp.main(argv, { stdout, stderr, env, esperaReintentoMs: 0, senal });
  return { codigo, stdout: stdout.texto, stderr: stderr.texto };
}

function argumentos(base, extra = []) {
  return ['--slug', 'villapesqueira', '--portal', base, '--api', base, '--titulo', 'Prueba Villa Pesqueira',
    '--intervalo', '0.05', '--limite', '4', '--timeout', '3000', ...extra];
}

async function conServidor(escenario, fn) {
  const srv = await iniciarServidor(escenario);
  try {
    return await fn(srv);
  } finally {
    await srv.cerrar();
  }
}

const esDetalle = (r) => r.ruta.startsWith('/acciones-de-gobierno/noticias/');
const esPortal = (r) => !r.ruta.startsWith('/api/');

/** Afirmaciones de solo lectura y de orden que valen para cualquier medición. */
function afirmarReglasComunes(registro) {
  assert.ok(registro.length > 0, 'el servidor debe haber recibido peticiones');
  assert.ok(registro.every((r) => r.metodo === 'GET'), `solo GET: ${[...new Set(registro.map((r) => r.metodo))].join(', ')}`);
  assert.ok(!registro.some((r) => r.ruta === '/noticias' || r.ruta.startsWith('/noticias/')), 'nunca debe pedir /noticias del portal');
  const antes = registro.filter((r) => esDetalle(r) && !r.noticiaYaEntregada);
  assert.deepEqual(antes, [], 'no debe pedir el detalle antes de que la noticia exista en la API');
  const portalAntes = registro.filter((r) => esPortal(r) && !r.noticiaYaEntregada);
  assert.deepEqual(portalAntes, [], 'no debe sondear el portal antes de t_api');
}

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

describe('normalización de títulos y HTML', () => {
  test('normalizarTitulo: minúsculas, sin acentos, espacios colapsados, tipografía ASCII', () => {
    assert.equal(mp.normalizarTitulo('  CARBÓ  presente\u00a0en la\n APERTURA '), 'carbo presente en la apertura');
    assert.equal(mp.normalizarTitulo('Niños “felices” — año ‘26’'), 'ninos "felices" - ano \'26\'');
    assert.equal(mp.normalizarTitulo('Inauguracio\u0301n'), 'inauguracion');
    assert.equal(mp.normalizarTitulo('se\u00admá\u200bforo'), 'semaforo');
    assert.equal(mp.normalizarTitulo(mp.normalizarTitulo('Él Ñandú')), 'el nandu');
  });

  test('decodificarEntidades con nombre y numéricas', () => {
    assert.equal(mp.decodificarEntidades('Rock &amp; roll &#x27;son&#39; &quot;m&aacute;s&quot; &Ntilde; &#241; &desconocida;'),
      'Rock & roll \'son\' "más" Ñ ñ &desconocida;');
  });

  test('htmlContieneTitulo: entidades, acentos, etiquetas intercaladas y payload RSC', () => {
    const titulo = 'Inauguración del “Parque” Niños & Jóvenes \'Sonora\'';
    assert.ok(mp.htmlContieneTitulo('<h3>Inauguraci&oacute;n del &ldquo;Parque&rdquo; Ni&#241;os &amp; J&#xF3;venes &#x27;Sonora&#x27;</h3>', titulo));
    assert.ok(mp.htmlContieneTitulo('<h3>INAUGURACIÓN DEL <em>“Parque”</em>\n   Niños <!-- -->&amp;<!-- --> Jóvenes &#39;Sonora&#39;</h3>', titulo));
    assert.ok(mp.htmlContieneTitulo(
      '<script>self.__next_f.push([1,"{\\"titulo\\":\\"Inauguraci\\u00f3n del \\u201cParque\\u201d Ni\\u00f1os \\u0026 J\\u00f3venes \'Sonora\'\\"}"])</script>',
      titulo,
    ));
    assert.ok(mp.htmlContieneTitulo('<p>inauguracion del "parque" ninos &amp; jovenes \'sonora\'</p>', titulo));
    assert.ok(!mp.htmlContieneTitulo('<h3>Inauguración del “Parque”</h3>', titulo), 'un título parcial no cuenta');
    assert.ok(!mp.htmlContieneTitulo('<h3>Otra noticia</h3>', titulo));
    assert.ok(!mp.htmlContieneTitulo('<h3>x</h3>', '   '), 'un título vacío nunca coincide');
  });

  test('buscarNoticias exige título idéntico normalizado; titulosParecidos da pistas', () => {
    const lista = [
      { titulo: 'CARBÓ PRESENTE EN LA APERTURA DE AUDITORÍAS INTEGRALES 2025.' },
      { titulo: ' Carbó presente en la apertura de auditorías integrales 2025. ' },
      { titulo: 'Otra' },
      null,
      { sinTitulo: true },
    ];
    assert.equal(mp.buscarNoticias(lista, 'carbo presente en la apertura de auditorias integrales 2025.').length, 2);
    assert.equal(mp.buscarNoticias(lista, 'carbo presente en la apertura de auditorias integrales 2025').length, 0);
    assert.deepEqual(mp.titulosParecidos(lista, 'carbo presente en la apertura de auditorias integrales 2025', 1),
      ['CARBÓ PRESENTE EN LA APERTURA DE AUDITORÍAS INTEGRALES 2025.']);
    assert.deepEqual(mp.buscarNoticias('no es lista', 'x'), []);
  });

  test('cabecerasCache y descripciones', () => {
    const h = new Headers({ 'x-vercel-cache': 'HIT', age: '280', 'x-nextjs-stale-time': '300' });
    assert.deepEqual(mp.cabecerasCache(h), { xVercelCache: 'HIT', age: 280, staleTime: 300 });
    assert.deepEqual(mp.cabecerasCache(new Headers()), { xVercelCache: null, age: null, staleTime: null });
    assert.equal(mp.describirCacheBreve({ xVercelCache: 'stale', age: 301 }), 'STALE age=301');
    assert.equal(mp.describirCache({ xVercelCache: null, age: null }), 'sin cabeceras de caché de Vercel');
  });

  test('urlPortal nunca agrega parámetros y rutaDetalle escapa el slug', () => {
    assert.equal(mp.urlPortal('https://x.vercel.app', '/'), 'https://x.vercel.app/');
    assert.equal(mp.urlPortal('https://x.vercel.app', '/acciones-de-gobierno'), 'https://x.vercel.app/acciones-de-gobierno');
    assert.equal(mp.rutaDetalle('a b/c'), '/acciones-de-gobierno/noticias/a%20b%2Fc');
    assert.equal(mp.urlNoticias('https://api.x', 'villapesqueira'), 'https://api.x/api/municipios/villapesqueira/noticias');
  });
});

describe('identidad de la noticia en el HTML: enlace, redirección y edad de la copia', () => {
  const tarjeta = (slug, titulo = 'x') => `<a href="/acciones-de-gobierno/noticias/${slug}"><h3>${titulo}</h3></a>`;

  test('htmlEnlazaNoticia exige la ruta exacta del detalle de ESE slug', () => {
    assert.ok(mp.htmlEnlazaNoticia(tarjeta('trabajos-de-limpieza'), 'trabajos-de-limpieza'));
    assert.ok(!mp.htmlEnlazaNoticia(tarjeta('trabajos-de-limpieza-y-mantenimiento'), 'trabajos-de-limpieza'),
      'un slug que empieza igual es otra noticia');
    assert.ok(!mp.htmlEnlazaNoticia(tarjeta('prueba-villa-pesqueira'), 'prueba-villa-pesqueira-2'), 'la prueba anterior borrada');
    assert.ok(!mp.htmlEnlazaNoticia(tarjeta('prueba-villa-pesqueira-2'), 'prueba-villa-pesqueira'));
    assert.ok(mp.htmlEnlazaNoticia('<a href="https://carbo.example/acciones-de-gobierno/noticias/abc/">', 'abc'), 'absoluta y con barra final');
    assert.ok(mp.htmlEnlazaNoticia("<a href='/acciones-de-gobierno/noticias/abc?x=1'>", 'abc'));
    assert.ok(mp.htmlEnlazaNoticia('self.__next_f.push([1,"{\\"href\\":\\"/acciones-de-gobierno/noticias/abc\\"}"])', 'abc'), 'payload RSC');
    assert.ok(mp.htmlEnlazaNoticia('<a href=/acciones-de-gobierno/noticias/abc>', 'abc'), 'atributo sin comillas');
    assert.ok(!mp.htmlEnlazaNoticia('<a href="/noticias/abc">', 'abc'), 'otra ruta');
    assert.ok(!mp.htmlEnlazaNoticia('<h3>abc</h3>', 'abc'), 'el slug como texto no es un enlace');
    assert.ok(!mp.htmlEnlazaNoticia(tarjeta('abc'), null));
    assert.ok(mp.htmlEnlazaNoticia(tarjeta('a.b'), 'a.b'));
    assert.ok(!mp.htmlEnlazaNoticia(tarjeta('axb'), 'a.b'), 'los caracteres especiales del slug no son comodines');
  });

  test('tarjeta real del portal de Carbó (enlace + alt + título)', () => {
    const html = '<div role="group" aria-label="1 de 3: CARBÓ PRESENTE EN LA APERTURA DE AUDITORÍAS INTEGRALES 2025."><a class="group relative block" '
      + 'href="/acciones-de-gobierno/noticias/carbo-presente-en-la-apertura-de-auditorias-integrales-2025"><img alt="CARBÓ PRESENTE EN LA '
      + 'APERTURA DE AUDITORÍAS INTEGRALES 2025." decoding="async"/></a></div>';
    assert.ok(mp.htmlEnlazaNoticia(html, 'carbo-presente-en-la-apertura-de-auditorias-integrales-2025'));
    assert.ok(mp.htmlContieneTitulo(html, 'Carbó presente en la apertura de auditorías integrales 2025.'));
    assert.ok(!mp.htmlEnlazaNoticia(html, 'carbo-presente-en-la-apertura'));
  });

  test('rutaRedirigida: otra ruta sí; mismo camino con otro dominio o barra final no', () => {
    assert.equal(mp.rutaRedirigida('http://x/acciones-de-gobierno', '/acciones-de-gobierno/noticias/abc'), '/acciones-de-gobierno');
    assert.equal(mp.rutaRedirigida('https://www.x/acciones-de-gobierno/', '/acciones-de-gobierno'), null);
    assert.equal(mp.rutaRedirigida('http://x/', '/'), null);
    assert.equal(mp.rutaRedirigida('http://x/acciones-de-gobierno/noticias/a%20b', '/acciones-de-gobierno/noticias/a%20b'), null);
    assert.equal(mp.rutaRedirigida('', '/'), null, 'sin URL final (fetch simulado) no hay redirección');
  });

  test('copiaAnteriorALaNoticia: age frente al último sondeo de la API sin la noticia', () => {
    assert.match(mp.copiaAnteriorALaNoticia({ age: 120, tRespuesta: 10.2, tSinNoticia: 10 }), /anterior a la noticia \(age=120 s/);
    assert.match(mp.copiaAnteriorALaNoticia({ age: 5, tRespuesta: 12, tSinNoticia: 10 }), /anterior/, 'generada a más tardar en t=7');
    assert.equal(mp.copiaAnteriorALaNoticia({ age: 3, tRespuesta: 12, tSinNoticia: 10 }), null, 'dentro del margen');
    assert.equal(mp.copiaAnteriorALaNoticia({ age: 0, tRespuesta: 10.2, tSinNoticia: 10 }), null);
    assert.equal(mp.copiaAnteriorALaNoticia({ age: null, tRespuesta: 10.2, tSinNoticia: 10 }), null, 'sin cabecera age');
    assert.equal(mp.copiaAnteriorALaNoticia({ age: 120, tRespuesta: 10.2, tSinNoticia: null }), null, 'ya publicada al iniciar');
  });

  test('copiaAnteriorACreacion: Date - age frente a creadoEn (con holgura por relojes)', () => {
    const fechaMs = Date.parse('2026-09-30T20:00:00Z');
    assert.match(mp.copiaAnteriorACreacion({ age: 120, fechaMs, creadoEn: '2026-09-30T19:59:00.000Z' }), /anterior a la creación/);
    assert.equal(mp.copiaAnteriorACreacion({ age: 60, fechaMs, creadoEn: '2026-09-30T19:59:00.000Z' }), null);
    assert.equal(mp.copiaAnteriorACreacion({ age: 120, fechaMs, creadoEn: '2026-09-26T18:58:51.100Z' }), null, 'noticia vieja');
    assert.equal(mp.copiaAnteriorACreacion({ age: 120, fechaMs, creadoEn: 'no es fecha' }), null);
    assert.equal(mp.copiaAnteriorACreacion({ age: 120, fechaMs: null, creadoEn: '2026-09-30T19:59:00.000Z' }), null);
    assert.equal(mp.fechaRespuesta(new Headers({ date: 'Wed, 30 Sep 2026 20:00:00 GMT' })), fechaMs);
    assert.equal(mp.fechaRespuesta(new Headers()), null);
  });

  test('normalizarPortal: solo el origen; rechaza ruta, ?parámetros, #ancla y credenciales', () => {
    assert.equal(mp.normalizarPortal('HTTPS://Carbo.Example:443/'), 'https://carbo.example');
    assert.equal(mp.normalizarPortal('villapesqueira.vercel.app'), 'https://villapesqueira.vercel.app');
    assert.equal(mp.normalizarPortal('http://127.0.0.1:8080//'), 'http://127.0.0.1:8080');
    const casos = [
      ['https://carbo.example/#inicio', /#ancla.*usa https:\/\/carbo\.example\./],
      ['https://carbo.example/?utm=x', /\?parámetros/],
      ['https://carbo.example?', /\?parámetros/],
      ['https://carbo.example/acciones-de-gobierno', /sin ruta.*usa https:\/\/carbo\.example\./],
      ['https://yo:secreto@carbo.example', /usuario ni contraseña/],
    ];
    for (const [portal, patron] of casos) {
      assert.throws(() => mp.normalizarPortal(portal), (err) => err instanceof mp.ErrorUso && patron.test(err.message), portal);
    }
  });

  test('normalizarBaseApi: quita /api final; rechaza ?parámetros y #ancla', () => {
    assert.equal(mp.normalizarBaseApi('http://a/api/'), 'http://a');
    assert.equal(mp.normalizarBaseApi('https://api.northadigital.com'), 'https://api.northadigital.com');
    assert.equal(mp.normalizarBaseApi('http://a/proxy/api'), 'http://a/proxy');
    assert.throws(() => mp.normalizarBaseApi('http://a/?x=1'), /--api no debe llevar/);
    assert.throws(() => mp.normalizarBaseApi('http://a/api#b'), /--api no debe llevar/);
  });

  test('urlPortal construye sobre el origen, sin ? ni #', () => {
    for (const ruta of ['/', '/acciones-de-gobierno', mp.rutaDetalle('prueba-villa-pesqueira')]) {
      const u = new URL(mp.urlPortal('https://carbo.example', ruta));
      assert.equal(u.pathname, ruta);
      assert.equal(u.search + u.hash, '');
    }
  });
});

describe('diagnóstico de caché', () => {
  const s = (t, xVercelCache, age, aparece, status = 200) => ({ t, xVercelCache, age, aparece, status });

  test('REVALIDATED => revalidación bajo demanda', () => {
    assert.match(mp.diagnosticarCache([s(0, 'HIT', 10, false), s(5, 'REVALIDATED', 0, true)]), /bajo demanda/);
  });
  test('copia STALE o edad >= ventana antes de aparecer => vencimiento del ISR', () => {
    assert.match(mp.diagnosticarCache([s(0, 'STALE', 305, false), s(5, 'HIT', 3, true)]), /vencimiento del ISR/);
    assert.match(mp.diagnosticarCache([s(0, 'HIT', 298, false), s(5, 'HIT', 1, true)]), /vencimiento del ISR/);
  });
  test('se renovó con edad < ventana => señal de revalidación bajo demanda', () => {
    assert.match(mp.diagnosticarCache([s(0, 'HIT', 20, false), s(5, 'HIT', 2, true)]), /señal de revalidación bajo demanda/);
  });
  test('siempre MISS => página no cacheada; primer sondeo => no se sabe; cambio de status', () => {
    assert.match(mp.diagnosticarCache([s(0, 'MISS', null, false), s(5, 'MISS', null, true)]), /no se sirve desde caché/);
    assert.match(mp.diagnosticarCache([s(0, 'HIT', 5, true)]), /primer sondeo/);
    assert.match(mp.diagnosticarCache([s(0, 'HIT', 5, false, 404), s(5, 'MISS', null, true)]), /pasó de 404/);
    assert.equal(mp.diagnosticarCache([s(0, 'HIT', 5, false)]), null);
  });
});

describe('evaluar e interpretar', () => {
  const pagina = (t, tras) => ({ t, tras, statusVistos: {}, errores: 0, sinTitulo: 0 });
  const informe = (paginas, extra = {}) => ({
    parametros: { umbralS: 60, limiteS: 600, intervaloS: 5 },
    noticia: { slug: 'x' },
    tApi: 10,
    duracionS: 400,
    yaPublicadaAlIniciar: false,
    slug: 'villapesqueira',
    sondeos: [],
    paginas,
    ...extra,
  });

  test('códigos 0, 1, 2 y 3', () => {
    assert.equal(mp.evaluar(informe({ home: pagina(20, 10), acciones: pagina(21, 11), detalle: pagina(70, 60) })).codigo, 0);
    const lento = mp.evaluar(informe({ home: pagina(320, 310), acciones: pagina(21, 11), detalle: pagina(22, 12) }));
    assert.equal(lento.codigo, 1);
    assert.deepEqual(lento.masLenta, { clave: 'home', tras: 310 });
    assert.equal(mp.evaluar(informe({ home: pagina(null, null), acciones: pagina(21, 11), detalle: pagina(22, 12) })).codigo, 2);
    assert.equal(mp.evaluar(informe({}, { noticia: null })).codigo, 2);
    assert.equal(mp.evaluar(informe({}, { error: 'x' })).codigo, 3);
  });

  test('API o portal fallando al terminar => código 3, no "no apareció"', () => {
    const caida = mp.evaluar(informe({}, { noticia: null, apiCaida: true, apiFallosSeguidos: 2, ultimoErrorApi: '404 "Ruta no encontrada"' }));
    assert.equal(caida.codigo, 3);
    assert.match(caida.mensaje, /los últimos 2 sondeos fallaron \(último: 404 "Ruta no encontrada"\)/);
    const detalleCaido = { t: null, tras: null, statusVistos: {}, errores: 3, fallosSeguidos: 2, ultimoError: 'error de red (ECONNRESET)', sinTitulo: 0 };
    const portal = mp.evaluar(informe({ home: pagina(20, 10), acciones: pagina(21, 11), detalle: detalleCaido }));
    assert.equal(portal.codigo, 3);
    assert.match(portal.mensaje, /El portal dejó de responder: detalle \(error de red \(ECONNRESET\)\)/);
    // Fallos intermedios con el último sondeo bien: sigue siendo "no apareció".
    const intermitente = mp.evaluar(informe({}, { noticia: null, apiCaida: false, erroresApi: 3, apiFallosSeguidos: 0 }));
    assert.equal(intermitente.codigo, 2);
  });

  test('~300 s o más => sin revalidación bajo demanda, con la pista de /api/revalidate', () => {
    const inf = informe({ home: pagina(320, 310), acciones: pagina(21, 11), detalle: pagina(22, 12) });
    Object.assign(inf, mp.evaluar(inf));
    const texto = mp.interpretar(inf).join('\n');
    assert.match(texto, /NO hay revalidación bajo demanda/);
    assert.match(texto, /\/api\/revalidate/);
    assert.match(texto, /POST/);
  });

  test('no apareció con poco tiempo observado => sugiere un --limite mayor', () => {
    const inf = informe({ home: pagina(null, null), acciones: pagina(21, 11), detalle: pagina(22, 12) }, { duracionS: 60 });
    Object.assign(inf, mp.evaluar(inf));
    const texto = mp.interpretar(inf).join('\n');
    assert.match(texto, /--limite 600/);
    assert.match(texto, /portada puede mostrar solo las noticias más recientes/);
  });

  test('interrumpido con Ctrl+C: el mensaje lo dice', () => {
    const inf = informe({}, { noticia: null, interrumpido: true, duracionS: 1.9 });
    assert.match(mp.evaluar(inf).mensaje, /antes de la interrupción \(Ctrl\+C a los 1\.9 s\)/);
    assert.match(mp.evaluar(informe({}, { noticia: null })).mensaje, /antes del límite \(600 s\)/);
  });

  test('senal abortada detiene la medición y marca interrumpido', async () => {
    const controlador = new AbortController();
    controlador.abort();
    const fetchImpl = async () => new Response('[]', { status: 200 });
    const inf = await mp.medirPublicacion({ slug: 's', api: 'http://a', portal: 'http://p', titulo: 'Titulo de prueba largo' },
      { fetchImpl, senal: controlador.signal });
    assert.equal(inf.interrumpido, true);
    assert.equal(inf.codigo, 2);
    assert.equal(inf.peticiones, 0);
  });

  test('limiteSugerido cubre t_api + la ventana ISR + margen (mínimo 600 s)', () => {
    assert.equal(mp.limiteSugerido(0), 600);
    assert.equal(mp.limiteSugerido(100), 600);
    assert.equal(mp.limiteSugerido(300), 660);
    assert.equal(mp.limiteSugerido(null), 600);
  });
});

describe('argumentos', () => {
  test('valores por defecto y normalización', () => {
    const o = mp.analizarArgumentos(['--slug', 'villapesqueira', '--portal', 'villapesqueira.vercel.app/', '--titulo', '  Prueba  ']);
    assert.equal(o.slug, 'villapesqueira');
    assert.equal(o.portal, 'https://villapesqueira.vercel.app');
    assert.equal(o.titulo, 'Prueba');
    assert.equal(o.api, mp.API_POR_DEFECTO);
    assert.equal(o.limiteS, 600);
    assert.equal(o.intervaloS, 5);
    assert.equal(o.umbralS, 60);
    assert.equal(o.timeoutMs, 15000);
    assert.equal(o.json, false);
  });

  test('números con decimales y --api con /api final', () => {
    const o = mp.analizarArgumentos(['--slug', 's', '--portal', 'http://p', '--titulo', 't', '--intervalo', '0,05',
      '--limite', '1.5', '--umbral', '0.3', '--api', 'http://a/api/', '--timeout', '2500', '--json']);
    assert.equal(o.intervaloS, 0.05);
    assert.equal(o.limiteS, 1.5);
    assert.equal(o.umbralS, 0.3);
    assert.equal(o.api, 'http://a');
    assert.equal(o.timeoutMs, 2500);
    assert.equal(o.json, true);
  });

  test('errores de uso', () => {
    const base = ['--slug', 's', '--portal', 'http://p', '--titulo', 't'];
    const casos = [
      [['--portal', 'http://p', '--titulo', 't'], /Falta --slug/],
      [['--slug', 's', '--titulo', 't'], /Falta --portal/],
      [['--slug', 's', '--portal', 'http://p'], /Falta --titulo/],
      [[...base, '--titulo', '   '], /vacío/],
      [[...base, '--intervalo', '0'], /--intervalo/],
      [[...base, '--limite', 'abc'], /--limite/],
      [[...base, '--umbral', '-1'], /--umbral/],
      [[...base, '--timeout', '1.5'], /--timeout/],
      [[...base, '--api', 'ftp://x'], /--api/],
      [[...base, '--portal', 'ftp://x'], /--portal/],
      [[...base, '--desconocida'], /Opción desconocida/],
      [[...base, 'Villa', 'Pesqueira'], /Sobran argumentos/],
      [['--slug', 'a/b', '--portal', 'http://p', '--titulo', 't'], /Slug inválido/],
      [[...base, '--timeout', '2147483648'], /--timeout no puede pasar de 600000 ms/],
      [[...base, '--timeout', '600001'], /--timeout no puede pasar/],
      [[...base, '--limite', '86401'], /--limite no puede pasar de 86400 s/],
      [[...base, '--intervalo', '3601'], /--intervalo no puede pasar de 3600 s/],
      [[...base, '--json=false'], /^La opción --json no lleva valor \(usa solo --json\)\.$/],
      [[...base, '--ayuda=si'], /^La opción --ayuda no lleva valor/],
      [[...base, '--timeout'], /^La opción --timeout requiere un valor\.$/],
      [[...base, '--titulo', '-x'], /empieza con "-"/],
      [[...base, '--portal', 'http://p/#inicio'], /#ancla/],
      [[...base, '--portal', 'http://p/?utm=x'], /\?parámetros/],
      [[...base, '--portal', 'http://p/acciones-de-gobierno'], /sin ruta/],
      [[...base, '--api', 'http://a/?x=1'], /--api no debe llevar/],
    ];
    for (const [argv, patron] of casos) {
      assert.throws(() => mp.analizarArgumentos(argv), (err) => err instanceof mp.ErrorUso && patron.test(err.message), argv.join(' '));
    }
  });

  test('main devuelve 3 con argumentos inválidos y 0 con --ayuda', async () => {
    const malo = await correr(['--slug', 'x']);
    assert.equal(malo.codigo, 3);
    assert.match(malo.stderr, /Falta --portal/);
    const ayuda = await correr(['--ayuda']);
    assert.equal(ayuda.codigo, 0);
    assert.match(ayuda.stdout, /USO/);
    assert.match(ayuda.stdout, /\/api\/revalidate/);
    assert.match(ayuda.stdout, /CÓDIGOS DE SALIDA/);
    assert.match(ayuda.stdout, /Node >= 18\.3/);
  });

  test('topes aceptados: --timeout 600000, --limite 86400, --intervalo 3600', () => {
    const o = mp.analizarArgumentos(['--slug', 's', '--portal', 'http://p', '--titulo', 't',
      '--timeout', '600000', '--limite', '86400', '--intervalo', '3600']);
    assert.equal(o.timeoutMs, 600000);
    assert.equal(o.limiteS, 86400);
    assert.equal(o.intervaloS, 3600);
  });

  test('sin fetch global (Node viejo): mensaje en español y código 3, incluso con --ayuda', async () => {
    const stdout = flujo();
    const stderr = flujo();
    const codigo = await mp.main(['--ayuda'], { stdout, stderr, env: {}, fetchImpl: null });
    assert.equal(codigo, 3);
    assert.match(stderr.texto, /no tiene fetch global; se requiere Node >= 18\.3/);
    assert.equal(stdout.texto, '');
  });
});

describe('cliente HTTP', () => {
  test('rechaza métodos que no son de solo lectura', async () => {
    const cliente = mp.crearCliente({ fetchImpl: async () => { throw new Error('no debe llamarse'); } });
    for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      await assert.rejects(cliente.pedir('http://x', { metodo }), /Solo lectura/);
    }
    assert.equal(cliente.peticiones, 0);
  });

  test('timeout con AbortController y 1 reintento', async () => {
    let llamadas = 0;
    const fetchLento = (url, { signal }) => new Promise((_, rechazar) => {
      llamadas++;
      signal.addEventListener('abort', () => rechazar(new Error('abortado')));
    });
    const cliente = mp.crearCliente({ timeoutMs: 30, esperaReintentoMs: 0, fetchImpl: fetchLento });
    await assert.rejects(cliente.pedir('http://x'), (err) => err instanceof mp.ErrorRed && /tiempo de espera agotado \(30 ms\) tras 2 intentos/.test(err.message));
    assert.equal(llamadas, 2);
  });

  test('con senal (Ctrl+C): corta la petición en curso sin esperar el timeout ni reintentar', async () => {
    const controlador = new AbortController();
    let llamadas = 0;
    const fetchColgado = (url, { signal }) => new Promise((_, rechazar) => {
      llamadas++;
      signal.addEventListener('abort', () => rechazar(new Error('abortado')));
    });
    const cliente = mp.crearCliente({ timeoutMs: 60_000, esperaReintentoMs: 0, fetchImpl: fetchColgado, senal: controlador.signal });
    setTimeout(() => controlador.abort(), 30);
    const inicio = Date.now();
    await assert.rejects(cliente.pedir('http://x'), (err) => err instanceof mp.ErrorInterrumpido && !(err instanceof mp.ErrorRed));
    assert.ok(Date.now() - inicio < 2000);
    assert.equal(llamadas, 1, 'no reintenta tras Ctrl+C');
  });

  test('con senal (Ctrl+C): corta también la espera del reintento', async () => {
    const controlador = new AbortController();
    let llamadas = 0;
    const fetchFalla = async () => {
      llamadas++;
      throw new TypeError('fetch failed');
    };
    const cliente = mp.crearCliente({ timeoutMs: 1000, esperaReintentoMs: 60_000, fetchImpl: fetchFalla, senal: controlador.signal });
    setTimeout(() => controlador.abort(), 30);
    const inicio = Date.now();
    await assert.rejects(cliente.pedir('http://x'), mp.ErrorInterrumpido);
    assert.ok(Date.now() - inicio < 2000, 'no espera los 60 s del reintento');
    assert.equal(llamadas, 1);
  });
});

// ---------------------------------------------------------------------------
// Mediciones de punta a punta contra el servidor simulado
// ---------------------------------------------------------------------------

describe('medición contra el servidor simulado', () => {
  test('aparición rápida => código 0 y detalle solo después de la API', async () => {
    await conServidor(escenarioBase({ apiDesdeMs: 250 }), async (srv) => {
      const r = await correr(argumentos(srv.base, ['--json']));
      assert.equal(r.codigo, 0, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.resultado, 'RAPIDO');
      assert.equal(inf.veredicto, '< 60 s');
      assert.equal(inf.yaPublicadaAlIniciar, false);
      assert.ok(inf.tApi >= 0.2, `t_api=${inf.tApi}`);
      assert.equal(inf.noticia.slug, 'prueba-villa-pesqueira');
      assert.equal(inf.noticia.id, ID_NOTICIA);
      for (const clave of ['home', 'acciones', 'detalle']) {
        assert.ok(inf.paginas[clave].t >= inf.tApi, `${clave}.t`);
        assert.ok(inf.paginas[clave].tras <= 60, `${clave}.tras`);
      }
      assert.equal(inf.paginas.detalle.status, 200);
      assert.equal(inf.paginas.home.xVercelCache, 'MISS');
      assert.equal(inf.paginas.acciones.xVercelCache, 'REVALIDATED');
      assert.deepEqual(Object.keys(inf.tiempos), ['t_api', 't_home', 't_acciones', 't_detalle']);
      const sondeosApi = inf.sondeos.filter((s) => s.objetivo === 'api');
      assert.ok(sondeosApi.length >= 3, 'debió sondear la API varias veces antes de encontrarla');
      assert.equal(sondeosApi.at(-1).coincidencia.slug, 'prueba-villa-pesqueira');
      assert.match(inf.interpretacion.join('\n'), /REVALIDATED/);
      // Progreso en stderr, JSON puro en stdout.
      assert.match(r.stderr, /\[\+\s*\d+\.\ds\] API\s+200 · 2 noticias · sin coincidencia/);
      assert.match(r.stderr, /ENCONTRADA slug=prueba-villa-pesqueira/);
      assert.match(r.stderr, /Resultado: RAPIDO \(código 0\)/);
      afirmarReglasComunes(srv.registro);
    });
  });

  test('no se pide el detalle antes de que la noticia exista en la API', async () => {
    await conServidor(escenarioBase({ apiDesdeMs: 400 }), async (srv) => {
      const r = await correr(argumentos(srv.base));
      assert.equal(r.codigo, 0, r.stdout);
      const apiAntes = srv.registro.filter((x) => x.ruta.startsWith('/api/') && !x.noticiaYaEntregada);
      assert.ok(apiAntes.length >= 4, `sondeos de API sin la noticia: ${apiAntes.length}`);
      const detalles = srv.registro.filter(esDetalle);
      assert.ok(detalles.length >= 1, 'debe pedir el detalle una vez que existe en la API');
      assert.ok(detalles.every((x) => x.t >= srv.estado.entregadaEn - srv.estado.t0), 'detalle pedido antes de la entrega');
      const iPrimerDetalle = srv.registro.findIndex(esDetalle);
      const iUltimaApiSinNoticia = srv.registro.findLastIndex((x) => x.ruta.startsWith('/api/') && !x.noticiaYaEntregada);
      assert.ok(iPrimerDetalle > iUltimaApiSinNoticia, 'el detalle se pidió mientras la API aún no tenía la noticia');
      afirmarReglasComunes(srv.registro);
    });
  });

  test('aparición lenta => código 1, con 404 previo del detalle', async () => {
    const e = escenarioBase({ apiDesdeMs: 100 });
    e.portal.home.retrasoMs = 800;
    e.portal.detalle.retrasoMs = 300;
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--umbral', '0.3', '--json']));
      assert.equal(r.codigo, 1, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.resultado, 'LENTO');
      assert.equal(inf.veredicto, 'no (> 0.3 s)');
      assert.equal(inf.masLenta.clave, 'home');
      assert.ok(inf.paginas.home.tras >= 0.75, `home.tras=${inf.paginas.home.tras}`);
      assert.ok(inf.paginas.acciones.tras < 0.3);
      assert.ok(inf.paginas.detalle.statusVistos['404'] >= 1, 'el detalle debió dar 404 al principio');
      assert.equal(inf.paginas.detalle.status, 200);
      const texto = inf.interpretacion.join('\n');
      assert.match(texto, /El detalle respondió 404/);
      assert.match(texto, /Tardó más de 0.3 s/);
      afirmarReglasComunes(srv.registro);
    });
  });

  test('ISR sin revalidación bajo demanda (ventana simulada de 2 s) => código 1 e interpretación de ISR', async () => {
    const e = escenarioBase({ apiDesdeMs: 300 });
    e.portal.home.isrS = 2;
    e.portal.acciones.isrS = 2;
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--umbral', '0.5', '--limite', '6', '--json']));
      assert.equal(r.codigo, 1, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.ventanaIsrS, 2, 'toma la ventana de x-nextjs-stale-time');
      assert.ok(inf.paginas.home.tras >= 1.4 && inf.paginas.home.tras <= 3, `home.tras=${inf.paginas.home.tras}`);
      assert.ok(inf.sondeos.some((x) => x.objetivo === 'home' && x.xVercelCache === 'STALE' && !x.aparece),
        'la copia vencida (STALE) todavía no trae la noticia');
      const texto = inf.interpretacion.join('\n');
      assert.match(texto, /Tardó ~2 s o más/);
      assert.match(texto, /NO hay revalidación bajo demanda/);
      assert.match(texto, /\/api\/revalidate \(acepta POST\)/);
      assert.match(texto, /home: el sondeo anterior recibió una copia vencida \(x-vercel-cache=STALE/);
      assert.match(texto, /vencimiento del ISR/);
      afirmarReglasComunes(srv.registro);
    });
  });

  test('nunca aparece en el portal => código 2 (salida legible, sin colores)', async () => {
    const e = escenarioBase({ apiDesdeMs: 50 });
    for (const clave of ['home', 'acciones', 'detalle']) e.portal[clave].retrasoMs = Infinity;
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--limite', '0.6']));
      assert.equal(r.codigo, 2, r.stdout);
      assert.doesNotMatch(r.stdout, /\x1b\[/, 'sin códigos de color si no es TTY');
      assert.match(r.stdout, /home\s+200 · HIT age=120 · aún no/);
      assert.match(r.stdout, /detalle\s+404 · HIT age=5 · aún no/);
      assert.match(r.stdout, /t_home\s+=\s+—\s+no apareció/);
      assert.match(r.stdout, /t_detalle\s+=\s+—\s+no apareció/);
      assert.match(r.stdout, /Veredicto: no apareció/);
      assert.match(r.stdout, /Resultado: NO_APARECIO \(código 2\)/);
      assert.match(r.stdout, /Repite con --limite 600/);
      assert.match(r.stdout, /404 guardado en la caché de Vercel/);
      afirmarReglasComunes(srv.registro);
    });
  });

  test('nunca aparece en la API => código 2, sin tocar el portal', async () => {
    await conServidor(escenarioBase({ apiDesdeMs: Infinity }), async (srv) => {
      const r = await correr(argumentos(srv.base, ['--limite', '0.3', '--titulo', 'Prueba Villa', '--json']));
      assert.equal(r.codigo, 2, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.noticia, null);
      assert.equal(inf.tApi, null);
      assert.match(inf.mensaje, /no apareció en la API/);
      assert.match(inf.interpretacion[0], /borrador/);
      assert.ok(srv.registro.every((x) => x.ruta.startsWith('/api/')), 'sin noticia en la API no se pide nada del portal');
      afirmarReglasComunes(srv.registro);
    });
  });

  test('ya publicada al iniciar => t_api=0 y aviso', async () => {
    await conServidor(escenarioBase({ apiDesdeMs: 0 }), async (srv) => {
      const r = await correr(argumentos(srv.base));
      assert.equal(r.codigo, 0, r.stdout);
      assert.match(r.stdout, /ya estaba publicada al iniciar; la medición del portal empieza ahora/);
      assert.match(r.stdout, /t_api\s+=\s+0\.0 s\s+ya estaba publicada al iniciar/);
      assert.match(r.stdout, /NO miden la latencia real de publicación/);
      assert.match(r.stdout, /Veredicto: < 60 s/);
      const apis = srv.registro.filter((x) => x.ruta.startsWith('/api/'));
      assert.equal(apis.length, 1, 'con la noticia ya publicada basta un sondeo de la API');
      afirmarReglasComunes(srv.registro);
    });
    await conServidor(escenarioBase({ apiDesdeMs: 0 }), async (srv) => {
      const inf = JSON.parse((await correr(argumentos(srv.base, ['--json']))).stdout);
      assert.equal(inf.tApi, 0);
      assert.equal(inf.tiempos.t_api, 0);
      assert.equal(inf.yaPublicadaAlIniciar, true);
      assert.ok(inf.avisos.some((a) => /ya estaba publicada al iniciar/.test(a)));
    });
  });

  test('entidades HTML y acentos en el título', async () => {
    const titulo = 'Inauguración del “Parque” Niños & Jóvenes \'Sonora\'';
    const e = escenarioBase({ apiDesdeMs: 100, noticia: noticiaDe(titulo, 'inauguracion-del-parque') });
    // Portada con enlace absoluto y entidades; listado con enlace relativo, etiquetas y comentarios de React.
    e.portal.home.html = (visible) => paginaHtml(visible
      ? '<a href="https://portal.example/acciones-de-gobierno/noticias/inauguracion-del-parque"><h3>Inauguraci&oacute;n del '
        + '&ldquo;Parque&rdquo; Ni&#241;os &amp; J&#xF3;venes &#x27;Sonora&#x27;</h3></a>'
      : '<h3>Otra</h3>');
    e.portal.acciones.html = (visible) => paginaHtml(visible
      ? '<a href="/acciones-de-gobierno/noticias/inauguracion-del-parque"><h3>INAUGURACIÓN DEL <em>“Parque”</em>\n   '
        + 'Niños <!-- -->&amp;<!-- --> Jóvenes &#39;Sonora&#39;</h3></a>'
      : '<h3>Inauguración del “Parque”</h3>');
    e.portal.detalle.html = () => paginaHtml(
      '<div id="raiz"></div><script>self.__next_f.push([1,"{\\"titulo\\":\\"Inauguraci\\u00f3n del \\u201cParque\\u201d Ni\\u00f1os \\u0026 J\\u00f3venes \'Sonora\'\\"}"])</script>',
    );
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--titulo', 'inauguracion del "parque"  ninos & JOVENES \'sonora\'', '--json']));
      assert.equal(r.codigo, 0, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.noticia.titulo, titulo);
      assert.equal(inf.noticia.slug, 'inauguracion-del-parque');
      assert.ok(srv.registro.some((x) => x.ruta === '/acciones-de-gobierno/noticias/inauguracion-del-parque'));
      for (const clave of ['home', 'acciones', 'detalle']) assert.notEqual(inf.paginas[clave].t, null, clave);
      afirmarReglasComunes(srv.registro);
    });
  });

  test('título casi igual: no coincide, pero se muestra como parecido', async () => {
    await conServidor(escenarioBase({ apiDesdeMs: 0 }), async (srv) => {
      const r = await correr(argumentos(srv.base, ['--titulo', 'Prueba Villa Pesqueira 2', '--limite', '0.2']));
      assert.equal(r.codigo, 2);
      assert.match(r.stdout, /sin coincidencia \(parecida: "Prueba Villa Pesqueira"\)/);
      assert.match(r.stdout, /títulos parecidos: "Prueba Villa Pesqueira"/);
    });
  });

  test('5xx en el primer sondeo de la API se reintenta y la medición sigue', async () => {
    await conServidor(escenarioBase({ apiDesdeMs: 0, fallar500Api: 1 }), async (srv) => {
      const r = await correr(argumentos(srv.base, ['--json']));
      assert.equal(r.codigo, 0, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.sondeos[0].intentos, 2);
      assert.equal(inf.yaPublicadaAlIniciar, true);
    });
  });
});

describe('falsos positivos en portada y listado (copias viejas, títulos contenidos, redirecciones)', () => {
  /** Portada y listado congelados en una copia ISR vieja (HIT age=120) con las noticias dadas. */
  const congelarListados = (e, noticias) => {
    for (const clave of ['home', 'acciones']) {
      e.portal[clave].html = () => paginaHtml(listaHtml(noticias));
      e.portal[clave].cabeceras = () => ({ 'x-vercel-cache': 'HIT', age: '120' });
    }
  };

  test('otra noticia cuyo título CONTIENE el buscado no cuenta (caso real de Carbó) => código 2', async () => {
    const vieja = noticiaDe('TRABAJOS DE LIMPIEZA Y MANTENIMIENTO', 'trabajos-de-limpieza-y-mantenimiento', { id: 'n-vieja-3' });
    const e = escenarioBase({ apiDesdeMs: 150, noticia: noticiaDe('TRABAJOS DE LIMPIEZA', 'trabajos-de-limpieza') });
    congelarListados(e, [vieja, ...NOTICIAS_BASE]);
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--titulo', 'Trabajos de limpieza', '--limite', '0.8', '--json']));
      assert.equal(r.codigo, 2, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.resultado, 'NO_APARECIO');
      assert.equal(inf.yaPublicadaAlIniciar, false);
      assert.equal(inf.paginas.home.t, null);
      assert.equal(inf.paginas.acciones.t, null);
      assert.notEqual(inf.paginas.detalle.t, null, 'el detalle (ruta nueva) sí la muestra');
      assert.ok(inf.paginas.home.sinEnlace >= 1 && inf.paginas.acciones.sinEnlace >= 1);
      const home = inf.sondeos.find((s) => s.objetivo === 'home');
      assert.equal(home.aparece, false);
      assert.equal(home.enlace, false);
      assert.match(home.motivo, /título sin enlace a \/acciones-de-gobierno\/noticias\/trabajos-de-limpieza: otra noticia o copia vieja/);
      assert.match(inf.interpretacion.join('\n'), /otra noticia cuyo título contiene el buscado/);
      assert.match(r.stderr, /home\s+200 · HIT age=120 · aún no \(título sin enlace/);
      afirmarReglasComunes(srv.registro);
    });
  });

  test('prueba repetida: la noticia anterior con el mismo título (slug -2) en una copia vieja no cuenta => código 2', async () => {
    const borrada = noticiaDe('Prueba Villa Pesqueira', 'prueba-villa-pesqueira', { id: 'n-borrada' });
    const e = escenarioBase({ apiDesdeMs: 150, noticia: noticiaDe('Prueba Villa Pesqueira', 'prueba-villa-pesqueira-2') });
    congelarListados(e, [borrada, ...NOTICIAS_BASE]);
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--limite', '0.8', '--json']));
      assert.equal(r.codigo, 2, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.noticia.slug, 'prueba-villa-pesqueira-2');
      assert.equal(inf.paginas.home.t, null);
      assert.equal(inf.paginas.acciones.t, null);
      assert.ok(srv.registro.some((x) => x.ruta === '/acciones-de-gobierno/noticias/prueba-villa-pesqueira-2'));
      assert.ok(!srv.registro.some((x) => x.ruta === '/acciones-de-gobierno/noticias/prueba-villa-pesqueira'), 'nunca pide el detalle de la borrada');
      afirmarReglasComunes(srv.registro);
    });
  });

  test('mismo título y MISMO slug en una copia generada antes de publicar (age) no cuenta => código 2', async () => {
    // creadoEn de hace una hora: aquí solo actúa la comparación de age con el último sondeo de la API sin la noticia.
    const e = escenarioBase({ apiDesdeMs: 200 });
    congelarListados(e, [e.noticia, ...NOTICIAS_BASE]);
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--limite', '0.8', '--json']));
      assert.equal(r.codigo, 2, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.yaPublicadaAlIniciar, false);
      assert.ok(inf.tApiSinNoticia !== null && inf.tApiSinNoticia < inf.tApi);
      assert.equal(inf.paginas.home.t, null);
      assert.ok(inf.paginas.home.copiasViejas >= 1);
      const home = inf.sondeos.find((s) => s.objetivo === 'home');
      assert.equal(home.enlace, true, 'título y enlace están, pero la copia es vieja');
      assert.match(home.motivo, /copia de caché anterior a la noticia \(age=120 s/);
      assert.match(inf.interpretacion.join('\n'), /generada ANTES de que existiera esta noticia/);
      assert.notEqual(inf.paginas.detalle.t, null, 'el detalle (MISS, sin age) sí cuenta');
      afirmarReglasComunes(srv.registro);
    });
  });

  test('ya publicada al iniciar y recreada con el mismo slug: copia anterior a creadoEn no cuenta => código 2', async () => {
    const e = escenarioBase({ apiDesdeMs: 0, noticia: noticiaDe('Prueba Villa Pesqueira', 'prueba-villa-pesqueira', { creadoEn: new Date().toISOString() }) });
    congelarListados(e, [e.noticia, ...NOTICIAS_BASE]);
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--limite', '0.5', '--json']));
      assert.equal(r.codigo, 2, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.yaPublicadaAlIniciar, true);
      assert.equal(inf.paginas.home.t, null);
      assert.match(inf.sondeos.find((s) => s.objetivo === 'home').motivo, /anterior a la creación de la noticia/);
    });
  });

  test('copia regenerada después de publicar (age pequeño) sí cuenta', async () => {
    const e = escenarioBase({ apiDesdeMs: 200 });
    for (const clave of ['home', 'acciones']) {
      e.portal[clave].cabeceras = (visible) => (visible ? { 'x-vercel-cache': 'HIT', age: '1' } : { 'x-vercel-cache': 'HIT', age: '120' });
    }
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--json']));
      assert.equal(r.codigo, 0, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.paginas.home.age, 1);
      assert.equal(inf.paginas.home.copiasViejas, 0);
    });
  });

  test('detalle que redirige (307) al listado no cuenta como visto => código 2', async () => {
    const e = escenarioBase({ apiDesdeMs: 0 });
    e.interceptar = (req, res, { partes }) => {
      if (partes[0] !== 'acciones-de-gobierno' || partes[1] !== 'noticias') return false;
      enviar(res, 307, '', { location: '/acciones-de-gobierno' });
      return true;
    };
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--limite', '0.4', '--json']));
      assert.equal(r.codigo, 2, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.paginas.detalle.t, null);
      assert.equal(inf.paginas.detalle.status, null);
      assert.ok(inf.paginas.detalle.redirigidas >= 1);
      assert.equal(inf.paginas.detalle.ultimaRedireccion, '/acciones-de-gobierno');
      assert.notEqual(inf.paginas.acciones.t, null, 'el listado sí la muestra');
      const detalle = inf.sondeos.find((s) => s.objetivo === 'detalle');
      assert.equal(detalle.aparece, false);
      assert.equal(detalle.redirigida, '/acciones-de-gobierno');
      // Status y cabeceras son las de la respuesta final (el listado), pero la línea dice que se redirigió.
      assert.match(r.stderr, /detalle\s+200 · [A-Z]+ age=\d+ · aún no \(redirigida a \/acciones-de-gobierno\)/);
      assert.match(inf.interpretacion.join('\n'), /El detalle redirigió \d+ (vez|veces) a \/acciones-de-gobierno/);
    });
  });

  test('portada que redirige a otra ruta con la tarjeta enlazada sí cuenta (y se informa)', async () => {
    const e = escenarioBase({ apiDesdeMs: 0 });
    e.interceptar = (req, res, { ruta }) => {
      if (ruta === '/') {
        enviar(res, 308, '', { location: '/inicio' });
        return true;
      }
      if (ruta === '/inicio') {
        enviarHtml(res, 200, e.portal.home.html(true), { 'x-vercel-cache': 'MISS', age: '0' });
        return true;
      }
      return false;
    };
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--json']));
      assert.equal(r.codigo, 0, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.paginas.home.ultimaRedireccion, '/inicio');
      assert.match(r.stderr, /home\s+200 · MISS age=0 · redirigida a \/inicio · APARECE/);
      assert.match(inf.interpretacion.join('\n'), /home: el portal redirige \/ a \/inicio/);
    });
  });

  test('--portal con #ancla, ?parámetros o ruta => código 3 sin ninguna petición', async () => {
    await conServidor(escenarioBase({ apiDesdeMs: 0 }), async (srv) => {
      for (const portal of [`${srv.base}/#inicio`, `${srv.base}/?utm=x`, `${srv.base}/acciones-de-gobierno`]) {
        const r = await correr(['--slug', 'villapesqueira', '--portal', portal, '--api', srv.base,
          '--titulo', 'Prueba Villa Pesqueira', '--intervalo', '0.05', '--limite', '0.5']);
        assert.equal(r.codigo, 3, portal);
        assert.match(r.stderr, /Error: --portal/);
      }
      assert.equal(srv.registro.length, 0);
    });
  });
});

describe('API o portal que dejan de responder a media medición => código 3', () => {
  /** La API responde bien al primer sondeo (sin la noticia) y después falla según `modo`. */
  const apiQueCae = (modo) => {
    const e = escenarioBase({ apiDesdeMs: Infinity });
    e.interceptar = (req, res, { partes, estado }) => {
      if (partes[0] !== 'api') return false;
      estado.n = (estado.n ?? 0) + 1;
      if (estado.n === 1) return false;
      if (modo === 'red') req.socket.destroy();
      else enviarJson(res, 404, { error: 'Ruta no encontrada', path: req.url });
      return true;
    };
    return e;
  };

  for (const [modo, patron] of [['red', /error de red/], ['404', /404 "Ruta no encontrada"/]]) {
    test(`la API falla (${modo}) después del primer sondeo => ERROR, sin culpar al panel`, async () => {
      await conServidor(apiQueCae(modo), async (srv) => {
        const r = await correr(argumentos(srv.base, ['--intervalo', '0.1', '--limite', '0.5', '--json']));
        assert.equal(r.codigo, 3, r.stderr);
        const inf = JSON.parse(r.stdout);
        assert.equal(inf.resultado, 'ERROR');
        assert.equal(inf.apiCaida, true);
        assert.match(inf.mensaje, /La API dejó de responder bien: los últimos \d+ sondeos fallaron/);
        assert.match(inf.mensaje, patron);
        assert.ok(inf.erroresApi >= 2);
        const texto = inf.interpretacion.join('\n');
        assert.match(texto, /no es un problema del panel/);
        assert.doesNotMatch(texto, /borrador/);
        assert.ok(srv.registro.every((x) => x.ruta.startsWith('/api/')), 'sin noticia no se toca el portal');
      });
    });
  }

  test('fallos intermitentes con el último sondeo bien => sigue siendo código 2, con la nota', async () => {
    const e = escenarioBase({ apiDesdeMs: Infinity });
    e.interceptar = (req, res, { partes, estado, ahora }) => {
      const t = ahora - estado.t0;
      if (partes[0] !== 'api' || t < 100 || t >= 250) return false;
      enviarJson(res, 503, { error: 'Servicio no disponible' });
      return true;
    };
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--limite', '0.6', '--json']));
      assert.equal(r.codigo, 2, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.apiCaida, false);
      assert.ok(inf.erroresApi >= 1);
      assert.match(inf.interpretacion.join('\n'), /de la API fallaron \(red o respuesta inválida\); el último sí respondió/);
    });
  });

  test('el portal deja de responder después del primer sondeo => código 3', async () => {
    const e = escenarioBase({ apiDesdeMs: 0 });
    for (const clave of ['home', 'acciones', 'detalle']) e.portal[clave].retrasoMs = Infinity;
    e.interceptar = (req, res, { partes, estado, ahora }) => {
      if (partes[0] === 'api' || ahora - estado.t0 < 150) return false;
      req.socket.destroy();
      return true;
    };
    await conServidor(e, async (srv) => {
      const r = await correr(argumentos(srv.base, ['--limite', '0.6', '--json']));
      assert.equal(r.codigo, 3, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.match(inf.mensaje, /El portal dejó de responder: home \(error de red/);
      assert.ok(inf.paginas.home.sondeos >= 1, 'el primer sondeo sí respondió');
    });
  });
});

describe('Ctrl+C corta las peticiones en curso', () => {
  test('portal colgado: termina enseguida como interrumpido (código 2), sin esperar el timeout', async () => {
    const e = escenarioBase({ apiDesdeMs: 0 });
    e.interceptar = (req, res, { partes }) => partes[0] !== 'api'; // el portal acepta y nunca responde
    await conServidor(e, async (srv) => {
      const controlador = new AbortController();
      setTimeout(() => controlador.abort(), 300);
      const inicio = Date.now();
      const r = await correr(argumentos(srv.base, ['--timeout', '10000', '--limite', '600', '--json']), { senal: controlador.signal });
      const ms = Date.now() - inicio;
      assert.ok(ms < 3000, `tardó ${ms} ms en terminar tras Ctrl+C`);
      assert.equal(r.codigo, 2, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.interrumpido, true);
      assert.equal(inf.resultado, 'NO_APARECIO');
      assert.match(inf.mensaje, /antes de la interrupción \(Ctrl\+C/);
      assert.equal(inf.paginas.home.errores, 0, 'el corte no cuenta como error de red');
      assert.match(inf.interpretacion.join('\n'), /Repite sin interrumpir/);
    });
  });

  test('API colgada en el primer sondeo: interrumpido, no ERROR', async () => {
    const e = escenarioBase({ apiDesdeMs: 0 });
    e.interceptar = () => true; // nada responde
    await conServidor(e, async (srv) => {
      const controlador = new AbortController();
      setTimeout(() => controlador.abort(), 200);
      const inicio = Date.now();
      const r = await correr(argumentos(srv.base, ['--timeout', '10000', '--json']), { senal: controlador.signal });
      assert.ok(Date.now() - inicio < 3000);
      assert.equal(r.codigo, 2, r.stderr);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.interrumpido, true);
      assert.equal(inf.error, null);
      assert.equal(inf.erroresApi, 0);
    });
  });

  test('como CLI: SIGINT con el portal colgado muestra el resumen y sale con 2 en menos de 3 s',
    { skip: process.platform === 'win32' ? 'SIGINT no se puede enviar así en Windows' : false }, async () => {
      const e = escenarioBase({ apiDesdeMs: 0 });
      e.interceptar = (req, res, { partes }) => partes[0] !== 'api';
      await conServidor(e, async (srv) => {
        const hijo = spawn(process.execPath, [SCRIPT, ...argumentos(srv.base, ['--timeout', '10000', '--limite', '30'])],
          { env: { ...process.env, NO_COLOR: '1' } });
        let salida = '';
        hijo.stdout.on('data', (d) => {
          salida += d;
        });
        hijo.stderr.on('data', (d) => {
          salida += d;
        });
        await new Promise((resolver, rechazar) => {
          const limite = setTimeout(() => rechazar(new Error(`no llegó a sondear el portal:\n${salida}`)), 10_000);
          const revisar = () => {
            if (srv.registro.some((x) => x.ruta === '/')) {
              clearTimeout(limite);
              resolver();
            } else {
              setTimeout(revisar, 20);
            }
          };
          revisar();
        });
        const inicio = Date.now();
        hijo.kill('SIGINT');
        const codigo = await new Promise((resolver) => hijo.on('close', (c) => resolver(c)));
        assert.ok(Date.now() - inicio < 3000, `tardó ${Date.now() - inicio} ms tras SIGINT`);
        assert.equal(codigo, 2, salida);
        assert.match(salida, /Medición interrumpida \(Ctrl\+C\)/);
        assert.match(salida, /Resultado: NO_APARECIO \(código 2\)/);
      });
    });
});

describe('errores => código 3', () => {
  test('municipio sin alta (404 "Municipio ... no encontrado")', async () => {
    await conServidor(escenarioBase(), async (srv) => {
      const args = argumentos(srv.base, ['--json']);
      args[1] = 'villapesqueira-no-existe';
      const r = await correr(args);
      assert.equal(r.codigo, 3);
      const inf = JSON.parse(r.stdout);
      assert.equal(inf.resultado, 'ERROR');
      assert.match(inf.mensaje, /no existe en la API/);
      assert.match(inf.mensaje, /Municipio 'villapesqueira-no-existe' no encontrado/);
      assert.ok(srv.registro.every((x) => x.ruta.startsWith('/api/')), 'no debe tocar el portal');
      assert.equal(srv.registro.length, 1, 'un 404 no se reintenta');
    });
  });

  test('API inalcanzable', async () => {
    const cerrado = await puertoCerrado();
    const r = await correr(['--slug', 'villapesqueira', '--portal', cerrado, '--api', cerrado, '--titulo', 'Prueba',
      '--intervalo', '0.05', '--limite', '1', '--timeout', '2000']);
    assert.equal(r.codigo, 3);
    assert.match(r.stdout, /No se pudo consultar la API/);
    assert.match(r.stdout, /tras 2 intentos/);
    assert.match(r.stdout, /Resultado: ERROR \(código 3\)/);
    assert.equal(r.stdout.split('No se pudo consultar la API').length - 1, 1, 'el motivo se muestra una sola vez');
    assert.match(r.stdout, /Sin medición\./);
  });

  test('portal inalcanzable en el primer sondeo', async () => {
    const cerrado = await puertoCerrado();
    await conServidor(escenarioBase({ apiDesdeMs: 0 }), async (srv) => {
      const r = await correr(['--slug', 'villapesqueira', '--portal', cerrado, '--api', srv.base,
        '--titulo', 'Prueba Villa Pesqueira', '--intervalo', '0.05', '--limite', '1', '--timeout', '2000', '--json']);
      assert.equal(r.codigo, 3);
      const inf = JSON.parse(r.stdout);
      assert.match(inf.mensaje, /No se pudo conectar con el portal/);
      assert.equal(inf.tApi, 0, 'la parte de la API sí quedó medida');
    });
  });

  test('ruta de API rota (404 "Ruta no encontrada") no se confunde con alta pendiente', () => {
    assert.equal(mp.esMunicipioInexistente(404, JSON.stringify({ error: "Municipio 'x' no encontrado" })), true);
    assert.equal(mp.esMunicipioInexistente(404, JSON.stringify({ error: 'Ruta no encontrada', path: '/x' })), false);
    assert.equal(mp.esMunicipioInexistente(500, '{}'), false);
  });
});

describe('colores y punto de entrada', () => {
  test('usarColor respeta TTY y NO_COLOR', () => {
    assert.equal(mp.usarColor({ isTTY: true }, {}), true);
    assert.equal(mp.usarColor({ isTTY: true }, { NO_COLOR: '' }), false);
    assert.equal(mp.usarColor({ isTTY: false }, {}), false);
  });

  const ejecutar = (args) => new Promise((resolver) => {
    execFile(process.execPath, args, { timeout: 20_000 }, (err, stdout, stderr) => {
      resolver({ codigo: err ? err.code : 0, stdout, stderr });
    });
  });

  test('como CLI: --ayuda sale con 0 y argumentos inválidos con 3', async () => {
    const ayuda = await ejecutar([SCRIPT, '--ayuda']);
    assert.equal(ayuda.codigo, 0);
    assert.match(ayuda.stdout, /medir-publicacion\.mjs/);
    const malo = await ejecutar([SCRIPT, '--slug', 'x', '--portal', 'http://p', '--titulo', 't', '--limite', 'nada']);
    assert.equal(malo.codigo, 3);
    assert.match(malo.stderr, /--limite debe ser un número/);
  });

  test('como CLI contra el servidor simulado: código de salida real', async () => {
    await conServidor(escenarioBase({ apiDesdeMs: 0 }), async (srv) => {
      const r = await ejecutar([SCRIPT, ...argumentos(srv.base, ['--json'])]);
      assert.equal(r.codigo, 0, r.stderr);
      assert.equal(JSON.parse(r.stdout).codigo, 0);
    });
  });

  test('importar el módulo no ejecuta main()', async () => {
    const r = await ejecutar(['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(SCRIPT).href)}); console.log('ok');`]);
    assert.equal(r.codigo, 0, r.stderr);
    assert.equal(r.stdout.trim(), 'ok');
  });
});
