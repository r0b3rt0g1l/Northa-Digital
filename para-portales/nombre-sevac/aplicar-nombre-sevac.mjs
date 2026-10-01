#!/usr/bin/env node
// aplicar-nombre-sevac.mjs
//
// Renombra el apartado "SEvAC" a "SEvAC/Cumplimiento" en los portales y en el admin
// (cms-admin), según lo pidió el operador el 1 de octubre de 2026:
//   - Web: menú, pie de página, acceso del home, tarjeta del hub de Transparencia y el propio
//     apartado. El apartado ya no dice "armonización contable": queda solo la descripción
//     nueva, y CONAC aparece en siglas. La dirección no cambia (/transparencia/sevac), así que
//     los enlaces de documentos ya compartidos siguen funcionando.
//   - Menú: el texto nuevo es más largo; para que el encabezado se vea igual que hoy en todos
//     los anchos (medido en producción), el menú pasa de 20 a 12 px entre opciones y de 14 a
//     13 px de letra.
//   - Admin: etiquetas del menú lateral, del tablero y títulos de las páginas de SEvAC.
//
// Detecta solo si cada repo es un portal o el admin. Todo o nada por repo: si algún texto no
// está como se esperaba, no toca ese repo y dice cuál. Con --build, si el build falla deja el
// repo como estaba y se detiene.
//
// Uso:
//   node aplicar-nombre-sevac.mjs --dry-run ~/Developer/Bacadehuachi ~/Developer/cms-admin
//   node aplicar-nombre-sevac.mjs --build --commit --push ~/Developer/Bacadehuachi ~/Developer/cms-admin
//
// Node >= 18, sin dependencias. Solo escribe dentro de los repos que se le pasan.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const NOMBRE = "SEvAC/Cumplimiento";
export const DESCRIPCION =
  "Este apartado tiene como objetivo concentrar y dar cumplimiento a las obligaciones normativas vigentes del municipio, incluyendo las evaluaciones del SEVAC y demás disposiciones aplicables.";

export const MENSAJE_COMMIT = `SEvAC/Cumplimiento: nuevo nombre del apartado SEvAC

El apartado se llama ahora "SEvAC/Cumplimiento" y ya no menciona la
armonización contable; queda la descripción de obligaciones normativas
del municipio. La dirección (/transparencia/sevac) no cambia.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nc74wYa9arg6whdtGyz4eX
`;

// ---------------------------------------------------------------------------
// lib/sevac.js del portal: se reemplaza completo (los 15 portales lo tienen igual).
// ---------------------------------------------------------------------------

export const SEVAC_JS_ORIGINAL = `export const sevac = {
  titulo: "Sistema de Evaluaciones de la Armonización Contable",
  descripcionCorta:
    "Información financiera y presupuestal del municipio, conforme a la Ley General de Contabilidad Gubernamental.",
  descripcion:
    "El Sistema de Evaluaciones de la Armonización Contable (SEvAC) mide el cumplimiento de los entes públicos en la publicación y entrega oportuna de su información contable, presupuestaria, programática y de cuenta pública conforme a la Ley General de Contabilidad Gubernamental.",
  marcoLegal:
    "Los documentos se publican conforme a la Ley General de Contabilidad Gubernamental y los Lineamientos del Consejo Nacional de Armonización Contable (CONAC).",
  fuente:
    "Consejo Nacional de Armonización Contable (CONAC) y Auditoría Superior de la Federación (ASF).",
  enlaceOficial: null,
};

export default sevac;
`;

export const SEVAC_JS_NUEVO = `export const sevac = {
  titulo: "${NOMBRE}",
  descripcion:
    "${DESCRIPCION}",
  fuente: "CONAC y Auditoría Superior de la Federación (ASF).",
  enlaceOficial: null,
};

export default sevac;
`;

const normalizar = (t) => t.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd();

// ---------------------------------------------------------------------------
// Parches por reemplazo. Cada cambio dice cuántas veces debe aparecer el texto original;
// `hecho` reconoce el resultado, para que volver a correr el script no cambie nada.
// ---------------------------------------------------------------------------

const lit = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

const etiquetaMenu = {
  desc: 'etiqueta "SEvAC" del enlace a /transparencia/sevac',
  re: /(label:\s*)"SEvAC"(\s*,\s*href:\s*"\/transparencia\/sevac")/g,
  por: `$1"${NOMBRE}"$2`,
  veces: 1,
  hecho: lit(`label: "${NOMBRE}"`),
};

export const PORTAL = [
  {
    archivo: "app/(con-footer)/transparencia/sevac/page.js",
    cambios: [
      { desc: 'title: "SEvAC"', re: /title:\s*"SEvAC",/g, por: `title: "${NOMBRE}",`, veces: 1, hecho: lit(`title: "${NOMBRE}",`) },
      {
        desc: "migas de pan",
        re: /\{\s*name:\s*"SEvAC",\s*path:\s*"\/transparencia\/sevac"\s*\}/g,
        por: `{ name: "${NOMBRE}", path: "/transparencia/sevac" }`,
        veces: 1,
        hecho: lit(`name: "${NOMBRE}"`),
      },
      {
        desc: "encabezado del apartado (PageHeader con eyebrow y descripción corta)",
        re: /([ \t]*)<PageHeader\s+clave="header-sevac"\s+eyebrow="Armonización contable"\s+fallbackTitulo="SEvAC"\s+fallbackDescripcion=\{sevac\.titulo\}\s+bg="bg"\s+narrow\s*>\s*<p className="[^"]*">\s*\{sevac\.descripcionCorta\}\s*<\/p>\s*<\/PageHeader>/g,
        por: (_m, s) =>
          [
            `${s}<PageHeader`,
            `${s}  clave="header-sevac"`,
            `${s}  eyebrow="Obligaciones normativas"`,
            `${s}  fallbackTitulo="${NOMBRE}"`,
            `${s}  fallbackDescripcion={sevac.descripcion}`,
            `${s}  bg="bg"`,
            `${s}  narrow`,
            `${s}/>`,
          ].join("\n"),
        veces: 1,
        hecho: lit(`fallbackTitulo="${NOMBRE}"`),
      },
      {
        desc: "sección con la explicación del sistema y el marco legal",
        re: /(?:\n[ \t]*)+<section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">\s*<div className="[^"]*">\s*<p>\{sevac\.descripcion\}<\/p>\s*<p>\{sevac\.marcoLegal\}<\/p>\s*<\/div>\s*<\/section>(?=\n)/g,
        por: "",
        veces: 1,
        hecho: /^(?![\s\S]*sevac\.marcoLegal)/,
      },
      { desc: 'aria-label="Documentos SEvAC"', re: /aria-label="Documentos SEvAC"/g, por: `aria-label="Documentos ${NOMBRE}"`, veces: 1, hecho: lit(`aria-label="Documentos ${NOMBRE}"`) },
      { desc: "título Documentos SEvAC", re: /(<h2[^>]*>\s*)Documentos SEvAC(\s*<\/h2>)/g, por: "$1Documentos$2", veces: 1, hecho: /<h2[^>]*>\s*Documentos\s*<\/h2>/ },
      {
        desc: 'texto "en cumplimiento de la armonización contable" de la lista de documentos',
        re: /Información financiera y presupuestal publicada por el\{" "\}(\s*)\{municipalConfig\.identidad\.nombreCompleto\} en cumplimiento de la\s+armonización contable\. Los documentos se visualizan directamente\s+en este portal\./g,
        por: (_m, s) =>
          `Documentos publicados por el{" "}${s}{municipalConfig.identidad.nombreCompleto} para el cumplimiento${s}de sus obligaciones normativas. Los documentos se visualizan${s}directamente en este portal.`,
        veces: 1,
        hecho: lit("de sus obligaciones normativas. Los documentos se visualizan"),
      },
    ],
  },
  {
    archivo: "app/(con-footer)/transparencia/page.js",
    cambios: [
      { desc: "descripción de la página (metadatos)", re: /estructura orgánica, SEvAC y enlaces/g, por: `estructura orgánica, ${NOMBRE} y enlaces`, veces: 1, hecho: lit(`estructura orgánica, ${NOMBRE} y enlaces`) },
      { desc: 'tarjeta: label "SEvAC"', re: /(label:\s*)"SEvAC",/g, por: `$1"${NOMBRE}",`, veces: 1, hecho: lit(`label: "${NOMBRE}",`) },
      {
        desc: "tarjeta: descripción con armonización contable",
        re: lit('"Sistema de Evaluaciones de la Armonización Contable: cumplimiento por categoría e informes trimestrales del ejercicio fiscal."'),
        por: `"${DESCRIPCION}"`,
        veces: 1,
        hecho: lit(`"${DESCRIPCION}"`),
      },
    ],
  },
  { archivo: "components/layout/navItems.js", cambios: [etiquetaMenu] },
  { archivo: "components/layout/Footer.jsx", cambios: [etiquetaMenu] },
  {
    archivo: "components/home/TransparenciaCTA.jsx",
    cambios: [{ desc: 'acceso "SEvAC" del home', re: /(icon:\s*BarChart3,\s*label:\s*)"SEvAC"/g, por: `$1"${NOMBRE}"`, veces: 1, hecho: lit(`label: "${NOMBRE}"`) }],
  },
  {
    // El contenedor del menú no menciona SEvAC: se localiza por sus clases
    // (en el molde: components/layout/MainNav.jsx).
    buscar: { carpeta: "components", texto: "hidden items-stretch gap-5 lg:flex", hecho: "hidden items-stretch gap-3 lg:flex" },
    cambios: [
      { desc: "separación del menú (gap-5 -> gap-3)", re: lit("hidden items-stretch gap-5 lg:flex"), por: "hidden items-stretch gap-3 lg:flex", veces: 1, hecho: lit("hidden items-stretch gap-3 lg:flex") },
    ],
  },
  {
    // La letra de las opciones vive en otros componentes del menú: 3 variantes en el molde
    // (enlace normal, enlace externo de Transparencia y botón con submenú de Gobierno). Cambian
    // las tres para que todo el menú quede del mismo tamaño; se exige que sean 3 en total.
    buscarTodos: {
      carpeta: "components",
      texto: "whitespace-nowrap px-1 py-2 text-sm font-medium uppercase",
      hecho: "whitespace-nowrap px-1 py-2 text-[13px] leading-5 font-medium uppercase",
      total: 3,
      desc: "letra del menú (text-sm -> 13 px, en sus 3 variantes)",
    },
  },
];

export const ADMIN = [
  {
    archivo: "src/lib/nav.js",
    cambios: [
      { desc: 'menú lateral "SEvAC"', re: /(href:\s*"\/transparencia\/sevac",\s*label:\s*)"SEvAC"/g, por: `$1"${NOMBRE}"`, veces: 1, hecho: lit(`label: "${NOMBRE}"`) },
      { desc: 'acceso rápido "Documento SEvAC"', re: /label:\s*"Documento SEvAC"/g, por: `label: "Documento ${NOMBRE}"`, veces: 1, hecho: lit(`label: "Documento ${NOMBRE}"`) },
    ],
  },
  {
    archivo: "src/app/(admin)/page.jsx",
    cambios: [
      { desc: 'tablero: label "SEvAC"', re: /label:\s*"SEvAC"/g, por: `label: "${NOMBRE}"`, veces: 2, hecho: lit(`label: "${NOMBRE}"`) },
      { desc: 'tablero: tipo "Documento SEvAC"', re: /tipo:\s*"Documento SEvAC"/g, por: `tipo: "Documento ${NOMBRE}"`, veces: 1, hecho: lit(`tipo: "Documento ${NOMBRE}"`) },
    ],
  },
  {
    archivo: "src/app/(admin)/transparencia/sevac/page.jsx",
    cambios: [
      { desc: "título de la pestaña", re: lit("Transparencia · SEvAC — CMS Municipal"), por: `Transparencia · ${NOMBRE} — CMS Municipal`, veces: 1, hecho: lit(`Transparencia · ${NOMBRE} — CMS Municipal`) },
      { desc: 'encabezado "Transparencia · Armonización contable"', re: lit("Transparencia · Armonización contable"), por: "Transparencia · Obligaciones normativas", veces: 1, hecho: lit("Transparencia · Obligaciones normativas") },
      { desc: "título <h1>SEvAC</h1>", re: />SEvAC<\/h1>/g, por: `>${NOMBRE}</h1>`, veces: 1, hecho: lit(`>${NOMBRE}</h1>`) },
      {
        desc: 'texto "Sistema de Evaluación de la Armonización Contable"',
        re: /del Sistema de Evaluación de la Armonización Contable(\s*\(SEvAC\))?/g,
        por: `de ${NOMBRE}`,
        veces: 1,
        hecho: /^(?![\s\S]*Armonización Contable)/,
      },
      { desc: "mensaje de error de carga", re: lit("No se pudieron cargar los documentos SEvAC."), por: `No se pudieron cargar los documentos de ${NOMBRE}.`, veces: 1, hecho: lit(`los documentos de ${NOMBRE}.`) },
    ],
  },
  {
    archivo: "src/app/(admin)/transparencia/sevac/[id]/editar/page.jsx",
    cambios: [
      { desc: "título de la pestaña", re: lit("Editar documento · SEvAC — CMS Municipal"), por: `Editar documento · ${NOMBRE} — CMS Municipal`, veces: 1, hecho: lit(`Editar documento · ${NOMBRE} — CMS Municipal`) },
      { desc: 'encabezado "Transparencia · SEvAC"', re: /Transparencia · SEvAC(?=\s*\n)/g, por: `Transparencia · ${NOMBRE}`, veces: 1, hecho: lit(`Transparencia · ${NOMBRE}`) },
    ],
  },
  {
    archivo: "src/app/(admin)/transparencia/sevac/nuevo/page.jsx",
    cambios: [
      { desc: "título de la pestaña", re: lit("Nuevo documento · SEvAC — CMS Municipal"), por: `Nuevo documento · ${NOMBRE} — CMS Municipal`, veces: 1, hecho: lit(`Nuevo documento · ${NOMBRE} — CMS Municipal`) },
      { desc: 'encabezado "Transparencia · SEvAC"', re: /Transparencia · SEvAC(?=\s*\n)/g, por: `Transparencia · ${NOMBRE}`, veces: 1, hecho: lit(`Transparencia · ${NOMBRE}`) },
    ],
  },
  {
    archivo: "src/lib/contenidos-catalogo.js",
    cambios: [{ desc: 'catálogo "Encabezado · SEvAC"', re: lit('"Encabezado · SEvAC"'), por: `"Encabezado · ${NOMBRE}"`, veces: 1, hecho: lit(`"Encabezado · ${NOMBRE}"`) }],
  },
];

/** Aplica los cambios de un archivo. Devuelve el texto nuevo (igual al de entrada si ya estaba). */
export function parchear(texto, cambios, nombreArchivo) {
  let s = texto;
  for (const c of cambios) {
    const n = (s.match(c.re) || []).length;
    if (n === c.veces) {
      s = s.replace(c.re, c.por);
      continue;
    }
    c.hecho.lastIndex = 0;
    if (n === 0 && c.hecho.test(s)) continue; // ya aplicado
    throw new Error(`${nombreArchivo}: esperaba ${c.veces} vez/veces "${c.desc}" y encontré ${n}. El archivo no es como el del molde; no toqué el repo.`);
  }
  return s;
}

function archivosCon(raiz, carpeta, textos) {
  const encontrados = [];
  const recorrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) recorrer(f);
      else if (/\.(jsx?|tsx?)$/.test(e.name)) {
        const t = fs.readFileSync(f, "utf8");
        if (textos.some((x) => t.includes(x))) encontrados.push(path.relative(raiz, f));
      }
    }
  };
  const base = path.join(raiz, carpeta);
  if (fs.existsSync(base)) recorrer(base);
  return encontrados.sort();
}

const contar = (t, x) => t.split(x).length - 1;

/** Reemplaza `texto` por `hecho` en todos los archivos de `carpeta`; exige `total` apariciones. */
function planificarTodos(raiz, { carpeta, texto, hecho, total, desc }) {
  const archivos = archivosCon(raiz, carpeta, [texto, hecho]);
  let pendientes = 0;
  let hechos = 0;
  const cambios = [];
  for (const ruta of archivos) {
    const antes = fs.readFileSync(path.join(raiz, ruta), "utf8");
    pendientes += contar(antes, texto);
    hechos += contar(antes, hecho);
    if (antes.includes(texto)) cambios.push({ ruta, antes, despues: antes.split(texto).join(hecho) });
  }
  if (pendientes === 0 && hechos === total) return []; // ya aplicado
  if (pendientes + hechos !== total) {
    throw new Error(`esperaba ${total} vez/veces "${desc}" en ${carpeta}/ y encontré ${pendientes + hechos}${archivos.length ? ` (${archivos.join(", ")})` : ""}. No toqué el repo.`);
  }
  return cambios;
}

function buscarArchivo(raiz, { carpeta, texto, hecho }) {
  const encontrados = archivosCon(raiz, carpeta, [texto, hecho]);
  if (encontrados.length !== 1) {
    throw new Error(`esperaba 1 archivo en ${carpeta}/ con las clases del menú ("${texto}") y encontré ${encontrados.length}${encontrados.length ? `: ${encontrados.join(", ")}` : ""}`);
  }
  return encontrados[0];
}

export function tipoDeRepo(raiz) {
  if (fs.existsSync(path.join(raiz, "components/layout/navItems.js")) && fs.existsSync(path.join(raiz, "lib/sevac.js"))) return "portal";
  if (fs.existsSync(path.join(raiz, "src/lib/nav.js")) && fs.existsSync(path.join(raiz, "src/app/(admin)/transparencia/sevac/page.jsx"))) return "admin";
  throw new Error("no parece ni un portal del molde ni cms-admin");
}

/** Calcula, sin escribir, los cambios del repo. Lanza un Error si algo no cuadra. */
export function planificar(raiz) {
  const tipo = tipoDeRepo(raiz);
  const cambios = [];
  if (tipo === "portal") {
    const f = path.join(raiz, "lib/sevac.js");
    const antes = fs.readFileSync(f, "utf8");
    if (normalizar(antes) === normalizar(SEVAC_JS_ORIGINAL)) cambios.push({ ruta: "lib/sevac.js", antes, despues: SEVAC_JS_NUEVO });
    else if (normalizar(antes) !== normalizar(SEVAC_JS_NUEVO)) throw new Error("lib/sevac.js no es como el del molde; no toqué el repo");
  }
  for (const p of tipo === "portal" ? PORTAL : ADMIN) {
    if (p.buscarTodos) {
      for (const c of planificarTodos(raiz, p.buscarTodos)) {
        const previo = cambios.find((x) => x.ruta === c.ruta);
        if (previo) previo.despues = previo.despues.split(p.buscarTodos.texto).join(p.buscarTodos.hecho);
        else cambios.push(c);
      }
      continue;
    }
    const ruta = p.archivo ?? buscarArchivo(raiz, p.buscar);
    const f = path.join(raiz, ruta);
    if (!fs.existsSync(f)) throw new Error(`no existe ${ruta}`);
    const antes = fs.readFileSync(f, "utf8");
    const despues = parchear(antes, p.cambios, ruta);
    if (despues !== antes) cambios.push({ ruta, antes, despues });
  }
  return { tipo, cambios };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const AYUDA = `aplicar-nombre-sevac.mjs — SEvAC pasa a llamarse "${NOMBRE}" (portales y cms-admin)

  node aplicar-nombre-sevac.mjs [--dry-run] [--build] [--commit] [--push] <repo>...

  --dry-run  muestra los cambios y no escribe nada
  --build    corre "npm run build" después de aplicar; si falla, deja el repo como estaba
  --commit   hace git pull --ff-only antes, y un commit SOLO con los archivos de este cambio
  --push     hace git push (requiere --commit)

  Cada repo debe estar en main y sin cambios sin guardar en los archivos que se tocan
  (otros archivos modificados se avisan, no se tocan ni se suben).
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

class ErrorDeBuild extends Error {}

/** Rutas con cambios sin guardar (modificadas, nuevas o sin seguimiento), tal cual las da git. */
export function archivosModificados(raiz) {
  // -z: rutas sin comillas ni escapes, separadas por NUL; sin recortar espacios (el estado
  // " M" empieza con espacio).
  const r = spawnSync("git", ["status", "--porcelain", "-z"], { cwd: raiz, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git status falló: ${r.stderr}`);
  const partes = r.stdout.split("\0").filter(Boolean);
  const rutas = [];
  for (let i = 0; i < partes.length; i++) {
    const estado = partes[i].slice(0, 2);
    rutas.push(partes[i].slice(3));
    if (estado[0] === "R" || estado[0] === "C") i++; // renombrado: la ruta de origen viene aparte
  }
  return rutas;
}

function mostrarDiff(c) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nombre-sevac-"));
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

  // Solo bloquean cambios sin guardar en los archivos que este script toca.
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
