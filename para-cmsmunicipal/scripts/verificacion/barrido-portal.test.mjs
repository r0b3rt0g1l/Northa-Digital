// Pruebas de barrido-portal.mjs (node:test, sin dependencias).
//
//   node --test scripts/verificacion/barrido-portal.test.mjs
//
// Un servidor node:http local simula a la vez la API (/api/municipios) y el
// portal (HTML, sitemap.xml, robots.txt y /_next/static/*). No sale a la red.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  main,
  CODIGO,
  normalizarConMapa,
  rangoOriginal,
  regexTermino,
  nombreBase,
  construirTerminos,
  analizarDocumento,
  extraerLocsSitemap,
  reescribirHost,
  extraerEnlacesInternos,
  extraerRecursosNext,
  planificarRutas,
  esCorreoPlaceholder,
  digitosTelefono,
  mencionaOtroMunicipio,
  leerArgv,
  parsearArgumentos,
  formatearReporte,
  ErrorBarrido,
} from './barrido-portal.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'barrido-portal.mjs');

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const MUNICIPIOS = [
  { id: '1', nombre: 'H. Ayuntamiento de Sahuaripa', slug: 'sahuaripa', dominio: 'sahuaripatransparencia.com.mx' },
  { id: '2', nombre: 'H. Ayuntamiento de Carbó', slug: 'carbo', dominio: 'carbotransparencia.com.mx' },
  { id: '3', nombre: 'H. Ayuntamiento de Baviácora', slug: 'baviacora', dominio: 'baviacoratransparencia.com.mx' },
  { id: '4', nombre: 'Municipio de Aconchi', slug: 'aconchi', dominio: 'www.aconchitransparencia.com.mx' },
  { id: '5', nombre: 'H. Ayuntamiento de Rayón', slug: 'rayon', dominio: 'www.rayontransparencia.com.mx' },
];

const CHUNK_MAIN = '/_next/static/chunks/main-abc123.js';
const CHUNK_PAGINA = '/_next/static/chunks/app/page-def456.js';
const CSS = '/_next/static/css/app-789.css';

/** HTML parecido al de Next (app router): CSS, chunk, payload RSC con ruta relativa. */
function html({ cuerpo = '', enlaces = ['/gobierno', '/contacto'], municipio = 'Villa Pesqueira' } = {}) {
  const nav = enlaces.map((e) => `<a href="${e}">${e}</a>`).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
<title>Inicio · H. Ayuntamiento de ${municipio}</title>
<link rel="stylesheet" href="${CSS}?dpl=dpl_1" data-precedence="next"/>
<script src="${CHUNK_MAIN}?dpl=dpl_1" async=""></script>
</head><body><nav>${nav}<a href="https://facebook.com/villapesqueira">Facebook</a><a href="/escudo.png">Escudo</a><a href="#arriba">Arriba</a></nav>
<main><h1>H. Ayuntamiento de ${municipio}</h1><p>${cuerpo}</p></main>
<script>self.__next_f.push([1,"2:I[5123,[\\"static/chunks/app/page-def456.js?dpl=dpl_1\\"],\\"default\\"]\\n"])</script>
</body></html>`;
}

function sitemap(locs) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map((l) => `  <url><loc>${l}</loc><lastmod>2026-09-01</lastmod></url>`).join('\n')}
</urlset>`;
}

/**
 * Portal limpio de Villa Pesqueira. `cambios` reemplaza o agrega rutas; cada
 * valor es un string (cuerpo), { estado, cuerpo, tipo, retraso } o una función
 * (req, origen, n) que devuelve eso (n = número de petición a esa ruta).
 */
function portalLimpio(cambios = {}) {
  return {
    '/': html({ cuerpo: 'Bienvenidos a Villa Pesqueira, Sonora. Tierra de trabajo.' }),
    '/gobierno': html({ cuerpo: 'Cabildo 2024-2027 de Villa Pesqueira.' }),
    '/contacto': html({ cuerpo: 'Escríbenos desde el formulario.' }),
    '/turismo': html({ cuerpo: 'Visita la presa y el templo de Mátape.' }),
    '/sitemap.xml': (req, origen) => sitemap([`${origen}/`, `${origen}/turismo`, `${origen}/gobierno`]),
    '/robots.txt': (req, origen) => `User-agent: *\nAllow: /\nSitemap: ${origen}/sitemap.xml\n`,
    [CHUNK_MAIN]: '(()=>{console.log("portal")})();',
    [CHUNK_PAGINA]: '"use strict";(self.webpackChunk=self.webpackChunk||[]).push([[1],{1:(e,t,n)=>{n.d(t,{t:()=>"Villa Pesqueira"})}}]);',
    [CSS]: 'body{margin:0}.carbon{color:#111}',
    ...cambios,
  };
}

function tipoPorRuta(ruta) {
  if (ruta.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (ruta.endsWith('.css')) return 'text/css; charset=utf-8';
  if (ruta.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (ruta.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (ruta.startsWith('/api/')) return 'application/json; charset=utf-8';
  return 'text/html; charset=utf-8';
}

/**
 * Levanta el servidor local. `rutas` es un mapa ruta -> respuesta; `api` es la
 * respuesta de /api/municipios (por defecto MUNICIPIOS en JSON).
 */
async function levantar(rutas, { api = { cuerpo: JSON.stringify(MUNICIPIOS) }, retraso = 0 } = {}) {
  const registro = [];
  const conteo = new Map();
  const temporizadores = new Set();
  const estado = { activos: 0, maxActivos: 0 };
  let origen = '';
  const server = http.createServer((req, res) => {
    estado.activos++;
    estado.maxActivos = Math.max(estado.maxActivos, estado.activos);
    let cerrado = false;
    const terminar = () => {
      if (!cerrado) {
        cerrado = true;
        estado.activos--;
      }
    };
    res.on('close', terminar);
    const u = new URL(req.url, 'http://local');
    registro.push({ metodo: req.method, ruta: u.pathname, url: req.url });
    const n = (conteo.get(u.pathname) ?? 0) + 1;
    conteo.set(u.pathname, n);
    let r = u.pathname === '/api/municipios' ? api : rutas[u.pathname];
    if (typeof r === 'function') r = r(req, origen, n);
    if (r === undefined) r = { estado: 404, cuerpo: '<!DOCTYPE html><html><body>No encontrado</body></html>' };
    if (typeof r === 'string') r = { cuerpo: r };
    const responder = () => {
      if (res.destroyed) return;
      res.writeHead(r.estado ?? 200, { 'content-type': r.tipo ?? tipoPorRuta(u.pathname) });
      res.end(r.cuerpo ?? '');
    };
    const espera = r.retraso ?? retraso;
    if (espera > 0) {
      const t = setTimeout(() => {
        temporizadores.delete(t);
        responder();
      }, espera);
      temporizadores.add(t);
      req.on('close', () => {
        if (res.writableEnded) return;
        clearTimeout(t);
        temporizadores.delete(t);
      });
    } else {
      responder();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origen = `http://127.0.0.1:${server.address().port}`;
  return {
    origen,
    registro,
    estado,
    veces: (ruta) => conteo.get(ruta) ?? 0,
    cerrar: () =>
      new Promise((resolve) => {
        for (const t of temporizadores) clearTimeout(t);
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

/** Puerto local sin servidor (para simular la API caída). */
async function puertoCerrado() {
  const s = http.createServer();
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  const { port } = s.address();
  await new Promise((resolve) => s.close(resolve));
  return `http://127.0.0.1:${port}`;
}

/** Corre main() en proceso con --json y devuelve { codigo, json, texto, err }. */
async function barrer(srv, args = [], { slug = 'villapesqueira', nombre = 'Villa Pesqueira', json = true, api } = {}) {
  const out = [];
  const err = [];
  const argv = [
    '--portal', srv.origen,
    '--slug', slug,
    '--api', api ?? srv.origen,
    '--timeout', '3000',
    ...(nombre ? ['--nombre', nombre] : []),
    ...(json ? ['--json'] : []),
    ...args,
  ];
  const codigo = await main(argv, { salida: (t) => out.push(t), error: (t) => err.push(t), esperaReintento: 0 });
  const texto = out.join('\n');
  return { codigo, json: json && texto ? JSON.parse(texto) : null, texto, err: err.join('\n') };
}

/** Levanta un portal, barre y cierra. */
async function barrerPortal(rutas, args, opciones = {}) {
  const srv = await levantar(rutas, opciones.servidor);
  try {
    return { ...(await barrer(srv, args, opciones)), srv };
  } finally {
    await srv.cerrar();
  }
}

const terminosHallados = (json) => json.restos.map((g) => g.termino).sort();

// ---------------------------------------------------------------------------
// Barrido completo contra el servidor local
// ---------------------------------------------------------------------------

test('portal limpio: código 0, rutas de sitemap + enlaces, chunks y CSS una sola vez, solo GET', async () => {
  const { codigo, json, srv } = await barrerPortal(portalLimpio());
  assert.equal(codigo, CODIGO.LIMPIO);
  assert.equal(json.codigo, 0);
  assert.deepEqual(json.restos, []);
  assert.deepEqual(json.errores, []);
  const rutas = json.rutas.map((r) => r.ruta);
  assert.equal(rutas[0], '/');
  assert.deepEqual([...rutas].sort(), ['/', '/contacto', '/gobierno', '/turismo']);
  const recursos = json.recursos.map((r) => r.ruta).sort();
  assert.deepEqual(recursos, [CHUNK_PAGINA, CHUNK_MAIN, CSS].sort());
  // Cada recurso y cada ruta se pidió una sola vez (la portada tampoco se repite).
  for (const ruta of ['/', '/gobierno', '/contacto', '/turismo', CHUNK_MAIN, CHUNK_PAGINA, CSS, '/sitemap.xml']) {
    assert.equal(srv.veces(ruta), 1, `${ruta} pedida ${srv.veces(ruta)} veces`);
  }
  // Nada fuera del host (facebook), ni la imagen /escudo.png como ruta.
  assert.ok(!rutas.includes('/escudo.png'));
  assert.ok(srv.registro.every((r) => r.metodo === 'GET'), 'solo GET');
  // La query ?dpl= se conserva al pedir el chunk.
  assert.ok(srv.registro.some((r) => r.url === `${CHUNK_MAIN}?dpl=dpl_1`));
  assert.equal(json.nombre, 'Villa Pesqueira');
  assert.equal(json.fuenteNombre, 'argumento');
});

test('resto "Sahuaripa" en texto plano del HTML: código 1 con contexto del original', async () => {
  const cuerpo =
    'Portal oficial del municipio. Para trámites acude a la presidencia municipal de Sahuaripa en horario de oficina.';
  const { codigo, json } = await barrerPortal(portalLimpio({ '/gobierno': html({ cuerpo }) }));
  assert.equal(codigo, CODIGO.RESTOS);
  assert.deepEqual(terminosHallados(json), ['sahuaripa']);
  const g = json.restos[0];
  assert.equal(g.total, 1);
  assert.equal(g.archivos.length, 1);
  assert.equal(g.archivos[0].archivo, '/gobierno');
  assert.equal(g.archivos[0].conteo, 1);
  const ctx = g.archivos[0].contextos[0];
  assert.match(ctx, /presidencia municipal de «Sahuaripa» en horario/);
  // ±60 caracteres alrededor, con elipsis porque el texto sigue.
  const [antes, resto] = ctx.split('«Sahuaripa»');
  assert.equal(antes.replace(/^…/, '').length, 60);
  assert.equal(resto.replace(/…$/, '').length, 60);
  assert.ok(g.origenes.includes('API (nombre)'));
});

test('resto escrito como S\\u0061huaripa dentro de un chunk JS: código 1 y contexto con el escape original', async () => {
  const chunk = 'self.x={colindancias:{norte:"S\\u0061huaripa",sur:"Mátape"},lada:"623"};';
  const { codigo, json } = await barrerPortal(portalLimpio({ [CHUNK_PAGINA]: chunk }));
  assert.equal(codigo, CODIGO.RESTOS);
  assert.deepEqual(terminosHallados(json), ['sahuaripa']);
  const a = json.restos[0].archivos[0];
  assert.equal(a.archivo, CHUNK_PAGINA);
  assert.match(a.contextos[0], /norte:"«S\\u0061huaripa»",sur/);
});

test('resto escrito con entidades HTML (&iacute; &#97; &#x61;): código 1 en cada forma', async () => {
  for (const forma of ['Sahuar&iacute;pa', 'S&#97;huaripa', 'Sahu&#x61;ripa', 'SAHUAR&Iacute;PA']) {
    const { codigo, json } = await barrerPortal(
      portalLimpio({ '/contacto': html({ cuerpo: `Oficina de enlace en ${forma}, Sonora.` }) }),
    );
    assert.equal(codigo, CODIGO.RESTOS, forma);
    assert.deepEqual(terminosHallados(json), ['sahuaripa'], forma);
    assert.ok(json.restos[0].archivos[0].contextos[0].includes(`«${forma}»`), forma);
  }
});

test('--extra: "misi\\u00f3n jesuita de 1639" en un chunk se detecta (1); sin --extra no (0)', async () => {
  const chunk = 'const h={subtitulo:"Pueblo de origen ópata y misi\\u00f3n jesuita de 1639, en la regi\\u00f3n del R\\u00edo Sonora."};';
  const rutas = portalLimpio({ [CHUNK_PAGINA]: chunk });

  const sin = await barrerPortal(rutas);
  assert.equal(sin.codigo, CODIGO.LIMPIO);

  const con = await barrerPortal(rutas, ['--extra', '1639,misión jesuita', '--extra', 'río sonora']);
  assert.equal(con.codigo, CODIGO.RESTOS);
  assert.deepEqual(terminosHallados(con.json), ['1639', 'mision jesuita', 'rio sonora']);
  const g = con.json.restos.find((x) => x.termino === 'mision jesuita');
  assert.match(g.archivos[0].contextos[0], /«misi\\u00f3n jesuita»/);
  assert.deepEqual(g.origenes, ['--extra']);
});

test('límites de palabra: "carbón", "carbono", "Carbonera" y "crayón" no disparan "carbo" ni "rayon" (0)', async () => {
  const cuerpo = 'Programa de captura de carbono y venta de carbón. Colonia Carbonera. Dibujo con crayón. Rayones en la pared.';
  const chunk = 'const e="carbon-neutral",t={crayon:1,carbono:2};';
  const { codigo, json } = await barrerPortal(portalLimpio({ '/': html({ cuerpo }), [CHUNK_PAGINA]: chunk }));
  assert.equal(codigo, CODIGO.LIMPIO, JSON.stringify(json.restos));
  // En cambio "Carbó" solo sí es un resto.
  const r = await barrerPortal(portalLimpio({ '/': html({ cuerpo: `${cuerpo} Visita Carbó.` }) }));
  assert.equal(r.codigo, CODIGO.RESTOS);
  assert.deepEqual(terminosHallados(r.json), ['carbo']);
});

test('--permitir: un término lo silencia en todo el portal; una frase solo dentro de ella', async () => {
  const rutas = portalLimpio({
    '/': html({ cuerpo: 'Villa Pesqueira es colindante con Sahuaripa al oriente.' }),
    '/gobierno': html({ cuerpo: 'Directorio heredado: presidencia de Sahuaripa.' }),
  });
  const base = await barrerPortal(rutas);
  assert.equal(base.codigo, CODIGO.RESTOS);
  assert.equal(base.json.restos[0].total, 2);

  const termino = await barrerPortal(rutas, ['--permitir', 'sahuaripa']);
  assert.equal(termino.codigo, CODIGO.LIMPIO);
  assert.deepEqual(termino.json.permitidos, ['sahuaripa']);
  assert.ok(!termino.json.terminos.some((t) => t.termino === 'sahuaripa'));

  const frase = await barrerPortal(rutas, ['--permitir', 'colindante con Sahuaripa']);
  assert.equal(frase.codigo, CODIGO.RESTOS, 'la otra mención sigue');
  const g = frase.json.restos[0];
  assert.equal(g.total, 1);
  assert.equal(g.archivos[0].archivo, '/gobierno');

  const ambas = await barrerPortal(rutas, ['--permitir', 'colindante con sahuaripa,presidencia de sahuaripa']);
  assert.equal(ambas.codigo, CODIGO.LIMPIO);
});

test('correo real y teléfono: AVISO con código 0; los placeholders se ignoran', async () => {
  const cuerpo =
    'Escríbenos a contacto@villapesqueira.gob.mx o al Tel. (623) 233-01-39. ' +
    'Ejemplo de formulario: tu@correo.com, ejemplo@dominio.mx. Logo: escudo@2x.png';
  const { codigo, json } = await barrerPortal(portalLimpio({ '/contacto': html({ cuerpo }) }));
  assert.equal(codigo, CODIGO.LIMPIO);
  assert.deepEqual(json.restos, []);
  assert.deepEqual(json.avisos.correos.map((g) => g.valor), ['contacto@villapesqueira.gob.mx']);
  assert.equal(json.avisos.correos[0].archivos[0].archivo, '/contacto');
  assert.equal(json.avisos.correos[0].menciona, null);
  assert.deepEqual(json.avisos.telefonos.map((g) => g.valor), ['623 233 0139']);
});

test('correo con el nombre de otro municipio pegado: AVISO con pista, sigue en 0', async () => {
  const rutas = portalLimpio({ '/contacto': html({ cuerpo: 'Transparencia: transparenciasahuaripa2124@gmail.com' }) });
  const { codigo, json } = await barrerPortal(rutas);
  assert.equal(codigo, CODIGO.LIMPIO);
  assert.equal(json.avisos.correos[0].valor, 'transparenciasahuaripa2124@gmail.com');
  assert.equal(json.avisos.correos[0].menciona, 'sahuaripa');
  const texto = await barrerPortal(rutas, [], { json: false });
  assert.match(texto.texto, /contiene «sahuaripa»: ¿es de otro municipio\?/);
});

test('Cloudinary con cms-municipal/<otro-slug>/: AVISO (código 0); el propio slug no se reporta', async () => {
  const cuerpo =
    '<img src="https://res.cloudinary.com/dtpxt4a2p/image/upload/v1786/cms-municipal/sahuaripa/identidad/escudo.png"/>' +
    '<img src="https://res.cloudinary.com/dtpxt4a2p/image/upload/v1787/cms-municipal/villapesqueira/identidad/escudo.png"/>';
  const { codigo, json } = await barrerPortal(portalLimpio({ '/': html({ cuerpo }) }));
  assert.equal(codigo, CODIGO.LIMPIO);
  assert.deepEqual(json.restos, []);
  assert.equal(json.avisos.cloudinary.length, 1);
  assert.equal(json.avisos.cloudinary[0].valor, 'cms-municipal/sahuaripa/');
  assert.equal(json.avisos.cloudinary[0].slug, 'sahuaripa');
  assert.match(json.avisos.cloudinary[0].archivos[0].contextos[0], /«cms-municipal\/sahuaripa\/»identidad/);
});

test('sitemap con otro host (dominio propio): las rutas se reescriben al host de --portal', async () => {
  const rutas = portalLimpio({
    '/sitemap.xml': sitemap([
      'https://villapesqueira.gob.mx/',
      'https://villapesqueira.gob.mx/turismo',
      'https://www.villapesqueira.gob.mx/historia/',
      'https://villapesqueira.gob.mx/acta.pdf',
    ]),
    '/historia': html({ cuerpo: 'Historia de Villa Pesqueira.' }),
  });
  const { codigo, json, srv } = await barrerPortal(rutas);
  assert.equal(codigo, CODIGO.LIMPIO);
  const pedidas = json.rutas.map((r) => r.ruta);
  assert.ok(pedidas.includes('/turismo'));
  assert.ok(pedidas.includes('/historia'));
  assert.ok(!pedidas.includes('/acta.pdf'), 'los PDF no son páginas');
  assert.equal(srv.veces('/historia'), 1, 'se pidió al servidor local, no al dominio del sitemap');
  assert.deepEqual(json.sitemap.hostsReescritos.sort(), ['villapesqueira.gob.mx', 'www.villapesqueira.gob.mx']);
  assert.ok(json.avisos.generales.some((a) => a.includes('villapesqueira.gob.mx') && a.includes('127.0.0.1')));
});

test('API caída (puerto cerrado): código 3 con mensaje en español', async () => {
  const srv = await levantar(portalLimpio());
  try {
    const api = await puertoCerrado();
    const r = await barrer(srv, [], { api });
    assert.equal(r.codigo, CODIGO.ERROR);
    assert.equal(r.json.codigo, 3);
    assert.match(r.json.error, /No se pudo consultar la API de municipios/);
    const t = await barrer(srv, [], { api, json: false });
    assert.equal(t.codigo, CODIGO.ERROR);
    assert.match(t.err, /^ERROR: No se pudo consultar la API/);
  } finally {
    await srv.cerrar();
  }
});

test('API con HTTP 503: se reintenta una vez y termina con código 3', async () => {
  const { codigo, json, srv } = await barrerPortal(portalLimpio(), [], {
    servidor: { api: { estado: 503, cuerpo: 'Service Unavailable' } },
  });
  assert.equal(codigo, CODIGO.ERROR);
  assert.match(json.error, /HTTP 503/);
  assert.equal(srv.veces('/api/municipios'), 2);
});

test('API que no devuelve una lista JSON: código 3', async () => {
  const { codigo, json } = await barrerPortal(portalLimpio(), [], {
    servidor: { api: { cuerpo: '<html>login</html>', tipo: 'text/html' } },
  });
  assert.equal(codigo, CODIGO.ERROR);
  assert.match(json.error, /no devolvió una lista JSON/);
});

test('slug sin alta y sin --nombre: código 3; slug con alta toma el nombre de la API', async () => {
  const sinNombre = await barrerPortal(portalLimpio(), [], { nombre: null });
  assert.equal(sinNombre.codigo, CODIGO.ERROR);
  assert.match(sinNombre.json.error, /--nombre/);

  // Portal de Carbó: "Carbó" es propio; "Rayón" (vecino) es de otro municipio.
  const municipio = 'Carbó';
  const rutas = portalLimpio({
    '/': html({ municipio, cuerpo: 'Carbó, Sonora. carbotransparencia.com.mx' }),
    '/gobierno': html({ municipio, cuerpo: 'Las minas vecinas de Rayón y Opodepe.' }),
    '/contacto': html({ municipio }),
    '/turismo': html({ municipio }),
    [CHUNK_PAGINA]: 'x={nombre:"Carb\\u00f3"}',
  });
  const carbo = await barrerPortal(rutas, [], { slug: 'carbo', nombre: null });
  assert.equal(carbo.codigo, CODIGO.RESTOS);
  assert.equal(carbo.json.nombre, 'Carbó');
  assert.equal(carbo.json.fuenteNombre, 'api');
  assert.deepEqual(terminosHallados(carbo.json), ['opodepe', 'rayon']);
  // Villa Pesqueira (del listado fijo) sí se busca en el portal de Carbó.
  assert.ok(carbo.json.terminos.some((t) => t.termino === 'villa pesqueira'));
  const conResto = await barrerPortal(
    { ...rutas, '/turismo': html({ municipio: 'Villa Pesqueira' }) },
    ['--permitir', 'rayon,opodepe'],
    { slug: 'carbo', nombre: null },
  );
  assert.deepEqual(terminosHallados(conResto.json), ['villa pesqueira']);
  assert.equal(conResto.json.restos[0].archivos[0].archivo, '/turismo');
});

test('--max-rutas limita las páginas y lo avisa', async () => {
  const enlaces = Array.from({ length: 10 }, (_, i) => `/pagina-${i}`);
  const rutas = portalLimpio({ '/': html({ enlaces }) });
  for (const e of enlaces) rutas[e] = html({ cuerpo: `Página ${e}` });
  const { codigo, json } = await barrerPortal(rutas, ['--max-rutas', '4']);
  assert.equal(codigo, CODIGO.LIMPIO);
  assert.equal(json.rutas.length, 4);
  assert.equal(json.rutas[0].ruta, '/');
  assert.ok(json.avisos.generales.some((a) => /4 de \d+ rutas/.test(a)));
});

test('concurrencia: nunca más de 4 peticiones simultáneas', async () => {
  const enlaces = Array.from({ length: 14 }, (_, i) => `/p${i}`);
  const rutas = portalLimpio({ '/': html({ enlaces }) });
  for (const e of enlaces) rutas[e] = html({ cuerpo: e });
  const { codigo, srv } = await barrerPortal(rutas, [], { servidor: { retraso: 25 } });
  assert.equal(codigo, CODIGO.LIMPIO);
  assert.ok(srv.estado.maxActivos <= 4, `máximo simultáneo: ${srv.estado.maxActivos}`);
  assert.ok(srv.estado.maxActivos >= 2, 'sí hubo paralelismo');
});

test('timeout por petición con un reintento: un chunk lento la primera vez se recupera', async () => {
  const rutas = portalLimpio({
    [CHUNK_PAGINA]: (req, origen, n) => ({ cuerpo: 'x="S\\u0061huaripa"', retraso: n === 1 ? 2000 : 0 }),
  });
  const { codigo, json, srv } = await barrerPortal(rutas, ['--timeout', '300']);
  assert.equal(srv.veces(CHUNK_PAGINA), 2);
  assert.deepEqual(json.errores, []);
  assert.equal(codigo, CODIGO.RESTOS);
});

test('recurso que falla dos veces: barrido incompleto (código 3) si no hay restos', async () => {
  const rutas = portalLimpio({ [CHUNK_MAIN]: { estado: 500, cuerpo: 'error' } });
  const { codigo, json, srv } = await barrerPortal(rutas);
  assert.equal(codigo, CODIGO.ERROR);
  assert.equal(srv.veces(CHUNK_MAIN), 2);
  assert.equal(json.errores.length, 1);
  assert.match(json.errores[0].error, /HTTP 500/);
});

test('portada inaccesible: código 3', async () => {
  const { codigo, json } = await barrerPortal(portalLimpio({ '/': { estado: 500, cuerpo: 'x' } }));
  assert.equal(codigo, CODIGO.ERROR);
  assert.match(json.error, /portada/);
});

test('reporte de texto: agrupa por término, explica la revisión manual y --permitir', async () => {
  const rutas = portalLimpio({
    '/': html({ cuerpo: 'Colindante con Sahuaripa y con Baviácora. contacto@villapesqueira.gob.mx' }),
  });
  const { codigo, texto } = await barrerPortal(rutas, [], { json: false });
  assert.equal(codigo, CODIGO.RESTOS);
  assert.match(texto, /RESTOS DE OTROS MUNICIPIOS: 2 términos/);
  assert.match(texto, /\[RESTO\] "sahuaripa"/);
  assert.match(texto, /\[RESTO\] "baviacora"/);
  assert.match(texto, /Colindante con «Sahuaripa» y con/);
  assert.match(texto, /revisa cada contexto a mano/i);
  assert.match(texto, /--permitir "baviacora,sahuaripa"|--permitir "sahuaripa,baviacora"/);
  assert.match(texto, /\[AVISO\] correo contacto@villapesqueira\.gob\.mx/);
  assert.match(texto, /código 1/);
});

// ---------------------------------------------------------------------------
// CLI real (proceso hijo): punto de entrada, códigos de salida y --ayuda
// ---------------------------------------------------------------------------

function correrCli(args) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(process.execPath, [SCRIPT, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    hijo.stdout.on('data', (d) => (out += d));
    hijo.stderr.on('data', (d) => (err += d));
    hijo.on('error', reject);
    hijo.on('close', (codigo) => resolve({ codigo, out, err }));
  });
}

test('CLI: --ayuda (0), argumentos inválidos (3) y barrido real con código 1', async () => {
  const ayuda = await correrCli(['--ayuda']);
  assert.equal(ayuda.codigo, 0);
  assert.match(ayuda.out, /Uso:/);
  assert.match(ayuda.out, /--permitir/);

  const sinPortal = await correrCli(['--slug', 'villapesqueira']);
  assert.equal(sinPortal.codigo, 3);
  assert.match(sinPortal.err, /Falta --portal/);

  const desconocida = await correrCli(['--portal', 'https://x.mx', '--slug', 'x', '--foo']);
  assert.equal(desconocida.codigo, 3);
  assert.match(desconocida.err, /Opción desconocida: --foo/);

  const srv = await levantar(portalLimpio({ '/turismo': html({ cuerpo: 'Ruta de Arivechi a Moctezuma.' }) }));
  try {
    const r = await correrCli([
      '--portal', srv.origen, '--slug', 'villapesqueira', '--nombre', 'Villa Pesqueira',
      '--api', `${srv.origen}/api/municipios`, '--json',
    ]);
    assert.equal(r.codigo, 1, r.err);
    const json = JSON.parse(r.out);
    assert.deepEqual(terminosHallados(json), ['arivechi', 'moctezuma']);
  } finally {
    await srv.cerrar();
  }
});

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

test('normalizarConMapa: escapes, entidades, minúsculas y diacríticos, con mapa al original', () => {
  const casos = [
    ['Baviácora', 'baviacora'],
    ['BAVI&Aacute;CORA', 'baviacora'],
    ['Bavi&#225;cora', 'baviacora'],
    ['Bavi&#xE1;cora', 'baviacora'],
    ['Bavi\\u00e1cora', 'baviacora'],
    ['Bavi\\\\u00e1cora', 'baviacora'], // doble escapado (payload RSC)
    ['Bavi&amp;aacute;cora', 'baviacora'], // entidad escapada dos veces
    ['&quot;Río&quot; &amp; más', '"rio" & mas'],
    ['Sahu­aripa', 'sahuaripa'], // guion suave
  ];
  for (const [entrada, esperado] of casos) {
    assert.equal(normalizarConMapa(entrada).texto, esperado, entrada);
  }
  const original = 'Hola S\\u0061huaripa y m&aacute;s';
  const n = normalizarConMapa(original);
  const i = n.texto.indexOf('sahuaripa');
  const [a, b] = rangoOriginal(n, i, i + 'sahuaripa'.length);
  assert.equal(original.slice(a, b), 'S\\u0061huaripa');
  const j = n.texto.indexOf('mas');
  const [c, d] = rangoOriginal(n, j, j + 3);
  assert.equal(original.slice(c, d), 'm&aacute;s');
});

test('regexTermino: límites de palabra y términos de varias palabras', () => {
  const hay = (termino, texto) => regexTermino(termino).test(normalizarConMapa(texto).texto);
  assert.ok(hay('carbo', 'Municipio de Carbó.'));
  assert.ok(!hay('carbo', 'carbón'));
  assert.ok(!hay('carbo', 'carbono'));
  assert.ok(!hay('rayon', 'crayón'));
  assert.ok(!hay('rayon', 'rayones'));
  assert.ok(hay('rayon', 'Rayón, Sonora'));
  assert.ok(hay('sahuaripa', 'escudo_sahuaripa.png'));
  assert.ok(hay('sahuaripa', '/cms-municipal/sahuaripa-2/'));
  assert.ok(hay('san javier', 'San  Javier'));
  assert.ok(hay('san javier', 'san-javier'));
  assert.ok(!hay('san javier', 'sanjavier'));
  assert.ok(hay('1639', 'misión de 1639.'));
  assert.ok(!hay('1639', '0.1639'));
  assert.ok(!hay('1639', '16390'));
  assert.ok(!hay('1639', '1639.25'));
});

test('nombreBase y construirTerminos: prefijos, exclusión del propio y --permitir', () => {
  assert.equal(nombreBase('H. Ayuntamiento de Baviácora'), 'Baviácora');
  assert.equal(nombreBase('Municipio de Aconchi'), 'Aconchi');
  assert.equal(nombreBase('H Ayuntamiento Constitucional de Rayón'), 'Rayón');
  assert.equal(nombreBase('Soyopa'), 'Soyopa');

  const conf = construirTerminos({
    municipios: MUNICIPIOS,
    slug: 'sahuaripa',
    extra: ['1639'],
    permitir: ['Rayón'],
  });
  assert.equal(conf.propio.nombre, 'Sahuaripa');
  const t = conf.terminos.map((x) => x.termino);
  assert.ok(!t.includes('sahuaripa'), 'excluye el propio');
  assert.ok(!t.includes('sahuaripatransparencia.com.mx'), 'excluye el propio dominio');
  assert.ok(!t.includes('rayon'), 'excluye lo permitido');
  assert.ok(t.includes('rayontransparencia.com.mx'), 'el dominio de otro sigue');
  for (const x of ['carbo', 'baviacora', 'aconchi', 'aconchitransparencia.com.mx', 'arivechi', 'moctezuma', 'huasabas', 'bacanora', '1639']) {
    assert.ok(t.includes(x), x);
  }
  assert.throws(
    () => construirTerminos({ municipios: MUNICIPIOS, slug: 'villapesqueira' }),
    (e) => e instanceof ErrorBarrido && /--nombre/.test(e.message),
  );
  const vp = construirTerminos({ municipios: MUNICIPIOS, slug: 'villapesqueira', nombre: 'Villa Pesqueira' });
  assert.ok(!vp.terminos.some((x) => x.termino === 'villa pesqueira'), 'el listado fijo excluye el propio');
});

test('analizarDocumento: el propio nombre enmascara términos contenidos en él', () => {
  const conf = construirTerminos({
    municipios: [{ slug: 'sanjavier', nombre: 'H. Ayuntamiento de San Javier' }],
    slug: 'sanpedro',
    nombre: 'San Pedro de la Cueva',
    molde: [],
    extra: ['cueva'],
  });
  const a = analizarDocumento('Bienvenidos a San Pedro de la Cueva. La cueva del cerro. San Javier.', conf);
  assert.deepEqual(a.restos.map((h) => h.coincidencia), ['cueva', 'San Javier']);
});

test('sitemap, reescritura de host, enlaces internos y recursos de Next', () => {
  const { tipo, locs } = extraerLocsSitemap(
    '<sitemapindex><sitemap><loc><![CDATA[https://x.mx/sitemap-0.xml]]></loc></sitemap></sitemapindex>',
  );
  assert.equal(tipo, 'indice');
  assert.deepEqual(locs, ['https://x.mx/sitemap-0.xml']);
  assert.deepEqual(extraerLocsSitemap('<urlset><url><loc> https://a.mx/b?x=1&amp;y=2 </loc></url></urlset>').locs, [
    'https://a.mx/b?x=1&y=2',
  ]);

  const r = reescribirHost('https://villapesqueira.gob.mx/turismo/?a=1#b', 'https://villapesqueira.vercel.app');
  assert.deepEqual(r, {
    url: 'https://villapesqueira.vercel.app/turismo',
    ruta: '/turismo',
    hostOriginal: 'villapesqueira.gob.mx',
    reescrito: true,
  });
  assert.equal(reescribirHost('mailto:a@b.mx', 'https://x.mx'), null);

  const enlaces = extraerEnlacesInternos(
    '<a href="/gobierno">a</a><a href=\'/contacto?x=1\'>b</a><a href="https://x.mx/turismo/">c</a>' +
      '<a href="https://otro.mx/y">d</a><a href="//cdn.mx/z">e</a><a href="/_next/image?url=x">f</a>' +
      '<a href="/doc.pdf">g</a><a href="#top">h</a><a href="/gobierno#x">i</a><link rel="icon" href="/favicon.ico"/>',
    'https://x.mx',
  );
  assert.deepEqual(enlaces, ['/gobierno', '/contacto', '/turismo']);

  const recursos = extraerRecursosNext(
    '<script src="/_next/static/chunks/a.js?dpl=1"></script><link href="/_next/static/css/b.css" rel="stylesheet"/>' +
      '<script>self.__next_f.push([1,"I[1,[\\"static/chunks/app/c.js\\",\\"/_next/static/chunks/a.js?dpl=1\\"]]"])</script>' +
      '<script src="https://x.mx/_next/static/chunks/d.js"></script><img src="/_next/static/media/e.png"/>',
    'https://x.mx',
  );
  assert.deepEqual(
    recursos.map((x) => x.url),
    [
      'https://x.mx/_next/static/chunks/a.js?dpl=1',
      'https://x.mx/_next/static/css/b.css',
      'https://x.mx/_next/static/chunks/app/c.js',
      'https://x.mx/_next/static/chunks/d.js',
    ],
  );

  assert.deepEqual(planificarRutas([['/a', '/b/'], ['/a', '/c', '/logo.svg', '/api/x']], 3), ['/', '/a', '/b']);
});

test('correos placeholder, teléfonos mexicanos y pista de otro municipio', () => {
  assert.ok(esCorreoPlaceholder('tu@correo.com'));
  assert.ok(esCorreoPlaceholder('ejemplo@municipio.gob.mx'));
  assert.ok(esCorreoPlaceholder('nombre@example.com'));
  assert.ok(!esCorreoPlaceholder('contacto@villapesqueira.gob.mx'));

  assert.equal(digitosTelefono('(623) 233-01-39'), '6232330139');
  assert.equal(digitosTelefono('+52 1 634 343 0014'), '6343430014');
  assert.equal(digitosTelefono('1788211689'), null, 'no empieza con LADA válida');
  assert.equal(digitosTelefono('555 555 5555'), null);

  const conf = construirTerminos({ municipios: MUNICIPIOS, slug: 'villapesqueira', nombre: 'Villa Pesqueira' });
  const tel = (s) => analizarDocumento(s, conf).telefonos.map((h) => h.clave);
  assert.deepEqual(tel('Tel. 662 123 4567'), ['662 123 4567']);
  assert.deepEqual(tel('"telefono":"6343430014"'), ['634 343 0014']);
  assert.deepEqual(tel('id:6343430014'), [], 'corrido sin contexto de teléfono');
  assert.deepEqual(tel('<a href="tel:+526621234567">x</a>'), ['662 123 4567']);
  assert.deepEqual(tel('https://wa.me/5216621112233'), ['662 111 2233']);
  assert.deepEqual(tel('623 23 35 131'), ['623 233 5131']);
  assert.deepEqual(tel('M 10 662 123 4567 L 22 34 56 78 90 Z'), [], 'coordenadas SVG');

  assert.equal(mencionaOtroMunicipio('transparenciasahuaripa2124@gmail.com', conf), 'sahuaripa');
  assert.equal(mencionaOtroMunicipio('villapesqueira@gmail.com', conf), null);
});

test('argumentos: --opcion=valor, listas repetidas, errores en español', () => {
  const v = leerArgv(['--portal=https://x.mx', '--extra', 'a,b', '--extra=c', '--json', '-h']);
  assert.equal(v.portal, 'https://x.mx');
  assert.deepEqual(v.extra, ['a,b', 'c']);
  assert.equal(v.json, true);
  assert.equal(v.ayuda, true);

  const op = parsearArgumentos([
    '--portal', 'https://villapesqueira.vercel.app/algo', '--slug', 'VillaPesqueira',
    '--extra', '1639, río sonora', '--permitir', 'hermosillo,san javier', '--max-rutas', '5',
    '--api', 'https://api.northadigital.com/api/municipios', '--timeout', '9000',
  ]);
  assert.equal(op.portal, 'https://villapesqueira.vercel.app');
  assert.equal(op.slug, 'villapesqueira');
  assert.deepEqual(op.extra, ['1639', 'río sonora']);
  assert.deepEqual(op.permitir, ['hermosillo', 'san javier']);
  assert.equal(op.maxRutas, 5);
  assert.equal(op.timeout, 9000);
  assert.equal(op.api, 'https://api.northadigital.com');

  const falla = (argv, re) => assert.throws(() => parsearArgumentos(argv), (e) => e instanceof ErrorBarrido && re.test(e.message));
  falla(['--slug', 'x'], /Falta --portal/);
  falla(['--portal', 'ftp://x.mx', '--slug', 'x'], /http/);
  falla(['--portal', 'https://x.mx'], /Falta --slug/);
  falla(['--portal', 'https://x.mx', '--slug', 'x', '--max-rutas', '0'], /entero positivo/);
  falla(['--portal', 'https://x.mx', '--slug', 'x', '--timeout', 'abc'], /entero positivo/);
  falla(['--portal', '--slug', 'x'], /Falta el valor de --portal/);
  falla(['suelto'], /Argumento inesperado/);
});

test('formatearReporte: portal limpio muestra "ninguno" y código 0', () => {
  const texto = formatearReporte({
    portal: 'https://x.mx',
    slug: 'x',
    nombre: 'X',
    fuenteNombre: 'argumento',
    rutas: [{ ruta: '/', estado: 200 }],
    recursos: [],
    otros: [],
    terminos: [{ termino: 'sahuaripa' }],
    permitidos: [],
    restos: [],
    avisos: { correos: [], telefonos: [], cloudinary: [], generales: [] },
    errores: [],
    codigo: 0,
  });
  assert.match(texto, /RESTOS DE OTROS MUNICIPIOS: ninguno/);
  assert.match(texto, /sin restos de otros municipios \(código 0\)/);
});
