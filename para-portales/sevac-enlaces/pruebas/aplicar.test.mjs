import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parchearPagina, parchearVisor, planificar, leerArgs, ARCHIVOS, PAGINA, VISOR, RUTA } from "../aplicar-enlaces-sevac.mjs";
import { construido } from "../construir.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ORIGINAL = path.join(AQUI, "portal-original");
const SCRIPT = path.join(AQUI, "..", "aplicar-enlaces-sevac.mjs");
const leer = (r) => fs.readFileSync(path.join(ORIGINAL, r), "utf8");

function git(cwd, ...args) {
  const r = spawnSync("git", ["-c", "user.email=prueba@local", "-c", "user.name=prueba", ...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** Copia el portal original a un repo git temporal (rama main, limpio). */
function repoTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portal-"));
  fs.cpSync(ORIGINAL, dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "base");
  return dir;
}

const correr = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

test("el script trae los archivos nuevos al día (node construir.mjs)", () => {
  const { actual, nuevo } = construido();
  assert.equal(actual, nuevo, "corre `node construir.mjs`");
  assert.deepEqual(Object.keys(ARCHIVOS).sort(), ["lib/sevac-enlaces/enlaces.js", "lib/sevac-enlaces/servir-documento.js", RUTA].sort());
  assert.match(ARCHIVOS[RUTA], /process\.env\.NEXT_PUBLIC_MUNICIPIO_SLUG/);
  assert.match(ARCHIVOS[RUTA], /from "@\/lib\/sevac-enlaces\/servir-documento"/);
});

test("página SEvAC: usa el enlace propio de cada documento, calculado con el listado completo", () => {
  const { texto, yaEstaba } = parchearPagina(leer(PAGINA));
  assert.equal(yaEstaba, false);
  assert.match(texto, /import \{ getSevac \} from "@\/lib\/content";\nimport \{ construirEnlaces, origenPermitido \} from "@\/lib\/sevac-enlaces\/enlaces";\n/);
  assert.match(texto, /const hayFiltros = Boolean\(anio \|\| trimestre\);\n  \/\/ Cada documento/);
  assert.match(texto, /construirEnlaces\(hayFiltros \? await getSevac\(\{\}\) : documentos\)/);
  assert.match(texto, /return \{\n {16}doc: conEnlace\(doc\),\n {16}label,/);
  assert.equal(parchearPagina(texto).yaEstaba, true, "idempotente");
});

test("visor: botón Copiar enlace junto a Pestaña, solo para enlaces propios", () => {
  const { texto, yaEstaba } = parchearVisor(leer(VISOR));
  assert.equal(yaEstaba, false);
  assert.match(texto, /import \{ useState, useEffect \} from "react";/);
  assert.match(texto, /import \{ X, Download, ExternalLink, FileText, Link2, Check \} from "lucide-react";/);
  assert.match(texto, /const enlacePropio = typeof pdfUrl === "string" && pdfUrl\.startsWith\("\/"\);/);
  const iPestana = texto.indexOf(">Pestaña</span>");
  const iBoton = texto.indexOf("onClick={copiarEnlace}");
  const iCerrar = texto.indexOf('aria-label="Cerrar visor de PDF"');
  assert.ok(iPestana < iBoton && iBoton < iCerrar, "orden: Pestaña, Copiar enlace, Cerrar");
  // Los hooks quedan antes del return del componente.
  assert.ok(texto.indexOf("useState(false);\n  useEffect") < texto.indexOf("  return (\n    <Dialog.Root"));
  assert.equal(parchearVisor(texto).yaEstaba, true, "idempotente");
});

test("si el archivo no es como el del molde, no lo toca y explica por qué", () => {
  assert.throws(() => parchearPagina(leer(PAGINA).replace("const hayFiltros", "const hayFiltrosX")), /hayFiltros[\s\S]*no lo toqué/);
  assert.throws(() => parchearPagina(leer(PAGINA).replace("getSevac", "otraCosa")), /getSevac/);
  assert.throws(() => parchearVisor(leer(VISOR).replace(">Pestaña<", ">Nueva pestaña<")), /Pestaña/);
  assert.throws(() => parchearVisor(leer(VISOR).replace("const setOpen", "let setOpen")), /setOpen/);
  assert.throws(() => parchearVisor(leer(VISOR) + "\nconst copiado = 1;\n"), /copiado/);
});

test("imports con otros nombres o en varias líneas", () => {
  const v = leer(VISOR).replace('import { useState } from "react";', 'import {\n  useEffect,\n  useState,\n} from "react";');
  const { texto } = parchearVisor(v);
  assert.match(texto, /import \{\n  useEffect,\n  useState,\n\} from "react";/, "si ya está useEffect, deja el import igual");
  const sinEffect = leer(VISOR).replace('import { useState } from "react";', 'import {\n  useMemo,\n  useState,\n} from "react";');
  assert.match(parchearVisor(sinEffect).texto, /import \{ useMemo, useState, useEffect \} from "react";/);
});

test("CLI: prueba en seco no escribe; aplicado hace commit; la segunda vez no cambia nada", () => {
  const dir = repoTemporal();
  try {
    const seco = correr("--dry-run", dir);
    assert.equal(seco.status, 0, seco.stderr);
    assert.match(seco.stdout, /5 archivo\(s\)/);
    assert.equal(git(dir, "status", "--porcelain"), "", "en seco no escribe");

    // --commit hace git pull: sin remoto fallaría, así que se prueba sin --commit y se confirma a mano.
    const ap = correr(dir);
    assert.equal(ap.status, 0, ap.stdout + ap.stderr);
    for (const r of [...Object.keys(ARCHIVOS), PAGINA, VISOR]) assert.ok(fs.existsSync(path.join(dir, r)), r);
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "aplicado");

    const otra = correr(dir);
    assert.equal(otra.status, 0);
    assert.match(otra.stdout, /ya estaba aplicado/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: no toca un repo con cambios sin guardar ni uno en otra rama", () => {
  const sucio = repoTemporal();
  const rama = repoTemporal();
  try {
    fs.appendFileSync(path.join(sucio, VISOR), "\n// cambio local\n");
    git(rama, "switch", "-q", "-c", "feat/otra");
    const r = correr(sucio, rama);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /cambios sin guardar/);
    assert.match(r.stderr, /rama "feat\/otra"/);
    assert.ok(!fs.existsSync(path.join(sucio, RUTA)));
    assert.ok(!fs.existsSync(path.join(rama, RUTA)));
  } finally {
    fs.rmSync(sucio, { recursive: true, force: true });
    fs.rmSync(rama, { recursive: true, force: true });
  }
});

test("--build: si el build falla, deja el repo exactamente como estaba", () => {
  const dir = repoTemporal();
  try {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ scripts: { build: "exit 1" } }));
    fs.mkdirSync(path.join(dir, "node_modules"));
    git(dir, "add", "package.json");
    git(dir, "commit", "-qm", "build roto");
    const r = correr("--build", dir, dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /el build falló; dejé el repo como estaba/);
    assert.match(r.stdout, /1 repo\(s\) sin procesar/, "se detiene en el primer build roto");
    assert.equal(git(dir, "status", "--porcelain"), "");
    assert.ok(!fs.existsSync(path.join(dir, "lib/sevac-enlaces")), "borra las carpetas que creó");
    assert.ok(!fs.existsSync(path.join(dir, "app/(con-footer)/transparencia/sevac/[anio]")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("no pisa archivos nuevos que ya existan con otro contenido", () => {
  const dir = repoTemporal();
  try {
    fs.mkdirSync(path.join(dir, "lib/sevac-enlaces"), { recursive: true });
    fs.writeFileSync(path.join(dir, "lib/sevac-enlaces/enlaces.js"), "// otro\n");
    assert.throws(() => planificar(dir), /ya existe y es distinto/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("argumentos", () => {
  assert.throws(() => leerArgs([]), /falta al menos un repo/);
  assert.throws(() => leerArgs(["--push", "x"]), /--push requiere --commit/);
  assert.throws(() => leerArgs(["--dry-run", "--build", "x"]), /no se combina/);
  assert.throws(() => leerArgs(["--nada", "x"]), /desconocida/);
  assert.deepEqual(leerArgs(["--build", "--commit", "--push", "a", "b"]).repos, ["a", "b"]);
});
