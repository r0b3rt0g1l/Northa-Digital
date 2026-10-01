// Enlaces públicos de los documentos SEvAC, en el dominio del municipio.
//
// Cada documento se publica en una dirección legible que abre el archivo directo:
//   /transparencia/sevac/<año>/<periodo>/<nombre>.<ext>
//   p. ej. /transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal.pdf
// <periodo> es t1..t4 (trimestre) o "anual" si el documento no tiene trimestre; <nombre> sale
// del título. Si en el mismo año y periodo dos documentos dan el mismo nombre (p. ej. "Actas de
// cabildo" varias veces en un trimestre), el más antiguo se queda con el nombre limpio y los
// demás llevan un sufijo corto y fijo de su archivo: actas-de-cabildo-26470bd4.pdf. Así el
// enlace del primero no cambia cuando se sube otro con el mismo título.
//
// Ojo: si en el panel cambian el título, el año o el trimestre, cambia el enlace del documento.
//
// Sin dependencias. Acepta tanto el documento crudo de la API (archivoUrl, fileName) como el ya
// normalizado del portal (url, nombreArchivo): las dos formas dan la misma ruta.

export const RUTA_SEVAC = "/transparencia/sevac";

/** Únicos orígenes de los que se sirven archivos (el backend sube a R2 y, antes, a Cloudinary). */
export const HOSTS_PERMITIDOS = Object.freeze(["archivos.northadigital.com", "res.cloudinary.com"]);

const LARGO_MAXIMO = 90;
const EXTENSIONES_EN_TITULO = /\.(pdf|docx?|xlsx?|pptx?|csv|zip)\s*$/i;

/** "D.3.1 Estado Analítico de Ingresos.pdf" -> "d-3-1-estado-analitico-de-ingresos" */
export function nombreLegible(titulo) {
  let t = String(titulo ?? "")
    .trim()
    .replace(EXTENSIONES_EN_TITULO, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (t.length > LARGO_MAXIMO) {
    t = t.slice(0, LARGO_MAXIMO);
    const corte = t.lastIndexOf("-");
    if (corte > LARGO_MAXIMO / 2) t = t.slice(0, corte);
    t = t.replace(/-+$/, "");
  }
  return t || "documento";
}

export function anioDe(doc) {
  const n = Number(doc?.anio);
  return Number.isInteger(n) && n >= 1900 && n <= 2999 ? String(n) : "sin-anio";
}

export function periodoDe(doc) {
  const t = String(doc?.trimestre ?? "").trim();
  return /^[1-4]$/.test(t) ? `t${t}` : "anual";
}

/** URL original del archivo: `archivoUrl` en la API, `url` en el documento normalizado del portal. */
export function urlDelArchivo(doc) {
  const u = doc?.archivoUrl ?? doc?.url;
  return typeof u === "string" && /^https?:\/\//i.test(u) ? u : "";
}

function rutaDelArchivo(doc) {
  try {
    return new URL(urlDelArchivo(doc)).pathname;
  } catch {
    return "";
  }
}

function extensionDeNombre(nombre) {
  const ultimo = String(nombre ?? "").split("/").pop() ?? "";
  const ext = ultimo.includes(".") ? ultimo.split(".").pop().toLowerCase() : "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "";
}

/** Extensión del archivo: la de su URL; si no tiene, la del nombre original; si no, pdf. */
export function extensionDe(doc) {
  return extensionDeNombre(rutaDelArchivo(doc)) || extensionDeNombre(doc?.fileName ?? doc?.nombreArchivo) || "pdf";
}

/** Sufijo corto y fijo para desempatar: sale del nombre del archivo (UUID en R2, id en Cloudinary). */
export function sufijoDe(doc) {
  const base = (rutaDelArchivo(doc).split("/").pop() ?? "").replace(/\.[^.]*$/, "").toLowerCase();
  const limpio = base.replace(/[^a-z0-9]/g, "");
  if (limpio.length >= 8) return limpio.slice(0, 8);
  const id = String(doc?.id ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return (limpio + id).slice(0, 8) || "x";
}

function porAntiguedad(a, b) {
  const fa = String(a.creadoEn ?? "9999");
  const fb = String(b.creadoEn ?? "9999");
  if (fa !== fb) return fa < fb ? -1 : 1;
  return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
}

/**
 * Devuelve un Map id -> ruta pública ("/transparencia/sevac/2026/t2/nombre.pdf") para todos
 * los documentos de un municipio. Determinista: el mismo listado da siempre las mismas rutas.
 */
export function construirEnlaces(docs) {
  const grupos = new Map();
  for (const d of Array.isArray(docs) ? docs : []) {
    if (!d || d.id == null) continue;
    const base = `${anioDe(d)}/${periodoDe(d)}/${nombreLegible(d.titulo)}`;
    const ext = extensionDe(d);
    const clave = `${base}.${ext}`;
    if (!grupos.has(clave)) grupos.set(clave, { base, ext, docs: [] });
    grupos.get(clave).docs.push(d);
  }

  const enlaces = new Map();
  const usadas = new Set();
  // Primero los nombres limpios, para que un nombre con sufijo nunca le quite el suyo a otro.
  for (const [clave, g] of grupos) {
    g.docs.sort(porAntiguedad);
    enlaces.set(String(g.docs[0].id), `${RUTA_SEVAC}/${clave}`);
    usadas.add(clave);
  }
  for (const g of grupos.values()) {
    for (const d of g.docs.slice(1)) {
      const id = String(d.id).toLowerCase().replace(/[^a-z0-9]/g, "");
      const candidatos = [sufijoDe(d), `${sufijoDe(d)}-${id.slice(0, 8)}`, id];
      let ruta = null;
      for (const s of candidatos) {
        const r = `${g.base}-${s}.${g.ext}`;
        if (!usadas.has(r)) {
          ruta = r;
          break;
        }
      }
      for (let n = 2; ruta === null; n++) {
        const r = `${g.base}-${id}-${n}.${g.ext}`;
        if (!usadas.has(r)) ruta = r;
      }
      usadas.add(ruta);
      enlaces.set(String(d.id), `${RUTA_SEVAC}/${ruta}`);
    }
  }
  return enlaces;
}

/** Ruta pública de UN documento, calculada contra el listado completo (hace falta para desempatar). */
export function enlaceDe(doc, docs) {
  return construirEnlaces(docs).get(String(doc?.id)) ?? null;
}

/** Normaliza una ruta pedida: decodifica, quita barras sobrantes y pasa a minúsculas. */
export function normalizarRuta(ruta) {
  let r = String(ruta ?? "");
  try {
    r = decodeURIComponent(r);
  } catch {
    // Se queda como vino; simplemente no coincidirá con ningún documento.
  }
  return r.trim().toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "");
}

/**
 * Busca el documento cuya ruta pública es `ruta`. Devuelve el documento o null.
 * También acepta la forma con sufijo de un documento que hoy tiene el nombre limpio: si se borra el
 * más antiguo de dos con el mismo título, el enlace con sufijo que ya se había compartido sigue
 * funcionando.
 */
export function resolverDocumento(docs, ruta) {
  const buscada = normalizarRuta(ruta);
  const lista = (Array.isArray(docs) ? docs : []).filter((d) => d && d.id != null);
  for (const [id, r] of construirEnlaces(lista)) {
    if (r === buscada) return lista.find((d) => String(d.id) === id) ?? null;
  }
  for (const d of lista) {
    const alias = `${RUTA_SEVAC}/${anioDe(d)}/${periodoDe(d)}/${nombreLegible(d.titulo)}-${sufijoDe(d)}.${extensionDe(d)}`;
    if (alias === buscada) return d;
  }
  return null;
}

/** true si la URL del archivo es https y de un origen permitido (defensa ante datos inesperados). */
export function origenPermitido(url) {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && HOSTS_PERMITIDOS.includes(u.hostname);
  } catch {
    return false;
  }
}

/** Nombre con el que se descarga el archivo: el último tramo de la ruta pública. */
export function nombreDeDescarga(rutaPublica) {
  return String(rutaPublica ?? "").split("/").pop() || "documento.pdf";
}
