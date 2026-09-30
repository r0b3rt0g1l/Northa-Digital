// Pruebas de verificar-alta.mjs con node:test y un servidor HTTP local que simula
// la API de CMS Municipal y el portal. Ejecutar:
//   node --test scripts/verificacion/

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as va from './verificar-alta.mjs';

const SCRIPT = fileURLToPath(new URL('./verificar-alta.mjs', import.meta.url));
const ID_PRUEBA = '11111111-2222-4333-8444-555555555555';
const ID_OTRO = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ID_TERCERO = '99999999-8888-4777-8666-555555555555';

const HTML_PORTADA = `<!doctype html><html><head><title>Villa Pesqueira</title></head><body>
<h1>Bienvenidos a Villa&nbsp;Pesqueira</h1>
<p>Rock &amp; roll &#x27;sonorense&#x27; y
   &quot;m&aacute;s&quot;</p>
<p>H. Ayuntamiento de <strong>Villa Pesqueira</strong></p>
<script>self.__next_f.push([1,"{\\"titulo\\":\\"Presidencia Municipal 2024\\u20132027\\"}"])</script>
</body></html>`;

// ---------------------------------------------------------------------------
// Servidor simulado (API + escudo + portal)
// ---------------------------------------------------------------------------

function municipioDe(base, { slug = 'villapesqueira', nombre = 'Villa Pesqueira', id = ID_PRUEBA } = {}) {
  return {
    id,
    nombre: `H. Ayuntamiento de ${nombre}`,
    slug,
    estado: 'Sonora',
    escudoUrl: `${base}/escudos/${slug}.png`,
    dominio: `${slug}transparencia.com.mx`,
    portadaHistoriaUrl: null,
    portadaHistoriaPublicId: null,
    activo: true,
    creadoEn: '2026-09-01T00:00:00.000Z',
    actualizadoEn: '2026-09-01T00:00:00.000Z',
  };
}

/** Escenario sano: el tenant existe, todo aislado, portal con los textos. */
function escenarioOk(base, { slug = 'villapesqueira', nombre = 'Villa Pesqueira' } = {}) {
  const municipio = municipioDe(base, { slug, nombre });
  const carbo = municipioDe(base, { slug: 'carbo', nombre: 'Carbó', id: ID_OTRO });
  return {
    retrasoMs: 15,
    municipios: [carbo, municipio],
    contenido: {
      [slug]: {
        hero: [{ id: 'h1', municipioId: ID_PRUEBA, titulo: 'Bienvenidos' }],
        noticias: [
          { id: 'n1', titulo: 'Primera', slug: 'primera-noticia', extracto: 'x', imagenUrl: null, categoria: 'General', publicarEn: '2026-09-01', creadoEn: '2026-09-01' },
          { id: 'n2', titulo: 'Segunda', slug: 'segunda-noticia', extracto: 'y', imagenUrl: null, categoria: 'General', publicarEn: '2026-09-02', creadoEn: '2026-09-02' },
        ],
        sevac: [{ id: 's1', municipioId: ID_PRUEBA }],
        estadisticas: [{ id: 'e1', municipioId: ID_PRUEBA }, { id: 'e2', municipioId: ID_PRUEBA }],
        documentos: [{ id: 'd1', titulo: 'sin municipioId' }],
        funcionarios: [{ id: 'f1', municipioId: ID_PRUEBA }],
        atractivos: [{ id: 'a1', municipioId: ID_PRUEBA, slug: 'rio' }],
        imagenes: [],
      },
    },
    detallesNoticia: {
      [slug]: {
        'primera-noticia': { id: 'n1', municipioId: ID_PRUEBA, slug: 'primera-noticia', titulo: 'Primera' },
      },
    },
    escudo: { status: 200, tipo: 'image/png' },
    portal: {
      '/': { html: HTML_PORTADA, cabeceras: { 'x-vercel-cache': 'HIT', age: '12', 'x-nextjs-stale-time': '300' } },
      '/transparencia/sevac': { html: '<h1>SEVAC</h1>', cabeceras: { 'x-vercel-cache': 'MISS' } },
    },
  };
}

function enviarJson(req, res, status, cuerpo) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(req.method === 'HEAD' ? undefined : JSON.stringify(cuerpo));
}

function manejar(req, res, e, estado) {
  const url = new URL(req.url, 'http://local');
  const partes = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (e.interceptar?.(req, res, partes, estado)) return;

  if (partes[0] === 'api' && partes[1] === 'municipios') {
    if (partes.length === 2) return enviarJson(req, res, 200, e.lista ?? e.municipios);
    const slug = partes[2];
    const municipio = e.municipios.find((m) => m.slug === slug);
    if (partes.length === 3) {
      return municipio ? enviarJson(req, res, 200, municipio) : enviarJson(req, res, 404, { error: 'Municipio no encontrado' });
    }
    if (!municipio) return enviarJson(req, res, 404, { error: `Municipio '${slug}' no encontrado` });
    const subruta = partes[3];
    if (!va.SUBRUTAS.includes(subruta)) return enviarJson(req, res, 404, { error: 'Ruta no encontrada', path: url.pathname });
    if (partes.length === 4) return enviarJson(req, res, 200, e.contenido?.[slug]?.[subruta] ?? []);
    if (partes.length === 5 && subruta === 'noticias') {
      const detalle = e.detallesNoticia?.[slug]?.[partes[4]];
      return detalle ? enviarJson(req, res, 200, detalle) : enviarJson(req, res, 404, { error: 'Noticia no encontrada' });
    }
    return enviarJson(req, res, 404, { error: 'Ruta no encontrada', path: url.pathname });
  }

  if (partes[0] === 'escudos') {
    const escudo = e.escudo;
    const status = req.method === 'HEAD' && escudo.head ? escudo.head : escudo.status;
    res.writeHead(status, { 'content-type': escudo.tipo, 'content-length': '4' });
    return res.end(req.method === 'HEAD' ? undefined : 'PNG!');
  }

  if (partes[0] === 'portal') {
    const ruta = `/${partes.slice(1).join('/')}`;
    const pagina = e.portal?.[ruta];
    if (!pagina) {
      res.writeHead(404, { 'content-type': 'text/html' });
      return res.end('<h1>404</h1>');
    }
    res.writeHead(pagina.status ?? 200, { 'content-type': 'text/html; charset=utf-8', ...(pagina.cabeceras ?? {}) });
    return res.end(req.method === 'HEAD' ? undefined : pagina.html ?? '');
  }

  return enviarJson(req, res, 404, { error: 'Ruta no encontrada', path: url.pathname });
}

/**
 * Levanta el servidor simulado en un puerto libre. `modificar(escenario, base)` ajusta
 * el escenario sano para cada caso.
 */
async function levantar(modificar = () => {}, opciones = {}) {
  const estado = { peticiones: [], enVuelo: 0, maxEnVuelo: 0, escenario: null };
  const servidor = http.createServer((req, res) => {
    estado.peticiones.push({ metodo: req.method, ruta: req.url });
    estado.enVuelo++;
    estado.maxEnVuelo = Math.max(estado.maxEnVuelo, estado.enVuelo);
    res.on('close', () => {
      estado.enVuelo--;
    });
    setTimeout(() => manejar(req, res, estado.escenario, estado), estado.escenario.retrasoMs ?? 0);
  });
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  estado.escenario = escenarioOk(base, opciones);
  modificar(estado.escenario, base);
  return {
    base,
    portal: `${base}/portal`,
    estado,
    rutas: () => estado.peticiones.map((p) => p.ruta),
    cerrar: () => new Promise((resolver) => {
      servidor.closeAllConnections?.();
      servidor.close(() => resolver());
    }),
  };
}

/** Flujo de escritura en memoria para capturar stdout/stderr. */
function capturador({ isTTY = false } = {}) {
  return {
    isTTY,
    texto: '',
    write(fragmento) {
      this.texto += fragmento;
      return true;
    },
  };
}

async function correr(args, { env = {}, isTTY = false } = {}) {
  const stdout = capturador({ isTTY });
  const stderr = capturador();
  const codigo = await va.main(args, { stdout, stderr, env, esperaReintentoMs: 0 });
  return { codigo, salida: stdout.texto, errores: stderr.texto };
}

async function correrJson(srv, slug, extra = []) {
  const r = await correr([slug, '--api', srv.base, '--json', ...extra]);
  let informe;
  try {
    informe = JSON.parse(r.salida);
  } catch {
    assert.fail(`La salida no es JSON:\n${r.salida}\n${r.errores}`);
  }
  assert.equal(informe.codigo, r.codigo, 'el código del informe coincide con el de salida');
  return { ...r, informe };
}

const filas = (informe, clave) => informe.comprobaciones.filter((c) => c.clave === clave);
const fila = (informe, clave) => {
  const encontradas = filas(informe, clave);
  assert.equal(encontradas.length, 1, `se esperaba 1 comprobación "${clave}", hay ${encontradas.length}`);
  return encontradas[0];
};
const conEstado = (informe, estado) => informe.comprobaciones.filter((c) => c.estado === estado);

function ejecutarProceso(comando, args, opciones = {}) {
  return new Promise((resolver) => {
    execFile(comando, args, { timeout: 30_000, env: { ...process.env, NO_COLOR: '1' }, ...opciones }, (err, stdout, stderr) => {
      resolver({ codigo: err ? (typeof err.code === 'number' ? err.code : -1) : 0, stdout, stderr });
    });
  });
}

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

describe('funciones puras', () => {
  test('decodificarEntidades: nombradas, decimales y hexadecimales', () => {
    assert.equal(va.decodificarEntidades('a &amp; b &#x27;c&#x27; &quot;d&quot; &#39;e&#39; &lt;f&gt;'), `a & b 'c' "d" 'e' <f>`);
    assert.equal(va.decodificarEntidades('Carb&oacute; Ba&ntilde;o &Aacute;'), 'Carbó Baño Á');
    assert.equal(va.decodificarEntidades('&amp;amp; &desconocida; &#xZZ;'), '&amp; &desconocida; &#xZZ;');
    assert.equal(va.decodificarEntidades('&#128512;'), '😀');
  });

  test('normalizarTexto: espacios, &nbsp;, comillas tipográficas y NFC', () => {
    assert.equal(va.normalizarTexto('  Villa&nbsp;\n\t Pesqueira  '), 'Villa Pesqueira');
    assert.equal(va.normalizarTexto('“hola” ‘mundo’'), `"hola" 'mundo'`);
    assert.equal(va.normalizarTexto('Carbó'), 'Carbó');
  });

  test('contieneTexto: compara con entidades, etiquetas y escapes del payload de Next', () => {
    assert.ok(va.contieneTexto(HTML_PORTADA, 'Bienvenidos a Villa Pesqueira'));
    assert.ok(va.contieneTexto(HTML_PORTADA, `Rock & roll 'sonorense' y "más"`));
    assert.ok(va.contieneTexto(HTML_PORTADA, 'H. Ayuntamiento de Villa Pesqueira'), 'texto partido por <strong>');
    assert.ok(va.contieneTexto(HTML_PORTADA, 'Presidencia Municipal 2024–2027'), 'escape \\u2013 del payload');
    assert.ok(!va.contieneTexto(HTML_PORTADA, 'bienvenidos a villa pesqueira'), 'distingue mayúsculas');
    assert.ok(!va.contieneTexto(HTML_PORTADA, 'Bienvenidos a Carbó'));
  });

  test('esAltaPendiente: solo el 404 de municipio, no el de ruta', () => {
    assert.ok(va.esAltaPendiente(404, { error: 'Municipio no encontrado' }));
    assert.ok(va.esAltaPendiente(404, { error: "Municipio 'villapesqueira' no encontrado" }));
    assert.ok(!va.esAltaPendiente(404, { error: 'Ruta no encontrada', path: '/x' }));
    assert.ok(!va.esAltaPendiente(404, undefined));
    assert.ok(!va.esAltaPendiente(500, { error: 'Municipio no encontrado' }));
  });

  test('esUuid y urlApi', () => {
    assert.ok(va.esUuid('296e426e-5175-49a4-b530-4acba37e3b87'));
    assert.ok(!va.esUuid('296e426e5175'));
    assert.ok(!va.esUuid(42));
    assert.equal(va.urlApi('https://x.test', 'villa pesqueira', 'hero'), 'https://x.test/api/municipios/villa%20pesqueira/hero');
  });

  test('normalizarBaseApi y normalizarPortal', () => {
    assert.equal(va.normalizarBaseApi('https://api.northadigital.com/'), 'https://api.northadigital.com');
    assert.equal(va.normalizarBaseApi('https://api.northadigital.com/api/'), 'https://api.northadigital.com');
    assert.throws(() => va.normalizarBaseApi('api.northadigital.com'), va.ErrorUso);
    assert.equal(va.normalizarPortal('villapesqueira.vercel.app/'), 'https://villapesqueira.vercel.app');
    assert.equal(va.normalizarPortal('http://localhost:3000'), 'http://localhost:3000');
    assert.throws(() => va.normalizarPortal('ftp://x.test'), va.ErrorUso);
  });

  test('sugerenciaCache según x-vercel-cache', () => {
    assert.match(va.sugerenciaCache({ 'x-vercel-cache': 'STALE', age: '400', 'x-nextjs-stale-time': '300' }), /regeneración.*reintenta en unos segundos/);
    assert.match(va.sugerenciaCache({ 'x-vercel-cache': 'HIT', age: '100', 'x-nextjs-stale-time': '300' }), /~200 s/);
    assert.match(va.sugerenciaCache({ 'x-vercel-cache': null, age: null, 'x-nextjs-stale-time': null }), /caché ISR \(~300 s\).*reintenta/);
  });

  test('mapearConConcurrencia respeta el límite y el orden', async () => {
    let enVuelo = 0;
    let maximo = 0;
    const resultado = await va.mapearConConcurrencia([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      enVuelo++;
      maximo = Math.max(maximo, enVuelo);
      await va.dormir(5);
      enVuelo--;
      return n * 10;
    });
    assert.deepEqual(resultado, [10, 20, 30, 40, 50, 60, 70]);
    assert.equal(maximo, 3);
  });

  test('crearCliente rechaza métodos de escritura sin tocar la red', async () => {
    let llamadas = 0;
    const cliente = va.crearCliente({ fetchImpl: async () => { llamadas++; return new Response('{}'); } });
    for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
      await assert.rejects(cliente.pedir('http://127.0.0.1:1/x', { metodo }), /Solo lectura/);
    }
    assert.equal(llamadas, 0);
    await cliente.pedir('http://127.0.0.1:1/x', { metodo: 'head' });
    assert.equal(llamadas, 1);
  });

  test('crearCliente reintenta 1 vez ante error de red y 5xx', async () => {
    let llamadas = 0;
    const cliente = va.crearCliente({
      esperaReintentoMs: 0,
      fetchImpl: async () => {
        llamadas++;
        if (llamadas === 1) throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
        return new Response('[]', { status: 200 });
      },
    });
    const r = await cliente.pedir('http://x.test/a');
    assert.equal(r.status, 200);
    assert.equal(r.intentos, 2);

    llamadas = 0;
    const siempre503 = va.crearCliente({ esperaReintentoMs: 0, fetchImpl: async () => { llamadas++; return new Response('x', { status: 503 }); } });
    assert.equal((await siempre503.pedir('http://x.test/b')).status, 503);
    assert.equal(llamadas, 2);

    llamadas = 0;
    const caido = va.crearCliente({ esperaReintentoMs: 0, fetchImpl: async () => { llamadas++; throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }); } });
    await assert.rejects(caido.pedir('http://x.test/c'), (err) => err instanceof va.ErrorRed && /ECONNREFUSED/.test(err.message) && err.intentos === 2);
    assert.equal(llamadas, 2);
  });

  test('decodificarEntidades no resuelve nombres de Object.prototype (&constructor; &toString;)', () => {
    const texto = 'a &constructor; b &toString; c &valueOf; d &__proto__; e &hasOwnProperty; &CONSTRUCTOR;';
    assert.equal(va.decodificarEntidades(texto), texto);
    assert.ok(!va.contieneTexto('<p>&valueOf;</p>', 'function valueOf() { [native code] }'));
    assert.ok(va.contieneTexto('<p>&valueOf;</p>', '&valueOf;'));
  });

  test('normalizarPortal/normalizarBaseApi rechazan ?consulta, #fragmento y credenciales', () => {
    for (const malo of ['https://x.test/?nocache=1', 'https://x.test?nocache=1', 'x.test/#ancla', 'https://x.test/portal?', 'https://x.test#']) {
      assert.throws(() => va.normalizarPortal(malo), (err) => err instanceof va.ErrorUso && /no admite \?consulta ni #fragmento/.test(err.message), malo);
    }
    assert.throws(() => va.normalizarPortal('https://usuario:clave@x.test'), /usuario ni contraseña/);
    assert.throws(() => va.normalizarBaseApi('https://api.x.test/?v=2'), /--api no admite \?consulta/);
    assert.equal(va.normalizarPortal('http://127.0.0.1:3000/portal//'), 'http://127.0.0.1:3000/portal');
    assert.equal(va.normalizarPortal('HTTPS://Carbotransparencia.com.mx'), 'https://carbotransparencia.com.mx');
  });

  test('urlPortal arma las rutas sobre la base (con o sin subruta)', () => {
    assert.equal(va.urlPortal('https://x.test', '/'), 'https://x.test/');
    assert.equal(va.urlPortal('https://x.test', '/transparencia/sevac'), 'https://x.test/transparencia/sevac');
    assert.equal(va.urlPortal('http://127.0.0.1:9/portal', '/transparencia/sevac'), 'http://127.0.0.1:9/portal/transparencia/sevac');
    assert.equal(va.urlPortal('http://127.0.0.1:9/portal', '/'), 'http://127.0.0.1:9/portal/');
  });

  test('clasificarRedireccion: equivalente (barra, https, www) frente a distinta (host o ruta)', () => {
    const c = (a, b) => va.clasificarRedireccion(a, b).tipo;
    assert.equal(c('https://x.test/', 'https://x.test/'), 'ninguna');
    assert.equal(c('https://x.test/', undefined), 'ninguna');
    assert.equal(c('https://x.test/portal/', 'https://x.test/portal'), 'equivalente');
    assert.equal(c('http://x.test/', 'https://x.test/'), 'equivalente');
    assert.equal(c('https://banamichitransparencia.com.mx/', 'https://www.banamichitransparencia.com.mx/'), 'equivalente');
    assert.equal(c('https://www.x.test/transparencia/sevac', 'https://x.test/transparencia/sevac'), 'equivalente');
    assert.equal(c('https://x.test/transparencia/sevac', 'https://x.test/transparencia'), 'distinta');
    assert.equal(c('https://x.test/', 'https://otro.test/'), 'distinta');
    assert.equal(c('https://x.test/', 'https://x.test/login'), 'distinta');
    assert.equal(c('https://x.test/', 'http://x.test/'), 'distinta', 'bajar a http no es equivalente');
    assert.equal(c('http://127.0.0.1:3000/', 'http://127.0.0.1:4000/'), 'distinta', 'otro puerto');
    assert.match(va.clasificarRedireccion('https://x.test/', 'https://otro.test/').nota, /redirigido a https:\/\/otro\.test\//);
  });

  test('crearBuscadorTexto: exacta, solo ignorando mayúsculas (CSS), solo ignorando acentos, ausente', () => {
    const html = '<h3 class="font-bold capitalize">c. sylvia lenika placencia leal</h3>'
      + '<p class="uppercase">presidenta&nbsp;municipal</p><p>Municipio de Carbo, Sonora</p>';
    const buscar = va.crearBuscadorTexto(html);
    assert.deepEqual(buscar('c. sylvia lenika placencia leal'), { coincidencia: 'exacta', fragmento: 'c. sylvia lenika placencia leal' });
    assert.deepEqual(buscar('C. Sylvia Lenika Placencia Leal'), { coincidencia: 'mayusculas', fragmento: 'c. sylvia lenika placencia leal' });
    assert.deepEqual(buscar('PRESIDENTA MUNICIPAL'), { coincidencia: 'mayusculas', fragmento: 'presidenta municipal' });
    assert.deepEqual(buscar('municipio de carbó'), { coincidencia: 'acentos', fragmento: 'Municipio de Carbo' });
    assert.deepEqual(buscar('Bienvenidos'), { coincidencia: null, fragmento: null });
    assert.equal(va.buscarTexto(HTML_PORTADA, 'bienvenidos a villa pesqueira').fragmento, 'Bienvenidos a Villa Pesqueira');
  });

  test('crearBuscadorTexto: límites de palabra, prioridad al texto visible y mapa de posiciones', () => {
    // La búsqueda aproximada exige palabra completa (la exacta sigue siendo por subcadena).
    const dominio = '<a href="https://carbotransparencia.com.mx">carbotransparencia.com.mx</a>';
    assert.equal(va.buscarTexto(dominio, 'Carbo').coincidencia, null);
    assert.equal(va.buscarTexto(dominio, 'carbo').coincidencia, 'exacta');
    // Muestra el texto visible (lo que transforma el CSS), no el alt="" ni el payload JSON.
    const html = '<img alt="C. SYLVIA LEAL"><h3 class="capitalize">c. sylvia leal</h3>'
      + '<script>self.__next_f.push([1,"{\\"nombre\\":\\"C. SYLVIA LEAL\\"}"])</script>';
    assert.deepEqual(va.buscarTexto(html, 'C. Sylvia Leal'), { coincidencia: 'mayusculas', fragmento: 'c. sylvia leal' });
    // Letras cuya minúscula cambia de longitud ('İ' -> 'i̇'): el fragmento se recorta bien.
    assert.deepEqual(va.buscarTexto('<p>DİRECCIÓN de Obras Públicas</p>', 'direccion de obras'),
      { coincidencia: 'acentos', fragmento: 'DİRECCIÓN de Obras' });
  });

  test('plegarSlug y slugsParecidos: mayúsculas, acentos y guiones', () => {
    assert.equal(va.plegarSlug('Villa-Pésqueira'), 'villapesqueira');
    const lista = [{ slug: 'villapesqueira' }, { slug: 'mazatan' }, { slug: 'rayon' }, null, { slug: 7 }];
    assert.deepEqual(va.slugsParecidos(lista, 'villapésqueira'), ['villapesqueira']);
    assert.deepEqual(va.slugsParecidos(lista, 'mazatán'), ['mazatan']);
    assert.deepEqual(va.slugsParecidos(lista, 'villa-pesqueira'), ['villapesqueira']);
    assert.deepEqual(va.slugsParecidos(lista, 'Rayon'), ['rayon']);
    assert.deepEqual(va.slugsParecidos(lista, 'rayon'), [], 'el slug exacto no es "parecido"');
    assert.deepEqual(va.slugsParecidos(lista, 'carbo'), []);
  });

  test('crearCliente limita un timeout enorme a 2^31-1 ms (sin TimeoutOverflowWarning ni aborto a 1 ms)', async () => {
    const avisos = [];
    const escuchar = (w) => avisos.push(w.name);
    process.on('warning', escuchar);
    try {
      const cliente = va.crearCliente({
        timeoutMs: 3_000_000_000,
        esperaReintentoMs: 0,
        fetchImpl: (url, { signal }) => new Promise((resolver, rechazar) => {
          const t = setTimeout(() => resolver(new Response('[]', { status: 200 })), 30);
          signal.addEventListener('abort', () => { clearTimeout(t); rechazar(new Error('abortado')); });
        }),
      });
      const r = await cliente.pedir('http://x.test/a');
      assert.equal(r.status, 200);
      assert.equal(r.intentos, 1);
      await va.dormir(5);
      assert.ok(!avisos.includes('TimeoutOverflowWarning'), avisos.join(', '));
    } finally {
      process.off('warning', escuchar);
    }
  });
});

describe('argumentos', () => {
  test('analiza slug, opciones y --esperar-texto repetido', () => {
    const o = va.analizarArgumentos(['villapesqueira', '--nombre', 'Villa Pesqueira', '--portal', 'https://villapesqueira.vercel.app/',
      '--esperar-texto', 'A', '--esperar-texto', 'B', '--api', 'http://localhost:4000/api', '--timeout', '2500', '--json']);
    assert.equal(o.slug, 'villapesqueira');
    assert.equal(o.nombre, 'Villa Pesqueira');
    assert.equal(o.portal, 'https://villapesqueira.vercel.app');
    assert.deepEqual(o.esperarTexto, ['A', 'B']);
    assert.equal(o.api, 'http://localhost:4000');
    assert.equal(o.timeoutMs, 2500);
    assert.equal(o.json, true);
    const d = va.analizarArgumentos(['carbo']);
    assert.equal(d.api, va.API_POR_DEFECTO);
    assert.equal(d.timeoutMs, 15000);
  });

  test('errores de uso claros en español', () => {
    assert.throws(() => va.analizarArgumentos([]), /Falta el slug/);
    assert.throws(() => va.analizarArgumentos(['villa', 'pesqueira']), /Sobran argumentos.*comillas/);
    assert.throws(() => va.analizarArgumentos(['x', '--timeout', 'abc']), /--timeout debe ser un entero/);
    assert.throws(() => va.analizarArgumentos(['x', '--timeout', '0']), /--timeout/);
    assert.throws(() => va.analizarArgumentos(['x', '--esperar-texto', 'hola']), /requiere --portal/);
    assert.throws(() => va.analizarArgumentos(['x', '--desconocida']), /Opción desconocida: --desconocida/);
    assert.throws(() => va.analizarArgumentos(['x', '--nombre']), /requiere un valor/);
    assert.throws(() => va.analizarArgumentos(['x', '--portal', 'p.test', '--esperar-texto', '-10%']), /--esperar-texto="valor"/);
    assert.deepEqual(va.analizarArgumentos(['x', '--portal', 'p.test', '--esperar-texto=-10%']).esperarTexto, ['-10%']);
  });

  test('opción booleana con valor: "no admite valor" (no "requiere un valor")', async () => {
    assert.throws(() => va.analizarArgumentos(['carbo', '--json=true']), (err) => err instanceof va.ErrorUso
      && err.message === 'La opción --json no admite valor: escribe solo --json.');
    assert.throws(() => va.analizarArgumentos(['carbo', '--ayuda=si']), (err) => err.message === 'La opción --ayuda no admite valor: escribe solo --ayuda.');
    assert.throws(() => va.analizarArgumentos(['carbo', '--portal']), (err) => err.message === 'La opción --portal requiere un valor.');
    const r = await correr(['carbo', '--json=true']);
    assert.equal(r.codigo, 3);
    assert.match(r.errores, /^Error: La opción --json no admite valor/);
  });

  test('--timeout por encima de 2^31-1 ms => error de uso; el máximo se acepta', () => {
    assert.throws(() => va.analizarArgumentos(['x', '--timeout', '3000000000']), (err) => err instanceof va.ErrorUso && /no puede pasar de 2147483647 ms/.test(err.message));
    assert.throws(() => va.analizarArgumentos(['x', '--timeout', '2147483648']), /no puede pasar de/);
    assert.equal(va.analizarArgumentos(['x', '--timeout', '2147483647']).timeoutMs, va.TIMEOUT_MAXIMO_MS);
  });

  test('--portal con ?consulta o #fragmento => error de uso (3) antes de cualquier petición', async () => {
    const srv = await levantar();
    try {
      for (const portal of [`${srv.portal}?nocache=1`, `${srv.portal}#ancla`]) {
        const r = await correr(['villapesqueira', '--api', srv.base, '--portal', portal]);
        assert.equal(r.codigo, 3, portal);
        assert.match(r.errores, /--portal no admite \?consulta ni #fragmento/);
      }
      assert.equal(srv.estado.peticiones.length, 0);
    } finally {
      await srv.cerrar();
    }
  });

  test('error de uso => código 3 (nunca 2, para no atrapar bucles de espera)', async () => {
    const r = await correr(['--timeout', 'x', 'carbo']);
    assert.equal(r.codigo, 3);
    assert.match(r.errores, /--timeout.*\n.*--ayuda/);
    assert.equal(r.salida, '');
  });

  test('--ayuda muestra uso, códigos y un bucle correcto', async () => {
    const r = await correr(['--ayuda']);
    assert.equal(r.codigo, 0);
    assert.match(r.salida, /USO/);
    assert.match(r.salida, /2 {2}ALTA_PENDIENTE/);
    assert.match(r.salida, /until node verificar-alta\.mjs villapesqueira .*codigo=\$\?; \[ "\$codigo" -ne 2 \]; do sleep 10; done/);
    assert.equal((await correr(['-h'])).codigo, 0);
  });
});

// ---------------------------------------------------------------------------
// Casos contra el servidor simulado
// ---------------------------------------------------------------------------

describe('verificación contra API simulada', () => {
  test('tenant OK => 0, sin avisos, solo GET/HEAD y concurrencia <= 3', async () => {
    const srv = await levantar();
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', [
        '--nombre', 'Villa Pesqueira', '--portal', srv.portal,
        '--esperar-texto', 'Bienvenidos a Villa Pesqueira',
        '--esperar-texto', `Rock & roll 'sonorense' y "más"`,
      ]);
      assert.equal(codigo, 0, JSON.stringify(conEstado(informe, 'FALLA'), null, 2));
      assert.equal(informe.resultado, 'OK');
      assert.deepEqual(informe.resumen, { ok: informe.comprobaciones.length, aviso: 0, falla: 0 });
      assert.equal(informe.municipio.id, ID_PRUEBA);
      for (const subruta of va.SUBRUTAS) {
        assert.equal(fila(informe, subruta).estado, 'OK', subruta);
        assert.ok(srv.rutas().includes(`/api/municipios/villapesqueira/${subruta}`), `pidió ${subruta}`);
      }
      assert.equal(fila(informe, 'hero').datos.conteo, 1);
      assert.equal(fila(informe, 'noticias').datos.conteo, 2);
      assert.equal(fila(informe, 'noticias (detalle)').estado, 'OK');
      assert.equal(filas(informe, 'texto esperado').length, 2);
      assert.match(fila(informe, 'portada /').detalle, /x-vercel-cache=HIT, age=12 s, x-nextjs-stale-time=300/);
      assert.equal(fila(informe, '/transparencia/sevac').estado, 'OK');
      assert.ok(srv.estado.peticiones.every((p) => p.metodo === 'GET' || p.metodo === 'HEAD'), 'solo GET/HEAD');
      assert.ok(srv.estado.maxEnVuelo <= 3, `concurrencia máxima ${srv.estado.maxEnVuelo}`);
      assert.equal(informe.peticiones, srv.estado.peticiones.length);
    } finally {
      await srv.cerrar();
    }
  });

  test('salida de texto legible, sin colores si no es TTY', async () => {
    const srv = await levantar();
    try {
      const r = await correr(['villapesqueira', '--api', srv.base, '--nombre', 'Villa Pesqueira']);
      assert.equal(r.codigo, 0);
      assert.match(r.salida, /Verificación de alta: villapesqueira/);
      assert.match(r.salida, /1\. Municipio en la API/);
      assert.match(r.salida, /3\. Contenido por subruta/);
      assert.match(r.salida, /\[ OK {2}\] hero/);
      assert.match(r.salida, /Resumen: \d+ OK · 0 AVISO · 0 FALLA/);
      assert.match(r.salida, /Resultado: OK \(código 0\)/);
      assert.doesNotMatch(r.salida, /\x1b\[/);
      assert.doesNotMatch(r.salida, /4\. Portal/, 'sin --portal no hay sección de portal');
    } finally {
      await srv.cerrar();
    }
  });

  test('colores solo con TTY y sin NO_COLOR', async () => {
    const srv = await levantar();
    try {
      const conColor = await correr(['villapesqueira', '--api', srv.base], { isTTY: true, env: {} });
      assert.match(conColor.salida, /\x1b\[32m\[ OK {2}\]\x1b\[0m/);
      const noColor = await correr(['villapesqueira', '--api', srv.base], { isTTY: true, env: { NO_COLOR: '' } });
      assert.doesNotMatch(noColor.salida, /\x1b\[/);
      const json = await correr(['villapesqueira', '--api', srv.base, '--json'], { isTTY: true, env: {} });
      assert.doesNotMatch(json.salida, /\x1b\[/);
    } finally {
      await srv.cerrar();
    }
  });

  test('alta pendiente => 2 y no pide las subrutas', async () => {
    const srv = await levantar((e) => {
      e.municipios = e.municipios.filter((m) => m.slug !== 'villapesqueira');
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', ['--portal', srv.portal]);
      assert.equal(codigo, 2);
      assert.equal(informe.resultado, 'ALTA_PENDIENTE');
      assert.match(informe.mensaje, /aún no existe en la BD; corre el alta/);
      assert.match(fila(informe, 'existe').detalle, /404 "Municipio no encontrado"/);
      assert.ok(!srv.rutas().some((r) => r.includes('/hero') || r.startsWith('/portal')), 'no sigue con subrutas ni portal');

      const texto = await correr(['villapesqueira', '--api', srv.base]);
      assert.equal(texto.codigo, 2);
      assert.match(texto.salida, /Resultado: ALTA_PENDIENTE \(código 2\) · El municipio "villapesqueira" aún no existe en la BD; corre el alta/);
    } finally {
      await srv.cerrar();
    }
  });

  test('slug con otras mayúsculas => 1 (no se queda esperando para siempre)', async () => {
    const srv = await levantar();
    try {
      const { codigo, informe } = await correrJson(srv, 'VillaPesqueira');
      assert.equal(codigo, 1);
      assert.equal(fila(informe, 'formato slug').estado, 'AVISO');
      assert.match(fila(informe, 'slug parecido').detalle, /sí "villapesqueira".*distinguen mayúsculas/);
    } finally {
      await srv.cerrar();
    }
  });

  test('municipioId cruzado en una subruta (fuga) => 1', async () => {
    const srv = await levantar((e) => {
      e.contenido.villapesqueira.funcionarios.push({ id: 'f-ajeno', municipioId: ID_OTRO });
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 1);
      assert.equal(informe.resultado, 'FALLA');
      const f = fila(informe, 'funcionarios');
      assert.equal(f.estado, 'FALLA');
      assert.match(f.detalle, /FUGA: 1 de 2 elementos con municipioId ajeno \(aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee\); p\. ej\. id f-ajeno/);
      assert.deepEqual(f.datos.municipioIdsAjenos, [ID_OTRO]);
    } finally {
      await srv.cerrar();
    }
  });

  test('detalle de noticia de otro municipio (fuga) => 1', async () => {
    const srv = await levantar((e) => {
      e.detallesNoticia.villapesqueira['primera-noticia'].municipioId = ID_OTRO;
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 1);
      assert.match(fila(informe, 'noticias (detalle)').detalle, /FUGA/);
    } finally {
      await srv.cerrar();
    }
  });

  test('elementos sin municipioId (documentos/imagenes) no fallan', async () => {
    const srv = await levantar((e) => {
      e.contenido.villapesqueira.imagenes = [{ id: 'i1', url: 'x' }, 'raro', null];
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 0);
      assert.match(fila(informe, 'imagenes').detalle, /3 elementos; la lista no trae municipioId/);
      assert.match(fila(informe, 'documentos').detalle, /1 elemento; la lista no trae municipioId/);
    } finally {
      await srv.cerrar();
    }
  });

  test('activo=false => 1', async () => {
    const srv = await levantar((e) => {
      e.municipios[1].activo = false;
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 1);
      assert.equal(fila(informe, 'activo').estado, 'FALLA');
      assert.match(fila(informe, 'activo').detalle, /activo = false/);
    } finally {
      await srv.cerrar();
    }
  });

  test('escudo 404 => 1 (intenta HEAD y luego GET)', async () => {
    const srv = await levantar((e) => {
      e.escudo = { status: 404, tipo: 'text/html' };
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 1);
      const escudo = fila(informe, 'escudo');
      assert.equal(escudo.estado, 'FALLA');
      assert.match(escudo.detalle, /-> 404, content-type "text\/html" vía GET \(HEAD dio 404\)/);
      const metodos = srv.estado.peticiones.filter((p) => p.ruta.startsWith('/escudos/')).map((p) => p.metodo);
      assert.deepEqual(metodos, ['HEAD', 'GET']);
    } finally {
      await srv.cerrar();
    }
  });

  test('escudo: HEAD no permitido pero GET 200 image/* => OK; 200 sin imagen => FALLA', async () => {
    const srv = await levantar((e) => {
      e.escudo = { status: 200, tipo: 'image/svg+xml', head: 405 };
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 0);
      assert.match(fila(informe, 'escudo').detalle, /200 image\/svg\+xml.*vía GET \(HEAD dio 405\)/);
      srv.estado.escenario.escudo = { status: 200, tipo: 'text/html' };
      const otra = await correrJson(srv, 'villapesqueira');
      assert.equal(otra.codigo, 1);
      assert.match(fila(otra.informe, 'escudo').detalle, /se esperaba 200 image\/\*/);
    } finally {
      await srv.cerrar();
    }
  });

  test('slug duplicado en la lista => 1', async () => {
    const srv = await levantar((e) => {
      e.lista = [...e.municipios, { ...e.municipios[1], id: ID_TERCERO }];
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 1);
      const f = fila(informe, 'aparece 1 vez');
      assert.equal(f.estado, 'FALLA');
      assert.match(f.detalle, /aparece 2 veces/);
      assert.deepEqual(f.datos.ids, [ID_PRUEBA, ID_TERCERO]);
    } finally {
      await srv.cerrar();
    }
  });

  test('ausente de la lista o con otro id => 1', async () => {
    const srv = await levantar((e) => {
      e.lista = [e.municipios[0]];
    });
    try {
      const a = await correrJson(srv, 'villapesqueira');
      assert.equal(a.codigo, 1);
      assert.match(fila(a.informe, 'aparece 1 vez').detalle, /no aparece en GET \/api\/municipios/);
      srv.estado.escenario.lista = [{ ...srv.estado.escenario.municipios[1], id: ID_TERCERO }];
      const b = await correrJson(srv, 'villapesqueira');
      assert.equal(b.codigo, 1);
      assert.match(fila(b.informe, 'aparece 1 vez').detalle, /otro id/);
    } finally {
      await srv.cerrar();
    }
  });

  test('portal sin el texto esperado => 1 con sugerencia de caché ISR', async () => {
    const srv = await levantar((e) => {
      e.portal['/'].cabeceras = { 'x-vercel-cache': 'STALE', age: '420', 'x-nextjs-stale-time': '300' };
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', [
        '--portal', srv.portal, '--nombre', 'Villa Pesqueira',
        '--esperar-texto', 'Bienvenidos a Villa Pesqueira',
        '--esperar-texto', 'Nueva administración 2027',
      ]);
      assert.equal(codigo, 1);
      const textos = filas(informe, 'texto esperado');
      assert.deepEqual(textos.map((t) => t.estado), ['OK', 'FALLA']);
      assert.match(textos[1].detalle, /no aparece "Nueva administración 2027"; puede ser la caché ISR \(~300 s\).*STALE.*reintenta/);
    } finally {
      await srv.cerrar();
    }
  });

  test('portal: nombre ausente => AVISO; /transparencia/sevac 500 => FALLA', async () => {
    const srv = await levantar((e) => {
      e.portal['/'].html = '<h1>Otro municipio</h1>';
      e.portal['/transparencia/sevac'].status = 500;
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', ['--portal', srv.portal, '--nombre', 'Villa Pesqueira']);
      assert.equal(codigo, 1);
      assert.equal(fila(informe, 'nombre en HTML').estado, 'AVISO');
      assert.equal(fila(informe, '/transparencia/sevac').estado, 'FALLA');
      const sevac = srv.estado.peticiones.filter((p) => p.ruta === '/portal/transparencia/sevac');
      assert.equal(sevac.length, 2, 'reintenta 1 vez ante 5xx');
    } finally {
      await srv.cerrar();
    }
  });

  test('portal caído => 1 (la API sí responde)', async () => {
    const srv = await levantar();
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', ['--portal', 'http://127.0.0.1:1', '--timeout', '2000']);
      assert.equal(codigo, 1);
      assert.match(fila(informe, 'portada /').detalle, /inalcanzable/);
      assert.equal(fila(informe, '/transparencia/sevac').estado, 'FALLA');
    } finally {
      await srv.cerrar();
    }
  });

  test('dominio null => 0 con AVISO informativo', async () => {
    const srv = await levantar((e) => {
      e.municipios[1].dominio = null;
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 0);
      assert.equal(informe.resultado, 'OK');
      const d = fila(informe, 'dominio');
      assert.equal(d.estado, 'AVISO');
      assert.equal(d.detalle, 'sin dominio propio (esperado mientras no haya dominio)');
      assert.equal(informe.resumen.aviso, 1);
    } finally {
      await srv.cerrar();
    }
  });

  test('hero vacío => 0 con AVISO (también estadísticas)', async () => {
    const srv = await levantar((e) => {
      e.contenido.villapesqueira.hero = [];
      e.contenido.villapesqueira.estadisticas = [];
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 0);
      const hero = fila(informe, 'hero');
      assert.equal(hero.estado, 'AVISO');
      assert.match(hero.detalle, /el portal podría ocultar el hero si el servidor no conserva el respaldo con listas vacías; carga contenido en el panel/);
      assert.equal(fila(informe, 'estadisticas').estado, 'AVISO');
      assert.equal(fila(informe, 'sevac').estado, 'OK');
    } finally {
      await srv.cerrar();
    }
  });

  test('nombre: --nombre ausente => FALLA; sin prefijo "H. Ayuntamiento de " => AVISO', async () => {
    const srv = await levantar((e) => {
      e.municipios[1].nombre = 'Municipio de Villa Pesqueira';
    });
    try {
      const a = await correrJson(srv, 'villapesqueira', ['--nombre', 'Villa Pesqueira']);
      assert.equal(a.codigo, 0);
      assert.equal(fila(a.informe, 'convención nombre').estado, 'AVISO');
      const b = await correrJson(srv, 'villapesqueira', ['--nombre', 'villa pesqueira']);
      assert.equal(b.codigo, 1);
      assert.match(fila(b.informe, 'nombre').detalle, /no incluye "villa pesqueira".*ignorando acentos\/mayúsculas/);
    } finally {
      await srv.cerrar();
    }
  });

  test('campos inválidos: id no UUID, slug distinto, estado vacío => 1', async () => {
    const srv = await levantar((e) => {
      Object.assign(e.municipios[1], { estado: '' });
      e.interceptar = (req, res, partes) => {
        if (partes.join('/') === 'api/municipios/villapesqueira') {
          enviarJson(req, res, 200, { ...e.municipios[1], id: '123', slug: 'villa-pesqueira' });
          return true;
        }
        return false;
      };
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 1);
      for (const clave of ['id', 'slug', 'estado']) assert.equal(fila(informe, clave).estado, 'FALLA', clave);
    } finally {
      await srv.cerrar();
    }
  });

  test('subruta que responde 500 o no-array => 1', async () => {
    const srv = await levantar((e) => {
      e.interceptar = (req, res, partes) => {
        if (partes[3] === 'sevac') { enviarJson(req, res, 500, { error: 'Error interno' }); return true; }
        if (partes[3] === 'atractivos') { enviarJson(req, res, 200, { datos: [] }); return true; }
        return false;
      };
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 1);
      assert.match(fila(informe, 'sevac').detalle, /500 "Error interno"/);
      assert.match(fila(informe, 'atractivos').detalle, /no es un array/);
      assert.equal(srv.rutas().filter((r) => r.endsWith('/sevac')).length, 2, 'reintenta 1 vez ante 5xx');
    } finally {
      await srv.cerrar();
    }
  });

  test('5xx transitorio en la API: el reintento lo salva => 0', async () => {
    let fallos = 0;
    const srv = await levantar((e) => {
      e.interceptar = (req, res, partes) => {
        if (partes.join('/') === 'api/municipios/villapesqueira' && fallos === 0) {
          fallos++;
          enviarJson(req, res, 502, { error: 'Bad gateway' });
          return true;
        }
        return false;
      };
    });
    try {
      const { codigo } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 0);
      assert.equal(fallos, 1);
    } finally {
      await srv.cerrar();
    }
  });
});

describe('portal: redirecciones y textos con otras mayúsculas', () => {
  const redirigir = (res, destino, status = 307) => {
    res.writeHead(status, { location: destino });
    res.end();
    return true;
  };

  test('/ y /transparencia/sevac redirigen a otra página con 200 => FALLA en ambas (1), sin revisar textos', async () => {
    const srv = await levantar((e) => {
      e.portal['/otro-sitio'] = { html: '<h1>Northa Digital: sitio no configurado</h1>' };
      e.interceptar = (req, res, partes) => (partes[0] === 'portal' && partes[1] !== 'otro-sitio'
        ? redirigir(res, '/portal/otro-sitio') : false);
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', [
        '--portal', srv.portal, '--nombre', 'Villa Pesqueira', '--esperar-texto', 'Bienvenidos a Villa Pesqueira',
      ]);
      assert.equal(codigo, 1);
      const portada = fila(informe, 'portada /');
      assert.equal(portada.estado, 'FALLA');
      assert.match(portada.detalle, /redirige a otra página: http:\/\/127\.0\.0\.1:\d+\/portal\/otro-sitio \(200\).*--portal; no se revisan los textos/);
      assert.equal(portada.datos.redireccion, 'distinta');
      const sevac = fila(informe, '/transparencia/sevac');
      assert.equal(sevac.estado, 'FALLA');
      assert.match(sevac.detalle, /redirige a otra página: .*\/portal\/otro-sitio/);
      assert.equal(filas(informe, 'texto esperado').length, 0);
      assert.equal(filas(informe, 'nombre en HTML').length, 0);
    } finally {
      await srv.cerrar();
    }
  });

  test('ruta SEVAC retirada que redirige a /transparencia => FALLA (la portada sigue OK)', async () => {
    const srv = await levantar((e) => {
      e.portal['/transparencia'] = { html: '<h1>Transparencia</h1>' };
      e.interceptar = (req, res, partes) => (partes.join('/') === 'portal/transparencia/sevac'
        ? redirigir(res, '/portal/transparencia', 308) : false);
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', ['--portal', srv.portal]);
      assert.equal(codigo, 1);
      assert.equal(fila(informe, 'portada /').estado, 'OK');
      assert.match(fila(informe, '/transparencia/sevac').detalle, /redirige a otra página: .*\/portal\/transparencia \(200\)/);
    } finally {
      await srv.cerrar();
    }
  });

  test('redirección al mismo sitio y ruta (barra final) => OK y se informa', async () => {
    const srv = await levantar((e) => {
      e.interceptar = (req, res) => (req.url === '/portal/' ? redirigir(res, '/portal', 308) : false);
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', [
        '--portal', srv.portal, '--esperar-texto', 'Bienvenidos a Villa Pesqueira',
      ]);
      assert.equal(codigo, 0, JSON.stringify(conEstado(informe, 'FALLA'), null, 2));
      const portada = fila(informe, 'portada /');
      assert.equal(portada.estado, 'OK');
      assert.match(portada.detalle, /redirigido a http:\/\/127\.0\.0\.1:\d+\/portal: mismo sitio/);
      assert.equal(fila(informe, 'texto esperado').estado, 'OK');
    } finally {
      await srv.cerrar();
    }
  });

  test('texto con otras mayúsculas por CSS => AVISO (0) sin culpar a la caché; sin acentos => FALLA; ausente => FALLA con caché', async () => {
    const srv = await levantar((e) => {
      e.portal['/'].html = `${HTML_PORTADA}<h3 class="text-lg font-bold capitalize">c. sylvia lenika placencia leal</h3>`
        + '<p class="capitalize">presidenta municipal</p><p>Comite de Transparencia</p>';
      e.portal['/'].cabeceras = { 'x-vercel-cache': 'HIT', age: '20', 'x-nextjs-stale-time': '300' };
    });
    try {
      const a = await correrJson(srv, 'villapesqueira', [
        '--portal', srv.portal,
        '--esperar-texto', 'C. Sylvia Lenika Placencia Leal', '--esperar-texto', 'Presidenta Municipal',
      ]);
      assert.equal(a.codigo, 0, JSON.stringify(conEstado(a.informe, 'FALLA'), null, 2));
      const [sylvia, presidenta] = filas(a.informe, 'texto esperado');
      assert.equal(sylvia.estado, 'AVISO');
      assert.match(sylvia.detalle, /solo aparece ignorando mayúsculas: en el HTML está "c\. sylvia lenika placencia leal" \(probable text-transform/);
      assert.doesNotMatch(sylvia.detalle, /puede ser la caché ISR|reintenta después/);
      assert.equal(sylvia.datos.enHtml, 'c. sylvia lenika placencia leal');
      assert.equal(presidenta.estado, 'AVISO');
      assert.equal(a.informe.resumen.aviso, 2);

      const b = await correrJson(srv, 'villapesqueira', ['--portal', srv.portal, '--esperar-texto', 'Comité de Transparencia']);
      assert.equal(b.codigo, 1);
      assert.match(fila(b.informe, 'texto esperado').detalle, /solo aparece ignorando acentos: en el HTML está "Comite de Transparencia"; revisa la ortografía/);

      const c = await correrJson(srv, 'villapesqueira', ['--portal', srv.portal, '--esperar-texto', 'Cabildo abierto 2027']);
      assert.equal(c.codigo, 1);
      assert.match(fila(c.informe, 'texto esperado').detalle, /no aparece "Cabildo abierto 2027"; puede ser la caché ISR.*reintenta después/);

      // --nombre en el HTML ignora mayúsculas (sigue exigiéndose tal cual en la API).
      srv.estado.escenario.portal['/'].html = '<h1 class="uppercase">h. ayuntamiento de villa pesqueira</h1>';
      const d = await correrJson(srv, 'villapesqueira', ['--portal', srv.portal, '--nombre', 'Villa Pesqueira']);
      assert.equal(d.codigo, 0);
      assert.equal(fila(d.informe, 'nombre').estado, 'OK');
      const nombreHtml = fila(d.informe, 'nombre en HTML');
      assert.equal(nombreHtml.estado, 'OK');
      assert.match(nombreHtml.detalle, /ignorando mayúsculas \(en el HTML: "villa pesqueira"\)/);
    } finally {
      await srv.cerrar();
    }
  });
});

describe('alta pendiente solo cuando esperar tiene sentido (2)', () => {
  test('slug con acento o con guion de más, existiendo el correcto => 1 (no espera para siempre)', async () => {
    const srv = await levantar();
    try {
      for (const slug of ['villapésqueira', 'villa-pesqueira', 'Villa-Pesqueira']) {
        const { codigo, informe } = await correrJson(srv, slug);
        assert.equal(codigo, 1, slug);
        assert.match(fila(informe, 'slug parecido').detalle, /no existe ".*" pero sí "villapesqueira": los slugs distinguen mayúsculas, acentos y guiones/);
        assert.match(informe.mensaje, /usa el slug exacto/);
      }
    } finally {
      await srv.cerrar();
    }
  });

  test('slug con formato inválido y sin parecido => 1 (nunca 2)', async () => {
    const srv = await levantar();
    try {
      for (const slug of ['pueblo_nuevo', 'Pueblo Nuevo', 'álamos']) {
        const { codigo, informe } = await correrJson(srv, slug);
        assert.equal(codigo, 1, slug);
        const formato = fila(informe, 'formato slug');
        assert.equal(formato.estado, 'FALLA');
        assert.match(formato.detalle, /no existe y no es un slug válido/);
        assert.match(informe.mensaje, /no tiene sentido esperar/);
      }
    } finally {
      await srv.cerrar();
    }
  });

  test('en el listado con el mismo slug pero detalle 404 => 1, no ALTA_PENDIENTE', async () => {
    const srv = await levantar((e) => {
      e.municipios[1].activo = false;
      e.interceptar = (req, res, partes) => {
        if (partes.join('/') === 'api/municipios/villapesqueira') {
          enviarJson(req, res, 404, { error: 'Municipio no encontrado' });
          return true;
        }
        return false;
      };
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 1);
      assert.equal(informe.resultado, 'FALLA');
      assert.match(fila(informe, 'aparece 1 vez').detalle, /SÍ aparece en GET \/api\/municipios \(id 11111111-2222-4333-8444-555555555555, activo=false\) aunque su detalle da 404/);
      assert.match(informe.mensaje, /no es un alta pendiente/);
    } finally {
      await srv.cerrar();
    }
  });

  test('si el listado no responde, el 404 del detalle sigue siendo ALTA_PENDIENTE (2) con AVISO', async () => {
    const srv = await levantar((e) => {
      e.municipios = e.municipios.filter((m) => m.slug !== 'villapesqueira');
      e.interceptar = (req, res, partes) => {
        if (partes.join('/') === 'api/municipios') { enviarJson(req, res, 500, { error: 'Error interno' }); return true; }
        return false;
      };
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 2);
      assert.equal(fila(informe, 'slug parecido').estado, 'AVISO');
      assert.match(fila(informe, 'slug parecido').detalle, /no se pudo revisar el listado.*500 "Error interno"/);
    } finally {
      await srv.cerrar();
    }
  });
});

describe('la API no responde a alguna consulta => 3 (no 1)', () => {
  const nuncaResponde = (condicion) => (e) => {
    e.interceptar = (req, res, partes) => condicion(partes.join('/'));
  };

  test('una subruta sin respuesta (timeout) => 3', async () => {
    const srv = await levantar(nuncaResponde((ruta) => ruta === 'api/municipios/villapesqueira/hero'));
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', ['--timeout', '150']);
      assert.equal(codigo, 3);
      assert.equal(informe.resultado, 'ERROR');
      const hero = fila(informe, 'hero');
      assert.equal(hero.estado, 'FALLA');
      assert.equal(hero.datos.errorRed, true);
      assert.match(hero.detalle, /tiempo de espera agotado \(150 ms\) tras 2 intentos/);
      assert.match(informe.mensaje, /La API no respondió a 1 consulta \(error de red o tiempo de espera\)/);
      assert.equal(fila(informe, 'sevac').estado, 'OK', 'lo demás se revisa igual');
    } finally {
      await srv.cerrar();
    }
  });

  test('el listado o el detalle de la noticia sin respuesta => 3', async () => {
    const srv = await levantar(nuncaResponde((ruta) => ruta === 'api/municipios' || ruta.startsWith('api/municipios/villapesqueira/noticias/')));
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', ['--timeout', '150']);
      assert.equal(codigo, 3);
      assert.equal(fila(informe, 'aparece 1 vez').datos.errorRed, true);
      assert.equal(fila(informe, 'noticias (detalle)').datos.errorRed, true);
      assert.match(informe.mensaje, /no respondió a 2 consultas/);
    } finally {
      await srv.cerrar();
    }
  });

  test('error de red de la API + una FALLA de contenido => 1 (la FALLA manda)', async () => {
    const srv = await levantar((e) => {
      e.contenido.villapesqueira.funcionarios.push({ id: 'f-ajeno', municipioId: ID_OTRO });
      nuncaResponde((ruta) => ruta === 'api/municipios/villapesqueira/hero')(e);
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', ['--timeout', '150']);
      assert.equal(codigo, 1);
      assert.match(informe.mensaje, /Hay 2 fallas \(1 por error de red de la API\)/);
    } finally {
      await srv.cerrar();
    }
  });

  test('el portal caído sigue siendo FALLA (1): no es la API', async () => {
    const srv = await levantar(nuncaResponde((ruta) => ruta.startsWith('portal')));
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', ['--portal', srv.portal, '--timeout', '150']);
      assert.equal(codigo, 1);
      assert.match(fila(informe, 'portada /').detalle, /inalcanzable: tiempo de espera agotado/);
    } finally {
      await srv.cerrar();
    }
  });
});

describe('API caída o inesperada => 3', () => {
  test('conexión rechazada', async () => {
    const srv = await levantar();
    const base = srv.base;
    await srv.cerrar();
    const r = await correr(['villapesqueira', '--api', base, '--json']);
    assert.equal(r.codigo, 3);
    const informe = JSON.parse(r.salida);
    assert.equal(informe.resultado, 'ERROR');
    assert.match(informe.mensaje, /La API no responde.*error de red \(ECONNREFUSED\) tras 2 intentos/);
  });

  test('timeout (la API no contesta)', async () => {
    const srv = await levantar((e) => {
      e.interceptar = () => true; // nunca responde
    });
    try {
      const inicio = Date.now();
      const { codigo, informe } = await correrJson(srv, 'villapesqueira', ['--timeout', '150']);
      assert.equal(codigo, 3);
      assert.match(informe.mensaje, /tiempo de espera agotado \(150 ms\) tras 2 intentos/);
      assert.equal(srv.estado.peticiones.length, 2, '1 intento + 1 reintento');
      assert.ok(Date.now() - inicio < 5000);
    } finally {
      await srv.cerrar();
    }
  });

  test('5xx persistente', async () => {
    const srv = await levantar((e) => {
      e.interceptar = (req, res) => { enviarJson(req, res, 503, { error: 'Servicio no disponible' }); return true; };
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 3);
      assert.match(informe.mensaje, /503 tras 2 intentos/);
    } finally {
      await srv.cerrar();
    }
  });

  test('"Ruta no encontrada" (base --api equivocada) no es alta pendiente', async () => {
    const srv = await levantar();
    try {
      const r = await correr(['villapesqueira', '--api', `${srv.base}/v2`, '--json']);
      assert.equal(r.codigo, 3);
      assert.match(JSON.parse(r.salida).mensaje, /404.*¿Es correcta la base --api\?/);
    } finally {
      await srv.cerrar();
    }
  });

  test('200 con cuerpo que no es JSON (p. ej. página de Cloudflare)', async () => {
    const srv = await levantar((e) => {
      e.interceptar = (req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>Just a moment...</html>'); return true; };
    });
    try {
      const { codigo, informe } = await correrJson(srv, 'villapesqueira');
      assert.equal(codigo, 3);
      assert.match(informe.mensaje, /no devolvió un objeto JSON/);
    } finally {
      await srv.cerrar();
    }
  });
});

// ---------------------------------------------------------------------------
// Proceso real (punto de entrada y bucle de espera documentado)
// ---------------------------------------------------------------------------

describe('como proceso', () => {
  let srv;
  before(async () => {
    let consultas = 0;
    srv = await levantar((e) => {
      // "nuevo" aparece en la BD a partir de la 3.ª consulta (simula que el alta termina).
      // Mientras tanto tampoco está en el listado (si estuviera, no sería un alta pendiente).
      e.interceptar = (req, res, partes) => {
        const ruta = partes.join('/');
        if (ruta === 'api/municipios/nuevo') {
          consultas++;
          if (consultas < 3) { enviarJson(req, res, 404, { error: 'Municipio no encontrado' }); return true; }
        }
        if (ruta === 'api/municipios' && consultas < 3) {
          enviarJson(req, res, 200, e.municipios.filter((m) => m.slug !== 'nuevo'));
          return true;
        }
        return false;
      };
      e.retrasoMs = 0;
    }, { slug: 'nuevo', nombre: 'Nuevo' });
  });
  after(async () => {
    await srv.cerrar();
  });

  test('importar el módulo no ejecuta main()', async () => {
    const r = await ejecutarProceso(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});`]);
    assert.equal(r.codigo, 0);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, '');
  });

  test('códigos de salida reales del proceso: 2 (pendiente) y 3 (uso)', async () => {
    const pendiente = await ejecutarProceso(process.execPath, [SCRIPT, 'noexiste', '--api', srv.base]);
    assert.equal(pendiente.codigo, 2);
    assert.match(pendiente.stdout, /ALTA_PENDIENTE \(código 2\)/);
    const uso = await ejecutarProceso(process.execPath, [SCRIPT]);
    assert.equal(uso.codigo, 3);
    assert.match(uso.stderr, /Falta el slug/);
  });

  test('el bucle documentado en --ayuda espera con 2 y termina con 0', { skip: !existsSync('/bin/bash') && 'sin bash' }, async () => {
    // process.execPath y no "node": el del PATH puede no existir o ser otra versión.
    const comando = `${JSON.stringify(process.execPath)} ${JSON.stringify(SCRIPT)} nuevo --api ${srv.base} --timeout 3000 --json > /dev/null`;
    const bucle = va.ejemploBucle({ comando, pausa: 0.05 });
    const r = await ejecutarProceso('/bin/bash', ['-c', bucle]);
    assert.equal(r.codigo, 0, r.stderr);
    assert.match(r.stdout, /Código final: 0/);
    const consultas = srv.rutas().filter((ruta) => ruta === '/api/municipios/nuevo').length;
    assert.ok(consultas >= 3, `consultó ${consultas} veces`);
  });
});
