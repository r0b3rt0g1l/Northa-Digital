// Pruebas de derivar-plantillas.mjs (node:test, sin dependencias).
// Ejecutar: node --test scripts/herramienta-alta/derivar-plantillas.test.mjs
//
// IMPORTANTE: los fixtures de abajo son SINTÉTICOS. Imitan contenido plausible
// para ejercitar la herramienta; NO reflejan el formato real de los archivos de
// cmsmunicipal (que esta prueba desconoce a propósito).

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  calcularVariantes,
  calcularCandidatas,
  crearMapaUuids,
  sustituir,
  detectarResiduos,
  detectarSecretos,
  terminosSignificativos,
  validarJson,
  verificarSintaxisJs,
  detectarTipoModulo,
  quitarAcentos,
  parsearArgumentos,
} from './derivar-plantillas.mjs';

const SCRIPT = fileURLToPath(new URL('./derivar-plantillas.mjs', import.meta.url));

// ---------------------------------------------------------------------------
// Fixtures sintéticos
// ---------------------------------------------------------------------------

const UUID_MUNICIPIO = '3f6c2a9e-8b1d-4c7e-9a2f-5d4b3c2a1e0f';
const UUID_OPERADOR = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const CONTRATO_VP = `{
  "nombre": "Villa Pesqueira",
  "slug": "villapesqueira",
  "hero": {
    "titulo": "Bienvenidos a Villa Pesqueira",
    "subtitulo": "Tierra de Mátape, fundada en 1629"
  },
  "datos": { "poblacion": "1,043", "superficieKm2": "1124.3" },
  "escudo": {
    "id": "${UUID_MUNICIPIO}",
    "url": "https://res.cloudinary.com/northa/image/upload/v1712345678/municipios/villapesqueira/escudo.png"
  },
  "contacto": { "correo": "presidencia@villapesqueira.gob.mx", "telefono": "(623) 123 4567" },
  "ubicacion": { "lat": 29.1234, "lng": -109.9876 },
  "area": "Secretaría del Ayuntamiento",
  "tema": { "color": "#123456", "opacidad": 0.85 }
}
`;

// UUID en MAYÚSCULAS a propósito: debe recibir el mismo marcador que en minúsculas.
const DB_ALTA_VP = `// Script sintético de prueba (no es el formato real)
'use strict';
async function alta(cliente) {
  await cliente.query('BEGIN');
  try {
    await cliente.query(
      \`INSERT INTO "Municipio" ("id", "nombre", "slug", "creadoEn", "actualizadoEn")
       VALUES ('${UUID_MUNICIPIO.toUpperCase()}', 'Villa Pesqueira', 'villapesqueira', '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z')\`
    );
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  }
}
module.exports = { alta };
`;

const OPERADOR_VP = `{
  "id": "${UUID_OPERADOR}",
  "email": "admin-villapesqueira@northa.digital",
  "nombre": "Administración Villa Pesqueira",
  "rol": "admin",
  "municipioId": "${UUID_MUNICIPIO}"
}
`;

const README_VP = `# MATERIAL DEL AYUNTAMIENTO DE VILLA PESQUEIRA

Carpeta: \`villa-pesqueira/\`
Fotos del cabildo de Villa Pesqueira y de la comisaría de Mátape (MATAPE en rótulos).
Contacto: comunicacion.villapesqueira@gmail.com
Logo: VillaPesqueira_escudo.png, texto alternativo: Villa_Pesqueira
`;

function rutasDe(raiz, slug) {
  return {
    contrato: path.join(raiz, 'scripts/herramienta-alta/contratos', `${slug}.json`),
    dbAlta: path.join(raiz, 'scripts/herramienta-alta/contratos', `db-alta-${slug}.js`),
    operador: path.join(raiz, 'scripts/lotes-db', `operador-${slug}.json`),
    material: path.resolve(raiz, '..', '_material-ayuntamientos', slug, 'README.md'),
  };
}

/** Crea <base>/<nombreDir>/cmsmunicipal (+ ../_material-ayuntamientos) con los archivos indicados. */
function crearFixture(base, nombreDir, slug, archivos) {
  const raiz = path.join(base, nombreDir, 'cmsmunicipal');
  const rutas = rutasDe(raiz, slug);
  fs.mkdirSync(raiz, { recursive: true });
  for (const [clave, contenido] of Object.entries(archivos)) {
    if (contenido == null) continue;
    fs.mkdirSync(path.dirname(rutas[clave]), { recursive: true });
    fs.writeFileSync(rutas[clave], contenido, 'utf8');
  }
  return { raiz, rutas };
}

function fixtureVillaPesqueira(base, nombreDir, sobrescribir = {}) {
  return crearFixture(base, nombreDir, 'villapesqueira', {
    contrato: CONTRATO_VP,
    dbAlta: DB_ALTA_VP,
    operador: OPERADOR_VP,
    material: README_VP,
    ...sobrescribir,
  });
}

function ejecutar(args, cwd) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  return { codigo: r.status, stdout: r.stdout, stderr: r.stderr };
}

const hashArchivo = (ruta) => crypto.createHash('sha256').update(fs.readFileSync(ruta)).digest('hex');

let BASE;
before(() => {
  BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'prueba-derivar-plantillas-'));
});
after(() => {
  if (BASE) fs.rmSync(BASE, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

test('importar el módulo no ejecuta main()', () => {
  assert.equal(process.exitCode, undefined);
});

describe('calcularVariantes', () => {
  test('Villa Pesqueira: variantes y orden de prioridad', () => {
    assert.deepEqual(calcularVariantes('Villa Pesqueira', 'villapesqueira'), [
      { marcador: 'NOMBRE', valor: 'Villa Pesqueira' },
      { marcador: 'NOMBRE_MAYUS', valor: 'VILLA PESQUEIRA' },
      { marcador: 'NOMBRE_MINUS', valor: 'villa pesqueira' },
      { marcador: 'SLUG', valor: 'villapesqueira' },
      { marcador: 'SLUG_MAYUS', valor: 'VILLAPESQUEIRA' },
      { marcador: 'SLUG_GUION', valor: 'villa-pesqueira' },
      { marcador: 'NOMBRE_CAMEL', valor: 'VillaPesqueira' },
    ]);
  });

  test('Bacadéhuachi (acentuado): variantes sin acentos y deduplicación (gana la primera)', () => {
    assert.deepEqual(calcularVariantes('Bacadéhuachi', 'bacadehuachi'), [
      { marcador: 'NOMBRE', valor: 'Bacadéhuachi' },
      { marcador: 'NOMBRE_SIN_ACENTOS', valor: 'Bacadehuachi' },
      { marcador: 'NOMBRE_MAYUS', valor: 'BACADÉHUACHI' },
      { marcador: 'NOMBRE_MAYUS_SIN_ACENTOS', valor: 'BACADEHUACHI' },
      { marcador: 'NOMBRE_MINUS', valor: 'bacadéhuachi' },
      { marcador: 'SLUG', valor: 'bacadehuachi' },
    ]);
    const descartadas = calcularCandidatas('Bacadéhuachi', 'bacadehuachi')
      .filter((c) => c.igualA)
      .map((c) => [c.marcador, c.igualA]);
    assert.deepEqual(descartadas, [
      ['SLUG_MAYUS', 'NOMBRE_MAYUS_SIN_ACENTOS'],
      ['SLUG_GUION', 'SLUG'],
      ['NOMBRE_CAMEL', 'NOMBRE_SIN_ACENTOS'],
    ]);
  });

  test('nombre compuesto con acentos: guion y camel', () => {
    const v = Object.fromEntries(calcularVariantes('San José de Gracias', 'sanjosedegracias').map((x) => [x.marcador, x.valor]));
    assert.equal(v.SLUG_GUION, 'san-jose-de-gracias');
    assert.equal(v.NOMBRE_CAMEL, 'SanJoseDeGracias');
    assert.equal(v.NOMBRE_MAYUS_SIN_ACENTOS, 'SAN JOSE DE GRACIAS');
    assert.equal(quitarAcentos('Huépac Ñuñez'), 'Huepac Nunez');
  });
});

describe('sustituir', () => {
  const vp = calcularVariantes('Villa Pesqueira', 'villapesqueira');

  test('de la cadena más larga a la más corta (sin reemplazos parciales)', () => {
    const variantes = [
      { marcador: 'CORTA', valor: 'Pesqueira' },
      { marcador: 'LARGA', valor: 'Villa Pesqueira' },
    ];
    assert.equal(sustituir('Villa Pesqueira y Pesqueira', variantes).texto, '{{LARGA}} y {{CORTA}}');
  });

  test('sensible a mayúsculas: solo variantes exactas', () => {
    const { texto } = sustituir('VILLA PESQUEIRA | villa pesqueira | VILLA pesqueira | Villa pesqueira', vp);
    assert.equal(texto, '{{NOMBRE_MAYUS}} | {{NOMBRE_MINUS}} | VILLA pesqueira | Villa pesqueira');
  });

  test('todas las variantes de Villa Pesqueira y conteo', () => {
    const { texto, conteo } = sustituir(
      'Villa Pesqueira villapesqueira VILLAPESQUEIRA villa-pesqueira VillaPesqueira admin-villapesqueira@northa.digital',
      vp,
    );
    assert.equal(
      texto,
      '{{NOMBRE}} {{SLUG}} {{SLUG_MAYUS}} {{SLUG_GUION}} {{NOMBRE_CAMEL}} admin-{{SLUG}}@northa.digital',
    );
    assert.deepEqual(conteo, { NOMBRE: 1, SLUG: 2, SLUG_MAYUS: 1, SLUG_GUION: 1, NOMBRE_CAMEL: 1 });
  });

  test('no toca apariciones pegadas a otras letras (evita romper palabras)', () => {
    const naco = calcularVariantes('Naco', 'naco');
    assert.equal(sustituir('Naco, naco y nacional', naco).texto, '{{NOMBRE}}, {{NOMBRE_MINUS}} y nacional');
    assert.equal(sustituir('municipioVillaPesqueira', vp).texto, 'municipioVillaPesqueira');
    assert.equal(sustituir('VillaPesqueira_escudo.png', vp).texto, '{{NOMBRE_CAMEL}}_escudo.png');
  });

  test('lo ya sustituido no se vuelve a sustituir', () => {
    const variantes = [
      { marcador: 'SLUG', valor: 'villapesqueira' },
      { marcador: 'OTRO', valor: 'SLUG' },
    ];
    assert.equal(sustituir('villapesqueira', variantes).texto, '{{SLUG}}');
  });

  test('acepta texto en forma NFD', () => {
    const v = calcularVariantes('Bacadéhuachi', 'bacadehuachi');
    assert.equal(sustituir('Bacadéhuachi', v).texto, '{{NOMBRE}}');
  });
});

describe('UUIDs', () => {
  test('numerados por orden de aparición y consistentes entre archivos (insensible a mayúsculas)', () => {
    const a = `x ${UUID_MUNICIPIO} y ${UUID_OPERADOR}`;
    const b = `z ${UUID_OPERADOR.toUpperCase()} w ${UUID_MUNICIPIO.toUpperCase()}`;
    const mapa = crearMapaUuids([a, b]);
    assert.deepEqual([...mapa.entries()], [
      [UUID_MUNICIPIO, 'UUID_1'],
      [UUID_OPERADOR, 'UUID_2'],
    ]);
    assert.equal(sustituir(a, [], mapa).texto, 'x {{UUID_1}} y {{UUID_2}}');
    assert.equal(sustituir(b, [], mapa).texto, 'z {{UUID_2}} w {{UUID_1}}');
  });
});

describe('detectarResiduos', () => {
  const vp = calcularVariantes('Villa Pesqueira', 'villapesqueira');
  const opciones = { nombre: 'Villa Pesqueira', slug: 'villapesqueira', extra: ['Mátape', 'San José'] };

  const residuosContrato = () => {
    const { texto } = sustituir(CONTRATO_VP, vp, crearMapaUuids([CONTRATO_VP]));
    return detectarResiduos(texto, { ...opciones, archivo: 'plantilla-contrato.json' });
  };
  const busca = (residuos, tipo, coincidencia) =>
    residuos.find((r) => r.tipo === tipo && r.coincidencia.includes(coincidencia));

  test('detecta --extra, año, números, Cloudinary versionado, correo, teléfono y coordenadas', () => {
    const r = residuosContrato();
    const matape = busca(r, 'extra', 'Mátape');
    assert.ok(matape, 'Mátape (por --extra)');
    assert.equal(matape.linea, 6);
    assert.equal(matape.archivo, 'plantilla-contrato.json');
    assert.ok(busca(r, 'anio', '1629'), '1629 como año');
    assert.ok(busca(r, 'numero', '1,043'), '1,043');
    assert.ok(busca(r, 'numero', '1124.3'), '1124.3');
    const cloud = busca(r, 'cloudinary', 'res.cloudinary.com');
    assert.ok(cloud, 'URL de Cloudinary');
    assert.match(cloud.motivo, /\/v1712345678\//);
    assert.ok(busca(r, 'correo', 'presidencia@{{SLUG}}.gob.mx'), 'correo');
    assert.ok(busca(r, 'telefono', '(623) 123 4567'), 'teléfono');
    assert.ok(busca(r, 'coordenada', '29.1234'), 'latitud');
    assert.ok(busca(r, 'coordenada', '-109.9876'), 'longitud');
  });

  test('no reporta marcadores, colores hex, decimales 0.x, "Secretaría" ni la versión como número', () => {
    const r = residuosContrato();
    // Los marcadores solo pueden aparecer dentro de correos/URLs reportados, nunca como residuo propio.
    assert.ok(
      !r.some((x) => x.coincidencia.includes('{{') && !['correo', 'cloudinary'].includes(x.tipo)),
      'ningún residuo sale de un marcador',
    );
    assert.ok(!r.some((x) => /^#?123456$/.test(x.coincidencia)), '#123456');
    assert.ok(!r.some((x) => x.coincidencia === '0.85'));
    assert.ok(!r.some((x) => x.alerta), 'sin alertas de seguridad');
    assert.ok(!r.some((x) => x.tipo === 'numero' && x.coincidencia.includes('1712345678')));
  });

  test('restos del nombre insensibles a mayúsculas/acentos; ignora palabras genéricas', () => {
    const texto = 'a Villa_Pesqueira\nPÉSQUEIRA\nVilla de Seris y la villa\nMATAPE y matape';
    const r = detectarResiduos(texto, { ...opciones, archivo: 'x.md' });
    assert.deepEqual(
      r.map((x) => [x.linea, x.tipo, x.coincidencia]),
      [
        [1, 'nombre', 'Pesqueira'],
        [2, 'nombre', 'PÉSQUEIRA'],
        [4, 'extra', 'MATAPE'],
        [4, 'extra', 'matape'],
      ],
    );
    assert.deepEqual(
      terminosSignificativos('Villa Pesqueira', 'villapesqueira').map((t) => t.norm),
      ['villapesqueira', 'pesqueira'],
    );
  });

  test('correo admin-{{SLUG}}@... no se reporta; otros correos sí', () => {
    const r = detectarResiduos('"email": "admin-{{SLUG}}@northa.digital", "otro": "info@northa.digital"', opciones);
    assert.deepEqual(r.map((x) => x.coincidencia), ['info@northa.digital']);
  });

  test('fechas ISO y timestamps', () => {
    const r = detectarResiduos("'2026-09-01T12:00:00.000Z', 1717171717, 31/12/2024", opciones);
    assert.deepEqual(
      r.map((x) => [x.tipo, x.coincidencia]),
      [
        ['fecha', '2026-09-01T12:00:00.000Z'],
        ['timestamp', '1717171717'],
        ['fecha', '31/12/2024'],
      ],
    );
  });
});

describe('seguridad', () => {
  test('detectarSecretos: claves sensibles con valor no vacío', () => {
    const casos = [
      ['"password": "Secreta123"', 'json', 1],
      ['"password": ""', 'json', 0],
      ['"token": null', 'json', 0],
      ['"passwordHash": "   "', 'json', 0],
      ['"secretaria": "Juana"', 'json', 0],
      ['"Secretaría": "Juana"', 'json', 0],
      ['"clientSecret": "abc"', 'json', 1],
      ["apiKey: 'abc123'", 'js', 1],
      ['api_key = "x"', 'js', 1],
      ['const secreto = SECRET;', 'js', 0],
      ['"hash": "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234"', 'json', 1],
      ['Contraseña: Hola123', 'texto', 1],
      ['La contraseña: se entrega por separado', 'texto', 0],
      ['tokenTTL: 3600', 'texto', 0],
    ];
    for (const [linea, tipo, esperado] of casos) {
      assert.equal(detectarSecretos(linea, tipo).length, esperado, `${linea} (${tipo})`);
    }
  });

  test('la alerta oculta el valor en coincidencia y contexto', () => {
    const r = detectarResiduos('  "password": "Secreta123", "tel": "6621234567"', { archivo: 'op.json' });
    const alerta = r.find((x) => x.alerta);
    assert.ok(alerta);
    assert.equal(alerta.tipo, 'seguridad');
    for (const x of r) {
      assert.ok(!x.coincidencia.includes('Secreta123'));
      assert.ok(!x.contexto.includes('Secreta123'));
    }
    assert.ok(r.some((x) => x.tipo === 'telefono' && x.coincidencia === '6621234567'));
  });
});

describe('validaciones', () => {
  test('validarJson', () => {
    assert.equal(validarJson('{"a": "{{SLUG}}"}').ok, true);
    assert.equal(validarJson('{"a": {{SLUG}}}').ok, false);
  });

  test('verificarSintaxisJs usa node --check sobre una copia temporal', () => {
    assert.equal(verificarSintaxisJs("const a = '{{SLUG}}';\n").ok, true);
    const mal = verificarSintaxisJs('const {{SLUG}} = 1;\n');
    assert.equal(mal.ok, false);
    assert.match(mal.error, /SyntaxError/);
    assert.equal(verificarSintaxisJs("export default { id: '{{UUID_1}}' };\n", { tipoModulo: 'mjs' }).ok, true);
  });

  test('detectarTipoModulo por sintaxis cuando no hay package.json con "type"', () => {
    const dir = fs.mkdtempSync(path.join(BASE, 'tipo-'));
    const ruta = path.join(dir, 'a.js');
    assert.equal(detectarTipoModulo(ruta, 'module.exports = {};'), 'cjs');
    assert.equal(detectarTipoModulo(ruta, "import x from 'y';\nexport default x;"), 'mjs');
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    assert.equal(detectarTipoModulo(ruta, 'module.exports = {};'), 'mjs');
  });

  test('parsearArgumentos separa --extra por comas y admite repetición', () => {
    const o = parsearArgumentos(['--slug', 'x', '--nombre', 'X', '--extra', 'Mátape, San José', '--extra', 'Otro']);
    assert.deepEqual(o.extra, ['Mátape', 'San José', 'Otro']);
    assert.equal(o.forzar, false);
  });
});

// ---------------------------------------------------------------------------
// CLI de punta a punta (child_process)
// ---------------------------------------------------------------------------

describe('CLI end-to-end', () => {
  test('genera plantillas, marcadores, UUID consistente, LEEME y deja las entradas intactas', () => {
    const { raiz, rutas } = fixtureVillaPesqueira(BASE, 'e2e');
    const antes = Object.fromEntries(Object.entries(rutas).map(([k, r]) => [k, hashArchivo(r)]));

    const r = ejecutar(
      ['--slug', 'villapesqueira', '--nombre', 'Villa Pesqueira', '--extra', 'Mátape,San José'],
      raiz,
    );
    assert.equal(r.codigo, 0, r.stderr);

    // Entradas intactas
    for (const [k, ruta] of Object.entries(rutas)) assert.equal(hashArchivo(ruta), antes[k], `entrada ${k} modificada`);

    const salida = path.join(raiz, 'scripts/herramienta-alta/plantillas');
    assert.deepEqual(fs.readdirSync(salida).sort(), [
      'LEEME.md',
      'plantilla-README-material.md',
      'plantilla-contrato.json',
      'plantilla-db-alta.js',
      'plantilla-operador.json',
    ]);
    const leer = (n) => fs.readFileSync(path.join(salida, n), 'utf8');
    const contrato = leer('plantilla-contrato.json');
    const db = leer('plantilla-db-alta.js');
    const operador = leer('plantilla-operador.json');
    const material = leer('plantilla-README-material.md');
    const leeme = leer('LEEME.md');

    // JSON válido y marcadores correctos
    const c = JSON.parse(contrato);
    const o = JSON.parse(operador);
    assert.equal(c.nombre, '{{NOMBRE}}');
    assert.equal(c.slug, '{{SLUG}}');
    assert.equal(c.hero.titulo, 'Bienvenidos a {{NOMBRE}}');
    assert.equal(c.escudo.url, 'https://res.cloudinary.com/northa/image/upload/v1712345678/municipios/{{SLUG}}/escudo.png');
    assert.equal(o.email, 'admin-{{SLUG}}@northa.digital');
    assert.equal(o.nombre, 'Administración {{NOMBRE}}');
    assert.equal(o.rol, 'admin');
    assert.match(db, /VALUES \('\{\{UUID_1\}\}', '\{\{NOMBRE\}\}', '\{\{SLUG\}\}'/);
    assert.match(material, /^# MATERIAL DEL AYUNTAMIENTO DE \{\{NOMBRE_MAYUS\}\}$/m);
    assert.match(material, /`\{\{SLUG_GUION\}\}\/`/);
    assert.match(material, /\{\{NOMBRE_CAMEL\}\}_escudo\.png/);

    // UUID consistente entre archivos
    assert.equal(c.escudo.id, '{{UUID_1}}');
    assert.equal(o.municipioId, '{{UUID_1}}');
    assert.equal(o.id, '{{UUID_2}}');

    // No quedan valores originales sustituibles
    for (const t of [contrato, db, operador]) {
      assert.ok(!t.includes('Villa Pesqueira'));
      assert.ok(!t.includes('villapesqueira'));
      assert.ok(!t.toLowerCase().includes(UUID_MUNICIPIO));
      assert.ok(!t.toLowerCase().includes(UUID_OPERADOR));
    }
    // Lo no sustituible queda intacto (regla 3)
    assert.ok(contrato.includes('Mátape') && contrato.includes('1629') && contrato.includes('"1,043"'));

    // LEEME: sha256, marcadores, residuos, instrucciones
    for (const ruta of Object.values(rutas)) assert.ok(leeme.includes(hashArchivo(ruta)), `sha256 de ${ruta}`);
    assert.match(leeme, /\| `\{\{NOMBRE\}\}` \| `Villa Pesqueira` \|/);
    assert.match(leeme, new RegExp(`\\| \`\\{\\{UUID_1\\}\\}\` \\| \`${UUID_MUNICIPIO}\` \\|`));
    assert.match(leeme, /--slug villapesqueira --nombre "Villa Pesqueira"/);
    for (const esperado of ['Mátape', '1629', '1,043', '1124.3', '/v1712345678/', 'plantilla-contrato.json:6']) {
      assert.ok(leeme.includes(esperado), `LEEME debería mencionar ${esperado}`);
    }
    assert.match(leeme, /crypto\.randomUUID\(\)/);
    assert.match(leeme, /grep -n "\{\{"/);
    assert.match(leeme, /`\{\{NOMBRE_SIN_ACENTOS\}\}` = `\{\{NOMBRE\}\}`/);

    // Consola
    assert.match(r.stdout, /Residuos para revisión manual: \d+/);
    assert.match(r.stdout, /Escrito en scripts\/herramienta-alta\/plantillas\//);
    assert.doesNotMatch(r.stderr, /ALERTA/);
  });

  test('sin --forzar no sobrescribe ni escribe NINGÚN archivo; con --forzar sí', () => {
    const { raiz } = fixtureVillaPesqueira(BASE, 'no-sobrescribir');
    const salida = path.join(raiz, 'scripts/herramienta-alta/plantillas');
    fs.mkdirSync(salida, { recursive: true });
    fs.writeFileSync(path.join(salida, 'LEEME.md'), 'CENTINELA');

    const args = ['--slug', 'villapesqueira', '--nombre', 'Villa Pesqueira'];
    const r = ejecutar(args, raiz);
    assert.equal(r.codigo, 1);
    assert.match(r.stderr, /ya existen/);
    assert.match(r.stderr, /scripts\/herramienta-alta\/plantillas\/LEEME\.md/);
    assert.deepEqual(fs.readdirSync(salida), ['LEEME.md'], 'no debe escribir ninguna otra salida');
    assert.equal(fs.readFileSync(path.join(salida, 'LEEME.md'), 'utf8'), 'CENTINELA');

    const r2 = ejecutar([...args, '--forzar'], raiz);
    assert.equal(r2.codigo, 0, r2.stderr);
    assert.equal(fs.readdirSync(salida).length, 5);
    assert.notEqual(fs.readFileSync(path.join(salida, 'LEEME.md'), 'utf8'), 'CENTINELA');

    // Segunda ejecución sin --forzar: error y las salidas no cambian
    const antes = fs.readdirSync(salida).map((n) => hashArchivo(path.join(salida, n)));
    const r3 = ejecutar(args, raiz);
    assert.equal(r3.codigo, 1);
    assert.deepEqual(fs.readdirSync(salida).map((n) => hashArchivo(path.join(salida, n))), antes);
  });

  test('--salida y --raiz: rutas relativas desde la raíz', () => {
    const { raiz } = fixtureVillaPesqueira(BASE, 'salida-personalizada');
    const r = ejecutar(
      ['--slug', 'villapesqueira', '--nombre', 'Villa Pesqueira', '--raiz', raiz, '--salida', 'otra/carpeta'],
      BASE,
    );
    assert.equal(r.codigo, 0, r.stderr);
    assert.ok(fs.existsSync(path.join(raiz, 'otra/carpeta/LEEME.md')));
  });

  test('entrada faltante: avisa y sigue; ninguna entrada: error', () => {
    const { raiz } = fixtureVillaPesqueira(BASE, 'faltante', { operador: null, material: null });
    const r = ejecutar(['--slug', 'villapesqueira', '--nombre', 'Villa Pesqueira'], raiz);
    assert.equal(r.codigo, 0, r.stderr);
    assert.match(r.stderr, /falta\s+scripts\/lotes-db\/operador-villapesqueira\.json/);
    const salida = path.join(raiz, 'scripts/herramienta-alta/plantillas');
    assert.deepEqual(fs.readdirSync(salida).sort(), ['LEEME.md', 'plantilla-contrato.json', 'plantilla-db-alta.js']);
    assert.match(fs.readFileSync(path.join(salida, 'LEEME.md'), 'utf8'), /Fuentes no encontradas/);

    const r2 = ejecutar(['--slug', 'noexiste', '--nombre', 'No Existe'], raiz);
    assert.equal(r2.codigo, 1);
    assert.match(r2.stderr, /ningún archivo de entrada/);
  });

  test('--material explícito inexistente: avisa y sigue', () => {
    const { raiz } = fixtureVillaPesqueira(BASE, 'material-explicito');
    const r = ejecutar(
      ['--slug', 'villapesqueira', '--nombre', 'Villa Pesqueira', '--material', 'no/esta/README.md'],
      raiz,
    );
    assert.equal(r.codigo, 0, r.stderr);
    assert.match(r.stderr, /falta\s+no\/esta\/README\.md/);
    assert.ok(!fs.existsSync(path.join(raiz, 'scripts/herramienta-alta/plantillas/plantilla-README-material.md')));
  });

  test('nombre acentuado (Bacadéhuachi)', () => {
    const { raiz } = crearFixture(BASE, 'acentos', 'bacadehuachi', {
      contrato: JSON.stringify(
        {
          nombre: 'Bacadéhuachi',
          sinAcentos: 'Bacadehuachi',
          titulo: 'BACADÉHUACHI',
          tituloSinAcentos: 'BACADEHUACHI',
          minus: 'bacadéhuachi',
          slug: 'bacadehuachi',
          raro: 'BacadeHuachi',
        },
        null,
        2,
      ),
      operador: JSON.stringify({ email: 'admin-bacadehuachi@northa.digital', rol: 'admin' }, null, 2),
    });
    const r = ejecutar(['--slug', 'bacadehuachi', '--nombre', 'Bacadéhuachi'], raiz);
    assert.equal(r.codigo, 0, r.stderr);
    assert.match(r.stderr, /falta\s+scripts\/herramienta-alta\/contratos\/db-alta-bacadehuachi\.js/);
    const salida = path.join(raiz, 'scripts/herramienta-alta/plantillas');
    const c = JSON.parse(fs.readFileSync(path.join(salida, 'plantilla-contrato.json'), 'utf8'));
    assert.deepEqual(c, {
      nombre: '{{NOMBRE}}',
      sinAcentos: '{{NOMBRE_SIN_ACENTOS}}',
      titulo: '{{NOMBRE_MAYUS}}',
      tituloSinAcentos: '{{NOMBRE_MAYUS_SIN_ACENTOS}}',
      minus: '{{NOMBRE_MINUS}}',
      slug: '{{SLUG}}',
      raro: 'BacadeHuachi',
    });
    const o = JSON.parse(fs.readFileSync(path.join(salida, 'plantilla-operador.json'), 'utf8'));
    assert.equal(o.email, 'admin-{{SLUG}}@northa.digital');
    const leeme = fs.readFileSync(path.join(salida, 'LEEME.md'), 'utf8');
    assert.match(leeme, /resto del nombre\/slug \("bacadehuachi"\) \| `BacadeHuachi`/);
  });

  test('password no vacío: ALERTA destacada, valor oculto en consola y LEEME, código 0', () => {
    const operadorConPassword = OPERADOR_VP.replace('"rol": "admin",', '"rol": "admin",\n  "password": "Secreta123",');
    const { raiz } = fixtureVillaPesqueira(BASE, 'seguridad', { operador: operadorConPassword });
    const r = ejecutar(['--slug', 'villapesqueira', '--nombre', 'Villa Pesqueira'], raiz);
    assert.equal(r.codigo, 0, r.stderr);
    assert.match(r.stderr, /ALERTA DE SEGURIDAD/);
    assert.match(r.stderr, /plantilla-operador\.json:6 .*"password"/);
    assert.ok(!r.stdout.includes('Secreta123') && !r.stderr.includes('Secreta123'), 'el secreto no debe imprimirse');
    const salida = path.join(raiz, 'scripts/herramienta-alta/plantillas');
    const leeme = fs.readFileSync(path.join(salida, 'LEEME.md'), 'utf8');
    assert.match(leeme, /### ALERTA DE SEGURIDAD/);
    assert.ok(!leeme.includes('Secreta123'), 'el secreto no debe aparecer en LEEME.md');
    // Regla 3: no se sustituye automáticamente; la plantilla conserva el valor y por eso se alerta.
    assert.ok(fs.readFileSync(path.join(salida, 'plantilla-operador.json'), 'utf8').includes('Secreta123'));
  });

  test('sintaxis JS rota tras sustituir: avisa (no aborta)', () => {
    const dbConIdentificador = "const villapesqueira = { id: 'x' };\nmodule.exports = villapesqueira;\n";
    const { raiz, rutas } = fixtureVillaPesqueira(BASE, 'sintaxis', { dbAlta: dbConIdentificador });
    const r = ejecutar(['--slug', 'villapesqueira', '--nombre', 'Villa Pesqueira'], raiz);
    assert.equal(r.codigo, 0, r.stderr);
    assert.match(r.stderr, /AVISO\s+plantilla-db-alta\.js\s+node --check falló .*SyntaxError/);
    assert.equal(fs.readFileSync(rutas.dbAlta, 'utf8'), dbConIdentificador, 'la entrada no cambia');
    assert.ok(fs.existsSync(path.join(raiz, 'scripts/herramienta-alta/plantillas/plantilla-db-alta.js')));
  });

  test('--ayuda / -h, argumentos faltantes y opciones desconocidas', () => {
    for (const flag of ['--ayuda', '-h']) {
      const r = ejecutar([flag], BASE);
      assert.equal(r.codigo, 0);
      assert.match(r.stdout, /^Uso:/);
      assert.match(r.stdout, /--forzar/);
    }
    const sinNombre = ejecutar(['--slug', 'villapesqueira'], BASE);
    assert.equal(sinNombre.codigo, 1);
    assert.match(sinNombre.stderr, /faltan --slug y\/o --nombre/);

    const desconocida = ejecutar(['--slug', 'x', '--nombre', 'X', '--otra'], BASE);
    assert.equal(desconocida.codigo, 1);
    assert.match(desconocida.stderr, /opción desconocida: --otra/);

    const slugMalo = ejecutar(['--slug', '../x', '--nombre', 'X'], BASE);
    assert.equal(slugMalo.codigo, 1);
    assert.match(slugMalo.stderr, /--slug inválido/);
  });
});
