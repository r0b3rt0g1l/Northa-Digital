#!/usr/bin/env node
// verificar-enlaces-sevac.mjs — comprueba en vivo, SOLO LECTURA, que los enlaces SEvAC de un
// portal funcionan después de publicar el cambio.
//
// Para cada documento de la API: calcula su enlace (igual que el portal), lo pide con HEAD al
// dominio del municipio y compara el tamaño con el del archivo original. Además revisa que la
// página /transparencia/sevac ya no publique direcciones de archivos.northadigital.com ni de
// Cloudinary. Con --completo descarga cada archivo entero (prueba el streaming de Vercel con
// archivos de más de 4.5 MB).
//
//   node verificar-enlaces-sevac.mjs bacadehuachi
//   node verificar-enlaces-sevac.mjs --completo bacadehuachi
//   node verificar-enlaces-sevac.mjs --todos
//
// Códigos de salida: 0 todo bien · 1 algún enlace falla · 3 error de red o de argumentos.

import { pathToFileURL } from "node:url";
import { construirEnlaces, urlDelArchivo } from "./lib/sevac-enlaces/enlaces.js";

const API = "https://api.northadigital.com";
const UA = { "user-agent": "verificar-enlaces-sevac/1.0 (solo lectura)" };

async function pedir(url, init = {}, intentos = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, { ...init, headers: { ...UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(120_000) });
    } catch (e) {
      if (i >= intentos) throw e;
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

async function tamano(url, completo) {
  const r = await pedir(url, { method: completo ? "GET" : "HEAD", redirect: "manual" });
  if (completo) {
    const n = (await r.arrayBuffer()).byteLength;
    return { estado: r.status, bytes: n, tipo: r.headers.get("content-type"), redir: r.headers.get("location") };
  }
  return { estado: r.status, bytes: Number(r.headers.get("content-length") ?? -1), tipo: r.headers.get("content-type"), redir: r.headers.get("location") };
}

export async function verificarMunicipio(slug, { completo = false, log = console.log } = {}) {
  const m = await (await pedir(`${API}/api/municipios/${slug}`)).json();
  const sitio = `https://${m.dominio || `${slug}.vercel.app`}`;
  const docs = await (await pedir(`${API}/api/municipios/${slug}/sevac`)).json();
  const enlaces = construirEnlaces(docs);
  log(`\n=== ${slug} (${sitio}) · ${docs.length} documento(s)`);
  let fallas = 0;

  const html = await (await pedir(`${sitio}/transparencia/sevac`)).text();
  const ajenas = (html.match(/\\"url\\":\\"https:\/\/(archivos\.northadigital\.com|res\.cloudinary\.com)[^"\\]*/g) ?? []).length;
  if (ajenas) {
    fallas++;
    log(`  FALLA la página aún publica ${ajenas} dirección(es) de archivos.northadigital.com/Cloudinary`);
  } else log("  OK    la página ya no publica direcciones de archivos.northadigital.com ni Cloudinary");

  for (const d of docs) {
    const ruta = enlaces.get(String(d.id));
    try {
      const [portal, origen] = await Promise.all([tamano(sitio + ruta, completo), tamano(urlDelArchivo(d), completo)]);
      const ok = portal.estado === 200 && !portal.redir && portal.bytes === origen.bytes && /pdf|octet/.test(portal.tipo ?? "");
      if (!ok) fallas++;
      log(`  ${ok ? "OK   " : "FALLA"} ${portal.estado} ${(portal.bytes / 1e6).toFixed(1).padStart(5)} MB  ${sitio}${ruta}${ok ? "" : `  (origen ${origen.estado}, ${origen.bytes} bytes${portal.redir ? `, redirige a ${portal.redir}` : ""})`}`);
    } catch (e) {
      fallas++;
      log(`  FALLA ${sitio}${ruta}: ${e.message}`);
    }
  }
  return fallas;
}

export async function main(argv = process.argv.slice(2)) {
  const completo = argv.includes("--completo");
  let slugs = argv.filter((a) => !a.startsWith("--"));
  try {
    if (argv.includes("--todos")) slugs = (await (await pedir(`${API}/api/municipios`)).json()).map((m) => m.slug);
    if (slugs.length === 0) {
      console.error("Uso: node verificar-enlaces-sevac.mjs [--completo] <slug>... | --todos");
      return 3;
    }
    let fallas = 0;
    for (const s of slugs) fallas += await verificarMunicipio(s, { completo });
    console.log(`\n${fallas === 0 ? "Todo bien" : `${fallas} falla(s)`}`);
    return fallas === 0 ? 0 : 1;
  } catch (e) {
    console.error(`Error de red: ${e.message}`);
    return 3;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then((c) => {
    process.exitCode = c;
  });
}
