#!/usr/bin/env node
// aplicar-enlace-sitio.mjs
//
// En el panel de administración (cms-admin) agrega, en el menú lateral, el enlace
// "Ver sitio público" al portal del municipio de la persona que entró (pedido del operador,
// 2 de octubre de 2026). El enlace sale de Municipio.dominio, que la API pública ya publica
// (GET /api/municipios/<slug>): cada municipio ve el suyo, sin escribir direcciones a mano, y
// cuando un municipio compre su dominio el enlace se actualiza solo.
//
//   1. src/lib/api.js                 -> getSitioPublico() (función nueva, al final)
//   2. src/app/(admin)/layout.jsx     -> la pide junto con el usuario y se la pasa al menú
//   3. src/components/Sidebar.jsx     -> muestra "Ver sitio público" con la dirección, arriba de la
//                                        persona que entró (también en el menú del celular)
//
// Si la API no responde (o el municipio no tiene dominio), el enlace simplemente no aparece: el
// panel sigue funcionando igual. Todo o nada: si algún archivo no es como se esperaba, no toca nada.
//
// Uso:
//   node aplicar-enlace-sitio.mjs --dry-run ~/Developer/cms-admin
//   node aplicar-enlace-sitio.mjs --build --commit --push ~/Developer/cms-admin
//
// Node >= 18, sin dependencias. Solo escribe dentro del repo que se le pasa.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const API = "src/lib/api.js";
export const LAYOUT = "src/app/(admin)/layout.jsx";
export const SIDEBAR = "src/components/Sidebar.jsx";

export const MENSAJE_COMMIT = `Admin: enlace "Ver sitio público" de cada municipio

El menú lateral muestra el enlace al portal del municipio de quien entró
(Municipio.dominio, de la API pública). Si la API no responde o el municipio
no tiene dominio, el enlace no aparece y el panel sigue igual.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nc74wYa9arg6whdtGyz4eX
`;

export const FUNCION_API = `
// URL pública del portal del municipio del usuario (Municipio.dominio, de la API pública).
// Devuelve { url, host } o null (sin dominio o con la API caída): el panel no depende de esto, así
// que nunca lanza error ni espera más de 4 s.
export async function getSitioPublico() {
  let temporizador;
  try {
    const slug = await getMunicipioSlug();
    if (!slug) return null;
    const municipio = await Promise.race([
      apiFetch(\`/api/municipios/\${slug}\`),
      new Promise((resolve) => {
        temporizador = setTimeout(() => resolve(null), 4000);
      }),
    ]);
    const host = typeof municipio?.dominio === "string" ? municipio.dominio.trim().toLowerCase() : "";
    return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\\.[a-z]{2,}$/.test(host) ? { url: \`https://\${host}\`, host } : null;
  } catch (error) {
    // Una redirección de Next (sesión vencida) debe seguir su curso.
    if (typeof error?.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}
`;

export const ENLACE_JSX = `          {sitioUrl ? (
            <a
              href={sitioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/55" aria-hidden="true">
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              <span className="min-w-0">
                <span className="block truncate">Ver sitio público</span>
                {sitioHost ? (
                  <span className="block truncate text-[11px] text-white/40">{sitioHost}</span>
                ) : null}
              </span>
            </a>
          ) : null}
`;

const cuenta = (t, re) => (t.match(re) || []).length;

export function parchearApi(t) {
  if (/export\s+async\s+function\s+getSitioPublico\b/.test(t)) return { texto: t, yaEstaba: true };
  const falla = (que) => {
    throw new Error(`${API}: ${que}. El archivo no es como el esperado; no toqué el repo.`);
  };
  if (!/export\s+(async\s+)?function\s+apiFetch\b/.test(t)) falla("no encontré apiFetch");
  if (!/\bgetMunicipioSlug\b/.test(t)) falla("no encontré getMunicipioSlug");
  return { texto: `${t.replace(/\s+$/, "")}\n${FUNCION_API}`, yaEstaba: false };
}

export function parchearLayout(t) {
  if (t.includes("getSitioPublico")) return { texto: t, yaEstaba: true };
  const falla = (que) => {
    throw new Error(`${LAYOUT}: ${que}. El archivo no es como el esperado; no toqué el repo.`);
  };
  const imp = /^import\s*\{\s*getCurrentUser\s*\}\s*from\s*["']@\/lib\/auth["'];?[ \t]*\n/m;
  if (cuenta(t, new RegExp(imp.source, "gm")) !== 1) falla('no encontré el import de getCurrentUser desde "@/lib/auth"');
  const usuario = /^([ \t]*)const usuario = await getCurrentUser\(\);[ \t]*\n/m;
  if (cuenta(t, new RegExp(usuario.source, "gm")) !== 1) falla('no encontré "const usuario = await getCurrentUser();"');
  const uso = /<Sidebar usuario=\{usuario\} \/>/g;
  if (cuenta(t, uso) !== 1) falla('no encontré "<Sidebar usuario={usuario} />"');
  let s = t.replace(imp, (m) => `${m}import { getSitioPublico } from "@/lib/api";\n`);
  s = s.replace(usuario, (_m, sg) => `${sg}const [usuario, sitio] = await Promise.all([getCurrentUser(), getSitioPublico()]);\n`);
  s = s.replace(uso, "<Sidebar usuario={usuario} sitioUrl={sitio?.url ?? null} sitioHost={sitio?.host ?? null} />");
  return { texto: s, yaEstaba: false };
}

export function parchearSidebar(t) {
  if (t.includes("sitioUrl")) return { texto: t, yaEstaba: true };
  const falla = (que) => {
    throw new Error(`${SIDEBAR}: ${que}. El archivo no es como el esperado; no toqué el repo.`);
  };
  const firma = "export default function Sidebar({ usuario }) {";
  if (cuenta(t, /export default function Sidebar\(\{ usuario \}\) \{/g) !== 1) falla(`no encontré "${firma}"`);
  const bloque = /(<div className="shrink-0 border-t border-white\/10 p-3">\n)([ \t]*<div className="flex items-center gap-3 px-2 py-1\.5">)/g;
  if (cuenta(t, bloque) !== 1) falla("no encontré el bloque de la persona que entró (al pie del menú)");
  let s = t.replace(firma, "export default function Sidebar({ usuario, sitioUrl = null, sitioHost = null }) {");
  s = s.replace(bloque, (_m, a, b) => `${a}${ENLACE_JSX}${b}`);
  return { texto: s, yaEstaba: false };
}

const leer = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);

/** Calcula, sin escribir, los cambios del repo `raiz`. Lanza un Error si no es seguro. */
export function planificar(raiz) {
  const cambios = [];
  for (const [ruta, parche] of [[API, parchearApi], [LAYOUT, parchearLayout], [SIDEBAR, parchearSidebar]]) {
    const antes = leer(path.join(raiz, ruta));
    if (antes === null) throw new Error(`no existe ${ruta}: no parece cms-admin`);
    const { texto, yaEstaba } = parche(antes);
    if (!yaEstaba) cambios.push({ ruta, antes, despues: texto });
  }
  return { cambios };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const AYUDA = `aplicar-enlace-sitio.mjs — enlace "Ver sitio público" en el menú de cms-admin

  node aplicar-enlace-sitio.mjs [--dry-run] [--build] [--commit] [--push] <repo-de-cms-admin>

  --dry-run  muestra los cambios y no escribe nada
  --build    corre "npm run build" después de aplicar; si falla, deja el repo como estaba
  --commit   hace git pull --ff-only antes, y un commit SOLO con los archivos de este cambio
  --push     hace git push (requiere --commit)

  El repo debe estar en main y sin cambios sin guardar en los archivos que se tocan
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
  if (o.repos.length === 0) throw new Error("falta el repo de cms-admin");
  if (o.push && !o.commit) throw new Error("--push requiere --commit");
  if (o.dryRun && (o.build || o.commit || o.push)) throw new Error("--dry-run no se combina con --build, --commit ni --push");
  return o;
}

function git(raiz, args) {
  const r = spawnSync("git", args, { cwd: raiz, encoding: "utf8" });
  return { ok: r.status === 0, salida: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "enlace-sitio-"));
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

  const { cambios } = planificar(raiz);

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
  return resultados.some(([, e]) => e === "FALLA") ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main();
}
