#!/usr/bin/env node
// aplicar-enlaces-sevac.mjs
//
// Aplica en uno o varios repos de PORTAL los enlaces SEvAC en el dominio del municipio:
//   1. lib/sevac-enlaces/enlaces.js y servir-documento.js                       (nuevos)
//   2. app/(con-footer)/transparencia/sevac/[anio]/[periodo]/[archivo]/route.js   (nuevo)
//   3. app/(con-footer)/transparencia/sevac/page.js -> cada documento usa su enlace propio
//   4. components/transparencia/PDFViewer.jsx        -> botón "Copiar enlace"
//
// Todo o nada por repo: si algo no cuadra (un archivo distinto al esperado, cambios sin guardar,
// otra rama), no toca ese repo y explica por qué. Con --build, si el build falla deja el repo
// como estaba y se detiene, para no repetir el mismo error en los demás.
//
// Uso:
//   node aplicar-enlaces-sevac.mjs --dry-run ~/Developer/Bacadehuachi
//   node aplicar-enlaces-sevac.mjs --build --commit --push ~/Developer/Bacadehuachi
//
// Node >= 18, sin dependencias. Solo escribe dentro de los repos que se le pasan.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const PAGINA = "app/(con-footer)/transparencia/sevac/page.js";
export const VISOR = "components/transparencia/PDFViewer.jsx";
export const RUTA = "app/(con-footer)/transparencia/sevac/[anio]/[periodo]/[archivo]/route.js";
const MARCA_PAGINA = "@/lib/sevac-enlaces/enlaces";
const MARCA_VISOR = "copiarEnlace";

export const MENSAJE_COMMIT = `SEvAC: enlaces en el dominio del municipio y botón Copiar enlace

Cada documento SEvAC tiene su propia dirección en el portal
(/transparencia/sevac/<año>/<periodo>/<nombre>.pdf) y abre el PDF
directo, sin pasar por archivos.northadigital.com ni Cloudinary.
El visor agrega el botón "Copiar enlace".

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nc74wYa9arg6whdtGyz4eX
`;

// ---------------------------------------------------------------------------
// Archivos nuevos. NO editar a mano: los regenera `node construir.mjs` a partir de
// lib/sevac-enlaces/*.js y plantillas/route.js (una prueba verifica que coincidan).
// ---------------------------------------------------------------------------
// <<ARCHIVOS
export const ARCHIVOS = {
  "lib/sevac-enlaces/enlaces.js": "// Enlaces públicos de los documentos SEvAC, en el dominio del municipio.\n//\n// Cada documento se publica en una dirección legible que abre el archivo directo:\n//   /transparencia/sevac/<año>/<periodo>/<nombre>.<ext>\n//   p. ej. /transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal.pdf\n// <periodo> es t1..t4 (trimestre) o \"anual\" si el documento no tiene trimestre; <nombre> sale\n// del título. Si en el mismo año y periodo dos documentos dan el mismo nombre (p. ej. \"Actas de\n// cabildo\" varias veces en un trimestre), el más antiguo se queda con el nombre limpio y los\n// demás llevan un sufijo corto y fijo de su archivo: actas-de-cabildo-26470bd4.pdf. Así el\n// enlace del primero no cambia cuando se sube otro con el mismo título.\n//\n// Ojo: si en el panel cambian el título, el año o el trimestre, cambia el enlace del documento.\n//\n// Sin dependencias. Acepta tanto el documento crudo de la API (archivoUrl, fileName) como el ya\n// normalizado del portal (url, nombreArchivo): las dos formas dan la misma ruta.\n\nexport const RUTA_SEVAC = \"/transparencia/sevac\";\n\n/** Únicos orígenes de los que se sirven archivos (el backend sube a R2 y, antes, a Cloudinary). */\nexport const HOSTS_PERMITIDOS = Object.freeze([\"archivos.northadigital.com\", \"res.cloudinary.com\"]);\n\nconst LARGO_MAXIMO = 90;\nconst EXTENSIONES_EN_TITULO = /\\.(pdf|docx?|xlsx?|pptx?|csv|zip)\\s*$/i;\n\n/** \"D.3.1 Estado Analítico de Ingresos.pdf\" -> \"d-3-1-estado-analitico-de-ingresos\" */\nexport function nombreLegible(titulo) {\n  let t = String(titulo ?? \"\")\n    .trim()\n    .replace(EXTENSIONES_EN_TITULO, \"\")\n    .normalize(\"NFD\")\n    .replace(/[̀-ͯ]/g, \"\")\n    .toLowerCase()\n    .replace(/[^a-z0-9]+/g, \"-\")\n    .replace(/^-+|-+$/g, \"\");\n  if (t.length > LARGO_MAXIMO) {\n    t = t.slice(0, LARGO_MAXIMO);\n    const corte = t.lastIndexOf(\"-\");\n    if (corte > LARGO_MAXIMO / 2) t = t.slice(0, corte);\n    t = t.replace(/-+$/, \"\");\n  }\n  return t || \"documento\";\n}\n\nexport function anioDe(doc) {\n  const n = Number(doc?.anio);\n  return Number.isInteger(n) && n >= 1900 && n <= 2999 ? String(n) : \"sin-anio\";\n}\n\nexport function periodoDe(doc) {\n  const t = String(doc?.trimestre ?? \"\").trim();\n  return /^[1-4]$/.test(t) ? `t${t}` : \"anual\";\n}\n\n/** URL original del archivo: `archivoUrl` en la API, `url` en el documento normalizado del portal. */\nexport function urlDelArchivo(doc) {\n  const u = doc?.archivoUrl ?? doc?.url;\n  return typeof u === \"string\" && /^https?:\\/\\//i.test(u) ? u : \"\";\n}\n\nfunction rutaDelArchivo(doc) {\n  try {\n    return new URL(urlDelArchivo(doc)).pathname;\n  } catch {\n    return \"\";\n  }\n}\n\nfunction extensionDeNombre(nombre) {\n  const ultimo = String(nombre ?? \"\").split(\"/\").pop() ?? \"\";\n  const ext = ultimo.includes(\".\") ? ultimo.split(\".\").pop().toLowerCase() : \"\";\n  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : \"\";\n}\n\n/** Extensión del archivo: la de su URL; si no tiene, la del nombre original; si no, pdf. */\nexport function extensionDe(doc) {\n  return extensionDeNombre(rutaDelArchivo(doc)) || extensionDeNombre(doc?.fileName ?? doc?.nombreArchivo) || \"pdf\";\n}\n\n/** Sufijo corto y fijo para desempatar: sale del nombre del archivo (UUID en R2, id en Cloudinary). */\nexport function sufijoDe(doc) {\n  const base = (rutaDelArchivo(doc).split(\"/\").pop() ?? \"\").replace(/\\.[^.]*$/, \"\").toLowerCase();\n  const limpio = base.replace(/[^a-z0-9]/g, \"\");\n  if (limpio.length >= 8) return limpio.slice(0, 8);\n  const id = String(doc?.id ?? \"\").toLowerCase().replace(/[^a-z0-9]/g, \"\");\n  return (limpio + id).slice(0, 8) || \"x\";\n}\n\nfunction porAntiguedad(a, b) {\n  const fa = String(a.creadoEn ?? \"9999\");\n  const fb = String(b.creadoEn ?? \"9999\");\n  if (fa !== fb) return fa < fb ? -1 : 1;\n  return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;\n}\n\n/**\n * Devuelve un Map id -> ruta pública (\"/transparencia/sevac/2026/t2/nombre.pdf\") para todos\n * los documentos de un municipio. Determinista: el mismo listado da siempre las mismas rutas.\n */\nexport function construirEnlaces(docs) {\n  const grupos = new Map();\n  for (const d of Array.isArray(docs) ? docs : []) {\n    if (!d || d.id == null) continue;\n    const base = `${anioDe(d)}/${periodoDe(d)}/${nombreLegible(d.titulo)}`;\n    const ext = extensionDe(d);\n    const clave = `${base}.${ext}`;\n    if (!grupos.has(clave)) grupos.set(clave, { base, ext, docs: [] });\n    grupos.get(clave).docs.push(d);\n  }\n\n  const enlaces = new Map();\n  const usadas = new Set();\n  // Primero los nombres limpios, para que un nombre con sufijo nunca le quite el suyo a otro.\n  for (const [clave, g] of grupos) {\n    g.docs.sort(porAntiguedad);\n    enlaces.set(String(g.docs[0].id), `${RUTA_SEVAC}/${clave}`);\n    usadas.add(clave);\n  }\n  for (const g of grupos.values()) {\n    for (const d of g.docs.slice(1)) {\n      const id = String(d.id).toLowerCase().replace(/[^a-z0-9]/g, \"\");\n      const candidatos = [sufijoDe(d), `${sufijoDe(d)}-${id.slice(0, 8)}`, id];\n      let ruta = null;\n      for (const s of candidatos) {\n        const r = `${g.base}-${s}.${g.ext}`;\n        if (!usadas.has(r)) {\n          ruta = r;\n          break;\n        }\n      }\n      for (let n = 2; ruta === null; n++) {\n        const r = `${g.base}-${id}-${n}.${g.ext}`;\n        if (!usadas.has(r)) ruta = r;\n      }\n      usadas.add(ruta);\n      enlaces.set(String(d.id), `${RUTA_SEVAC}/${ruta}`);\n    }\n  }\n  return enlaces;\n}\n\n/** Ruta pública de UN documento, calculada contra el listado completo (hace falta para desempatar). */\nexport function enlaceDe(doc, docs) {\n  return construirEnlaces(docs).get(String(doc?.id)) ?? null;\n}\n\n/** Normaliza una ruta pedida: decodifica, quita barras sobrantes y pasa a minúsculas. */\nexport function normalizarRuta(ruta) {\n  let r = String(ruta ?? \"\");\n  try {\n    r = decodeURIComponent(r);\n  } catch {\n    // Se queda como vino; simplemente no coincidirá con ningún documento.\n  }\n  return r.trim().toLowerCase().replace(/\\/{2,}/g, \"/\").replace(/\\/+$/, \"\");\n}\n\n/**\n * Busca el documento cuya ruta pública es `ruta`. Devuelve el documento o null.\n * También acepta la forma con sufijo de un documento que hoy tiene el nombre limpio: si se borra el\n * más antiguo de dos con el mismo título, el enlace con sufijo que ya se había compartido sigue\n * funcionando.\n */\nexport function resolverDocumento(docs, ruta) {\n  const buscada = normalizarRuta(ruta);\n  const lista = (Array.isArray(docs) ? docs : []).filter((d) => d && d.id != null);\n  for (const [id, r] of construirEnlaces(lista)) {\n    if (r === buscada) return lista.find((d) => String(d.id) === id) ?? null;\n  }\n  for (const d of lista) {\n    const alias = `${RUTA_SEVAC}/${anioDe(d)}/${periodoDe(d)}/${nombreLegible(d.titulo)}-${sufijoDe(d)}.${extensionDe(d)}`;\n    if (alias === buscada) return d;\n  }\n  return null;\n}\n\n/** true si la URL del archivo es https y de un origen permitido (defensa ante datos inesperados). */\nexport function origenPermitido(url) {\n  if (typeof url !== \"string\") return false;\n  try {\n    const u = new URL(String(url));\n    return u.protocol === \"https:\" && HOSTS_PERMITIDOS.includes(u.hostname);\n  } catch {\n    return false;\n  }\n}\n\n/** Nombre con el que se descarga el archivo: el último tramo de la ruta pública. */\nexport function nombreDeDescarga(rutaPublica) {\n  return String(rutaPublica ?? \"\").split(\"/\").pop() || \"documento.pdf\";\n}\n",
  "lib/sevac-enlaces/servir-documento.js": "// Sirve un documento SEvAC desde el dominio del municipio.\n//\n// GET /transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal.pdf\n//   1. Pide a la API el listado SEvAC del municipio (caché de datos de Next, 5 min, tag\n//      \"<slug>:sevac\"; si el documento no aparece, lo vuelve a pedir sin caché por si se acaba\n//      de subir).\n//   2. Busca el documento cuya ruta pública coincide (ver enlaces.js).\n//   3. Trae el archivo de su origen (R2 o Cloudinary) y lo pasa tal cual, en streaming, con\n//      soporte de Range (el visor de PDF del navegador pide el archivo por partes) y con\n//      Content-Disposition inline y un nombre legible.\n// La dirección del navegador nunca cambia: no hay redirección a archivos.northadigital.com.\n//\n// Por qué streaming: una respuesta de función en Vercel no puede pasar de 4.5 MB salvo en\n// streaming, y hay documentos SEvAC de hasta 90 MB.\n\nimport {\n  RUTA_SEVAC,\n  extensionDe,\n  normalizarRuta,\n  origenPermitido,\n  resolverDocumento,\n  construirEnlaces,\n  nombreDeDescarga,\n  urlDelArchivo,\n} from \"./enlaces.js\";\n\nexport const API_POR_DEFECTO = \"https://api.northadigital.com\";\nexport const REVALIDAR_S = 300;\nconst ESPERA_API_MS = 30_000; // igual que cmsFetch: la API puede tardar si Render arranca en frío\nconst CABECERAS_DEL_ORIGEN = [\"content-length\", \"content-range\", \"accept-ranges\", \"etag\", \"last-modified\"];\nconst CABECERAS_CONDICIONALES = [\"if-none-match\", \"if-modified-since\", \"if-range\"];\nconst ESTADOS_VALIDOS = new Set([200, 206, 304, 416]);\nconst TIPOS = { pdf: \"application/pdf\", xls: \"application/vnd.ms-excel\", xlsx: \"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\" };\n\nfunction pagina(estado, titulo, texto, metodo) {\n  const html = `<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>${titulo}</title><style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:0 1rem;color:#1a1a1a;line-height:1.5}a{color:inherit}</style></head><body><h1>${titulo}</h1><p>${texto}</p><p><a href=\"${RUTA_SEVAC}\">Ver todos los documentos SEvAC</a></p></body></html>`;\n  return new Response(metodo === \"HEAD\" ? null : html, {\n    status: estado,\n    headers: { \"content-type\": \"text/html; charset=utf-8\", \"cache-control\": \"no-store\", \"x-robots-tag\": \"noindex\" },\n  });\n}\n\nconst noEncontrado = (metodo) =>\n  pagina(404, \"Documento no encontrado\", \"No encontramos este documento. Puede que lo hayan movido o que su título haya cambiado.\", metodo);\nconst noDisponible = (estado, metodo) =>\n  pagina(estado, \"Documento no disponible por el momento\", \"No pudimos traer el documento. Intenta de nuevo en unos minutos.\", metodo);\n\n/**\n * Crea el manejador de la ruta. `municipio` es el slug del municipio en el CMS y `api` la URL\n * base de la API (en el portal: NEXT_PUBLIC_MUNICIPIO_SLUG y NEXT_PUBLIC_API_URL, como cms.ts).\n * `fetchImpl` existe para las pruebas; en el portal se usa el fetch de Next.\n * Si falta la configuración no rompe el build: responde 503 al pedir un documento.\n */\nexport function crearManejador({ municipio, api, fetchImpl = globalThis.fetch, revalidar = REVALIDAR_S } = {}) {\n  const configurado = /^[a-z0-9-]+$/.test(String(municipio ?? \"\")) && municipio !== \"municipio\";\n  const base = String(api || API_POR_DEFECTO).replace(/\\/+$/, \"\");\n\n  async function listar(fresco) {\n    const opciones = { headers: { accept: \"application/json\" }, signal: AbortSignal.timeout(ESPERA_API_MS) };\n    if (fresco) opciones.cache = \"no-store\";\n    else opciones.next = { revalidate: revalidar, tags: [`${municipio}:sevac`] };\n    const r = await fetchImpl(`${base}/api/municipios/${municipio}/sevac`, opciones);\n    if (!r.ok) throw new Error(`API respondió ${r.status}`);\n    const datos = await r.json();\n    if (Array.isArray(datos)) return datos;\n    if (Array.isArray(datos?.data)) return datos.data;\n    throw new Error(\"respuesta de la API sin listado\");\n  }\n\n  return async function manejar(request) {\n    const metodo = request.method === \"HEAD\" ? \"HEAD\" : \"GET\";\n    // Se usa la ruta pedida, no los params: así no importa cómo se llamen las carpetas dinámicas.\n    const ruta = normalizarRuta(new URL(request.url).pathname);\n    if (!ruta.startsWith(`${RUTA_SEVAC}/`)) return noEncontrado(metodo);\n    if (!configurado) return noDisponible(503, metodo);\n\n    let docs;\n    let doc = null;\n    try {\n      docs = await listar(false);\n      doc = resolverDocumento(docs, ruta);\n      if (!doc) {\n        docs = await listar(true);\n        doc = resolverDocumento(docs, ruta);\n      }\n    } catch {\n      return noDisponible(503, metodo);\n    }\n    const archivo = urlDelArchivo(doc);\n    if (!doc || !origenPermitido(archivo)) return noEncontrado(metodo);\n\n    const cabeceras = {};\n    const rango = request.headers.get(\"range\");\n    if (rango && /^bytes=[\\d\\s,-]+$/i.test(rango)) cabeceras.range = rango;\n    for (const h of CABECERAS_CONDICIONALES) {\n      const v = request.headers.get(h);\n      if (v) cabeceras[h] = v;\n    }\n\n    let origen;\n    try {\n      // Sin caché de datos (los archivos pueden pesar decenas de MB) y sin seguir redirecciones.\n      origen = await fetchImpl(archivo, { method: metodo, headers: cabeceras, cache: \"no-store\", redirect: \"manual\" });\n    } catch {\n      return noDisponible(502, metodo);\n    }\n    if (origen.status === 404 || origen.status === 410) return noEncontrado(metodo);\n    if (!ESTADOS_VALIDOS.has(origen.status)) return noDisponible(502, metodo);\n\n    const salida = new Headers();\n    for (const h of CABECERAS_DEL_ORIGEN) {\n      const v = origen.headers.get(h);\n      if (v) salida.set(h, v);\n    }\n    const ext = extensionDe(doc);\n    const nombre = nombreDeDescarga(construirEnlaces(docs).get(String(doc.id)));\n    salida.set(\"content-type\", origen.headers.get(\"content-type\") || TIPOS[ext] || \"application/octet-stream\");\n    salida.set(\"content-disposition\", `inline; filename=\"${nombre}\"`);\n    salida.set(\"x-content-type-options\", \"nosniff\");\n    // Solo caché del navegador; la CDN de Vercel no guarda archivos tan grandes de una función.\n    salida.set(\"cache-control\", origen.status === 200 && !cabeceras.range ? \"public, max-age=300\" : \"no-store\");\n\n    const sinCuerpo = metodo === \"HEAD\" || origen.status === 304;\n    if (sinCuerpo && origen.body) await origen.body.cancel().catch(() => {});\n    return new Response(sinCuerpo ? null : origen.body, { status: origen.status, headers: salida });\n  };\n}\n",
  "app/(con-footer)/transparencia/sevac/[anio]/[periodo]/[archivo]/route.js": "// Documentos SEvAC en el dominio del municipio:\n//   /transparencia/sevac/<año>/<t1..t4|anual>/<nombre>.pdf  ->  el archivo, directo.\n// Toda la lógica está en lib/sevac-enlaces/servir-documento.js. El slug y la API salen de las\n// mismas variables que usa lib/content/cms.ts, así que este archivo es igual en todos los portales.\nimport { crearManejador } from \"@/lib/sevac-enlaces/servir-documento\";\n\nconst manejar = crearManejador({\n  municipio: process.env.NEXT_PUBLIC_MUNICIPIO_SLUG,\n  api: process.env.NEXT_PUBLIC_API_URL,\n});\n\nexport async function GET(request) {\n  return manejar(request);\n}\n\nexport async function HEAD(request) {\n  return manejar(request);\n}\n"
};
// ARCHIVOS>>

// ---------------------------------------------------------------------------
// Parches (funciones puras: texto -> texto, o error con la explicación)
// ---------------------------------------------------------------------------

function escaparRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sangrar(lineas, sangria) {
  return lineas.map((l) => (l ? sangria + l : l)).join("\n") + "\n";
}

export function parchearPagina(t) {
  if (t.includes(MARCA_PAGINA)) return { texto: t, yaEstaba: true };
  const falla = (que) => {
    throw new Error(`${PAGINA}: ${que}. El archivo no es como el del molde; no lo toqué.`);
  };
  if (!/const\s+documentos\s*=\s*await\s+getSevac\(/.test(t)) falla('no encontré "const documentos = await getSevac("');

  const importContent = /^import\s*\{[^}]*\bgetSevac\b[^}]*\}\s*from\s*["']@\/lib\/content["'];?[^\n]*\n/m;
  if (!importContent.test(t)) falla('no encontré el import de getSevac desde "@/lib/content"');
  let s = t.replace(importContent, (m) => `${m}import { construirEnlaces, origenPermitido } from "${MARCA_PAGINA}";\n`);

  const filtros = /^([ \t]*)const\s+hayFiltros\s*=\s*Boolean\(\s*anio\s*\|\|\s*trimestre\s*\);?[ \t]*\n/m;
  const m = s.match(filtros);
  if (!m) falla('no encontré "const hayFiltros = Boolean(anio || trimestre);"');
  const bloque = sangrar(
    [
      "// Cada documento se abre desde el dominio del municipio (ver lib/sevac-enlaces/enlaces.js).",
      "// Los enlaces se calculan con el listado completo, aunque haya filtros, para que coincidan",
      "// siempre con los de la ruta que sirve el archivo ([anio]/[periodo]/[archivo]/route.js).",
      "const enlaces = construirEnlaces(hayFiltros ? await getSevac({}) : documentos);",
      "const conEnlace = (doc) => {",
      "  const ruta = enlaces.get(String(doc.id));",
      "  return ruta && origenPermitido(doc.url) ? { ...doc, url: ruta } : doc;",
      "};",
    ],
    m[1],
  );
  s = s.replace(filtros, (x) => x + bloque);

  const usoDoc = /(return\s*\{\s*)doc,/g;
  const n = (s.match(usoDoc) || []).length;
  if (n !== 1) falla(`esperaba exactamente un "return { doc," y hay ${n}`);
  s = s.replace(usoDoc, "$1doc: conEnlace(doc),");
  return { texto: s, yaEstaba: false };
}

function agregarImports(s, modulo, nombres) {
  const re = new RegExp(`^import\\s*\\{([^}]*)\\}\\s*from\\s*["']${escaparRegex(modulo)}["'];?`, "m");
  const m = s.match(re);
  if (!m) throw new Error(`${VISOR}: no encontré el import de "${modulo}". El archivo no es como el del molde; no lo toqué.`);
  const actuales = m[1].split(",").map((x) => x.trim()).filter(Boolean);
  const faltan = nombres.filter((n) => !actuales.some((a) => a === n || a.startsWith(`${n} as `)));
  if (faltan.length === 0) return s;
  return s.replace(re, `import { ${[...actuales, ...faltan].join(", ")} } from "${modulo}";`);
}

export function parchearVisor(t) {
  if (t.includes(MARCA_VISOR)) return { texto: t, yaEstaba: true };
  const falla = (que) => {
    throw new Error(`${VISOR}: ${que}. El archivo no es como el del molde; no lo toqué.`);
  };
  for (const nombre of ["copiado", "setCopiado", "enlacePropio", "Link2"]) {
    if (new RegExp(`\\b${nombre}\\b`).test(t)) falla(`ya usa el nombre "${nombre}"`);
  }
  let s = agregarImports(t, "react", ["useEffect"]);
  s = agregarImports(s, "lucide-react", ["Link2", "Check"]);

  const setOpen = /^([ \t]*)const\s+setOpen\s*=\s*isControlled\s*\?\s*onOpenChange\s*:\s*setInternalOpen;?[ \t]*\n/m;
  const m = s.match(setOpen);
  if (!m) falla('no encontré "const setOpen = isControlled ? onOpenChange : setInternalOpen;"');
  const logica = sangrar(
    [
      "",
      '// "Copiar enlace": solo para documentos servidos desde el dominio del municipio (ruta que',
      '// empieza con "/", como los SEvAC de lib/sevac-enlaces). Los demás no tienen enlace propio.',
      'const enlacePropio = typeof pdfUrl === "string" && pdfUrl.startsWith("/");',
      "const [copiado, setCopiado] = useState(false);",
      "useEffect(() => {",
      "  if (!copiado) return undefined;",
      "  const t = setTimeout(() => setCopiado(false), 2000);",
      "  return () => clearTimeout(t);",
      "}, [copiado]);",
      "",
      `async function ${MARCA_VISOR}() {`,
      "  const enlace = new URL(pdfUrl, window.location.origin).href;",
      "  try {",
      "    await navigator.clipboard.writeText(enlace);",
      "    setCopiado(true);",
      "  } catch {",
      "    // Sin permiso para el portapapeles (o navegador antiguo): se muestra para copiarlo a mano.",
      '    window.prompt("Copia el enlace del documento:", enlace);',
      "  }",
      "}",
    ],
    m[1],
  );
  s = s.replace(setOpen, (x) => x + logica);

  const pestana = /<span className="hidden sm:inline">Pestaña<\/span>[ \t]*\n([ \t]*)<\/a>[ \t]*\n/;
  const p = s.match(pestana);
  if (!p) falla('no encontré el botón "Pestaña"');
  const boton = sangrar(
    [
      "{enlacePropio ? (",
      "  <>",
      "    <button",
      '      type="button"',
      `      onClick={${MARCA_VISOR}}`,
      '      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text)] transition hover:border-[var(--color-text-muted)] hover:bg-[var(--color-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dorado)]"',
      '      aria-label={copiado ? "Enlace copiado" : "Copiar enlace del documento"}',
      "    >",
      "      {copiado ? (",
      '        <Check className="h-3.5 w-3.5" aria-hidden="true" />',
      "      ) : (",
      '        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />',
      "      )}",
      '      <span className="hidden sm:inline">',
      '        {copiado ? "Copiado" : "Copiar enlace"}',
      "      </span>",
      "    </button>",
      '    <span className="sr-only" aria-live="polite">',
      '      {copiado ? "Enlace copiado" : ""}',
      "    </span>",
      "  </>",
      ") : null}",
    ],
    p[1],
  );
  s = s.replace(pestana, (x) => x + boton);
  return { texto: s, yaEstaba: false };
}

// ---------------------------------------------------------------------------
// Plan por repo
// ---------------------------------------------------------------------------

const leer = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);

/**
 * Calcula, sin escribir nada, qué cambia en el repo `raiz`.
 * Devuelve { cambios: [{ ruta, antes, despues }], avisos: [] }; lanza un Error si no es seguro.
 */
export function planificar(raiz) {
  const abs = (r) => path.join(raiz, r);
  for (const r of [PAGINA, VISOR]) {
    if (!fs.existsSync(abs(r))) throw new Error(`no existe ${r}: no parece un portal del molde`);
  }
  const dirSevac = path.dirname(abs(PAGINA));
  for (const e of fs.readdirSync(dirSevac)) {
    if (e.startsWith("[") && e !== "[anio]") throw new Error(`ya hay otra ruta dinámica en transparencia/sevac: ${e}`);
  }

  const cambios = [];
  for (const [r, contenido] of Object.entries(ARCHIVOS)) {
    const actual = leer(abs(r));
    if (actual === contenido) continue;
    if (actual !== null) throw new Error(`${r} ya existe y es distinto; revísalo a mano (no lo piso)`);
    cambios.push({ ruta: r, antes: null, despues: contenido });
  }
  for (const [r, parche] of [[PAGINA, parchearPagina], [VISOR, parchearVisor]]) {
    const antes = leer(abs(r));
    const { texto, yaEstaba } = parche(antes);
    if (!yaEstaba) cambios.push({ ruta: r, antes, despues: texto });
  }

  const avisos = [];
  for (const f of ["middleware.js", "middleware.ts", "proxy.js", "proxy.ts", "src/middleware.js", "src/middleware.ts"]) {
    if (fs.existsSync(abs(f))) avisos.push(`hay ${f}: confirma que no intercepte /transparencia/sevac/...`);
  }
  const cms = leer(abs("lib/content/cms.ts")) ?? "";
  if (!cms.includes("NEXT_PUBLIC_MUNICIPIO_SLUG") || !cms.includes("NEXT_PUBLIC_API_URL")) {
    avisos.push("lib/content/cms.ts no usa NEXT_PUBLIC_MUNICIPIO_SLUG / NEXT_PUBLIC_API_URL: la ruta nueva usa esas variables");
  }
  return { cambios, avisos };
}

/** Escribe los cambios. Devuelve una función que los deshace (para cuando falla el build). */
export function escribir(raiz, cambios) {
  const creados = [];
  const dirsCreados = [];
  for (const c of cambios) {
    const f = path.join(raiz, c.ruta);
    if (c.antes === null) {
      let d = path.dirname(f);
      const nuevos = [];
      while (!fs.existsSync(d)) {
        nuevos.unshift(d);
        d = path.dirname(d);
      }
      for (const n of nuevos) {
        fs.mkdirSync(n);
        dirsCreados.push(n);
      }
      creados.push(f);
    }
    fs.writeFileSync(f, c.despues);
  }
  return function deshacer() {
    for (const c of cambios) if (c.antes !== null) fs.writeFileSync(path.join(raiz, c.ruta), c.antes);
    for (const f of creados) fs.rmSync(f, { force: true });
    for (const d of dirsCreados.reverse()) {
      try {
        fs.rmdirSync(d);
      } catch {
        // No estaba vacío: alguien más escribió ahí; se deja.
      }
    }
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const AYUDA = `aplicar-enlaces-sevac.mjs — enlaces SEvAC en el dominio del municipio

  node aplicar-enlaces-sevac.mjs [--dry-run] [--build] [--commit] [--push] <repo-del-portal>...

  --dry-run  muestra los cambios y no escribe nada
  --build    corre "npm run build" después de aplicar; si falla, deja el repo como estaba
  --commit   hace git pull --ff-only antes, y un commit con los cambios después
  --push     hace git push (requiere --commit)

  Cada repo debe estar limpio (sin cambios sin guardar) y en la rama main.
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

function mostrarDiff(c) {
  if (c.antes === null) {
    console.log(`    + ${c.ruta} (nuevo, ${c.despues.split("\n").length} líneas)`);
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "enlaces-sevac-"));
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
  const nombre = path.basename(raiz);
  console.log(`\n=== ${nombre} (${raiz})`);
  if (!fs.existsSync(path.join(raiz, ".git"))) throw new Error("no es un repo git");
  const remoto = git(raiz, ["remote", "get-url", "origin"]);
  console.log(`  repo: ${remoto.ok ? remoto.salida : "(sin remoto origin)"}`);

  const rama = git(raiz, ["rev-parse", "--abbrev-ref", "HEAD"]).salida;
  const estado = git(raiz, ["status", "--porcelain"]);
  if (!estado.ok) throw new Error(`git status falló: ${estado.salida}`);
  if (!o.dryRun) {
    if (estado.salida) throw new Error(`tiene cambios sin guardar; guárdalos o descártalos primero:\n${estado.salida}`);
    if (rama !== "main") throw new Error(`está en la rama "${rama}"; cámbiate a main (git switch main)`);
  }
  if (o.commit) {
    const pull = git(raiz, ["pull", "--ff-only"]);
    if (!pull.ok) throw new Error(`git pull --ff-only falló: ${pull.salida}`);
    console.log("  ✔ al día con GitHub (git pull --ff-only)");
  }

  const { cambios, avisos } = planificar(raiz);
  for (const a of avisos) console.log(`  ⚠ ${a}`);
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

  const deshacer = escribir(raiz, cambios);
  console.log("  ✔ cambios escritos");
  if (o.build) {
    if (!fs.existsSync(path.join(raiz, "node_modules"))) {
      console.log("  … instalando dependencias (npm ci)");
      const ci = spawnSync("npm", ["ci"], { cwd: raiz, stdio: "inherit" });
      if (ci.status !== 0) {
        deshacer();
        throw new Error("npm ci falló; dejé el repo como estaba");
      }
    }
    console.log("  … npm run build");
    const b = spawnSync("npm", ["run", "build"], { cwd: raiz, stdio: "inherit" });
    if (b.status !== 0) {
      deshacer();
      throw new Error("el build falló; dejé el repo como estaba. Pega la salida de arriba en el chat");
    }
    console.log("  ✔ build correcto");
  }
  if (o.commit) {
    const add = git(raiz, ["add", "--", ...cambios.map((c) => c.ruta)]);
    if (!add.ok) throw new Error(`git add falló: ${add.salida}`);
    const ci = git(raiz, ["commit", "-q", "-m", MENSAJE_COMMIT]);
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
  if (Object.keys(ARCHIVOS).length === 0) {
    console.error("Este script no trae los archivos nuevos: genéralo con `node construir.mjs`.");
    return 3;
  }
  const resultados = [];
  for (const r of o.repos) {
    try {
      resultados.push([r, procesar(r, o)]);
    } catch (e) {
      console.error(`  ✘ ${e.message}`);
      resultados.push([r, "FALLA"]);
      if (o.build) break; // un build roto se repetiría igual en los demás
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
