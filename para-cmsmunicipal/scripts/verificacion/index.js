// index.js — cargador de pruebas para `node --test scripts/verificacion`.
//
// Desde Node 21, `node --test <ruta>` trata cada argumento como patrón glob y ya
// no recorre directorios: intenta ejecutar la carpeta como módulo, y Node la
// resuelve a este index.js. Aquí se importan todas las pruebas *.test.mjs de la
// carpeta (en orden alfabético) para que el runner las reporte como siempre.
// En Node 18/20 este archivo se ignora (no coincide con los patrones de prueba)
// y el runner encuentra los *.test.mjs por sí mismo, así que nada corre dos veces.
//
// No es una herramienta: no hace peticiones ni lee nada fuera de esta carpeta.
// Solo usa import() dinámico, así que funciona como CommonJS o como ESM
// (según el "type" del package.json del repo que lo contenga).

(async () => {
  const path = await import('node:path');
  const fs = await import('node:fs');
  const { pathToFileURL } = await import('node:url');
  // CommonJS expone __dirname; en ESM se usa la ruta con la que se invocó a node.
  let dir = typeof __dirname === 'string' ? __dirname : path.resolve(process.argv[1] ?? '.');
  if (!fs.statSync(dir).isDirectory()) dir = path.dirname(dir);
  const archivos = fs.readdirSync(dir).filter((f) => /\.test\.(mjs|cjs|js)$/.test(f)).sort();
  for (const archivo of archivos) {
    await import(pathToFileURL(path.join(dir, archivo)).href);
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
