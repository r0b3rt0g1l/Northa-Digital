#!/usr/bin/env node
// aplicar-cabildo-detalle.mjs
//
// En los portales, la página Gobierno / Cabildo muestra a Presidencia, Sindicatura y
// Regidurías como tarjetas que no hacen nada. En Gobierno / Directorio, en cambio, cada
// persona es un botón que abre una ventana con su foto, cargo y datos. Este script le da
// a Cabildo ese mismo comportamiento (pedido del operador, 2 de octubre de 2026):
//
//   1. components/gobierno/CabildoOrganigrama.jsx (nuevo): igual que DirectorioOrganigrama.jsx,
//      pero para el Cabildo. Guarda la persona seleccionada y abre PersonDetailModal.
//   2. app/(con-footer)/gobierno/cabildo/page.js: usa CabildoOrganigrama en lugar de Organigrama.
//
// No cambia Organigrama.jsx (ya acepta `onSelect`) ni PersonDetailModal.jsx (ya conoce el tipo
// "regidor"). Todo o nada por repo: si algo no es como el molde, no toca ese repo y dice qué.
//
// Uso:
//   node aplicar-cabildo-detalle.mjs --dry-run ~/Developer/Carbo
//   node aplicar-cabildo-detalle.mjs --build --commit --push ~/Developer/Carbo
//
// Node >= 18, sin dependencias. Solo escribe dentro de los repos que se le pasan.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const PAGINA = "app/(con-footer)/gobierno/cabildo/page.js";
export const COMPONENTE = "components/gobierno/CabildoOrganigrama.jsx";
export const ORGANIGRAMA = "components/gobierno/Organigrama.jsx";
export const MODAL = "components/gobierno/PersonDetailModal.jsx";

export const MENSAJE_COMMIT = `Cabildo: al dar clic en una persona se abre su detalle

Presidencia, Sindicatura y Regidurías del Cabildo ahora son botones que
abren la misma ventana de detalle que ya usa el Directorio (foto, cargo y
datos). Se agrega CabildoOrganigrama, igual que DirectorioOrganigrama, y la
página de Cabildo lo usa.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nc74wYa9arg6whdtGyz4eX
`;

export const COMPONENTE_TEXTO = `"use client";

import { useState } from "react";
import { Organigrama } from "@/components/gobierno/Organigrama";
import { PersonDetailModal } from "@/components/gobierno/PersonDetailModal";

// Organigrama del Cabildo con detalle al hacer clic, igual que el Directorio
// (ver DirectorioOrganigrama.jsx): Presidencia, Sindicatura y cada Regiduría son botones
// que abren la misma ventana con foto, cargo y datos. Es un componente de cliente porque
// guarda qué persona está seleccionada; la página del Cabildo sigue siendo de servidor.
export function CabildoOrganigrama({
  presidente = null,
  sindica = null,
  regidores = [],
}) {
  const [selected, setSelected] = useState(null);

  return (
    <>
      <Organigrama
        presidente={presidente}
        sindica={sindica}
        regidores={regidores}
        onSelect={setSelected}
      />
      <PersonDetailModal
        person={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}

export default CabildoOrganigrama;
`;

const PROPS_PERMITIDAS = new Set(["presidente", "sindica", "regidores"]);

/** Cambia <Organigrama .../> por <CabildoOrganigrama .../> en la página del Cabildo. */
export function parchearPagina(t) {
  if (t.includes("CabildoOrganigrama")) return { texto: t, yaEstaba: true };
  const falla = (que) => {
    throw new Error(`${PAGINA}: ${que}. El archivo no es como el del molde; no toqué el repo.`);
  };

  const importOrg = /^import\s*\{\s*Organigrama\s*\}\s*from\s*["']@\/components\/gobierno\/Organigrama["'];?[ \t]*\n/gm;
  const nImport = (t.match(importOrg) || []).length;
  if (nImport !== 1) falla(`esperaba 1 import de Organigrama y encontré ${nImport}`);

  const usos = [...t.matchAll(/<Organigrama(?=[\s/>])([\s\S]*?)\/>/g)];
  if (usos.length !== 1) falla(`esperaba 1 uso de <Organigrama ... /> y encontré ${usos.length}`);
  if (/<\/Organigrama>/.test(t)) falla("<Organigrama> tiene contenido dentro (hijos)");
  const props = [...usos[0][1].matchAll(/(?:^|\s)([A-Za-z_][\w-]*)\s*=/g)].map((m) => m[1]);
  const extra = props.filter((p) => !PROPS_PERMITIDAS.has(p));
  if (extra.length) falla(`<Organigrama> recibe props que CabildoOrganigrama no maneja: ${extra.join(", ")}`);

  let s = t.replace(importOrg, 'import { CabildoOrganigrama } from "@/components/gobierno/CabildoOrganigrama";\n');
  s = s.replace(/<Organigrama(?=[\s/>])/, "<CabildoOrganigrama");
  return { texto: s, yaEstaba: false };
}

const leer = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);

/** Calcula, sin escribir, los cambios del repo `raiz`. Lanza un Error si no es seguro. */
export function planificar(raiz) {
  const abs = (r) => path.join(raiz, r);
  for (const r of [PAGINA, ORGANIGRAMA, MODAL]) {
    if (!fs.existsSync(abs(r))) throw new Error(`no existe ${r}: no parece un portal del molde`);
  }
  if (!/\bonSelect\b/.test(leer(abs(ORGANIGRAMA)))) {
    throw new Error(`${ORGANIGRAMA} no acepta onSelect: este portal no tiene el organigrama con clic. No toqué el repo.`);
  }
  const modal = leer(abs(MODAL));
  if (!/PersonDetailModal/.test(modal) || !/onOpenChange/.test(modal)) {
    throw new Error(`${MODAL} no es como el del molde (se esperaba PersonDetailModal con person, open y onOpenChange). No toqué el repo.`);
  }

  const cambios = [];
  const actual = leer(abs(COMPONENTE));
  if (actual === null) cambios.push({ ruta: COMPONENTE, antes: null, despues: COMPONENTE_TEXTO });
  else if (actual !== COMPONENTE_TEXTO) throw new Error(`${COMPONENTE} ya existe y es distinto; revísalo a mano (no lo piso)`);

  const antes = leer(abs(PAGINA));
  const { texto, yaEstaba } = parchearPagina(antes);
  if (!yaEstaba) cambios.push({ ruta: PAGINA, antes, despues: texto });
  return { cambios };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const AYUDA = `aplicar-cabildo-detalle.mjs — el Cabildo abre el detalle de cada persona, como el Directorio

  node aplicar-cabildo-detalle.mjs [--dry-run] [--build] [--commit] [--push] <repo-del-portal>...

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
  if (o.repos.length === 0) throw new Error("falta al menos un repo del portal");
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
  if (c.antes === null) {
    console.log(`    + ${c.ruta} (nuevo, ${c.despues.split("\n").length} líneas)`);
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cabildo-detalle-"));
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
    for (const c of cambios) {
      if (c.antes === null) fs.rmSync(path.join(raiz, c.ruta), { force: true });
      else fs.writeFileSync(path.join(raiz, c.ruta), c.antes);
    }
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
    console.log("  ✔ subido a GitHub: Vercel publicará el cambio en 1-2 minutos");
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
