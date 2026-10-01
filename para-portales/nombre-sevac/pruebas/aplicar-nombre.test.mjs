import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { planificar, parchear, leerArgs, tipoDeRepo, NOMBRE, DESCRIPCION, SEVAC_JS_NUEVO, PORTAL } from "../aplicar-nombre-sevac.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(AQUI, "..", "aplicar-nombre-sevac.mjs");
const PAGINA = "app/(con-footer)/transparencia/sevac/page.js";

function git(cwd, ...args) {
  const r = spawnSync("git", ["-c", "user.email=prueba@local", "-c", "user.name=prueba", ...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
function repo(tipo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${tipo}-`));
  fs.cpSync(path.join(AQUI, "fixtures", tipo), dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "base");
  return dir;
}
const correr = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: "utf8" });
const leer = (d, r) => fs.readFileSync(path.join(d, r), "utf8");
function todo(dir) {
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

test("portal: nombre nuevo en menú, pie, home, hub y apartado; sin armonización contable", () => {
  const d = repo("portal");
  try {
    const r = correr(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const [ruta, t] of todo(d)) assert.doesNotMatch(t, /armonizaci[oó]n contable/i, ruta);
    assert.equal(leer(d, "lib/sevac.js"), SEVAC_JS_NUEVO);
    const p = leer(d, PAGINA);
    assert.match(p, /title: "SEvAC\/Cumplimiento",/);
    assert.match(p, /name: "SEvAC\/Cumplimiento", path: "\/transparencia\/sevac"/);
    assert.match(p, /<PageHeader\n {8}clave="header-sevac"\n {8}eyebrow="Obligaciones normativas"\n {8}fallbackTitulo="SEvAC\/Cumplimiento"\n {8}fallbackDescripcion=\{sevac\.descripcion\}\n {8}bg="bg"\n {8}narrow\n {6}\/>\n\n {6}<section\n {8}aria-label="Documentos SEvAC\/Cumplimiento"/);
    assert.doesNotMatch(p, /descripcionCorta|marcoLegal/);
    assert.match(p, /construirEnlaces/, "conserva los enlaces SEvAC");
    assert.match(p, /Fuente: \{sevac\.fuente\}/);
    assert.match(leer(d, "lib/sevac.js"), /fuente: "CONAC y Auditoría Superior de la Federación \(ASF\)\."/);
    assert.ok(leer(d, "lib/sevac.js").includes(DESCRIPCION));
    for (const f of ["components/layout/navItems.js", "components/layout/Footer.jsx"]) assert.match(leer(d, f), /\{ label: "SEvAC\/Cumplimiento", href: "\/transparencia\/sevac" \}/, f);
    assert.match(leer(d, "components/home/TransparenciaCTA.jsx"), /icon: BarChart3, label: "SEvAC\/Cumplimiento"/);
    const hub = leer(d, "app/(con-footer)/transparencia/page.js");
    assert.match(hub, /label: "SEvAC\/Cumplimiento",/);
    assert.ok(hub.includes(`"${DESCRIPCION}"`));
    assert.match(hub, /href: "\/transparencia\/sevac"/, "la dirección no cambia");
    const nav = leer(d, "components/layout/Navbar.jsx");
    assert.match(nav, /hidden items-stretch gap-3 lg:flex/);
    assert.match(nav, /px-1 py-2 text-\[13px\] leading-5 font-medium uppercase/);
    // Idempotente
    const otra = correr(d);
    assert.equal(otra.status, 0);
    assert.match(otra.stdout, /ya estaba aplicado/);
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("admin: etiquetas y títulos con el nombre nuevo, sin armonización contable", () => {
  const d = repo("admin");
  try {
    assert.equal(tipoDeRepo(d), "admin");
    const r = correr(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const [ruta, t] of todo(d)) {
      assert.doesNotMatch(t, /armonizaci[oó]n contable/i, ruta);
      assert.doesNotMatch(t, /"SEvAC"|· SEvAC —|>SEvAC</, ruta);
    }
    assert.match(leer(d, "src/lib/nav.js"), /label: "SEvAC\/Cumplimiento"/);
    assert.match(leer(d, "src/lib/nav.js"), /label: "Documento SEvAC\/Cumplimiento"/);
    assert.equal((leer(d, "src/app/(admin)/page.jsx").match(/label: "SEvAC\/Cumplimiento"/g) || []).length, 2);
    const p = leer(d, "src/app/(admin)/transparencia/sevac/page.jsx");
    assert.match(p, /Transparencia · SEvAC\/Cumplimiento — CMS Municipal/);
    assert.match(p, />SEvAC\/Cumplimiento<\/h1>/);
    assert.match(p, /Documentos PDF de SEvAC\/Cumplimiento que se muestran en el portal\./);
    assert.match(leer(d, "src/app/(admin)/transparencia/sevac/nuevo/page.jsx"), /Transparencia · SEvAC\/Cumplimiento\n/);
    assert.match(correr(d).stdout, /ya estaba aplicado/);
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("si un texto no está como en el molde, no toca nada del repo", () => {
  const d = repo("portal");
  try {
    fs.writeFileSync(path.join(d, "components/layout/Footer.jsx"), leer(d, "components/layout/Footer.jsx").replace('label: "SEvAC"', 'label: "SEVAC"'));
    git(d, "commit", "-qam", "otro");
    const r = correr(d);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Footer\.jsx: esperaba 1 vez\/veces/);
    assert.equal(git(d, "status", "--porcelain"), "", "no escribió nada");
    assert.throws(() => parchear("nada", PORTAL[0].cambios, "x.js"), /no es como el del molde/);
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("menú: exige exactamente un archivo con las clases del menú", () => {
  const d = repo("portal");
  try {
    fs.copyFileSync(path.join(d, "components/layout/Navbar.jsx"), path.join(d, "components/layout/NavbarCopia.jsx"));
    assert.throws(() => planificar(d), /esperaba 1 archivo en components\/ con las clases del menú/);
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("cambios sin guardar: bloquean solo si son de archivos que se tocan; el commit lleva solo lo suyo", () => {
  const d = repo("admin");
  const ajeno = path.join(d, "src/app/(admin)/apariencia/portada-historia/page.jsx");
  try {
    fs.mkdirSync(path.dirname(ajeno), { recursive: true });
    fs.writeFileSync(ajeno, "export default function A() { return null; }\n");
    git(d, "add", "-A");
    git(d, "commit", "-qm", "portada");
    fs.appendFileSync(ajeno, "// cambio del operador, sin subir\n");
    // Sin remoto no hay pull: se aplica sin --commit y se revisa el aviso.
    const r = correr(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /otros cambios sin guardar \(no se tocan ni se suben\): src\/app\/\(admin\)\/apariencia\/portada-historia\/page\.jsx/);
    assert.match(fs.readFileSync(ajeno, "utf8"), /cambio del operador/);

    const d2 = repo("admin");
    try {
      fs.appendFileSync(path.join(d2, "src/lib/nav.js"), "// cambio local\n");
      const r2 = correr(d2);
      assert.equal(r2.status, 1);
      assert.match(r2.stderr, /cambios sin guardar en archivos que este script toca/);
    } finally {
      fs.rmSync(d2, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("--build: si falla, deja todo como estaba y se detiene", () => {
  const d = repo("portal");
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
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test("argumentos y tipo de repo", () => {
  assert.throws(() => leerArgs([]), /falta al menos un repo/);
  assert.throws(() => leerArgs(["--push", "x"]), /--push requiere --commit/);
  assert.throws(() => leerArgs(["--dry-run", "--commit", "x"]), /no se combina/);
  assert.throws(() => tipoDeRepo(os.tmpdir()), /ni un portal del molde ni cms-admin/);
  assert.equal(NOMBRE, "SEvAC/Cumplimiento");
});
