#!/usr/bin/env node
// fijar-dominio.mjs — pone Municipio.dominio de UN municipio, de forma segura.
//
// Para qué: el backend (src/middleware/invalidarCache.js) avisa al portal con
// POST https://${dominio}/api/revalidate. Si dominio es null, el aviso nunca sale y lo que
// se carga en el panel tarda hasta que caduca la caché del portal (alrededor de 1 h).
// Mientras no haya dominio propio, se usa el host provisional (<slug>.vercel.app).
//
// Seguridad:
//   - Por defecto es PRUEBA EN SECO: hace todo dentro de una transacción y la deshace (ROLLBACK).
//     Solo con --aplicar hace COMMIT.
//   - Bloquea la fila (FOR UPDATE), exige exactamente 1 municipio con ese slug y exactamente
//     1 fila actualizada.
//   - Si dominio ya tiene OTRO valor, no lo pisa salvo con --forzar.
//   - Valida el formato (solo host: sin https://, sin "/", sin espacios), igual que la flota.
//
// Uso (desde la raíz de cmsmunicipal, para que encuentre el paquete `pg` y el .env):
//   node --env-file=.env fijar-dominio.mjs --slug villapesqueira --dominio villapesqueira.vercel.app
//   node --env-file=.env fijar-dominio.mjs --slug villapesqueira --dominio villapesqueira.vercel.app --aplicar
//
// Conexión: SESSION_URL si existe (como db-alta-*.js); si no, DATABASE_URL.

import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export function leerArgs(argv) {
  const o = { slug: null, dominio: null, aplicar: false, forzar: false, ayuda: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--aplicar') o.aplicar = true;
    else if (a === '--forzar') o.forzar = true;
    else if (a === '--ayuda' || a === '-h') o.ayuda = true;
    else if (a === '--slug' || a === '--dominio') {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} requiere un valor`);
      o[a.slice(2)] = v.trim();
    } else throw new Error(`opción desconocida: ${a}`);
  }
  if (!o.ayuda) {
    if (!o.slug || !/^[a-z0-9-]+$/.test(o.slug)) throw new Error('--slug es obligatorio (minúsculas, números y guiones)');
    if (!o.dominio) throw new Error('--dominio es obligatorio');
    if (!esHostValido(o.dominio)) throw new Error(`--dominio debe ser solo el host, p. ej. villapesqueira.vercel.app (sin https:// ni "/"); recibí "${o.dominio}"`);
  }
  return o;
}

export function esHostValido(h) {
  return /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h);
}

// Lógica separada del driver para poder probarla con un cliente simulado.
export async function fijarDominio(client, { slug, dominio, aplicar, forzar }, log = console.log) {
  await client.query('BEGIN');
  try {
    const sel = await client.query('SELECT "id", "slug", "dominio" FROM "Municipio" WHERE "slug" = $1 FOR UPDATE', [slug]);
    if (sel.rows.length !== 1) throw new Error(`se esperaba exactamente 1 municipio con slug "${slug}" y hay ${sel.rows.length}`);
    const antes = sel.rows[0].dominio;
    log(`Municipio: ${slug} (id ${sel.rows[0].id})`);
    log(`  dominio actual: ${antes === null ? 'null' : antes}`);
    if (antes === dominio) {
      await client.query('ROLLBACK');
      log('  Ya tiene ese dominio: nada que cambiar.');
      return { estado: 'ya-estaba', antes, despues: antes };
    }
    if (antes !== null && antes !== '' && !forzar) {
      throw new Error(`el dominio ya vale "${antes}"; usa --forzar si de verdad quieres reemplazarlo por "${dominio}"`);
    }
    const otros = await client.query('SELECT "slug" FROM "Municipio" WHERE "dominio" = $1 AND "slug" <> $2', [dominio, slug]);
    if (otros.rows.length) throw new Error(`el dominio "${dominio}" ya lo usa otro municipio: ${otros.rows.map((r) => r.slug).join(', ')}`);
    const upd = await client.query('UPDATE "Municipio" SET "dominio" = $1 WHERE "slug" = $2', [dominio, slug]);
    if (upd.rowCount !== 1) throw new Error(`se esperaba actualizar 1 fila y se actualizaron ${upd.rowCount}`);
    const ver = await client.query('SELECT "dominio" FROM "Municipio" WHERE "slug" = $1', [slug]);
    log(`  dominio nuevo:  ${ver.rows[0].dominio}`);
    if (aplicar) {
      await client.query('COMMIT');
      log('  COMMIT: cambio guardado.');
      return { estado: 'aplicado', antes, despues: ver.rows[0].dominio };
    }
    await client.query('ROLLBACK');
    log('  PRUEBA EN SECO: se deshizo (ROLLBACK). Repite con --aplicar para guardarlo.');
    return { estado: 'prueba', antes, despues: ver.rows[0].dominio };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  }
}

const AYUDA = `fijar-dominio.mjs — pone Municipio.dominio de un municipio (prueba en seco por defecto)

  node --env-file=.env fijar-dominio.mjs --slug <slug> --dominio <host> [--aplicar] [--forzar]

  Ejecútalo desde la raíz de cmsmunicipal (necesita el paquete "pg" y el .env).
  Sin --aplicar no guarda nada. --forzar permite reemplazar un dominio que ya existe.
`;

export async function main(argv = process.argv.slice(2)) {
  let o;
  try { o = leerArgs(argv); } catch (e) { console.error(`Error: ${e.message}\n\n${AYUDA}`); return 3; }
  if (o.ayuda) { console.log(AYUDA); return 0; }
  const url = process.env.SESSION_URL || process.env.DATABASE_URL;
  if (!url) { console.error('Falta SESSION_URL o DATABASE_URL. Ejecuta con: node --env-file=.env …'); return 3; }
  let pg;
  try {
    pg = createRequire(path.join(process.cwd(), 'package.json'))('pg');
  } catch {
    console.error('No encuentro el paquete "pg". Ejecuta el script desde la raíz de cmsmunicipal.');
    return 3;
  }
  const client = new (pg.Client || pg.default.Client)({ connectionString: url });
  try {
    await client.connect();
    const host = new URL(url).hostname;
    console.log(`Base de datos: ${host}${o.aplicar ? '' : '   (PRUEBA EN SECO)'}`);
    await fijarDominio(client, o);
    return 0;
  } catch (e) {
    console.error(`No se cambió nada: ${e.message}`);
    return 1;
  } finally {
    await client.end().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then((c) => { process.exitCode = c; });
}
