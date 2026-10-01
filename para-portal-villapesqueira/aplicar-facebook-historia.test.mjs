import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as M from './aplicar-facebook-historia.mjs';

const CFG = `// Configuración del municipio.
export const municipalConfig = {
  identidad: {
    nombreCorto: 'Villa Pesqueira', // { llave dentro de un comentario }
    fundacion: { anio: 1629, texto: 'Misión de San José de Mátape.' },
    nota: 'cadena con } y { dentro',
  },

  redes: {
    // TODO: redes_sociales — pendientes de URLs oficiales
    facebook: null,
    instagram: null,
    twitter: null,
    youtube: null,
  },

  enlacesExternos: { transparenciaSonora: 'https://transparencia.sonora.gob.mx/organismos/9/1164' },

  historia: {
    subtitulo: '',
    parrafos: [],
  },

  paleta: { primario: '#23292E' },
};
`;

const HITOS_VACIO = `// Hitos históricos del municipio.
export const hitos = [];
`;

let n = 0;
function fixture({ cfg = CFG, hitos = HITOS_VACIO, git = false, crlf = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-fh-'));
  fs.mkdirSync(path.join(dir, 'lib'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const conv = (s) => (crlf ? s.replace(/\n/g, '\r\n') : s);
  if (cfg !== null) fs.writeFileSync(path.join(dir, 'lib', 'municipalConfig.js'), conv(cfg));
  if (hitos !== null) fs.writeFileSync(path.join(dir, 'lib', 'hitos.js'), conv(hitos));
  if (git) {
    const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
    g('init', '-q');
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A');
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init');
  }
  return dir;
}
const leer = (dir, f) => fs.readFileSync(path.join(dir, 'lib', f), 'utf8');
const sha = (dir) =>
  ['municipalConfig.js', 'hitos.js']
    .filter((f) => fs.existsSync(path.join(dir, 'lib', f)))
    .map((f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'lib', f))).digest('hex'))
    .join('|');
function correr(dir, ...args) {
  const out = [];
  const err = [];
  const code = M.main(['--raiz', dir, ...args], { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
async function importar(dir, f) {
  return import(pathToFileURL(path.join(dir, 'lib', f)).href + `?v=${++n}`);
}

test('aplica los tres cambios y el resultado se puede importar', async () => {
  const dir = fixture();
  const r = correr(dir);
  assert.equal(r.code, 0, r.err + r.out);
  const { municipalConfig: c } = await importar(dir, 'municipalConfig.js');
  assert.equal(c.redes.facebook, 'https://www.facebook.com/ayuntamientodevillapesqueira');
  assert.equal(c.redes.instagram, null);
  assert.match(c.historia.subtitulo, /1629.*1867/);
  assert.equal(c.historia.parrafos.length, 3, 'el párrafo de nivel 2 queda comentado');
  assert.ok(c.historia.parrafos[1].includes('«lugar de metales»'));
  assert.equal(c.identidad.nota, 'cadena con } y { dentro', 'no toca el resto');
  assert.equal(c.paleta.primario, '#23292E');
  const { hitos } = await importar(dir, 'hitos.js');
  assert.deepEqual(hitos.map((h) => h.ano), ['1629', '1867-02-11']);
  assert.deepEqual(Object.keys(hitos[0]), ['ano', 'titulo', 'descripcion']);
});

test('respeta el estilo de comillas de cada archivo y deja las fuentes comentadas', () => {
  const dir = fixture();
  correr(dir);
  const cfg = leer(dir, 'municipalConfig.js');
  const hit = leer(dir, 'hitos.js');
  assert.match(cfg, /facebook: 'https:\/\/www\.facebook\.com\/ayuntamientodevillapesqueira'/);
  assert.match(hit, /ano: "1629"/);
  assert.match(cfg, /\/\/ Fuentes: https:\/\/es\.wikipedia\.org/);
  assert.match(hit, /\/\/ Fuente: .*wikipedia/);
  assert.match(hit, /\/\/ NIVEL 3 \(NO publicar\)/);
  assert.match(hit, /^ {2}\/\/ \{\n {2}\/\/ {3}\/\/ Fuente: http:\/\/matape/m, 'los hitos de nivel 2 van comentados en una sola columna');
  assert.doesNotMatch(hit, /^\s*ano: "186[56]"/m, 'nivel 2 no está activo');
});

test('descomentar el nivel 2 (quitar `// ` de sus líneas) deja un archivo válido', async () => {
  const dir = fixture();
  correr(dir);
  const des = (src, lineasPorBloque) => {
    const ls = src.split('\n');
    for (let i = 0; i < ls.length; i++) {
      if (!/NIVEL 2/.test(ls[i])) continue;
      for (let k = 1; k <= lineasPorBloque; k++) ls[i + k] = ls[i + k].replace('// ', '');
    }
    return ls.join('\n');
  };
  fs.writeFileSync(path.join(dir, 'lib', 'hitos.js'), des(leer(dir, 'hitos.js'), 7));
  fs.writeFileSync(path.join(dir, 'lib', 'municipalConfig.js'), des(leer(dir, 'municipalConfig.js'), 1));
  const { hitos } = await importar(dir, 'hitos.js');
  assert.deepEqual(hitos.map((h) => h.ano), ['1629', '1865', '1866', '1867-02-11']);
  assert.ok(hitos[1].descripcion.includes('Barceló'));
  const { municipalConfig: c } = await importar(dir, 'municipalConfig.js');
  assert.equal(c.historia.parrafos.length, 4);
  assert.match(c.historia.parrafos[3], /Intervención Francesa/);
});

test('es idempotente: la segunda corrida no cambia nada', () => {
  const dir = fixture();
  assert.equal(correr(dir, '--forzar').code, 0);
  const antes = sha(dir);
  const r = correr(dir, '--forzar');
  assert.equal(r.code, 0);
  assert.match(r.out, /Nada que cambiar/);
  assert.equal((r.out.match(/YA ESTABA/g) || []).length, 3);
  assert.equal(sha(dir), antes);
});

test('--dry-run muestra el cambio y no escribe', () => {
  const dir = fixture();
  const antes = sha(dir);
  const r = correr(dir, '--dry-run');
  assert.equal(r.code, 0);
  assert.match(r.out, /\+ .*facebook\.com\/ayuntamientodevillapesqueira/);
  assert.equal(sha(dir), antes);
});

test('todo o nada: si historia ya tiene otro contenido, no se aplica ni facebook', () => {
  const cfg = CFG.replace("subtitulo: '',\n    parrafos: [],", "subtitulo: 'Otro texto',\n    parrafos: ['Algo que ya escribieron'],");
  const dir = fixture({ cfg });
  const antes = sha(dir);
  const r = correr(dir);
  assert.equal(r.code, 1);
  assert.match(r.out, /\[ERROR\]\s+historia/);
  assert.match(r.err, /No se escribió nada/);
  assert.equal(sha(dir), antes, 'facebook tampoco se escribió');
  assert.equal(correr(dir, '--forzar').code, 0, 'con --forzar sí reemplaza');
  assert.ok(!leer(dir, 'municipalConfig.js').includes('Algo que ya escribieron'));
});

test('no pisa un enlace de Facebook distinto sin --forzar', () => {
  const cfg = CFG.replace('facebook: null', "facebook: 'https://www.facebook.com/otra-pagina'");
  const dir = fixture({ cfg });
  const antes = sha(dir);
  const r = correr(dir);
  assert.equal(r.code, 1);
  assert.match(r.out, /otra-pagina/);
  assert.equal(sha(dir), antes);
  assert.equal(correr(dir, '--forzar').code, 0);
  assert.match(leer(dir, 'municipalConfig.js'), /ayuntamientodevillapesqueira/);
});

test('si falta lib/hitos.js no escribe; con --solo aplica lo demás', () => {
  const dir = fixture({ hitos: null });
  const antes = sha(dir);
  const r = correr(dir);
  assert.equal(r.code, 1);
  assert.match(r.err, /lib[\\/]hitos\.js/);
  assert.equal(sha(dir), antes);
  const s = correr(dir, '--solo', 'facebook,historia');
  assert.equal(s.code, 0, s.err);
  assert.match(leer(dir, 'municipalConfig.js'), /ayuntamientodevillapesqueira/);
});

test('error claro si no hay bloque redes, o si hay dos', () => {
  const sinRedes = fixture({ cfg: CFG.replace(/redes: \{[\s\S]*?\},\n/, '') });
  const r1 = correr(sinRedes, '--solo', 'facebook');
  assert.equal(r1.code, 1);
  assert.match(r1.out, /no encontré «redes: \{»/);
  const doble = fixture({ cfg: CFG + '\nexport const otra = { redes: { facebook: null } };\n' });
  const r2 = correr(doble, '--solo', 'facebook');
  assert.equal(r2.code, 1);
  assert.match(r2.out, /2 coincidencias/);
});

test('un bloque historia que no cierra se rechaza sin escribir', () => {
  const cfg = 'export const municipalConfig = {\n  historia: {\n    subtitulo: "",\n';
  const dir = fixture({ cfg });
  const antes = sha(dir);
  const r = correr(dir, '--solo', 'historia');
  assert.equal(r.code, 1);
  assert.match(r.out, /no cierra/);
  assert.equal(sha(dir), antes);
});

test('conserva los saltos de línea CRLF', () => {
  const dir = fixture({ crlf: true });
  assert.equal(correr(dir).code, 0);
  for (const f of ['municipalConfig.js', 'hitos.js']) {
    assert.ok(!/(?<!\r)\n/.test(leer(dir, f)), `${f} mezcló saltos de línea`);
  }
});

test('no toca archivos con cambios sin guardar en git (salvo --forzar)', { skip: spawnSync('git', ['--version']).status !== 0 }, () => {
  const dir = fixture({ git: true });
  fs.appendFileSync(path.join(dir, 'lib', 'municipalConfig.js'), '// cambio local\n');
  const antes = sha(dir);
  const r = correr(dir);
  assert.equal(r.code, 1);
  assert.match(r.err, /cambios sin guardar/);
  assert.equal(sha(dir), antes);
  assert.equal(correr(dir, '--forzar').code, 0);
});

test('bloque real de San Javier (con TODO y comentarios) se parchea bien', () => {
  const real = `  // TODO_SANJAVIER: redes_sociales — pendientes de URLs oficiales aportadas
  // por el ayuntamiento.
  redes: {
    facebook: null,
    instagram: null,
    twitter: null,
    youtube: null,
  },
`;
  const p = M.planFacebook(`export const municipalConfig = {\n${real}};\n`);
  assert.equal(p.estado, 'aplicar');
  assert.match(p.src, /facebook: 'https:\/\/www\.facebook\.com\/ayuntamientodevillapesqueira',/);
  assert.match(p.src, /TODO_SANJAVIER/);
});

test('lit escapa comillas, barras y saltos de línea', () => {
  assert.equal(M.lit("it's", "'"), "'it\\'s'");
  assert.equal(M.lit('a"b', '"'), '"a\\"b"');
  assert.equal(M.lit('a\\b\nc', "'"), "'a\\\\b\\nc'");
  assert.equal(eval(M.lit("l'«x»\\\n", "'")), "l'«x»\\\n");
});

test('cierreDe ignora llaves en cadenas, plantillas y comentarios', () => {
  const s = "{ a: '}', b: `}${1}`, // }\n c: /* } */ 1 }";
  assert.equal(M.cierreDe(s, 0), s.length - 1);
  assert.equal(M.cierreDe('{ sin cerrar', 0), -1);
});

test('uso: ayuda sale con 0 y una opción desconocida con 3', () => {
  const a = [];
  assert.equal(M.main(['--ayuda'], { out: (s) => a.push(s), err() {} }), 0);
  assert.match(a.join(''), /Todo o nada/);
  const e = [];
  assert.equal(M.main(['--nada'], { out() {}, err: (s) => e.push(s) }), 3);
  assert.match(e.join(''), /opción desconocida/);
});

test('el contenido: nivel 1 activo, nivel 2 comentado, sin afirmar lo no verificado', () => {
  assert.ok(M.HITOS.filter((h) => !h.pendiente).map((h) => h.ano).join() === '1629,1867-02-11');
  assert.ok(M.HITOS.filter((h) => h.pendiente).every((h) => /una sola fuente/.test(h.pendiente)));
  const todo = JSON.stringify([M.HISTORIA, M.HITOS]);
  assert.doesNotMatch(todo, /1930|1934/, 'la fecha en conflicto no se publica');
  assert.doesNotMatch(todo, /en honor|honra/i, 'no afirma el origen del apellido');
});
