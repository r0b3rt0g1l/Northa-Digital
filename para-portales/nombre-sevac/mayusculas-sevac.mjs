#!/usr/bin/env node
// mayusculas-sevac.mjs
//
// Pone el nombre del apartado en MAYÚSCULAS: "SEvAC/Cumplimiento" -> "SEVAC/CUMPLIMIENTO"
// (pedido del operador, 2 de octubre de 2026), en los portales y en el admin (cms-admin).
// Es el paso que sigue a aplicar-nombre-sevac.mjs: parte del nombre que ese script puso.
//
// Reemplaza el nombre en TODOS los archivos de código del repo (app, components, lib en los
// portales; src en el admin), así no se queda ninguna aparición atrás. La dirección
// (/transparencia/sevac) no cambia.
//
// Un ajuste que solo aplica a los portales: el título grande del apartado permite partir el
// renglón después de la barra (SEVAC/ + CUMPLIMIENTO). Medido en producción, en mayúsculas el
// nombre mide 351 px y se sale de una pantalla de 320 px; con el salto permitido queda en dos
// renglones y cabe. El título sale de sevac.titulo (lib/sevac.js), sin duplicar el texto.
//
// Todo o nada por repo: si algún archivo esperado no tiene el nombre, o queda una aparición
// con otra forma de escribirlo, no toca ese repo y dice cuál.
//
// Uso:
//   node mayusculas-sevac.mjs --dry-run ~/Developer/Carbo ~/Developer/cms-admin
//   node mayusculas-sevac.mjs --build --commit --push ~/Developer/Carbo ~/Developer/cms-admin
//
// Node >= 18, sin dependencias. Solo escribe dentro de los repos que se le pasan.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const VIEJO = "SEvAC/Cumplimiento";
export const NUEVO = "SEVAC/CUMPLIMIENTO";

export const MENSAJE_COMMIT = `SEVAC/CUMPLIMIENTO: nombre del apartado en mayúsculas

El nombre del apartado se escribe todo en mayúsculas en el título, la pestaña,
el menú, el pie, la tarjeta de Transparencia y el admin. En el portal, el título
grande puede partirse después de la barra para que quepa en celulares de 320 px.
La dirección (/transparencia/sevac) no cambia.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nc74wYa9arg6whdtGyz4eX
`;

/** Archivos que deben tener el nombre (en cualquiera de las dos formas) para que el repo sea válido. */
export const ESPERADOS = {
  portal: [
    "lib/sevac.js",
    "components/layout/navItems.js",
    "components/layout/Footer.jsx",
    "components/home/TransparenciaCTA.jsx",
    "app/(con-footer)/transparencia/page.js",
    "app/(con-footer)/transparencia/sevac/page.js",
  ],
  admin: [
    "src/lib/nav.js",
    "src/lib/contenidos-catalogo.js",
    "src/app/(admin)/page.jsx",
    "src/app/(admin)/transparencia/sevac/page.jsx",
    "src/app/(admin)/transparencia/sevac/nuevo/page.jsx",
    "src/app/(admin)/transparencia/sevac/[id]/editar/page.jsx",
  ],
};
const RAICES = { portal: ["app", "components", "lib"], admin: ["src"] };
export const PAGINA_PORTAL = "app/(con-footer)/transparencia/sevac/page.js";

const TITULO_VIEJO = `fallbackTitulo="${VIEJO}"`;
const TITULO_NUEVO_MARCA = 'sevac.titulo.replace("/", "/\\u200b")';
const SALTO_COMENTARIO = "// U+200B tras la barra: deja partir el título en pantallas de 320 px.";

export function tipoDeRepo(raiz) {
  if (fs.existsSync(path.join(raiz, "components/layout/navItems.js")) && fs.existsSync(path.join(raiz, "lib/sevac.js"))) return "portal";
  if (fs.existsSync(path.join(raiz, "src/lib/nav.js")) && fs.existsSync(path.join(raiz, "src/app/(admin)/transparencia/sevac/page.jsx"))) return "admin";
  throw new Error("no parece ni un portal del molde ni cms-admin");
}

function archivosDeCodigo(raiz, tipo) {
  const salida = [];
  const recorrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) recorrer(f);
      else if (/\.(jsx?|tsx?|mjs)$/.test(e.name)) salida.push(path.relative(raiz, f).split(path.sep).join("/"));
    }
  };
  for (const r of RAICES[tipo]) if (fs.existsSync(path.join(raiz, r))) recorrer(path.join(raiz, r));
  return salida.sort();
}

/** En el portal, el título grande permite partir después de la barra. Devuelve el texto nuevo. */
export function parchearTituloPagina(t) {
  const n = t.split(TITULO_VIEJO).length - 1;
  if (n !== 1) {
    throw new Error(`${PAGINA_PORTAL}: esperaba 1 vez ${TITULO_VIEJO} y encontré ${n}. El archivo no es como el del molde; no toqué el repo.`);
  }
  if (!/import\s*\{\s*sevac\s*\}\s*from\s*["']@\/lib\/sevac["']/.test(t)) {
    throw new Error(`${PAGINA_PORTAL}: no importa sevac desde "@/lib/sevac". El archivo no es como el del molde; no toqué el repo.`);
  }
  const linea = new RegExp(`^([ \\t]*)${TITULO_VIEJO.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[ \\t]*$`, "m");
  if (!linea.test(t)) throw new Error(`${PAGINA_PORTAL}: ${TITULO_VIEJO} no está solo en su línea. No toqué el repo.`);
  return t.replace(linea, (_m, sg) => `${sg}${SALTO_COMENTARIO}\n${sg}fallbackTitulo={${TITULO_NUEVO_MARCA}}`);
}

/** Calcula, sin escribir, los cambios del repo `raiz`. Lanza un Error si no es seguro. */
export function planificar(raiz) {
  const tipo = tipoDeRepo(raiz);
  const cambios = [];
  const vistos = new Map();
  for (const ruta of archivosDeCodigo(raiz, tipo)) {
    const antes = fs.readFileSync(path.join(raiz, ruta), "utf8");
    let despues = antes;
    if (tipo === "portal" && ruta === PAGINA_PORTAL && antes.includes(VIEJO)) despues = parchearTituloPagina(despues);
    despues = despues.split(VIEJO).join(NUEVO);
    // Cualquier otra forma de escribirlo (p. ej. "Sevac/cumplimiento") es una duda: no se adivina.
    const raros = [...despues.matchAll(/sevac\s*\/\s*cumplimiento/gi)].map((m) => m[0]).filter((x) => x !== NUEVO);
    if (raros.length) throw new Error(`${ruta}: el nombre aparece escrito de otra forma ("${raros[0]}"); revísalo a mano. No toqué el repo.`);
    vistos.set(ruta, { tiene: despues.includes(NUEVO), cambia: despues !== antes });
    if (despues !== antes) cambios.push({ ruta, antes, despues });
  }
  for (const ruta of ESPERADOS[tipo]) {
    const v = vistos.get(ruta);
    if (!v || !v.tiene) {
      throw new Error(`${ruta} no tiene el nombre "${VIEJO}" ni "${NUEVO}". Aplica primero aplicar-nombre-sevac.mjs. No toqué el repo.`);
    }
  }
  if (tipo === "portal") {
    const pagina = fs.readFileSync(path.join(raiz, PAGINA_PORTAL), "utf8");
    const nueva = cambios.find((c) => c.ruta === PAGINA_PORTAL)?.despues ?? pagina;
    if (!nueva.includes(TITULO_NUEVO_MARCA)) {
      throw new Error(`${PAGINA_PORTAL}: falta el título con salto permitido. No toqué el repo.`);
    }
  }
  return { tipo, cambios };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const AYUDA = `mayusculas-sevac.mjs — "${VIEJO}" pasa a "${NUEVO}" (portales y cms-admin)

  node mayusculas-sevac.mjs [--dry-run] [--build] [--commit] [--push] <repo>...

  --dry-run  muestra los cambios y no escribe nada
  --build    corre "npm run build" después de aplicar; si falla, deja el repo como estaba
  --commit   hace git pull --ff-only antes, y un commit SOLO con los archivos de este cambio
  --push     hace git push (requiere --commit)

  Cada repo debe estar en main y sin cambios sin guardar en los archivos que se tocan
  (otros archivos modificados o sueltos se avisan, no se tocan ni se suben).
`;

export function leerArgs(argv) {
  const o = { dryRun: false, build: false, commit: false, push: false, ayuda: false, repos: [] };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--build") o.build = true;
    else if (a === "--commit") o.commit = true;
    else if (a === "--push") o.push = true;
    else if (a === "--ayuda" || a === "-h" || a === "--help") o.ayuda = true;
    else if (a.startsWith("--")) throw new Error(`opción desconocida: ${a}`);
    else o.repos.push(a);
  }
  if (o.ayuda) return o;
  if (o.repos.length === 0) throw new Error("falta al menos un repo");
  if (o.push && !o.commit) throw new Error("--push requiere --commit");
  if (o.dryRun && (o.build || o.commit || o.push)) throw new Error("--dry-run no se combina con --build, --commit ni --push");
  return o;
}

function git(raiz, args) {
  const r = spawnSync("git", args, { cwd: raiz, encoding: "utf8" });
  return { ok: r.status === 0, salida: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

/** Falla de npm ci o de build: se repetiría igual en los demás repos, así que se detiene ahí. */
class ErrorDeBuild extends Error {}

/** Rutas con cambios sin guardar (modificadas, nuevas o sin seguimiento), tal cual las da git. */
export function archivosModificados(raiz) {
  const r = spawnSync("git", ["status", "--porcelain", "-z"], { cwd: raiz, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git status falló: ${r.stderr}`);
  const partes = r.stdout.split("\0").filter(Boolean);
  const rutas = [];
  for (let i = 0; i < partes.length; i++) {
    const estado = partes[i].slice(0, 2);
    rutas.push(partes[i].slice(3));
    if (estado[0] === "R" || estado[0] === "C") i++;
  }
  return rutas;
}

function mostrarDiff(c) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mayusculas-sevac-"));
  try {
    const a = path.join(dir, "antes");
    const b = path.join(dir, "despues");
    fs.writeFileSync(a, c.antes);
    fs.writeFileSync(b, c.despues);
    const r = spawnSync("diff", ["-u", "--label", `${c.ruta} (antes)`, "--label", `${c.ruta} (después)`, a, b], { encoding: "utf8" });
    console.log(r.stdout.replace(/^/gm, "    "));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function procesar(raizArg, o) {
  const raiz = path.resolve(raizArg.replace(/^~(?=$|\/)/, os.homedir()));
  console.log(`\n=== ${path.basename(raiz)} (${raiz})`);
  if (!fs.existsSync(path.join(raiz, ".git"))) throw new Error("no es un repo git");
  const remoto = git(raiz, ["remote", "get-url", "origin"]);
  console.log(`  repo: ${remoto.ok ? remoto.salida : "(sin remoto origin)"}`);
  const rama = git(raiz, ["rev-parse", "--abbrev-ref", "HEAD"]).salida;
  if (!o.dryRun && rama !== "main") throw new Error(`está en la rama "${rama}"; cámbiate a main (git switch main)`);

  if (o.commit) {
    const pull = git(raiz, ["pull", "--ff-only"]);
    if (!pull.ok) throw new Error(`git pull --ff-only falló: ${pull.salida}`);
    console.log("  ✔ al día con GitHub (git pull --ff-only)");
  }

  const { tipo, cambios } = planificar(raiz);
  console.log(`  tipo: ${tipo === "portal" ? "portal" : "admin (cms-admin)"}`);

  const modificados = archivosModificados(raiz);
  const propios = new Set(cambios.map((c) => c.ruta));
  const enConflicto = modificados.filter((f) => propios.has(f));
  if (!o.dryRun && enConflicto.length) throw new Error(`tiene cambios sin guardar en archivos que este script toca:\n${enConflicto.join("\n")}`);
  const ajenos = modificados.filter((f) => !propios.has(f));
  if (ajenos.length) console.log(`  ⚠ otros cambios sin guardar (no se tocan ni se suben): ${ajenos.join(", ")}`);

  if (cambios.length === 0) {
    console.log("  ✔ ya estaba aplicado: nada que cambiar");
    return "ya-estaba";
  }
  console.log(`  ${cambios.length} archivo(s): ${cambios.map((c) => c.ruta).join(", ")}`);
  if (o.dryRun) {
    for (const c of cambios) mostrarDiff(c);
    console.log("  (prueba en seco: no se escribió nada)");
    return "prueba";
  }

  for (const c of cambios) fs.writeFileSync(path.join(raiz, c.ruta), c.despues);
  const deshacer = () => {
    for (const c of cambios) fs.writeFileSync(path.join(raiz, c.ruta), c.antes);
  };
  console.log("  ✔ cambios escritos");
  if (o.build) {
    if (!fs.existsSync(path.join(raiz, "node_modules"))) {
      console.log("  … instalando dependencias (npm ci)");
      if (spawnSync("npm", ["ci"], { cwd: raiz, stdio: "inherit" }).status !== 0) {
        deshacer();
        throw new ErrorDeBuild("npm ci falló; dejé el repo como estaba");
      }
    }
    console.log("  … npm run build");
    if (spawnSync("npm", ["run", "build"], { cwd: raiz, stdio: "inherit" }).status !== 0) {
      deshacer();
      throw new ErrorDeBuild("el build falló; dejé el repo como estaba. Pega la salida de arriba en el chat");
    }
    console.log("  ✔ build correcto");
  }
  if (o.commit) {
    const add = git(raiz, ["add", "--", ...cambios.map((c) => c.ruta)]);
    if (!add.ok) throw new Error(`git add falló: ${add.salida}`);
    // Solo los archivos de este cambio, aunque haya otros en el índice.
    const ci = git(raiz, ["commit", "-q", "-m", MENSAJE_COMMIT, "--", ...cambios.map((c) => c.ruta)]);
    if (!ci.ok) throw new Error(`git commit falló: ${ci.salida}`);
    console.log(`  ✔ commit ${git(raiz, ["rev-parse", "--short", "HEAD"]).salida}`);
  }
  if (o.push) {
    const p = git(raiz, ["push", "origin", "main"]);
    if (!p.ok) throw new Error(`git push falló (el commit quedó hecho; vuelve a intentar "git push"): ${p.salida}`);
    console.log("  ✔ subido a GitHub: se publicará en 1-2 minutos");
  }
  return "aplicado";
}

export function main(argv = process.argv.slice(2)) {
  let o;
  try {
    o = leerArgs(argv);
  } catch (e) {
    console.error(`Error: ${e.message}\n\n${AYUDA}`);
    return 3;
  }
  if (o.ayuda) {
    console.log(AYUDA);
    return 0;
  }
  const resultados = [];
  for (const r of o.repos) {
    try {
      resultados.push([r, procesar(r, o)]);
    } catch (e) {
      console.error(`  ✘ ${e.message}`);
      resultados.push([r, "FALLA"]);
      if (e instanceof ErrorDeBuild) break;
    }
  }
  console.log("\nResumen:");
  for (const [r, estado] of resultados) console.log(`  ${estado.padEnd(9)} ${path.basename(r)}`);
  const pendientes = o.repos.length - resultados.length;
  if (pendientes > 0) console.log(`  (${pendientes} repo(s) sin procesar: me detuve en el primer build fallido)`);
  return resultados.some(([, e]) => e === "FALLA") || pendientes > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main();
}
