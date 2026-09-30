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
      e.interceptar = (req, res, partes) => {
        if (partes.join('/') === 'api/municipios/nuevo') {
          consultas++;
          if (consultas < 3) { enviarJson(req, res, 404, { error: 'Municipio no encontrado' }); return true; }
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
    const comando = `node ${JSON.stringify(SCRIPT)} nuevo --api ${srv.base} --timeout 3000 --json > /dev/null`;
    const bucle = va.ejemploBucle({ comando, pausa: 0.05 });
    const r = await ejecutarProceso('/bin/bash', ['-c', bucle]);
    assert.equal(r.codigo, 0, r.stderr);
    assert.match(r.stdout, /Código final: 0/);
    const consultas = srv.rutas().filter((ruta) => ruta === '/api/municipios/nuevo').length;
    assert.ok(consultas >= 3, `consultó ${consultas} veces`);
  });
});
