// Pruebas de aislamiento-publico.mjs (node:test + node:http, sin dependencias).
// Ejecutar: node --test scripts/verificacion/aislamiento-publico.test.mjs
//
// Los datos de abajo son SINTÉTICOS: imitan la forma de la API pública de CMS
// Municipal (verificada con GET el 2026-09-30) para ejercitar el script contra
// un servidor local. No se hace ninguna petición a la red real.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  COLECCIONES,
  CODIGOS,
  parsearArgumentos,
  normalizarApi,
  listaDeSlugs,
  estimarPeticiones,
  elegirOtro,
  muestrear,
  revisarMunicipioIds,
  detectarIdsRepetidos,
  clasificarDetallePropio,
  clasificarDetalleCruzado,
  calcularCodigo,
  crearLimitador,
  crearCliente,
  ejecutar,
  formatearTexto,
  usarColor,
  ErrorUso,
} from './aislamiento-publico.mjs';

const SCRIPT = fileURLToPath(new URL('./aislamiento-publico.mjs', import.meta.url));

// ---------------------------------------------------------------------------
// Datos sintéticos
// ---------------------------------------------------------------------------

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Tenant sintético con ids únicos derivados de `base`. */
function fabricarTenant(base, slug, nombre) {
  const id = uuid(base);
  const mk = (k) => uuid(base * 1000 + k);
  const noticias = [1, 2, 3, 4].map((i) => ({
    id: mk(100 + i),
    municipioId: id,
    titulo: `Noticia ${i} de ${nombre}`,
    slug: `${slug}-noticia-${i}`,
    extracto: '...',
    imagenUrl: null,
    categoria: 'General',
    publicarEn: '2026-01-01T00:00:00.000Z',
    creadoEn: '2026-01-01T00:00:00.000Z',
    contenido: '<p>texto</p>',
  }));
  return {
    municipio: {
      id, nombre, slug, estado: 'Sonora', escudoUrl: null, dominio: `${slug}.gob.mx`,
      portadaHistoriaUrl: null, portadaHistoriaPublicId: null, activo: true,
      creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-01T00:00:00.000Z',
    },
    colecciones: {
      hero: [{ id: mk(1), municipioId: id, titulo: `Bienvenidos a ${nombre}`, orden: 1, activo: true }],
      noticias,
      sevac: [{ id: mk(10), municipioId: id, titulo: 'Cuenta pública 2025' }],
      estadisticas: [
        { id: mk(20), municipioId: id, titulo: 'Habitantes', valor: '1,000' },
        { id: mk(21), municipioId: id, titulo: 'Localidades', valor: '12' },
      ],
      documentos: [],
      funcionarios: [1, 2, 3].map((i) => ({ id: mk(30 + i), municipioId: id, nombre: `Persona ${i}`, cargo: 'Cargo' })),
      atractivos: [1, 2].map((i) => ({ id: mk(40 + i), municipioId: id, slug: `${slug}-atractivo-${i}`, nombre: `Atractivo ${i}` })),
      imagenes: [],
    },
  };
}

function datosBase() {
  return [
    fabricarTenant(1, 'alfa', 'Alfa'),
    fabricarTenant(2, 'beta', 'Beta'),
    fabricarTenant(3, 'gamma', 'Gamma'),
  ];
}

const CLAVE_DETALLE = { noticias: 'slug', atractivos: 'slug', funcionarios: 'id' };
const NO_ENCONTRADO = { noticias: 'Noticia no encontrada', atractivos: 'Atractivo no encontrado', funcionarios: 'Funcionario no encontrado' };

// ---------------------------------------------------------------------------
// Servidor simulado (API pública)
// ---------------------------------------------------------------------------

/**
 * escenario:
 *   tenants: [{ municipio, colecciones, oculto? }]   (oculto: no sale en /api/municipios)
 *   fugaDetalle: { noticias: true }                  (el detalle busca en TODOS los tenants)
 *   responder(req, res, url) -> true si ya respondió (para simular fallos)
 */
async function iniciarApi(escenario) {
  const registro = { peticiones: [], enVuelo: 0, maxEnVuelo: 0 };
  const enviar = (res, estado, cuerpo) => {
    const texto = JSON.stringify(cuerpo);
    res.writeHead(estado, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(texto) });
    res.end(texto);
  };
  const servidor = http.createServer((req, res) => {
    registro.peticiones.push({ metodo: req.method, url: req.url });
    registro.enVuelo++;
    registro.maxEnVuelo = Math.max(registro.maxEnVuelo, registro.enVuelo);
    res.on('close', () => { registro.enVuelo--; });

    // Pequeña latencia para que la concurrencia sea observable.
    setTimeout(() => {
      const url = new URL(req.url, 'http://localhost');
      if (escenario.responder && escenario.responder(req, res, url)) return;
      if (req.method !== 'GET' && req.method !== 'HEAD') return enviar(res, 405, { error: 'Método no permitido' });
      const partes = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (partes[0] !== 'api' || partes[1] !== 'municipios') return enviar(res, 404, { error: 'Ruta no encontrada', path: url.pathname });
      const tenants = escenario.tenants;
      if (partes.length === 2) return enviar(res, 200, tenants.filter((t) => !t.oculto).map((t) => t.municipio));
      const t = tenants.find((x) => x.municipio.slug === partes[2]);
      if (partes.length === 3) return t ? enviar(res, 200, t.municipio) : enviar(res, 404, { error: 'Municipio no encontrado' });
      const coleccion = partes[3];
      if (!COLECCIONES.includes(coleccion) || partes.length > 5) {
        return enviar(res, 404, { error: 'Ruta no encontrada', path: url.pathname });
      }
      if (!t) return enviar(res, 404, { error: `Municipio '${partes[2]}' no encontrado` });
      if (partes.length === 4) {
        const lista = t.colecciones[coleccion] ?? [];
        if (coleccion === 'noticias') {
          // La LISTA de noticias no trae municipioId (como la API real).
          return enviar(res, 200, lista.map(({ municipioId, contenido, ...resto }) => resto));
        }
        return enviar(res, 200, lista);
      }
      const clave = CLAVE_DETALLE[coleccion];
      if (!clave) return enviar(res, 404, { error: 'Ruta no encontrada', path: url.pathname });
      const donde = escenario.fugaDetalle?.[coleccion]
        ? [t, ...tenants.filter((x) => x !== t)].flatMap((x) => x.colecciones[coleccion] ?? [])
        : (t.colecciones[coleccion] ?? []);
      const elemento = donde.find((e) => String(e[clave]) === partes[4]);
      return elemento ? enviar(res, 200, elemento) : enviar(res, 404, { error: NO_ENCONTRADO[coleccion] });
    }, 3);
  });
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const { port } = servidor.address();
  return {
    url: `http://127.0.0.1:${port}`,
    registro,
    cerrar: () => new Promise((resolver) => {
      servidor.closeAllConnections?.();
      servidor.close(() => resolver());
    }),
  };
}

/** Ejecuta el script como proceso (async: el servidor vive en este mismo proceso). */
function correr(args, env = {}) {
  return new Promise((resolver, rechazar) => {
    const hijo = spawn(process.execPath, [SCRIPT, ...args], {
      env: { ...process.env, NO_COLOR: '1', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    hijo.stdout.on('data', (d) => { stdout += d; });
    hijo.stderr.on('data', (d) => { stderr += d; });
    hijo.on('error', rechazar);
    hijo.on('close', (codigo) => resolver({ codigo, stdout, stderr }));
  });
}

async function correrJson(args) {
  const r = await correr([...args, '--json']);
  let informe;
  try {
    informe = JSON.parse(r.stdout);
  } catch {
    assert.fail(`la salida --json no es JSON válido.\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  }
  return { ...r, informe };
}

const deTipo = (informe, tipo) => informe.hallazgos.filter((h) => h.tipo === tipo);

function soloGet(registro) {
  const otros = registro.peticiones.filter((p) => p.metodo !== 'GET');
  assert.deepEqual(otros, [], 'el script solo debe usar GET');
}

// ---------------------------------------------------------------------------
// Escenarios requeridos (proceso real, códigos de salida)
// ---------------------------------------------------------------------------

describe('escenarios contra la API simulada (CLI)', () => {
  test('sin fugas → código 0', async () => {
    const api = await iniciarApi({ tenants: datosBase() });
    try {
      const { codigo, informe, stderr } = await correrJson(['--api', api.url, '--muestras', '2']);
      assert.equal(codigo, 0, stderr);
      assert.equal(informe.codigo, 0);
      assert.equal(informe.resultado, 'SIN FUGAS');
      assert.equal(informe.tenants.length, 3);
      assert.equal(deTipo(informe, 'FUGA').length, 0);
      assert.equal(deTipo(informe, 'ERROR').length, 0);
      for (const t of informe.tenants) {
        assert.equal(t.estado, 'OK');
        assert.equal(t.colecciones.noticias, 4);
        // 2 noticias + 2 atractivos + 2 funcionarios
        assert.equal(t.detalle.propios, 6);
        assert.equal(t.detalle.propiosOk, 6);
        assert.equal(t.detalle.aislados, 6);
      }
      assert.deepEqual(informe.tenants.map((t) => t.otro), ['beta', 'gamma', 'alfa']);
      assert.equal(informe.peticiones.total, api.registro.peticiones.length);
      assert.ok(informe.peticiones.total <= informe.peticiones.estimadoMaximo);
      soloGet(api.registro);
    } finally {
      await api.cerrar();
    }
  });

  test('municipioId cruzado en hero → código 1', async () => {
    const datos = datosBase();
    datos[0].colecciones.hero.push({ id: uuid(999001), municipioId: datos[1].municipio.id, titulo: 'Hero de Beta' });
    const api = await iniciarApi({ tenants: datos });
    try {
      const { codigo, informe } = await correrJson(['--api', api.url, '--muestras', '1']);
      assert.equal(codigo, 1);
      const fugas = deTipo(informe, 'FUGA');
      assert.equal(fugas.length, 1);
      assert.equal(fugas[0].coleccion, 'hero');
      assert.deepEqual(fugas[0].tenants, ['alfa', 'beta']);
      assert.equal(fugas[0].datos.municipioId, datos[1].municipio.id);
      assert.match(fugas[0].mensaje, /alfa\/hero/);
      assert.equal(informe.tenants.find((t) => t.slug === 'alfa').estado, 'FUGA');
      assert.equal(informe.tenants.find((t) => t.slug === 'gamma').estado, 'OK');
    } finally {
      await api.cerrar();
    }
  });

  test('detalle de noticia de A accesible bajo B → código 1', async () => {
    const api = await iniciarApi({ tenants: datosBase(), fugaDetalle: { noticias: true } });
    try {
      const { codigo, informe } = await correrJson(['--api', api.url, '--muestras', '1', '--solo', 'alfa,beta']);
      assert.equal(codigo, 1);
      const fugas = deTipo(informe, 'FUGA');
      // alfa-noticia-1 bajo beta y beta-noticia-1 bajo alfa
      assert.equal(fugas.length, 2);
      assert.ok(fugas.every((f) => f.coleccion === 'noticias'));
      const f = fugas.find((x) => x.datos.pedido === 'alfa-noticia-1');
      assert.ok(f, JSON.stringify(fugas, null, 2));
      assert.equal(f.datos.ruta, '/api/municipios/beta/noticias/alfa-noticia-1');
      assert.deepEqual(f.tenants, ['alfa', 'beta']);
      // atractivos y funcionarios siguen aislados
      for (const t of informe.tenants) assert.equal(t.detalle.aislados, 2);
      soloGet(api.registro);
    } finally {
      await api.cerrar();
    }
  });

  test('mismo slug legítimo en ambos tenants con ids distintos → código 0 + INFO', async () => {
    const datos = datosBase();
    for (const [i, t] of datos.slice(0, 2).entries()) {
      t.colecciones.noticias.unshift({
        id: uuid(888000 + i), municipioId: t.municipio.id, titulo: 'Bienvenida', slug: 'bienvenida',
        extracto: '', imagenUrl: null, categoria: 'General', publicarEn: null, creadoEn: null,
      });
    }
    const api = await iniciarApi({ tenants: datos });
    try {
      const { codigo, informe } = await correrJson(['--api', api.url, '--muestras', '1', '--solo', 'alfa,beta']);
      assert.equal(codigo, 0);
      assert.equal(deTipo(informe, 'FUGA').length, 0);
      const infos = deTipo(informe, 'INFO');
      assert.equal(infos.length, 2);
      assert.ok(infos.every((h) => h.coleccion === 'noticias' && /bienvenida/.test(h.mensaje)));
      assert.ok(infos.every((h) => /no es fuga/.test(h.mensaje)));
      assert.equal(informe.tenants[0].detalle.infos, 1);
    } finally {
      await api.cerrar();
    }
  });

  test('id repetido entre tenants → código 1', async () => {
    const datos = datosBase();
    const repetido = uuid(777777);
    datos[0].colecciones.estadisticas[0].id = repetido;
    datos[2].colecciones.estadisticas[1].id = repetido;
    const api = await iniciarApi({ tenants: datos });
    try {
      const { codigo, informe } = await correrJson(['--api', api.url, '--muestras', '0']);
      assert.equal(codigo, 1);
      const fugas = deTipo(informe, 'FUGA');
      assert.equal(fugas.length, 1);
      assert.equal(fugas[0].coleccion, 'estadisticas');
      assert.equal(fugas[0].datos.id, repetido);
      assert.deepEqual(fugas[0].tenants, ['alfa', 'gamma']);
      assert.equal(informe.tenants.find((t) => t.slug === 'beta').estado, 'OK');
    } finally {
      await api.cerrar();
    }
  });

  test('--incluir de un slug inexistente → AVISO y código 0', async () => {
    const api = await iniciarApi({ tenants: datosBase() });
    try {
      const { codigo, informe } = await correrJson([
        '--api', api.url, '--incluir', 'villapesqueira', '--solo', 'alfa,villapesqueira', '--muestras', '1',
      ]);
      assert.equal(codigo, 0);
      const avisos = deTipo(informe, 'AVISO');
      assert.equal(avisos.length, 1, JSON.stringify(avisos));
      assert.match(avisos[0].mensaje, /villapesqueira: aún no dado de alta/);
      assert.deepEqual(informe.omitidos, [{ slug: 'villapesqueira', motivo: 'aún no dado de alta' }]);
      assert.deepEqual(informe.tenants.map((t) => t.slug), ['alfa']);
      // Con un solo tenant seleccionado, el "otro" es el siguiente de la lista completa.
      assert.equal(informe.tenants[0].otro, 'beta');
      assert.equal(informe.tenants[0].detalle.aislados, 3);
      assert.ok(api.registro.peticiones.some((p) => p.url === '/api/municipios/villapesqueira'));
    } finally {
      await api.cerrar();
    }
  });

  test('API caída (conexión rechazada) → código 3', async () => {
    // Puerto que acaba de liberarse: nadie escucha ahí.
    const tmp = await iniciarApi({ tenants: [] });
    const url = tmp.url;
    await tmp.cerrar();
    const { codigo, informe } = await correrJson(['--api', url, '--timeout', '2000']);
    assert.equal(codigo, 3);
    assert.equal(informe.resultado, 'ERROR');
    const errores = deTipo(informe, 'ERROR');
    assert.equal(errores.length, 1);
    assert.match(errores[0].mensaje, /No se pudo obtener la lista de municipios/);
    assert.match(errores[0].mensaje, /error de red/);
    assert.equal(informe.peticiones.total, 2, 'una petición + un reintento');
    assert.equal(informe.peticiones.reintentos, 1);
  });

  test('API responde 503 → reintenta una vez y termina con código 3 (salida de texto)', async () => {
    const api = await iniciarApi({
      tenants: datosBase(),
      responder: (req, res) => {
        res.writeHead(503, { 'content-type': 'text/html' });
        res.end('<html>Service Unavailable</html>');
        return true;
      },
    });
    try {
      const r = await correr(['--api', api.url]);
      assert.equal(r.codigo, 3);
      assert.equal(api.registro.peticiones.length, 2);
      assert.match(r.stdout, /HTTP 503/);
      assert.match(r.stdout, /Resultado: ERROR \(código 3\)/);
      assert.doesNotMatch(r.stdout, /\x1b\[/, 'sin colores fuera de TTY');
    } finally {
      await api.cerrar();
    }
  });
});

// ---------------------------------------------------------------------------
// Más escenarios (en proceso)
// ---------------------------------------------------------------------------

describe('ejecutar() en proceso', () => {
  let api;
  before(async () => { api = await iniciarApi({ tenants: datosBase() }); });
  after(async () => { await api.cerrar(); });

  const opts = (extra = {}) => ({ api: api.url, muestras: 3, concurrencia: 3, timeout: 5000, maxPeticiones: 500, incluir: [], solo: null, ...extra });

  test('respeta la concurrencia máxima y solo usa GET', async () => {
    api.registro.peticiones.length = 0;
    api.registro.maxEnVuelo = 0;
    const informe = await ejecutar(opts({ concurrencia: 2 }), { retrasoReintento: 0 });
    assert.equal(informe.codigo, 0);
    assert.ok(api.registro.maxEnVuelo <= 2, `máximo en vuelo: ${api.registro.maxEnVuelo}`);
    assert.ok(api.registro.maxEnVuelo >= 1);
    soloGet(api.registro);
    // 1 lista + 3×8 colecciones + 3 tenants × (3 noticias + 2 atractivos + 3 funcionarios) × 2
    assert.equal(informe.peticiones.total, 1 + 24 + 3 * 8 * 2);
    assert.equal(informe.peticiones.estimadoMaximo, estimarPeticiones({ tenants: 3, muestras: 3 }));
  });

  test('--solo con un slug desconocido → AVISO', async () => {
    const informe = await ejecutar(opts({ solo: ['alfa', 'Beta'], muestras: 0 }), { retrasoReintento: 0 });
    assert.equal(informe.codigo, 0);
    assert.deepEqual(informe.tenants.map((t) => t.slug), ['alfa']);
    const avisos = deTipo(informe, 'AVISO');
    assert.equal(avisos.length, 1);
    assert.match(avisos[0].mensaje, /--solo Beta/);
  });

  test('--incluir de un tenant que no está en la lista pero existe → se incluye (INFO)', async () => {
    const datos = datosBase();
    datos.push({ ...fabricarTenant(4, 'delta', 'Delta'), oculto: true });
    const otra = await iniciarApi({ tenants: datos });
    try {
      const informe = await ejecutar(opts({ api: otra.url, incluir: ['delta'], solo: ['delta', 'alfa'], muestras: 1 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, 0);
      assert.deepEqual(informe.tenants.map((t) => t.slug), ['alfa', 'delta']);
      assert.equal(informe.tenants[1].origen, 'incluir');
      assert.equal(deTipo(informe, 'INFO').length, 1);
    } finally {
      await otra.cerrar();
    }
  });

  test('presupuesto: si el máximo estimado supera --max-peticiones lanza ErrorUso', async () => {
    await assert.rejects(ejecutar(opts({ maxPeticiones: 20 }), { retrasoReintento: 0 }), ErrorUso);
  });

  test('timeout: un servidor que no responde da ERROR (código 3) tras un reintento', async () => {
    const lento = await iniciarApi({ tenants: [], responder: () => true /* nunca responde */ });
    try {
      const informe = await ejecutar(opts({ api: lento.url, timeout: 150 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, CODIGOS.ERROR);
      assert.match(informe.hallazgos[0].mensaje, /timeout/);
      assert.equal(lento.registro.peticiones.length, 2);
    } finally {
      await lento.cerrar();
    }
  });

  test('404 "Ruta no encontrada" en el detalle cruzado no cuenta como aislamiento', async () => {
    const datos = datosBase();
    const rara = await iniciarApi({
      tenants: datos,
      responder: (req, res, url) => {
        if (/^\/api\/municipios\/beta\/atractivos\/./.test(url.pathname)) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Ruta no encontrada', path: url.pathname }));
          return true;
        }
        return false;
      },
    });
    try {
      const informe = await ejecutar(opts({ api: rara.url, solo: ['alfa', 'beta'], muestras: 1 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, 0);
      const avisos = deTipo(informe, 'AVISO');
      // alfa-atractivo-1 bajo beta (no concluyente) + beta-atractivo-1 bajo beta (propio 404)
      assert.equal(avisos.length, 2, JSON.stringify(avisos, null, 2));
      assert.ok(avisos.some((a) => /no concluyente/.test(a.mensaje)));
      assert.equal(informe.tenants[0].detalle.aislados, 2);
    } finally {
      await rara.cerrar();
    }
  });

  test('una subruta que responde 500 → ERROR y código 3', async () => {
    const fallo = await iniciarApi({
      tenants: datosBase(),
      responder: (req, res, url) => {
        if (url.pathname === '/api/municipios/gamma/sevac') {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end('{"error":"Error interno"}');
          return true;
        }
        return false;
      },
    });
    try {
      const informe = await ejecutar(opts({ api: fallo.url, muestras: 0 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, 3);
      assert.equal(informe.peticiones.reintentos, 1);
      assert.equal(informe.tenants.find((t) => t.slug === 'gamma').estado, 'ERROR');
      assert.equal(informe.tenants.find((t) => t.slug === 'gamma').colecciones.sevac, null);
    } finally {
      await fallo.cerrar();
    }
  });

  test('elementos de colecciones obligatorias sin municipioId → AVISO (no fuga)', async () => {
    const datos = datosBase();
    delete datos[1].colecciones.funcionarios[0].municipioId;
    const sin = await iniciarApi({ tenants: datos });
    try {
      const informe = await ejecutar(opts({ api: sin.url, muestras: 0 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, 0);
      const avisos = deTipo(informe, 'AVISO');
      assert.equal(avisos.length, 1);
      assert.match(avisos[0].mensaje, /beta\/funcionarios: 1 elemento\(s\) sin municipioId/);
    } finally {
      await sin.cerrar();
    }
  });

  test('documentos con municipioId ajeno → FUGA; sin municipioId → sin aviso', async () => {
    const datos = datosBase();
    datos[0].colecciones.documentos = [{ id: uuid(555001), titulo: 'Sin municipio' }];
    datos[1].colecciones.imagenes = [{ id: uuid(555002), municipioId: datos[2].municipio.id, url: 'x' }];
    const docs = await iniciarApi({ tenants: datos });
    try {
      const informe = await ejecutar(opts({ api: docs.url, muestras: 0 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, 1);
      const fugas = deTipo(informe, 'FUGA');
      assert.equal(fugas.length, 1);
      assert.equal(fugas[0].coleccion, 'imagenes');
      assert.deepEqual(fugas[0].tenants, ['beta', 'gamma']);
      assert.equal(deTipo(informe, 'AVISO').length, 0);
    } finally {
      await docs.cerrar();
    }
  });
});

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

describe('parsearArgumentos', () => {
  test('valores por defecto', () => {
    const o = parsearArgumentos([]);
    assert.equal(o.api, 'https://api.northadigital.com');
    assert.equal(o.muestras, 3);
    assert.equal(o.timeout, 15000);
    assert.equal(o.concurrencia, 3);
    assert.equal(o.maxPeticiones, 500);
    assert.deepEqual(o.incluir, []);
    assert.equal(o.solo, null);
    assert.equal(o.json, false);
  });

  test('listas por comas y repetidas, sin duplicados', () => {
    const o = parsearArgumentos(['--solo', 'carbo, sanjavier', '--solo', 'carbo,bacadehuachi', '--incluir', 'villapesqueira']);
    assert.deepEqual(o.solo, ['carbo', 'sanjavier', 'bacadehuachi']);
    assert.deepEqual(o.incluir, ['villapesqueira']);
  });

  test('--ayuda', () => {
    assert.deepEqual(parsearArgumentos(['--ayuda']), { ayuda: true });
    assert.deepEqual(parsearArgumentos(['-h']), { ayuda: true });
  });

  test('errores de uso', () => {
    assert.throws(() => parsearArgumentos(['--muestras', 'tres']), ErrorUso);
    assert.throws(() => parsearArgumentos(['--muestras', '-1']), ErrorUso);
    assert.throws(() => parsearArgumentos(['--concurrencia', '0']), ErrorUso);
    assert.throws(() => parsearArgumentos(['--concurrencia', '11']), ErrorUso);
    assert.throws(() => parsearArgumentos(['--api', 'ftp://x']), ErrorUso);
    assert.throws(() => parsearArgumentos(['--api', 'no es url']), ErrorUso);
    assert.throws(() => parsearArgumentos(['--desconocida']), ErrorUso);
    assert.throws(() => parsearArgumentos(['posicional']), ErrorUso);
    assert.throws(() => parsearArgumentos(['--solo', '../etc']), ErrorUso);
    assert.throws(() => parsearArgumentos(['--solo', ',']), ErrorUso);
  });

  test('normalizarApi', () => {
    assert.equal(normalizarApi('https://api.northadigital.com/'), 'https://api.northadigital.com');
    assert.equal(normalizarApi('https://api.northadigital.com/api/'), 'https://api.northadigital.com');
    assert.equal(normalizarApi('http://127.0.0.1:3000?x=1'), 'http://127.0.0.1:3000');
  });

  test('listaDeSlugs respeta mayúsculas', () => {
    assert.deepEqual(listaDeSlugs(['Carbo,carbo']), ['Carbo', 'carbo']);
  });
});

describe('presupuesto y selección', () => {
  test('15 tenants con --muestras 3 no pasa de ~400 peticiones', () => {
    const n = estimarPeticiones({ tenants: 15, muestras: 3, resoluciones: 1 });
    assert.equal(n, 1 + 1 + 15 * 8 + 15 * 3 * 3 * 2);
    assert.ok(n <= 400, `estimado: ${n}`);
  });

  test('elegirOtro es circular y usa la lista completa si solo hay uno seleccionado', () => {
    const todos = ['a', 'b', 'c', 'd'].map((slug) => ({ slug }));
    const sel = [todos[0], todos[2]];
    assert.equal(elegirOtro(sel, todos, 'a').slug, 'c');
    assert.equal(elegirOtro(sel, todos, 'c').slug, 'a');
    assert.equal(elegirOtro([todos[3]], todos, 'd').slug, 'a');
    assert.equal(elegirOtro([todos[0]], [todos[0]], 'a'), null);
  });

  test('muestrear toma los primeros con clave válida y sin repetir', () => {
    const els = [{ slug: '' }, { slug: 'x' }, null, { slug: 'x' }, { slug: 'y' }, { slug: 'z' }];
    assert.deepEqual(muestrear(els, 'slug', 2).map((e) => e.slug), ['x', 'y']);
    assert.deepEqual(muestrear(els, 'slug', 0), []);
    assert.deepEqual(muestrear(null, 'slug', 3), []);
  });
});

describe('reglas de aislamiento', () => {
  const A = { id: 'id-a', slug: 'a' };
  const B = { id: 'id-b', slug: 'b' };
  const duenos = new Map([['id-a', 'a'], ['id-b', 'b']]);

  test('revisarMunicipioIds', () => {
    const h = revisarMunicipioIds(A, 'hero', [{ id: 1, municipioId: 'id-a' }, { id: 2, municipioId: 'id-b' }], duenos);
    assert.equal(h.length, 1);
    assert.equal(h[0].tipo, 'FUGA');
    assert.deepEqual(h[0].tenants, ['a', 'b']);
    assert.deepEqual(revisarMunicipioIds(A, 'noticias', [{ id: 1 }], duenos), []);
    assert.equal(revisarMunicipioIds(A, 'hero', [{ id: 1 }], duenos)[0].tipo, 'AVISO');
  });

  test('detectarIdsRepetidos ignora repetidos dentro del mismo tenant', () => {
    const h = detectarIdsRepetidos([
      { slug: 'a', listas: { hero: [{ id: 'x' }, { id: 'x' }], noticias: [{ id: 'n' }] } },
      { slug: 'b', listas: { hero: [{ id: 'y' }], noticias: [{ id: 'n' }] } },
    ]);
    assert.equal(h.length, 1);
    assert.equal(h[0].coleccion, 'noticias');
    assert.deepEqual(h[0].tenants, ['a', 'b']);
  });

  const cruzado = (respuesta, extra = {}) => clasificarDetalleCruzado({
    tenant: A, otro: B, coleccion: 'noticias', clave: 'slug', valor: 'hola',
    elemento: { id: 'n-a', slug: 'hola' }, respuesta: { ruta: '/api/municipios/b/noticias/hola', ...respuesta },
    duenoPorId: duenos, ...extra,
  });

  test('clasificarDetalleCruzado', () => {
    assert.equal(cruzado({ estado: 404, cuerpo: { error: 'Noticia no encontrada' } }).resultado, 'aislado');
    assert.equal(cruzado({ estado: 404, cuerpo: { error: "Municipio 'b' no encontrado" } }).resultado, 'aviso');
    assert.equal(cruzado({ estado: 500, cuerpo: {} }).resultado, 'error');
    assert.equal(cruzado({ estado: 200, cuerpo: {} }).resultado, 'aviso');
    assert.equal(cruzado({ estado: 200, cuerpo: null, jsonInvalido: true }).resultado, 'error');
    // Datos de A bajo B
    assert.equal(cruzado({ estado: 200, cuerpo: { id: 'n-a', municipioId: 'id-a', slug: 'hola' } }).resultado, 'fuga');
    assert.equal(cruzado({ estado: 200, cuerpo: { id: 'otro', municipioId: 'id-a', slug: 'hola' } }).resultado, 'fuga');
    // Mismo id aunque diga municipioId de B: fuga
    assert.equal(cruzado({ estado: 200, cuerpo: { id: 'n-a', municipioId: 'id-b' } }).resultado, 'fuga');
    // Propio de B con el mismo slug: INFO
    const listaB = [{ id: 'n-b', slug: 'hola' }];
    assert.equal(cruzado({ estado: 200, cuerpo: { id: 'n-b', municipioId: 'id-b', slug: 'hola' } }, { listaOtro: listaB }).resultado, 'info');
    // De B pero no está en su lista pública: AVISO (posible borrador), no fuga
    assert.equal(cruzado({ estado: 200, cuerpo: { id: 'n-b2', municipioId: 'id-b', slug: 'hola' } }, { listaOtro: [] }).resultado, 'aviso');
    // Sin municipioId: solo INFO si el id coincide con el propio de B
    assert.equal(cruzado({ estado: 200, cuerpo: { id: 'n-b', slug: 'hola' } }, { listaOtro: listaB }).resultado, 'info');
    assert.equal(cruzado({ estado: 200, cuerpo: { id: 'zzz', slug: 'hola' } }, { listaOtro: listaB }).resultado, 'fuga');
  });

  test('clasificarDetallePropio', () => {
    const propio = (respuesta) => clasificarDetallePropio({
      tenant: A, coleccion: 'noticias', clave: 'slug', valor: 'hola', elemento: { id: 'n-a', slug: 'hola' },
      respuesta: { ruta: '/api/municipios/a/noticias/hola', ...respuesta }, duenoPorId: duenos,
    });
    assert.equal(propio({ estado: 200, cuerpo: { id: 'n-a', municipioId: 'id-a', slug: 'hola' } }).resultado, 'ok');
    assert.equal(propio({ estado: 200, cuerpo: { id: 'n-a', municipioId: 'id-b', slug: 'hola' } }).resultado, 'fuga');
    assert.equal(propio({ estado: 200, cuerpo: { id: 'n-a', slug: 'hola' } }).resultado, 'aviso');
    assert.equal(propio({ estado: 404, cuerpo: { error: 'Noticia no encontrada' } }).resultado, 'aviso');
    assert.equal(propio({ estado: 0, error: 'error de red: ECONNRESET' }).resultado, 'error');
  });

  test('calcularCodigo: FUGA tiene prioridad sobre ERROR', () => {
    assert.equal(calcularCodigo([]), 0);
    assert.equal(calcularCodigo([{ tipo: 'AVISO' }, { tipo: 'INFO' }]), 0);
    assert.equal(calcularCodigo([{ tipo: 'ERROR' }]), 3);
    assert.equal(calcularCodigo([{ tipo: 'ERROR' }, { tipo: 'FUGA' }]), 1);
  });
});

describe('cliente HTTP', () => {
  test('crearLimitador no supera el máximo', async () => {
    const limitar = crearLimitador(2);
    let activos = 0;
    let maximo = 0;
    await Promise.all(Array.from({ length: 8 }, () => limitar(async () => {
      activos++;
      maximo = Math.max(maximo, activos);
      await new Promise((r) => setTimeout(r, 5));
      activos--;
    })));
    assert.equal(maximo, 2);
  });

  test('solo GET, reintento en error de red y tope de peticiones', async () => {
    const llamadas = [];
    let n = 0;
    const fetchImpl = async (url, init) => {
      llamadas.push(init.method);
      n++;
      if (n === 1) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
      return new Response('[]', { status: 200 });
    };
    const cliente = crearCliente({ api: 'http://x', fetchImpl, retrasoReintento: 0, maxPeticiones: 3 });
    const r1 = await cliente.get('/api/municipios');
    assert.equal(r1.estado, 200);
    assert.equal(r1.intentos, 2);
    assert.equal(cliente.estadisticas.reintentos, 1);
    await cliente.get('/api/municipios');
    const r3 = await cliente.get('/api/municipios');
    assert.equal(r3.estado, 0);
    assert.match(r3.error, /tope de peticiones/);
    assert.equal(cliente.estadisticas.peticiones, 3);
    assert.ok(llamadas.every((m) => m === 'GET'));
  });

  test('404 no se reintenta', async () => {
    let n = 0;
    const cliente = crearCliente({
      api: 'http://x', retrasoReintento: 0,
      fetchImpl: async () => { n++; return new Response('{"error":"x"}', { status: 404 }); },
    });
    const r = await cliente.get('/y');
    assert.equal(r.estado, 404);
    assert.equal(n, 1);
  });
});

describe('salida', () => {
  const informe = {
    api: 'http://x', tenantsListados: 1,
    parametros: { muestras: 1, concurrencia: 3, timeout: 15000, maxPeticiones: 500, incluir: [], solo: null },
    tenants: [{
      slug: 'a', id: 'id-a', nombre: 'A', origen: 'lista', otro: null, estado: 'OK',
      colecciones: Object.fromEntries(COLECCIONES.map((c) => [c, 0])),
      detalle: { propios: 0, propiosOk: 0, cruzados: 0, aislados: 0, infos: 0 },
      fugas: 0, errores: 0, avisos: 1, infos: 0,
    }],
    hallazgos: [{ tipo: 'AVISO', tenants: [], coleccion: null, mensaje: 'algo' }],
    peticiones: { total: 9, reintentos: 0, estimadoMaximo: 15, maximoPermitido: 500 },
    resumen: { tenantsRevisados: 1, tenantsConFuga: [], fugas: 0, errores: 0, avisos: 1, infos: 0 },
    codigo: 0, resultado: 'SIN FUGAS', duracionMs: 1200,
  };

  test('texto sin colores y con color', () => {
    const plano = formatearTexto(informe, { color: false });
    assert.doesNotMatch(plano, /\x1b\[/);
    assert.match(plano, /Resultado: SIN FUGAS \(código 0\)/);
    assert.match(plano, /AVISO  algo/);
    assert.match(formatearTexto(informe, { color: true }), /\x1b\[/);
  });

  test('usarColor respeta TTY y NO_COLOR', () => {
    assert.equal(usarColor({ isTTY: true }, {}), true);
    assert.equal(usarColor({ isTTY: false }, {}), false);
    assert.equal(usarColor({ isTTY: true }, { NO_COLOR: '' }), false);
    assert.equal(usarColor({ isTTY: true }, { NO_COLOR: '1' }), false);
  });

  test('--ayuda sale con 0 y argumentos inválidos con 2', async () => {
    const ayuda = await correr(['--ayuda']);
    assert.equal(ayuda.codigo, 0);
    assert.match(ayuda.stdout, /Códigos de salida/);
    const malo = await correr(['--muestras', 'x']);
    assert.equal(malo.codigo, 2);
    assert.match(malo.stderr, /--muestras debe ser un entero/);
  });

  test('importar el módulo no ejecuta main()', async () => {
    const r = await new Promise((resolver) => {
      const hijo = spawn(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(SCRIPT)}); console.log('importado');`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      hijo.stdout.on('data', (d) => { out += d; });
      hijo.on('close', (codigo) => resolver({ codigo, out }));
    });
    assert.equal(r.codigo, 0);
    assert.equal(r.out.trim(), 'importado');
  });
});
