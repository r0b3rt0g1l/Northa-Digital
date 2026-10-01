import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { crearManejador } from "../lib/sevac/servir-documento.js";

const DOCS = JSON.parse(fs.readFileSync(new URL("./datos/bacadehuachi.json", import.meta.url), "utf8"));
const PUENTE = DOCS.find((d) => d.titulo === "MANTENIMIENTO DE PUENTE PEATONAL");
const RUTA_PUENTE = "/transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal.pdf";
const SITIO = "https://bacadehuachitransparencia.com.mx";
const PDF = new TextEncoder().encode("%PDF-1.4 contenido de prueba");

// fetch simulado: la API y el origen de archivos. Guarda cada llamada para revisarla.
function fetchFalso({ docs = DOCS, docsFrescos = docs, apiEstado = 200, origen } = {}) {
  const llamadas = [];
  const f = async (url, opciones = {}) => {
    llamadas.push({ url: String(url), opciones });
    if (String(url).startsWith("https://api.northadigital.com/")) {
      if (apiEstado !== 200) return new Response("error", { status: apiEstado });
      return Response.json(opciones.cache === "no-store" ? docsFrescos : docs);
    }
    if (origen) return origen(url, opciones);
    const rango = opciones.headers?.range;
    if (rango === "bytes=0-3") {
      return new Response(PDF.slice(0, 4), { status: 206, headers: { "content-type": "application/pdf", "content-range": `bytes 0-3/${PDF.length}`, "content-length": "4", "accept-ranges": "bytes" } });
    }
    return new Response(opciones.method === "HEAD" ? null : PDF, {
      status: 200,
      headers: { "content-type": "application/pdf", "content-length": String(PDF.length), "accept-ranges": "bytes", etag: '"abc"', "set-cookie": "no=pasar" },
    });
  };
  f.llamadas = llamadas;
  return f;
}

const pedir = (manejar, ruta, init) => manejar(new Request(SITIO + ruta, init));

test("sirve el PDF directo, en el dominio del municipio, con nombre legible", async () => {
  const f = fetchFalso();
  const r = await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: f }), RUTA_PUENTE);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  assert.equal(r.headers.get("content-disposition"), 'inline; filename="mantenimiento-de-puente-peatonal.pdf"');
  assert.equal(r.headers.get("accept-ranges"), "bytes");
  assert.equal(r.headers.get("etag"), '"abc"');
  assert.equal(r.headers.get("set-cookie"), null, "no se copian cabeceras ajenas del origen");
  assert.equal(r.headers.get("location"), null, "no hay redirección");
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), PDF);
  const api = f.llamadas[0];
  assert.equal(api.url, "https://api.northadigital.com/api/municipios/bacadehuachi/sevac");
  assert.deepEqual(api.opciones.next, { revalidate: 300, tags: ["bacadehuachi:sevac"] });
  const archivo = f.llamadas[1];
  assert.equal(archivo.url, PUENTE.archivoUrl);
  assert.equal(archivo.opciones.cache, "no-store", "los archivos no entran a la caché de datos");
  assert.equal(archivo.opciones.redirect, "manual");
});

test("pasa las peticiones por partes (Range) del visor de PDF", async () => {
  const f = fetchFalso();
  const r = await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: f }), RUTA_PUENTE, { headers: { range: "bytes=0-3" } });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), `bytes 0-3/${PDF.length}`);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal((await r.arrayBuffer()).byteLength, 4);
  assert.equal(f.llamadas[1].opciones.headers.range, "bytes=0-3");
});

test("HEAD responde sin cuerpo y con el tamaño", async () => {
  const f = fetchFalso();
  const r = await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: f }), RUTA_PUENTE, { method: "HEAD" });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-length"), String(PDF.length));
  assert.equal(r.body, null);
  assert.equal(f.llamadas[1].opciones.method, "HEAD");
});

test("un documento recién subido se encuentra aunque la caché aún no lo tenga", async () => {
  const f = fetchFalso({ docs: DOCS.filter((d) => d.id !== PUENTE.id), docsFrescos: DOCS });
  const r = await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: f }), RUTA_PUENTE);
  assert.equal(r.status, 200);
  assert.equal(f.llamadas[1].opciones.cache, "no-store", "segunda consulta sin caché");
});

test("404 legible si el documento no existe", async () => {
  const f = fetchFalso();
  const r = await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: f }), "/transparencia/sevac/2026/t2/no-existe.pdf");
  assert.equal(r.status, 404);
  assert.match(r.headers.get("content-type"), /text\/html/);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(await r.text(), /Documento no encontrado[\s\S]*href="\/transparencia\/sevac"/);
  assert.equal(f.llamadas.filter((l) => !l.url.includes("api.northadigital.com")).length, 0, "no toca el origen de archivos");
});

test("nunca sirve archivos de un origen no permitido", async () => {
  const malos = DOCS.map((d) => (d.id === PUENTE.id ? { ...d, archivoUrl: "https://evil.example.com/x.pdf" } : d));
  const f = fetchFalso({ docs: malos });
  const r = await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: f }), RUTA_PUENTE);
  assert.equal(r.status, 404);
  assert.ok(!f.llamadas.some((l) => l.url.includes("evil")));
});

test("API caída: 503, sin romper", async () => {
  const r = await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: fetchFalso({ apiEstado: 500 }) }), RUTA_PUENTE);
  assert.equal(r.status, 503);
  const r2 = await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: async () => { throw new Error("red"); } }), RUTA_PUENTE);
  assert.equal(r2.status, 503);
});

test("origen: 404 se vuelve 404, redirección o error se vuelve 502", async () => {
  for (const [estado, esperado] of [[404, 404], [302, 502], [500, 502], [403, 502]]) {
    const f = fetchFalso({ origen: async () => new Response(null, { status: estado, headers: estado === 302 ? { location: "https://otro" } : {} }) });
    const r = await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: f }), RUTA_PUENTE);
    assert.equal(r.status, esperado, `origen ${estado}`);
    assert.equal(r.headers.get("location"), null);
  }
});

test("rutas fuera de /transparencia/sevac y slug inválido", async () => {
  const f = fetchFalso();
  const r = await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: f }), "/otra/cosa.pdf");
  assert.equal(r.status, 404);
  assert.equal(f.llamadas.length, 0);
  assert.throws(() => crearManejador({ municipio: "../x" }), /slug/);
  assert.throws(() => crearManejador({}), /slug/);
});

test("Range con formato raro no se reenvía", async () => {
  const f2 = fetchFalso();
  await pedir(crearManejador({ municipio: "bacadehuachi", fetchImpl: f2 }), RUTA_PUENTE, { headers: { range: "items=0-3" } });
  assert.equal(f2.llamadas[1].opciones.headers.range, undefined);
});
