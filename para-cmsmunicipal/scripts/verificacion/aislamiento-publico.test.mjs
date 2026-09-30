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

import fs from 'node:fs';

import {
  COLECCIONES,
  CODIGOS,
  MAX_OTROS_EXTERNOS,
  parsearArgumentos,
  leerArgv,
  normalizarApi,
  listaDeSlugs,
  estimarPeticiones,
  elegirOtro,
  candidatosOtro,
  es404DeElemento,
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

  test('404 "Ruta no encontrada" en el detalle: no cuenta como aislamiento y el propio es ERROR → código 3', async () => {
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
      assert.equal(informe.codigo, CODIGOS.ERROR);
      assert.equal(deTipo(informe, 'FUGA').length, 0);
      // alfa-atractivo-1 bajo beta: 404 no concluyente (AVISO).
      const avisos = deTipo(informe, 'AVISO');
      assert.equal(avisos.length, 1, JSON.stringify(avisos, null, 2));
      assert.match(avisos[0].mensaje, /beta\/atractivos\/alfa-atractivo-1.*404 no concluyente \(la ruta o el municipio no existen\)/);
      const errores = deTipo(informe, 'ERROR').map((h) => h.mensaje);
      assert.equal(errores.length, 3, JSON.stringify(errores, null, 2));
      // beta-atractivo-1 bajo beta (su propio tenant) debía dar 200.
      assert.ok(errores.some((m) => /GET \/api\/municipios\/beta\/atractivos\/beta-atractivo-1 → HTTP 404 "Ruta no encontrada" \(se esperaba 200/.test(m)));
      // Ninguna de las dos colecciones de atractivos quedó demostrada.
      assert.ok(errores.some((m) => /^alfa: el detalle cruzado bajo beta no fue concluyente en atractivos/.test(m)));
      assert.ok(errores.some((m) => /^beta: el detalle cruzado bajo alfa no fue concluyente en atractivos/.test(m)));
      const [alfa, beta] = informe.tenants;
      assert.equal(alfa.detalle.aislados, 2);
      assert.equal(alfa.detalle.noConcluyentes, 1);
      // El 404 de beta-atractivo-1 bajo alfa es "Atractivo no encontrado", pero sin 200 propio no prueba nada.
      assert.equal(beta.detalle.aislados, 2);
      assert.equal(beta.detalle.noConcluyentes, 1);
      assert.equal(beta.detalle.propiosOk, 2);
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
// Revisión adversarial: detalle no verificable, 0 tenants, 404 raros,
// presupuesto, tenant de contraste y cortacircuitos
// ---------------------------------------------------------------------------

describe('la prueba no se da por buena si no demostró nada', () => {
  const json = (res, estado, cuerpo) => {
    res.writeHead(estado, { 'content-type': 'application/json' });
    res.end(JSON.stringify(cuerpo));
    return true;
  };
  const partes = (url) => url.pathname.split('/').filter(Boolean);
  const opts = (api, extra = {}) => ({
    api, muestras: 2, concurrencia: 3, timeout: 5000, maxPeticiones: 500, incluir: [], solo: null, ...extra,
  });

  test('detalle propio siempre 404 "… no encontrado": el 404 cruzado no cuenta → código 3', async () => {
    const api = await iniciarApi({
      tenants: datosBase(),
      responder: (req, res, url) => (partes(url).length === 5 ? json(res, 404, { error: NO_ENCONTRADO[partes(url)[3]] }) : false),
    });
    try {
      const { codigo, informe } = await correrJson(['--api', api.url, '--muestras', '2']);
      assert.equal(codigo, 3);
      assert.equal(informe.resultado, 'ERROR');
      for (const t of informe.tenants) {
        assert.equal(t.detalle.propiosOk, 0);
        assert.equal(t.detalle.aislados, 0, `${t.slug}: sin 200 propio no hay aislamiento demostrado`);
        assert.equal(t.detalle.noConcluyentes, 6);
        assert.equal(t.estado, 'ERROR');
      }
      const errores = deTipo(informe, 'ERROR');
      assert.equal(errores.length, 3, JSON.stringify(errores, null, 2));
      assert.ok(errores.every((e) => /no fue concluyente en noticias, atractivos, funcionarios/.test(e.mensaje)));
      // Cada propio con 404 "no encontrado" es una incoherencia lista/detalle (AVISO).
      assert.equal(deTipo(informe, 'AVISO').length, 18);
    } finally {
      await api.cerrar();
    }
  });

  test('ruta de detalle inexistente (404 "Ruta no encontrada" también bajo el propio) → ERROR, código 3', async () => {
    const api = await iniciarApi({
      tenants: datosBase(),
      responder: (req, res, url) => (partes(url).length === 5 ? json(res, 404, { error: 'Ruta no encontrada', path: url.pathname }) : false),
    });
    try {
      const informe = await ejecutar(opts(api.url, { muestras: 1 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, CODIGOS.ERROR);
      const errores = deTipo(informe, 'ERROR').map((h) => h.mensaje);
      // 3 tenants × 3 detalles propios que debían dar 200 + 3 "no concluyente".
      assert.equal(errores.filter((m) => /se esperaba 200/.test(m)).length, 9);
      assert.equal(errores.filter((m) => /no fue concluyente/.test(m)).length, 3);
      assert.equal(deTipo(informe, 'AVISO').filter((h) => /404 no concluyente/.test(h.mensaje)).length, 9);
      assert.ok(informe.tenants.every((t) => t.detalle.aislados === 0 && t.estado === 'ERROR'));
    } finally {
      await api.cerrar();
    }
  });

  test('404 cruzado sin el JSON de "no encontrado" (HTML de proxy, {}, {"message"}) → no concluyente, código 3', async () => {
    const datos = datosBase();
    const idsAlfa = new Set(Object.values(datos[0].colecciones).flat().map((e) => e.id));
    const raros = {
      noticias: (res) => { res.writeHead(404, { 'content-type': 'text/html' }); res.end('<html><body>404 Not Found</body></html>'); return true; },
      atractivos: (res) => json(res, 404, {}),
      funcionarios: (res) => json(res, 404, { message: 'Not Found' }),
    };
    const api = await iniciarApi({
      tenants: datos,
      responder: (req, res, url) => {
        const p = partes(url);
        const deAlfa = p.length === 5 && (p[4].startsWith('alfa-') || idsAlfa.has(p[4]));
        return p[2] === 'beta' && deAlfa ? raros[p[3]](res) : false;
      },
    });
    try {
      const informe = await ejecutar(opts(api.url, { solo: ['alfa', 'beta'], muestras: 1 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, CODIGOS.ERROR);
      const [alfa, beta] = informe.tenants;
      assert.equal(alfa.detalle.propiosOk, 3);
      assert.equal(alfa.detalle.aislados, 0);
      assert.equal(alfa.detalle.noConcluyentes, 3);
      assert.equal(beta.detalle.aislados, 3);
      assert.equal(beta.estado, 'OK');
      const avisos = deTipo(informe, 'AVISO').map((h) => h.mensaje);
      assert.equal(avisos.length, 3, JSON.stringify(avisos, null, 2));
      assert.ok(avisos.some((m) => /noticias\/alfa-noticia-1.*cuerpo no JSON; se esperaba \{"error":"Noticia no encontrada"\}/.test(m)));
      assert.ok(avisos.some((m) => /atractivos\/alfa-atractivo-1.*mensaje inesperado; se esperaba \{"error":"Atractivo no encontrado"\}/.test(m)));
      assert.ok(avisos.some((m) => /funcionarios\/.*mensaje inesperado; se esperaba \{"error":"Funcionario no encontrado"\}/.test(m)));
      const errores = deTipo(informe, 'ERROR');
      assert.equal(errores.length, 1);
      assert.match(errores[0].mensaje, /^alfa: el detalle cruzado bajo beta no fue concluyente en noticias, atractivos, funcionarios/);
    } finally {
      await api.cerrar();
    }
  });

  test('/api/municipios responde [] → ERROR y código 3', async () => {
    const api = await iniciarApi({ tenants: [] });
    try {
      const { codigo, informe } = await correrJson(['--api', api.url]);
      assert.equal(codigo, 3);
      assert.equal(informe.resumen.tenantsRevisados, 0);
      const errores = deTipo(informe, 'ERROR');
      assert.equal(errores.length, 1);
      assert.match(errores[0].mensaje, /lista vacía/);
    } finally {
      await api.cerrar();
    }
  });

  test('--solo solo con slugs que no existen (errata de mayúsculas) → ERROR y código 3', async () => {
    const api = await iniciarApi({ tenants: datosBase() });
    try {
      const r = await correr(['--api', api.url, '--solo', 'Alfa,Beta']);
      assert.equal(r.codigo, 3);
      assert.match(r.stdout, /ERROR\s+No hay tenants que revisar: ningún slug de --solo \(Alfa, Beta\)/);
      assert.match(r.stdout, /Resultado: ERROR \(código 3\)/);
      assert.equal(api.registro.peticiones.length, 1);
    } finally {
      await api.cerrar();
    }
  });

  test('--solo solo de tenants pendientes de alta (--incluir con 404) → AVISO y código 0', async () => {
    const api = await iniciarApi({ tenants: datosBase() });
    try {
      const { codigo, informe } = await correrJson(['--api', api.url, '--incluir', 'villapesqueira', '--solo', 'villapesqueira']);
      assert.equal(codigo, 0);
      assert.equal(deTipo(informe, 'ERROR').length, 0);
      const avisos = deTipo(informe, 'AVISO').map((h) => h.mensaje);
      assert.ok(avisos.some((m) => /villapesqueira: aún no dado de alta/.test(m)));
      assert.ok(avisos.some((m) => /los de --solo aún no están dados de alta/.test(m)));
    } finally {
      await api.cerrar();
    }
  });

  test('presupuesto: con un solo tenant, el estimado cubre las listas del "otro" y basta como tope', async () => {
    const datos = datosBase();
    for (const [i, t] of datos.slice(0, 2).entries()) {
      t.colecciones.noticias.unshift({ id: uuid(889000 + i), municipioId: t.municipio.id, slug: 'bienvenida', titulo: 'Bienvenida' });
    }
    const api = await iniciarApi({ tenants: datos });
    try {
      const libre = await ejecutar(opts(api.url, { solo: ['alfa'], muestras: 1 }), { retrasoReintento: 0 });
      assert.equal(libre.codigo, 0);
      assert.equal(libre.peticiones.estimadoMaximo, estimarPeticiones({ tenants: 1, muestras: 1, otrosExternos: 2 }));
      assert.ok(libre.peticiones.total <= libre.peticiones.estimadoMaximo,
        `total ${libre.peticiones.total} > estimado ${libre.peticiones.estimadoMaximo}`);
      const justo = await ejecutar(
        opts(api.url, { solo: ['alfa'], muestras: 1, maxPeticiones: libre.peticiones.estimadoMaximo }),
        { retrasoReintento: 0 },
      );
      assert.equal(justo.codigo, 0, JSON.stringify(justo.hallazgos, null, 2));
      assert.equal(deTipo(justo, 'ERROR').length, 0);
      const infos = deTipo(justo, 'INFO');
      assert.equal(infos.length, 1);
      assert.match(infos[0].mensaje, /beta tiene su propio elemento en noticias con slug "bienvenida"/);
    } finally {
      await api.cerrar();
    }
  });

  test('el "otro" salta al siguiente tenant activo cuyas listas responden → código 0', async () => {
    const datos = datosBase();
    datos[1].municipio.activo = false;
    const api = await iniciarApi({
      tenants: datos,
      responder: (req, res, url) => (url.pathname.startsWith('/api/municipios/beta/')
        ? json(res, 404, { error: "Municipio 'beta' no encontrado" })
        : false),
    });
    try {
      const { codigo, informe } = await correrJson(['--api', api.url, '--muestras', '2']);
      assert.equal(codigo, 0, JSON.stringify(deTipo(informe, 'ERROR'), null, 2));
      const alfa = informe.tenants.find((t) => t.slug === 'alfa');
      assert.equal(alfa.otro, 'gamma');
      assert.equal(alfa.detalle.aislados, 6);
      assert.equal(alfa.detalle.noConcluyentes, 0);
      assert.equal(informe.tenants.find((t) => t.slug === 'gamma').otro, 'alfa');
      // Nada se pidió bajo beta salvo sus listas (inactivo: AVISO, no ERROR).
      assert.ok(!api.registro.peticiones.some((p) => p.url.split('/').length === 6 && p.url.startsWith('/api/municipios/beta/')));
      assert.equal(deTipo(informe, 'AVISO').length, COLECCIONES.length);
    } finally {
      await api.cerrar();
    }
  });

  test('sin tenant de contraste utilizable → ERROR y código 3 (no se presenta como OK)', async () => {
    const datos = datosBase();
    datos[1].municipio.activo = false;
    datos[2].municipio.activo = false;
    const api = await iniciarApi({ tenants: datos });
    try {
      const informe = await ejecutar(opts(api.url, { solo: ['alfa'], muestras: 1 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, CODIGOS.ERROR);
      assert.equal(informe.tenants[0].otro, null);
      assert.equal(informe.tenants[0].estado, 'ERROR');
      const errores = deTipo(informe, 'ERROR');
      assert.equal(errores.length, 1);
      assert.match(errores[0].mensaje, /alfa: no hay tenant de contraste/);
      assert.match(formatearTexto(informe), /cruzado: sin tenant de contraste/);
    } finally {
      await api.cerrar();
    }
  });

  test('candidato externo cuyas listas fallan → AVISO y se usa el siguiente', async () => {
    const api = await iniciarApi({
      tenants: datosBase(),
      responder: (req, res, url) => (url.pathname === '/api/municipios/beta/funcionarios'
        ? json(res, 500, { error: 'Error interno' })
        : false),
    });
    try {
      const informe = await ejecutar(opts(api.url, { solo: ['alfa'], muestras: 1 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, 0, JSON.stringify(informe.hallazgos, null, 2));
      assert.equal(informe.tenants[0].otro, 'gamma');
      assert.equal(informe.tenants[0].detalle.aislados, 3);
      const avisos = deTipo(informe, 'AVISO');
      assert.equal(avisos.length, 1);
      assert.match(avisos[0].mensaje, /beta no sirve como tenant de contraste: GET \/api\/municipios\/beta\/funcionarios → HTTP 500/);
      // El estimado no cuenta reintentos (el 500 de beta/funcionarios se reintentó una vez).
      assert.equal(informe.peticiones.reintentos, 1);
      assert.ok(informe.peticiones.total - informe.peticiones.reintentos <= informe.peticiones.estimadoMaximo);
    } finally {
      await api.cerrar();
    }
  });

  test('un solo tenant en toda la API → AVISO (no hay a quién filtrar) y código 0', async () => {
    const api = await iniciarApi({ tenants: [fabricarTenant(1, 'alfa', 'Alfa')] });
    try {
      const informe = await ejecutar(opts(api.url, { muestras: 1 }), { retrasoReintento: 0 });
      assert.equal(informe.codigo, 0);
      assert.match(deTipo(informe, 'AVISO')[0].mensaje, /Solo hay un tenant en la API/);
    } finally {
      await api.cerrar();
    }
  });

  test('cortacircuitos: con las subrutas colgadas deja de pedir tras 5 fallos seguidos', async () => {
    const api = await iniciarApi({ tenants: datosBase(), responder: (req, res, url) => partes(url).length >= 4 });
    try {
      const t0 = Date.now();
      const informe = await ejecutar(opts(api.url, { timeout: 150, muestras: 3 }), { retrasoReintento: 0 });
      const ms = Date.now() - t0;
      assert.equal(informe.codigo, CODIGOS.ERROR);
      assert.equal(informe.peticiones.cortacircuitos, true);
      // 1 lista + como mucho (5 + 2 en vuelo) get() fallidos × 2 intentos; sin cortacircuitos serían 1 + 24 × 2.
      assert.ok(informe.peticiones.total <= 15, `peticiones: ${informe.peticiones.total}`);
      assert.ok(informe.peticiones.omitidas >= 24 - 7, `omitidas: ${informe.peticiones.omitidas}`);
      const incompletas = deTipo(informe, 'ERROR').filter((h) => /^Revisión incompleta: la API dejó de responder/.test(h.mensaje));
      assert.equal(incompletas.length, 1);
      assert.ok(deTipo(informe, 'ERROR').length <= 8, 'sin un ERROR por cada petición omitida');
      assert.ok(informe.tenants.every((t) => t.estado === 'ERROR'));
      assert.ok(ms < 5000, `tardó ${ms} ms`);
      assert.match(formatearTexto(informe), /omitidas: \d+ por cortacircuitos/);
    } finally {
      await api.cerrar();
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

  test('leerArgv (sin util.parseArgs): --op=valor, repetibles, -h y errores', () => {
    assert.deepEqual(
      leerArgv(['--muestras=2', '--solo', 'a', '--solo=b', '-h', '--json', '--api', 'http://x', '--api', 'http://y']),
      { muestras: '2', solo: ['a', 'b'], ayuda: true, json: true, api: 'http://y' },
    );
    const o = parsearArgumentos(['--solo=carbo', '--muestras=0', '--max-peticiones=50']);
    assert.deepEqual(o.solo, ['carbo']);
    assert.equal(o.muestras, 0);
    assert.equal(o.maxPeticiones, 50);
    assert.throws(() => leerArgv(['--muestras']), /--muestras necesita un valor/);
    assert.throws(() => leerArgv(['--api', '--json']), /--api necesita un valor/);
    assert.throws(() => leerArgv(['--json=1']), /--json no lleva valor/);
    assert.throws(() => leerArgv(['-x']), /opción desconocida: -x/);
    assert.throws(() => leerArgv(['--']), ErrorUso);
    assert.throws(() => leerArgv(['--toString']), /opción desconocida/);
  });

  test('no importa node:util (parseArgs no existe en Node 18.0–18.2 y rompería con código 1)', () => {
    const fuente = fs.readFileSync(SCRIPT, 'utf8');
    assert.doesNotMatch(fuente, /from\s+['"](node:)?util['"]/);
    assert.doesNotMatch(fuente, /import\s*\(\s*['"](node:)?util['"]\s*\)/);
  });
});

describe('presupuesto y selección', () => {
  test('15 tenants con --muestras 3 no pasa de ~400 peticiones', () => {
    const n = estimarPeticiones({ tenants: 15, muestras: 3, resoluciones: 1 });
    assert.equal(n, 1 + 1 + 15 * 8 + 15 * 3 * 3 * 2);
    assert.ok(n <= 400, `estimado: ${n}`);
  });

  test('el estimado incluye las listas de hasta MAX_OTROS_EXTERNOS tenants de contraste fuera de la selección', () => {
    assert.equal(estimarPeticiones({ tenants: 1, muestras: 1, otrosExternos: 13 }), 1 + 8 + 3 * 2 + MAX_OTROS_EXTERNOS * 3);
    assert.equal(estimarPeticiones({ tenants: 1, muestras: 1, otrosExternos: 1 }), 1 + 8 + 3 * 2 + 3);
    assert.equal(estimarPeticiones({ tenants: 1, muestras: 0, otrosExternos: 13 }), 1 + 8, 'sin detalle no hay contraste');
    assert.equal(estimarPeticiones({ tenants: 0, muestras: 3, otrosExternos: 13 }), 1);
    // Humo típico: 3 de 14 tenants con --muestras 3 sigue muy por debajo de ~400.
    assert.ok(estimarPeticiones({ tenants: 3, muestras: 3, otrosExternos: 11 }) <= 400);
  });

  test('candidatosOtro: primero la selección (circular), luego el resto; sin inactivos', () => {
    const todos = [{ slug: 'a' }, { slug: 'b', activo: false }, { slug: 'c' }, { slug: 'd' }, { slug: 'e' }];
    const [a, , c, d] = todos;
    const nombres = (xs) => xs.map((x) => x.slug);
    assert.deepEqual(nombres(candidatosOtro([a, c], todos, 'a')), ['c', 'd', 'e']);
    assert.deepEqual(nombres(candidatosOtro([a, c], todos, 'c')), ['a', 'd', 'e']);
    assert.deepEqual(nombres(candidatosOtro([d], todos, 'd')), ['e', 'a', 'c']);
    assert.deepEqual(nombres(candidatosOtro([a], [a, todos[1]], 'a')), []);
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

  test('clasificarDetalleCruzado: solo el 404 JSON de "no encontrado" de esa colección es aislamiento', () => {
    assert.equal(cruzado({ estado: 404, cuerpo: { error: 'Noticia no encontrada.' } }).resultado, 'aislado');
    const noConcluyentes = [
      [{ estado: 404, cuerpo: undefined, jsonInvalido: true }, /cuerpo no JSON; se esperaba \{"error":"Noticia no encontrada"\}/],
      [{ estado: 404, cuerpo: undefined }, /cuerpo no JSON/],
      [{ estado: 404, cuerpo: {} }, /mensaje inesperado/],
      [{ estado: 404, cuerpo: { message: 'Not Found' } }, /mensaje inesperado/],
      [{ estado: 404, cuerpo: { error: 'Atractivo no encontrado' } }, /mensaje inesperado/],
      [{ estado: 404, cuerpo: { error: 'Ruta no encontrada', path: '/x' } }, /la ruta o el municipio no existen/],
    ];
    for (const [respuesta, patron] of noConcluyentes) {
      const r = cruzado(respuesta);
      assert.equal(r.resultado, 'aviso', JSON.stringify(respuesta));
      assert.equal(r.hallazgos[0].tipo, 'AVISO');
      assert.match(r.hallazgos[0].mensaje, patron);
    }
  });

  test('es404DeElemento', () => {
    assert.equal(es404DeElemento('funcionarios', { estado: 404, cuerpo: { error: 'Funcionario no encontrado' } }), true);
    assert.equal(es404DeElemento('funcionarios', { estado: 404, cuerpo: { error: 'Noticia no encontrada' } }), false);
    assert.equal(es404DeElemento('hero', { estado: 404, cuerpo: { error: 'Hero no encontrado' } }), false);
    assert.equal(es404DeElemento('noticias', { estado: 200, cuerpo: { error: 'Noticia no encontrada' } }), false);
    assert.equal(es404DeElemento('noticias', { estado: 404, jsonInvalido: true }), false);
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
    // Bajo su propio tenant se espera 200: un 404 que no es "Noticia no encontrada" es ERROR.
    const ruta = propio({ estado: 404, cuerpo: { error: 'Ruta no encontrada', path: '/x' } });
    assert.equal(ruta.resultado, 'error');
    assert.match(ruta.hallazgos[0].mensaje, /se esperaba 200.*la ruta o el municipio no existen/);
    assert.equal(propio({ estado: 404, cuerpo: { error: "Municipio 'a' no encontrado" } }).resultado, 'error');
    assert.equal(propio({ estado: 404, cuerpo: undefined, jsonInvalido: true }).resultado, 'error');
    // `valido`: solo con 200 y datos el 404 cruzado demuestra aislamiento.
    assert.equal(propio({ estado: 200, cuerpo: { id: 'n-a', municipioId: 'id-a', slug: 'hola' } }).valido, true);
    assert.equal(propio({ estado: 200, cuerpo: { id: 'n-a', slug: 'hola' } }).valido, true);
    assert.equal(propio({ estado: 200, cuerpo: { id: 'n-a', municipioId: 'id-b', slug: 'hola' } }).valido, true);
    assert.equal(propio({ estado: 200, cuerpo: {} }).valido, false);
    assert.equal(propio({ estado: 404, cuerpo: { error: 'Noticia no encontrada' } }).valido, false);
    assert.equal(propio({ estado: 500, cuerpo: {} }).valido, false);
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

  test('cortacircuitos: tras N fallos seguidos no llama más a fetch; una respuesta HTTP reinicia la cuenta', async () => {
    let llamadas = 0;
    const fetchImpl = async () => {
      llamadas++;
      if (llamadas === 3) return new Response('[]', { status: 200 });
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    };
    const cliente = crearCliente({ api: 'http://x', fetchImpl, retrasoReintento: 0, concurrencia: 1, fallosSeguidos: 3 });
    const r1 = await cliente.get('/1'); // llamadas 1 y 2: falla
    assert.equal(r1.estado, 0);
    assert.equal(r1.omitida, false);
    const r2 = await cliente.get('/2'); // llamada 3: 200 → reinicia la cuenta
    assert.equal(r2.estado, 200);
    assert.equal(cliente.estadisticas.fallosSeguidos, 0);
    for (const ruta of ['/3', '/4', '/5']) await cliente.get(ruta); // 3 fallos seguidos (6 llamadas)
    assert.equal(llamadas, 9);
    assert.equal(cliente.estadisticas.cortado, true);
    assert.match(cliente.estadisticas.motivoCorte, /ECONNREFUSED/);
    const r6 = await cliente.get('/6');
    assert.equal(llamadas, 9, 'con el cortacircuitos abierto no se hacen más peticiones');
    assert.equal(r6.omitida, true);
    assert.equal(r6.estado, 0);
    assert.match(r6.error, /cortacircuitos/);
    assert.equal(cliente.estadisticas.omitidas, 1);
  });

  test('cortacircuitos: los 5xx no lo abren (la API sí responde) y 0 lo desactiva', async () => {
    let llamadas = 0;
    const con5xx = crearCliente({
      api: 'http://x', retrasoReintento: 0, fallosSeguidos: 2,
      fetchImpl: async () => { llamadas++; return new Response('{"error":"x"}', { status: 503 }); },
    });
    for (let i = 0; i < 4; i++) await con5xx.get(`/${i}`);
    assert.equal(con5xx.estadisticas.cortado, false);
    assert.equal(llamadas, 8);
    const sinCorte = crearCliente({
      api: 'http://x', retrasoReintento: 0, fallosSeguidos: 0,
      fetchImpl: async () => { throw new TypeError('fetch failed'); },
    });
    for (let i = 0; i < 6; i++) await sinCorte.get(`/${i}`);
    assert.equal(sinCorte.estadisticas.cortado, false);
    assert.equal(sinCorte.estadisticas.peticiones, 12);
  });

  test('si el reintento se omite por el tope, vale el resultado real del primer intento', async () => {
    const cliente = crearCliente({
      api: 'http://x', retrasoReintento: 0, maxPeticiones: 1,
      fetchImpl: async () => new Response('{"error":"caído"}', { status: 502 }),
    });
    const r = await cliente.get('/y');
    assert.equal(r.estado, 502);
    assert.equal(r.omitida, false);
    assert.equal(r.intentos, 1);
    assert.equal(cliente.estadisticas.reintentos, 0);
    assert.equal(cliente.estadisticas.agotado, true);
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

  test('--ayuda sale con 0; argumentos inválidos y presupuesto excedido con 3 (como el resto de la suite)', async () => {
    const ayuda = await correr(['--ayuda']);
    assert.equal(ayuda.codigo, 0);
    assert.match(ayuda.stdout, /Códigos de salida/);
    assert.doesNotMatch(ayuda.stdout, /^\s*2\s/m, 'la ayuda no debe documentar un código 2');
    const malo = await correr(['--muestras', 'x']);
    assert.equal(malo.codigo, 3);
    assert.match(malo.stderr, /--muestras debe ser un entero/);
    const desconocida = await correr(['--opcion-inexistente']);
    assert.equal(desconocida.codigo, 3);
    assert.match(desconocida.stderr, /opción desconocida: --opcion-inexistente/);
    const api = await iniciarApi({ tenants: datosBase() });
    try {
      const tope = await correr(['--api', api.url, '--max-peticiones', '10']);
      assert.equal(tope.codigo, 3);
      assert.match(tope.stderr, /supera --max-peticiones 10/);
    } finally {
      await api.cerrar();
    }
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
