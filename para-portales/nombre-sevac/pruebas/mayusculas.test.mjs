import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { planificar, parchearTituloPagina, leerArgs, tipoDeRepo, archivosModificados, VIEJO, NUEVO, PAGINA_PORTAL, ESPERADOS } from "../mayusculas-sevac.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RENOMBRAR = path.join(AQUI, "..", "aplicar-nombre-sevac.mjs");
const SCRIPT = path.join(AQUI, "..", "mayusculas-sevac.mjs");

function git(cwd, ...args) {
  const r = spawnSync("git", ["-c", "user.email=prueba@local", "-c", "user.name=prueba", ...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
/** Repo en el estado real de la flota: partiendo del molde original, con el nombre "SEvAC/Cumplimiento" ya aplicado. */
function repoConNombre(tipo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${tipo}-`));
  fs.cpSync(path.join(AQUI, "fixtures", tipo), dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "molde");
  const r = spawnSync(process.execPath, [RENOMBRAR, dir], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "nombre");
  return dir;
}
const correr = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: "utf8" });
const leer = (d, r) => fs.readFileSync(path.join(d, r), "utf8");
const limpiar = (...ds) => ds.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
function todos(dir) {
  const salida = [];
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git") continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) rec(f);
      else salida.push([path.relative(dir, f), fs.readFileSync(f, "utf8")]);
    }
  };
  rec(dir);
  return salida;
}

test("portal: todo el nombre queda en mayúsculas; ninguna aparición vieja; la dirección no cambia", () => {
  const d = repoConNombre("portal");
  try {
    const antes = todos(d).reduce((n, [, t]) => n + (t.split(VIEJO).length - 1), 0);
    assert.ok(antes >= 9, `el repo de partida tiene el nombre ${antes} veces`);
    const r = correr(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    let ahora = 0;
    for (const [ruta, t] of todos(d)) {
      assert.ok(!t.includes(VIEJO), `${ruta} ya no tiene "${VIEJO}"`);
      for (const m of t.matchAll(/sevac\s*\/\s*cumplimiento/gi)) assert.equal(m[0], NUEVO, `${ruta}: ${m[0]}`);
      ahora += t.split(NUEVO).length - 1;
    }
    // Una aparición menos: el título grande de la página ya no repite el texto, lo toma de lib/sevac.js.
    assert.equal(ahora, antes - 1, "las mismas apariciones, ahora en mayúsculas");
    assert.match(leer(d, "lib/sevac.js"), /titulo: "SEVAC\/CUMPLIMIENTO"/);
    assert.match(leer(d, "lib/sevac.js"), /"Este apartado tiene como objetivo concentrar y dar cumplimiento a las obligaciones normativas vigentes del municipio, incluyendo las evaluaciones del SEVAC y demás disposiciones aplicables\."/);
    assert.match(leer(d, "components/layout/navItems.js"), /\{ label: "SEVAC\/CUMPLIMIENTO", href: "\/transparencia\/sevac" \}/);
    assert.match(leer(d, "app/(con-footer)/transparencia/page.js"), /href: "\/transparencia\/sevac"/);
    assert.match(leer(d, PAGINA_PORTAL), /title: "SEVAC\/CUMPLIMIENTO",/);
    assert.match(leer(d, PAGINA_PORTAL), /path: "\/transparencia\/sevac"/);
  } finally {
    limpiar(d);
  }
});

test("portal: el título grande permite partir tras la barra, con un comentario que lo explica", () => {
  const d = repoConNombre("portal");
  try {
    correr(d);
    const p = leer(d, PAGINA_PORTAL);
    assert.match(p, /\n {8}\/\/ U\+200B tras la barra: deja partir el título en pantallas de 320 px\.\n {8}fallbackTitulo=\{sevac\.titulo\.replace\("\/", "\/\\u200b"\)\}\n/);
    assert.doesNotMatch(p, /fallbackTitulo="/);
    // El texto de la pestaña, las migas y el aria-label NO llevan el carácter invisible.
    assert.doesNotMatch(p.replace(/fallbackTitulo=\{sevac\.titulo\.replace\("\/", "\/\\u200b"\)\}/, ""), /u200b/);
    // La expresión hace lo que dice.
    assert.equal("SEVAC/CUMPLIMIENTO".replace("/", "/​"), "SEVAC/​CUMPLIMIENTO");
    assert.equal("SEVAC/CUMPLIMIENTO".replace("/", "/​").replaceAll("​", ""), NUEVO);
  } finally {
    limpiar(d);
  }
});

test("admin: etiquetas, títulos y catálogo en mayúsculas; sin el ajuste del salto", () => {
  const d = repoConNombre("admin");
  try {
    assert.equal(tipoDeRepo(d), "admin");
    const r = correr(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const [ruta, t] of todos(d)) assert.ok(!t.includes(VIEJO), ruta);
    assert.match(leer(d, "src/lib/nav.js"), /label: "SEVAC\/CUMPLIMIENTO"/);
    assert.match(leer(d, "src/lib/nav.js"), /label: "Documento SEVAC\/CUMPLIMIENTO"/);
    assert.equal((leer(d, "src/app/(admin)/page.jsx").match(/label: "SEVAC\/CUMPLIMIENTO"/g) || []).length, 2);
    assert.match(leer(d, "src/app/(admin)/transparencia/sevac/page.jsx"), />SEVAC\/CUMPLIMIENTO<\/h1>/);
    assert.match(leer(d, "src/lib/contenidos-catalogo.js"), /"Encabezado · SEVAC\/CUMPLIMIENTO"/);
    for (const [, t] of todos(d)) assert.ok(!t.includes("​") && !/\\u200b/.test(t));
  } finally {
    limpiar(d);
  }
});

test("es idempotente: la segunda vez no cambia nada", () => {
  for (const tipo of ["portal", "admin"]) {
    const d = repoConNombre(tipo);
    try {
      assert.equal(correr(d).status, 0);
      git(d, "add", "-A");
      git(d, "commit", "-qm", "mayúsculas");
      const otra = correr(d);
      assert.equal(otra.status, 0);
      assert.match(otra.stdout, /ya estaba aplicado/);
      assert.equal(git(d, "status", "--porcelain"), "");
    } finally {
      limpiar(d);
    }
  }
});

test("un repo sin el nombre aplicado no se toca y se explica qué falta", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "portal-"));
  try {
    fs.cpSync(path.join(AQUI, "fixtures", "portal"), d, { recursive: true });
    git(d, "init", "-q", "-b", "main");
    git(d, "add", "-A");
    git(d, "commit", "-qm", "molde");
    const r = correr(d);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no tiene el nombre "SEvAC\/Cumplimiento" ni "SEVAC\/CUMPLIMIENTO"\. Aplica primero aplicar-nombre-sevac\.mjs/);
    assert.equal(git(d, "status", "--porcelain"), "");
  } finally {
    limpiar(d);
  }
});

test("otra forma de escribirlo es una duda: no se adivina y no se toca nada", () => {
  const d = repoConNombre("portal");
  try {
    fs.appendFileSync(path.join(d, "components/layout/Footer.jsx"), '\n// Sevac/cumplimiento (nota vieja)\n');
    git(d, "commit", "-qam", "nota");
    const r = correr(d);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /components\/layout\/Footer\.jsx: el nombre aparece escrito de otra forma \("Sevac\/cumplimiento"\)/);
    assert.equal(git(d, "status", "--porcelain"), "");
    assert.ok(leer(d, "lib/sevac.js").includes(VIEJO), "no cambió ningún archivo");
  } finally {
    limpiar(d);
  }
});

test("el título de la página: si no es como el molde, explica por qué", () => {
  const d = repoConNombre("portal");
  try {
    const base = leer(d, PAGINA_PORTAL);
    assert.throws(() => parchearTituloPagina(base.replace(`fallbackTitulo="${VIEJO}"`, `fallbackTitulo="Otra cosa"`)), /esperaba 1 vez fallbackTitulo="SEvAC\/Cumplimiento" y encontré 0/);
    assert.throws(() => parchearTituloPagina(base.replace('import { sevac } from "@/lib/sevac";', "")), /no importa sevac/);
    assert.throws(() => parchearTituloPagina(base.replace(`fallbackTitulo="${VIEJO}"`, `fallbackTitulo="${VIEJO}" bg="x"`)), /no está solo en su línea/);
  } finally {
    limpiar(d);
  }
});

test("cambios sin guardar: bloquean solo en archivos propios; el commit lleva solo lo suyo", () => {
  const d = repoConNombre("admin");
  const d2 = repoConNombre("admin");
  const remoto = fs.mkdtempSync(path.join(os.tmpdir(), "remoto-"));
  try {
    fs.writeFileSync(path.join(d, "cinemagoer.db"), "x");
    const r = correr(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /otros cambios sin guardar \(no se tocan ni se suben\): cinemagoer\.db/);
    fs.appendFileSync(path.join(d2, "src/lib/nav.js"), "// cambio local\n");
    const r2 = correr(d2);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /cambios sin guardar en archivos que este script toca/);

    git(remoto, "init", "-q", "--bare", "-b", "main");
    const d3 = repoConNombre("admin");
    try {
      git(d3, "remote", "add", "origin", remoto);
      git(d3, "push", "-q", "-u", "origin", "main");
      fs.writeFileSync(path.join(d3, "otro.txt"), "x");
      git(d3, "add", "otro.txt");
      const r3 = correr("--commit", "--push", d3);
      assert.equal(r3.status, 0, r3.stdout + r3.stderr);
      const archivos = git(d3, "show", "--name-only", "--pretty=format:", "HEAD").split("\n").filter(Boolean).sort();
      assert.deepEqual(archivos, [...ESPERADOS.admin].sort());
      assert.match(git(d3, "log", "-1", "--pretty=%B"), /Claude-Session: https:\/\/claude\.ai\/code\/session_/);
      assert.equal(archivosModificados(d3).join(), "otro.txt");
    } finally {
      limpiar(d3);
    }
  } finally {
    limpiar(d, d2, remoto);
  }
});

test("--build: si falla, deja todo como estaba y se detiene", () => {
  const d = repoConNombre("portal");
  try {
    fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ scripts: { build: "exit 1" } }));
    fs.mkdirSync(path.join(d, "node_modules"));
    git(d, "add", "package.json");
    git(d, "commit", "-qm", "build roto");
    const r = correr("--build", d, d);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /el build falló; dejé el repo como estaba/);
    assert.match(r.stdout, /1 repo\(s\) sin procesar/);
    assert.equal(git(d, "status", "--porcelain"), "");
  } finally {
    limpiar(d);
  }
});

test("argumentos y tipo de repo", () => {
  assert.throws(() => leerArgs([]), /falta al menos un repo/);
  assert.throws(() => leerArgs(["--push", "x"]), /--push requiere --commit/);
  assert.throws(() => leerArgs(["--dry-run", "--commit", "x"]), /no se combina/);
  assert.throws(() => tipoDeRepo(os.tmpdir()), /ni un portal del molde ni cms-admin/);
  assert.equal(NUEVO, VIEJO.toUpperCase());
});
