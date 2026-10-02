import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { planificar, parchearApi, parchearLayout, parchearSidebar, leerArgs, archivosModificados, API, LAYOUT, SIDEBAR, FUNCION_API } from "../aplicar-enlace-sitio.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(AQUI, "..", "aplicar-enlace-sitio.mjs");
const FIXTURE = path.join(AQUI, "fixtures", "admin");

function git(cwd, ...args) {
  const r = spawnSync("git", ["-c", "user.email=prueba@local", "-c", "user.name=prueba", ...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-"));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "base");
  return dir;
}
const correr = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: "utf8" });
const leer = (d, r) => fs.readFileSync(path.join(d, r), "utf8");
const limpiar = (...ds) => ds.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));

test("layout: pide el sitio junto con el usuario y se lo pasa al menú; nada más cambia", () => {
  const antes = leer(FIXTURE, LAYOUT);
  const { texto, yaEstaba } = parchearLayout(antes);
  assert.equal(yaEstaba, false);
  assert.match(texto, /^import \{ getSitioPublico \} from "@\/lib\/api";$/m);
  assert.match(texto, /const \[usuario, sitio\] = await Promise\.all\(\[getCurrentUser\(\), getSitioPublico\(\)\]\);/);
  assert.match(texto, /<Sidebar usuario=\{usuario\} sitioUrl=\{sitio\?\.url \?\? null\} sitioHost=\{sitio\?\.host \?\? null\} \/>/);
  const a = antes.split("\n");
  const b = texto.split("\n");
  assert.equal(b.length, a.length + 1, "una línea de más: el import");
  assert.equal(parchearLayout(texto).yaEstaba, true, "idempotente");
});

test("menú: firma con los dos datos nuevos y el enlace arriba de la persona que entró", () => {
  const { texto, yaEstaba } = parchearSidebar(leer(FIXTURE, SIDEBAR));
  assert.equal(yaEstaba, false);
  assert.match(texto, /export default function Sidebar\(\{ usuario, sitioUrl = null, sitioHost = null \}\) \{/);
  const iEnlace = texto.indexOf("Ver sitio público");
  const iPersona = texto.indexOf("{initialsOf(usuario) || \"U\"}");
  const iCerrar = texto.indexOf("Cerrar sesión");
  assert.ok(iEnlace > 0 && iEnlace < iPersona && iPersona < iCerrar, "orden: enlace, persona, cerrar sesión");
  assert.match(texto, /href=\{sitioUrl\}\n\s+target="_blank"\n\s+rel="noopener noreferrer"/);
  assert.match(texto, /\{sitioUrl \? \(/);
  assert.match(texto, /\) : null\}\n {10}<div className="flex items-center gap-3 px-2 py-1\.5">/);
  assert.equal(parchearSidebar(texto).yaEstaba, true, "idempotente");
});

test("si un archivo no es como el esperado, no toca nada y explica por qué", () => {
  assert.throws(() => parchearLayout(leer(FIXTURE, LAYOUT).replace("<Sidebar usuario={usuario} />", "<Sidebar />")), /<Sidebar usuario=\{usuario\} \/>/);
  assert.throws(() => parchearLayout(leer(FIXTURE, LAYOUT).replace("const usuario = await getCurrentUser();", "const usuario = null;")), /const usuario = await getCurrentUser\(\);/);
  assert.throws(() => parchearSidebar(leer(FIXTURE, SIDEBAR).replace("Sidebar({ usuario })", "Sidebar({ usuario, x })")), /export default function Sidebar/);
  assert.throws(() => parchearSidebar(leer(FIXTURE, SIDEBAR).replace('p-3">', 'p-4">')), /bloque de la persona que entró/);
  assert.throws(() => parchearApi("export const x = 1;\n"), /no encontré apiFetch/);
  assert.throws(() => parchearApi("export async function apiFetch() {}\n"), /no encontré getMunicipioSlug/);
});

// Carga getSitioPublico() de verdad: arma un módulo con apiFetch y getMunicipioSlug falsos.
async function cargarFuncion({ slug = "carbo", apiFetch, espera = 4000 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "funcion-"));
  const archivo = path.join(dir, "api.mjs");
  const base = `const apiFetch = globalThis.__apiFetch; const getMunicipioSlug = async () => globalThis.__slug;\n`;
  fs.writeFileSync(archivo, base + FUNCION_API.replace("export async function", "export async function").replace("4000", String(espera)));
  globalThis.__apiFetch = apiFetch;
  globalThis.__slug = slug;
  const modulo = await import(`${pathToFileURL(archivo).href}?t=${Math.random()}`);
  return { getSitioPublico: modulo.getSitioPublico, limpiar: () => limpiar(dir) };
}

test("getSitioPublico: devuelve la dirección del dominio, sin barras ni mayúsculas", async () => {
  const llamadas = [];
  const { getSitioPublico, limpiar: l } = await cargarFuncion({ apiFetch: async (ruta) => { llamadas.push(ruta); return { slug: "carbo", dominio: " CarboTransparencia.com.mx " }; } });
  try {
    assert.deepEqual(await getSitioPublico(), { url: "https://carbotransparencia.com.mx", host: "carbotransparencia.com.mx" });
    assert.deepEqual(llamadas, ["/api/municipios/carbo"]);
  } finally {
    l();
  }
});

test("getSitioPublico: devuelve null (sin romper) si no hay dominio, es inválido o la API falla", async () => {
  const casos = [
    ["sin dominio", async () => ({ dominio: null })],
    ["vacío", async () => ({ dominio: "" })],
    ["con protocolo", async () => ({ dominio: "https://x.mx" })],
    ["con ruta", async () => ({ dominio: "x.mx/admin" })],
    ["javascript:", async () => ({ dominio: "javascript:alert(1)" })],
    ["con espacios", async () => ({ dominio: "x y.mx" })],
    ["respuesta nula", async () => null],
    ["error de red", async () => { throw new Error("red"); }],
  ];
  for (const [nombre, apiFetch] of casos) {
    const { getSitioPublico, limpiar: l } = await cargarFuncion({ apiFetch });
    try {
      assert.equal(await getSitioPublico(), null, nombre);
    } finally {
      l();
    }
  }
  const sinSlug = await cargarFuncion({ slug: undefined, apiFetch: async () => { throw new Error("no debe llamarse"); } });
  try {
    assert.equal(await sinSlug.getSitioPublico(), null, "sin municipio en la sesión");
  } finally {
    sinSlug.limpiar();
  }
});

test("getSitioPublico: no espera a una API lenta, y deja pasar la redirección de sesión vencida", async () => {
  const lenta = await cargarFuncion({ espera: 60, apiFetch: () => new Promise(() => {}) });
  try {
    const t0 = Date.now();
    assert.equal(await lenta.getSitioPublico(), null);
    assert.ok(Date.now() - t0 < 1500, "responde por el tiempo límite");
  } finally {
    lenta.limpiar();
  }
  const redir = await cargarFuncion({ apiFetch: async () => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" }); } });
  try {
    await assert.rejects(redir.getSitioPublico(), /NEXT_REDIRECT/);
  } finally {
    redir.limpiar();
  }
});

test("el formato de dirección acepta el dominio real de los 15 municipios", async () => {
  const dominios = ["bacadehuachitransparencia.com.mx", "www.banamichitransparencia.com.mx", "carbotransparencia.com.mx", "villapesqueira.vercel.app", "www.aconchitransparencia.com.mx", "sahuaripatransparencia.com.mx"];
  for (const dominio of dominios) {
    const { getSitioPublico, limpiar: l } = await cargarFuncion({ apiFetch: async () => ({ dominio }) });
    try {
      assert.equal((await getSitioPublico())?.url, `https://${dominio}`, dominio);
    } finally {
      l();
    }
  }
});

test("repo: parcha los 3 archivos y es idempotente", () => {
  const d = repo();
  try {
    assert.deepEqual(planificar(d).cambios.map((c) => c.ruta).sort(), [API, LAYOUT, SIDEBAR].sort());
    const r = correr(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(leer(d, API), /export async function getSitioPublico\(\)/);
    assert.match(leer(d, LAYOUT), /getSitioPublico/);
    assert.match(leer(d, SIDEBAR), /Ver sitio público/);
    assert.match(correr(d).stdout, /ya estaba aplicado/);
  } finally {
    limpiar(d);
  }
});

test("cambios sin guardar: bloquean solo en archivos propios; el commit lleva solo lo suyo", () => {
  const d = repo();
  const d2 = repo();
  const remoto = fs.mkdtempSync(path.join(os.tmpdir(), "remoto-"));
  try {
    fs.mkdirSync(path.join(d, "src/app/(admin)/apariencia/portada-historia"), { recursive: true });
    fs.writeFileSync(path.join(d, "src/app/(admin)/apariencia/portada-historia/page.jsx"), "export default function A() { return null; }\n");
    git(d, "add", "-A");
    git(d, "commit", "-qm", "portada");
    fs.appendFileSync(path.join(d, "src/app/(admin)/apariencia/portada-historia/page.jsx"), "// cambio del operador, sin subir\n");
    const r = correr(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /otros cambios sin guardar \(no se tocan ni se suben\): src\/app\/\(admin\)\/apariencia\/portada-historia\/page\.jsx/);
    fs.appendFileSync(path.join(d2, SIDEBAR), "// cambio local\n");
    const r2 = correr(d2);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /cambios sin guardar en archivos que este script toca/);

    // Commit con push: solo los 3 archivos, aunque el operador tenga algo en el índice.
    git(remoto, "init", "-q", "--bare", "-b", "main");
    const d3 = repo();
    try {
      git(d3, "remote", "add", "origin", remoto);
      git(d3, "push", "-q", "-u", "origin", "main");
      fs.writeFileSync(path.join(d3, "otro.txt"), "x");
      git(d3, "add", "otro.txt");
      const r3 = correr("--commit", "--push", d3);
      assert.equal(r3.status, 0, r3.stdout + r3.stderr);
      assert.deepEqual(git(d3, "show", "--name-only", "--pretty=format:", "HEAD").split("\n").filter(Boolean).sort(), [API, LAYOUT, SIDEBAR].sort());
      assert.equal(archivosModificados(d3).join(), "otro.txt");
    } finally {
      limpiar(d3);
    }
  } finally {
    limpiar(d, d2, remoto);
  }
});

test("--build: si falla, deja el repo exactamente como estaba", () => {
  const d = repo();
  try {
    fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ scripts: { build: "exit 1" } }));
    fs.mkdirSync(path.join(d, "node_modules"));
    git(d, "add", "package.json");
    git(d, "commit", "-qm", "build roto");
    const r = correr("--build", d);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /el build falló; dejé el repo como estaba/);
    assert.equal(git(d, "status", "--porcelain"), "");
  } finally {
    limpiar(d);
  }
});

test("argumentos", () => {
  assert.throws(() => leerArgs([]), /falta el repo de cms-admin/);
  assert.throws(() => leerArgs(["--push", "x"]), /--push requiere --commit/);
  assert.throws(() => leerArgs(["--dry-run", "--build", "x"]), /no se combina/);
  assert.throws(() => leerArgs(["--nada", "x"]), /desconocida/);
});
