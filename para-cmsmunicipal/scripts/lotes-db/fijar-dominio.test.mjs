import test from 'node:test';
import assert from 'node:assert/strict';
import { leerArgs, esHostValido, fijarDominio } from './fijar-dominio.mjs';

// Cliente simulado de pg: guarda filas en memoria y respeta BEGIN/COMMIT/ROLLBACK.
function clienteFalso(filas) {
  let datos = structuredClone(filas);
  let copia = null;
  const sql = [];
  return {
    sql,
    get datos() { return datos; },
    async query(q, p = []) {
      sql.push(q);
      if (q === 'BEGIN') { copia = structuredClone(datos); return {}; }
      if (q === 'COMMIT') { copia = null; return {}; }
      if (q === 'ROLLBACK') { if (copia) datos = copia; copia = null; return {}; }
      if (q.startsWith('SELECT "id"')) return { rows: datos.filter((r) => r.slug === p[0]) };
      if (q.startsWith('SELECT "slug" FROM')) return { rows: datos.filter((r) => r.dominio === p[0] && r.slug !== p[1]) };
      if (q.startsWith('UPDATE')) { let n = 0; for (const r of datos) if (r.slug === p[1]) { r.dominio = p[0]; n++; } return { rowCount: n }; }
      if (q.startsWith('SELECT "dominio"')) return { rows: datos.filter((r) => r.slug === p[0]) };
      throw new Error('consulta inesperada: ' + q);
    },
  };
}
const BASE = [
  { id: 'a', slug: 'villapesqueira', dominio: null },
  { id: 'b', slug: 'carbo', dominio: 'carbotransparencia.com.mx' },
];
const silencio = () => {};
const opts = (x = {}) => ({ slug: 'villapesqueira', dominio: 'villapesqueira.vercel.app', aplicar: false, forzar: false, ...x });

test('prueba en seco: muestra el cambio pero no lo guarda', async () => {
  const c = clienteFalso(BASE);
  const r = await fijarDominio(c, opts(), silencio);
  assert.equal(r.estado, 'prueba');
  assert.equal(r.despues, 'villapesqueira.vercel.app');
  assert.equal(c.datos[0].dominio, null, 'se deshizo');
  assert.equal(c.sql.at(-1), 'ROLLBACK');
});

test('con --aplicar guarda (COMMIT) y no toca a otros municipios', async () => {
  const c = clienteFalso(BASE);
  const r = await fijarDominio(c, opts({ aplicar: true }), silencio);
  assert.equal(r.estado, 'aplicado');
  assert.equal(c.datos[0].dominio, 'villapesqueira.vercel.app');
  assert.equal(c.datos[1].dominio, 'carbotransparencia.com.mx');
  assert.equal(c.sql.at(-1), 'COMMIT');
});

test('idempotente: si ya tiene ese dominio no cambia nada', async () => {
  const c = clienteFalso([{ ...BASE[0], dominio: 'villapesqueira.vercel.app' }]);
  const r = await fijarDominio(c, opts({ aplicar: true }), silencio);
  assert.equal(r.estado, 'ya-estaba');
  assert.ok(!c.sql.some((q) => q.startsWith('UPDATE')));
});

test('no pisa un dominio existente sin --forzar; con --forzar sí', async () => {
  const c = clienteFalso([{ ...BASE[0], dominio: 'villapesqueiratransparencia.com.mx' }]);
  await assert.rejects(fijarDominio(c, opts({ aplicar: true }), silencio), /ya vale/);
  assert.equal(c.datos[0].dominio, 'villapesqueiratransparencia.com.mx');
  const r = await fijarDominio(c, opts({ aplicar: true, forzar: true }), silencio);
  assert.equal(r.estado, 'aplicado');
});

test('rechaza un slug inexistente y un dominio que ya usa otro municipio', async () => {
  const c = clienteFalso(BASE);
  await assert.rejects(fijarDominio(c, opts({ slug: 'noexiste', aplicar: true }), silencio), /exactamente 1/);
  await assert.rejects(fijarDominio(c, opts({ dominio: 'carbotransparencia.com.mx', aplicar: true }), silencio), /ya lo usa otro/);
  assert.equal(c.datos[0].dominio, null);
});

test('valida el formato del dominio y los argumentos', () => {
  assert.ok(esHostValido('villapesqueira.vercel.app'));
  assert.ok(esHostValido('www.villapesqueiratransparencia.com.mx'));
  for (const malo of ['https://villapesqueira.vercel.app', 'villapesqueira.vercel.app/', 'villa pesqueira.mx', 'localhost', 'VILLA.MX']) {
    assert.ok(!esHostValido(malo), malo);
  }
  assert.throws(() => leerArgs(['--slug', 'villapesqueira']), /--dominio es obligatorio/);
  assert.throws(() => leerArgs(['--slug', 'villapesqueira', '--dominio', 'https://x.mx']), /solo el host/);
  assert.throws(() => leerArgs(['--nada']), /desconocida/);
  assert.equal(leerArgs(['--slug', 'villapesqueira', '--dominio', 'villapesqueira.vercel.app', '--aplicar']).aplicar, true);
});
