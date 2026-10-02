import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { planificar, parchearPagina, leerArgs, archivosModificados, COMPONENTE, COMPONENTE_TEXTO, PAGINA, ORGANIGRAMA, MODAL } from "../aplicar-cabildo-detalle.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(AQUI, "..", "aplicar-cabildo-detalle.mjs");
const FIXTURE = path.join(AQUI, "fixtures", "portal");

function git(cwd, ...args) {
  const r = spawnSync("git", ["-c", "user.email=prueba@local", "-c", "user.name=prueba", ...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cabildo-"));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "base");
  return dir;
}
const correr = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: "utf8" });
const leer = (d, r) => fs.readFileSync(path.join(d, r), "utf8");
const limpiar = (...ds) => ds.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));

test("el componente nuevo es igual en estructura a DirectorioOrganigrama", () => {
  const dir = leer(FIXTURE, "components/gobierno/DirectorioOrganigrama.jsx");
  for (const t of ['"use client";', 'import { useState } from "react";', 'import { Organigrama } from "@/components/gobierno/Organigrama";', 'import { PersonDetailModal } from "@/components/gobierno/PersonDetailModal";', "const [selected, setSelected] = useState(null);", "onSelect={setSelected}", "open={selected !== null}", "if (!open) setSelected(null);"]) {
    assert.ok(dir.includes(t), `el Directorio de referencia tiene: ${t}`);
    assert.ok(COMPONENTE_TEXTO.includes(t), `el componente nuevo tiene: ${t}`);
  }
  assert.match(COMPONENTE_TEXTO, /<Organigrama\n {8}presidente=\{presidente\}\n {8}sindica=\{sindica\}\n {8}regidores=\{regidores\}\n {8}onSelect=\{setSelected\}\n {6}\/>/);
  assert.match(COMPONENTE_TEXTO, /export default CabildoOrganigrama;/);
});

test("página: usa CabildoOrganigrama con las mismas props; nada más cambia", () => {
  const antes = leer(FIXTURE, PAGINA);
  const { texto, yaEstaba } = parchearPagina(antes);
  assert.equal(yaEstaba, false);
  assert.match(texto, /^import \{ CabildoOrganigrama \} from "@\/components\/gobierno\/CabildoOrganigrama";$/m);
  assert.doesNotMatch(texto, /import \{ Organigrama \}/);
  assert.match(texto, /<CabildoOrganigrama\n {10}presidente=\{presidente\}\n {10}sindica=\{sindica\}\n {10}regidores=\{regidores\}\n {8}\/>/);
  // Todo lo demás queda igual: mismo número de líneas y solo 2 líneas distintas.
  const a = antes.split("\n");
  const b = texto.split("\n");
  assert.equal(a.length, b.length);
  assert.equal(a.filter((l, i) => l !== b[i]).length, 2);
  assert.equal(parchearPagina(texto).yaEstaba, true, "idempotente");
});

test("página: si no es como el molde, no la toca y explica por qué", () => {
  const base = leer(FIXTURE, PAGINA);
  assert.throws(() => parchearPagina(base.replace('import { Organigrama } from "@/components/gobierno/Organigrama";\n', "")), /esperaba 1 import de Organigrama y encontré 0/);
  assert.throws(() => parchearPagina(base.replace("<Organigrama", "<OrganigramaX")), /esperaba 1 uso de <Organigrama/);
  assert.throws(() => parchearPagina(base.replace("regidores={regidores}", "regidores={regidores} dif={dif}")), /props que CabildoOrganigrama no maneja: dif/);
  assert.throws(() => parchearPagina(base.replace("/>\n      </section>", "></Organigrama>\n      </section>")), /esperaba 1 uso/);
});

test("repo: crea el componente, parcha la página y no toca Organigrama ni el modal", () => {
  const d = repo();
  try {
    const { cambios } = planificar(d);
    assert.deepEqual(cambios.map((c) => c.ruta).sort(), [COMPONENTE, PAGINA].sort());
    const r = correr(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(leer(d, COMPONENTE), COMPONENTE_TEXTO);
    assert.match(leer(d, PAGINA), /<CabildoOrganigrama/);
    for (const intacto of [ORGANIGRAMA, MODAL, "components/gobierno/DirectorioOrganigrama.jsx"]) assert.equal(leer(d, intacto), leer(FIXTURE, intacto), intacto);
    assert.match(correr(d).stdout, /ya estaba aplicado/);
  } finally {
    limpiar(d);
  }
});

test("repo: exige el organigrama con clic y el modal del molde", () => {
  const sinClic = repo();
  const sinModal = repo();
  const modalRaro = repo();
  try {
    fs.writeFileSync(path.join(sinClic, ORGANIGRAMA), leer(sinClic, ORGANIGRAMA).replaceAll("onSelect", "alSeleccionar"));
    assert.throws(() => planificar(sinClic), /no acepta onSelect/);
    fs.rmSync(path.join(sinModal, MODAL));
    assert.throws(() => planificar(sinModal), /no existe components\/gobierno\/PersonDetailModal\.jsx/);
    fs.writeFileSync(path.join(modalRaro, MODAL), "export const X = 1;\n");
    assert.throws(() => planificar(modalRaro), /PersonDetailModal con person, open y onOpenChange/);
    const r = correr(sinClic);
    assert.equal(r.status, 1);
    assert.equal(fs.existsSync(path.join(sinClic, COMPONENTE)), false, "no escribió nada");
  } finally {
    limpiar(sinClic, sinModal, modalRaro);
  }
});

test("repo: un componente propio distinto no se pisa", () => {
  const d = repo();
  try {
    fs.writeFileSync(path.join(d, COMPONENTE), "// otro\n");
    assert.throws(() => planificar(d), /ya existe y es distinto/);
  } finally {
    limpiar(d);
  }
});

test("cambios sin guardar: bloquean solo en archivos propios; el commit lleva solo lo suyo", () => {
  const d = repo();
  const d2 = repo();
  try {
    fs.writeFileSync(path.join(d, "cinemagoer.db"), "x");
    fs.appendFileSync(path.join(d, ORGANIGRAMA), "// cambio del operador\n");
    const r = correr(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /otros cambios sin guardar \(no se tocan ni se suben\): [^\n]*cinemagoer\.db/);
    assert.match(leer(d, ORGANIGRAMA), /cambio del operador/);
    fs.appendFileSync(path.join(d2, PAGINA), "// cambio local\n");
    const r2 = correr(d2);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /cambios sin guardar en archivos que este script toca/);
  } finally {
    limpiar(d, d2);
  }
});

test("--build: si falla, deja el repo exactamente como estaba (borra el archivo nuevo) y se detiene", () => {
  const d = repo();
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
    assert.equal(fs.existsSync(path.join(d, COMPONENTE)), false);
  } finally {
    limpiar(d);
  }
});

test("--commit: commit solo con los 2 archivos, aunque haya otros en el índice", () => {
  const dir = repo();
  const remoto = fs.mkdtempSync(path.join(os.tmpdir(), "remoto-"));
  try {
    git(remoto, "init", "-q", "--bare", "-b", "main");
    git(dir, "remote", "add", "origin", remoto);
    git(dir, "push", "-q", "-u", "origin", "main");
    fs.writeFileSync(path.join(dir, "otro.txt"), "x");
    git(dir, "add", "otro.txt");
    const r = correr("--commit", "--push", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const archivos = git(dir, "show", "--name-only", "--pretty=format:", "HEAD").split("\n").filter(Boolean).sort();
    assert.deepEqual(archivos, [COMPONENTE, PAGINA].sort());
    assert.match(git(dir, "log", "-1", "--pretty=%B"), /Claude-Session: https:\/\/claude\.ai\/code\/session_/);
    assert.equal(git(remoto, "log", "-1", "--pretty=%s"), "Cabildo: al dar clic en una persona se abre su detalle");
    assert.equal(archivosModificados(dir).join(), "otro.txt");
  } finally {
    limpiar(dir, remoto);
  }
});

test("argumentos", () => {
  assert.throws(() => leerArgs([]), /falta al menos un repo/);
  assert.throws(() => leerArgs(["--push", "x"]), /--push requiere --commit/);
  assert.throws(() => leerArgs(["--dry-run", "--build", "x"]), /no se combina/);
  assert.throws(() => leerArgs(["--nada", "x"]), /desconocida/);
  assert.deepEqual(leerArgs(["--build", "--commit", "--push", "a", "b"]).repos, ["a", "b"]);
});
