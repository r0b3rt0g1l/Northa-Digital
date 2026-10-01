// Sirve un documento SEvAC desde el dominio del municipio.
//
// GET /transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal.pdf
//   1. Pide a la API el listado SEvAC del municipio (caché de datos de Next, 5 min, tag
//      "<slug>:sevac"; si el documento no aparece, lo vuelve a pedir sin caché por si se acaba
//      de subir).
//   2. Busca el documento cuya ruta pública coincide (ver enlaces.js).
//   3. Trae el archivo de su origen (R2 o Cloudinary) y lo pasa tal cual, en streaming, con
//      soporte de Range (el visor de PDF del navegador pide el archivo por partes) y con
//      Content-Disposition inline y un nombre legible.
// La dirección del navegador nunca cambia: no hay redirección a archivos.northadigital.com.
//
// Por qué streaming: una respuesta de función en Vercel no puede pasar de 4.5 MB salvo en
// streaming, y hay documentos SEvAC de hasta 90 MB.

import {
  RUTA_SEVAC,
  extensionDe,
  normalizarRuta,
  origenPermitido,
  resolverDocumento,
  construirEnlaces,
  nombreDeDescarga,
  urlDelArchivo,
} from "./enlaces.js";

export const API_POR_DEFECTO = "https://api.northadigital.com";
export const REVALIDAR_S = 300;
const ESPERA_API_MS = 30_000; // igual que cmsFetch: la API puede tardar si Render arranca en frío
const CABECERAS_DEL_ORIGEN = ["content-length", "content-range", "accept-ranges", "etag", "last-modified"];
const CABECERAS_CONDICIONALES = ["if-none-match", "if-modified-since", "if-range"];
const ESTADOS_VALIDOS = new Set([200, 206, 304, 416]);
const TIPOS = { pdf: "application/pdf", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

function pagina(estado, titulo, texto, metodo) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title><style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:0 1rem;color:#1a1a1a;line-height:1.5}a{color:inherit}</style></head><body><h1>${titulo}</h1><p>${texto}</p><p><a href="${RUTA_SEVAC}">Ver todos los documentos SEvAC</a></p></body></html>`;
  return new Response(metodo === "HEAD" ? null : html, {
    status: estado,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

const noEncontrado = (metodo) =>
  pagina(404, "Documento no encontrado", "No encontramos este documento. Puede que lo hayan movido o que su título haya cambiado.", metodo);
const noDisponible = (estado, metodo) =>
  pagina(estado, "Documento no disponible por el momento", "No pudimos traer el documento. Intenta de nuevo en unos minutos.", metodo);

/**
 * Crea el manejador de la ruta. `municipio` es el slug del municipio en el CMS y `api` la URL
 * base de la API (en el portal: NEXT_PUBLIC_MUNICIPIO_SLUG y NEXT_PUBLIC_API_URL, como cms.ts).
 * `fetchImpl` existe para las pruebas; en el portal se usa el fetch de Next.
 * Si falta la configuración no rompe el build: responde 503 al pedir un documento.
 */
export function crearManejador({ municipio, api, fetchImpl = globalThis.fetch, revalidar = REVALIDAR_S } = {}) {
  const configurado = /^[a-z0-9-]+$/.test(String(municipio ?? "")) && municipio !== "municipio";
  const base = String(api || API_POR_DEFECTO).replace(/\/+$/, "");

  async function listar(fresco) {
    const opciones = { headers: { accept: "application/json" }, signal: AbortSignal.timeout(ESPERA_API_MS) };
    if (fresco) opciones.cache = "no-store";
    else opciones.next = { revalidate: revalidar, tags: [`${municipio}:sevac`] };
    const r = await fetchImpl(`${base}/api/municipios/${municipio}/sevac`, opciones);
    if (!r.ok) throw new Error(`API respondió ${r.status}`);
    const datos = await r.json();
    if (Array.isArray(datos)) return datos;
    if (Array.isArray(datos?.data)) return datos.data;
    throw new Error("respuesta de la API sin listado");
  }

  return async function manejar(request) {
    const metodo = request.method === "HEAD" ? "HEAD" : "GET";
    // Se usa la ruta pedida, no los params: así no importa cómo se llamen las carpetas dinámicas.
    const ruta = normalizarRuta(new URL(request.url).pathname);
    if (!ruta.startsWith(`${RUTA_SEVAC}/`)) return noEncontrado(metodo);
    if (!configurado) return noDisponible(503, metodo);

    let docs;
    let doc = null;
    try {
      docs = await listar(false);
      doc = resolverDocumento(docs, ruta);
      if (!doc) {
        docs = await listar(true);
        doc = resolverDocumento(docs, ruta);
      }
    } catch {
      return noDisponible(503, metodo);
    }
    const archivo = urlDelArchivo(doc);
    if (!doc || !origenPermitido(archivo)) return noEncontrado(metodo);

    const cabeceras = {};
    const rango = request.headers.get("range");
    if (rango && /^bytes=[\d\s,-]+$/i.test(rango)) cabeceras.range = rango;
    for (const h of CABECERAS_CONDICIONALES) {
      const v = request.headers.get(h);
      if (v) cabeceras[h] = v;
    }

    let origen;
    try {
      // Sin caché de datos (los archivos pueden pesar decenas de MB) y sin seguir redirecciones.
      origen = await fetchImpl(archivo, { method: metodo, headers: cabeceras, cache: "no-store", redirect: "manual" });
    } catch {
      return noDisponible(502, metodo);
    }
    if (origen.status === 404 || origen.status === 410) return noEncontrado(metodo);
    if (!ESTADOS_VALIDOS.has(origen.status)) return noDisponible(502, metodo);

    const salida = new Headers();
    for (const h of CABECERAS_DEL_ORIGEN) {
      const v = origen.headers.get(h);
      if (v) salida.set(h, v);
    }
    const ext = extensionDe(doc);
    const nombre = nombreDeDescarga(construirEnlaces(docs).get(String(doc.id)));
    salida.set("content-type", origen.headers.get("content-type") || TIPOS[ext] || "application/octet-stream");
    salida.set("content-disposition", `inline; filename="${nombre}"`);
    salida.set("x-content-type-options", "nosniff");
    // Solo caché del navegador; la CDN de Vercel no guarda archivos tan grandes de una función.
    salida.set("cache-control", origen.status === 200 && !cabeceras.range ? "public, max-age=300" : "no-store");

    const sinCuerpo = metodo === "HEAD" || origen.status === 304;
    if (sinCuerpo && origen.body) await origen.body.cancel().catch(() => {});
    return new Response(sinCuerpo ? null : origen.body, { status: origen.status, headers: salida });
  };
}
