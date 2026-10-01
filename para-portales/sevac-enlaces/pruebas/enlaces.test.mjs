import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  RUTA_SEVAC,
  nombreLegible,
  periodoDe,
  anioDe,
  extensionDe,
  sufijoDe,
  construirEnlaces,
  enlaceDe,
  resolverDocumento,
  origenPermitido,
  nombreDeDescarga,
} from "../lib/sevac/enlaces.js";

const datos = (s) => JSON.parse(fs.readFileSync(new URL(`./datos/${s}.json`, import.meta.url), "utf8"));
const MUNICIPIOS = ["bacadehuachi", "banamichi", "tepache", "aconchi"];

test("nombre legible a partir del título", () => {
  assert.equal(nombreLegible("MANTENIMIENTO DE PUENTE PEATONAL"), "mantenimiento-de-puente-peatonal");
  assert.equal(nombreLegible("D.3.1 Estado Analítico de Ingresos.pdf"), "d-3-1-estado-analitico-de-ingresos");
  assert.equal(nombreLegible("D.1.19 información de obligaciones pagadas/garantizadas"), "d-1-19-informacion-de-obligaciones-pagadas-garantizadas");
  assert.equal(nombreLegible("Año de la Niñez"), "ano-de-la-ninez");
  assert.equal(nombreLegible("  ¿?  "), "documento");
  assert.equal(nombreLegible(null), "documento");
  const largo = nombreLegible("REHABILITACION DE RED DE ALUMBRADO PUBLICO EN EL MUNICIPIO DE BACADEHUACHI, SONORA, OBRA NUMERO 12 DEL PROGRAMA");
  assert.ok(largo.length <= 90, largo);
  assert.ok(!largo.endsWith("-"));
  assert.match(largo, /^rehabilitacion-de-red-de-alumbrado-publico/);
});

test("año, periodo y extensión", () => {
  assert.equal(anioDe({ anio: 2026 }), "2026");
  assert.equal(anioDe({ anio: "2025" }), "2025");
  assert.equal(anioDe({ anio: null }), "sin-anio");
  assert.equal(periodoDe({ trimestre: "2" }), "t2");
  assert.equal(periodoDe({ trimestre: 4 }), "t4");
  assert.equal(periodoDe({ trimestre: null }), "anual");
  assert.equal(periodoDe({ trimestre: "5" }), "anual");
  assert.equal(extensionDe({ archivoUrl: "https://archivos.northadigital.com/a/b/c.PDF" }), "pdf");
  assert.equal(extensionDe({ archivoUrl: "https://x/y/sin-extension", mimeType: "application/vnd.ms-excel" }), "pdf", "el mimeType no cuenta: el documento normalizado no lo trae");
  assert.equal(extensionDe({ archivoUrl: "no es url" }), "pdf");
});

test("el ejemplo que pediste: Bacadéhuachi, puente peatonal", () => {
  const docs = datos("bacadehuachi");
  const puente = docs.find((d) => d.titulo === "MANTENIMIENTO DE PUENTE PEATONAL");
  assert.equal(enlaceDe(puente, docs), `${RUTA_SEVAC}/2026/t2/mantenimiento-de-puente-peatonal.pdf`);
  assert.equal(resolverDocumento(docs, "/transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal.pdf").id, puente.id);
});

for (const m of MUNICIPIOS) {
  test(`${m}: cada documento tiene una ruta única que vuelve a él`, () => {
    const docs = datos(m);
    const enlaces = construirEnlaces(docs);
    assert.equal(enlaces.size, docs.length);
    assert.equal(new Set(enlaces.values()).size, docs.length, "rutas repetidas");
    for (const d of docs) {
      const r = enlaces.get(String(d.id));
      assert.match(r, /^\/transparencia\/sevac\/\d{4}\/(t[1-4]|anual)\/[a-z0-9-]+\.[a-z0-9]+$/, r);
      assert.equal(resolverDocumento(docs, r)?.id, d.id, r);
      assert.equal(resolverDocumento(docs, r.toUpperCase())?.id, d.id, "sin distinguir mayúsculas");
    }
  });
}

test("determinista: el orden del listado no cambia las rutas", () => {
  const docs = datos("tepache");
  const a = construirEnlaces(docs);
  const b = construirEnlaces([...docs].reverse());
  assert.deepEqual([...a].sort(), [...b].sort());
});

test("títulos repetidos: el más antiguo conserva el nombre limpio; los demás llevan sufijo fijo", () => {
  const base = { anio: 2026, trimestre: "3", titulo: "ACTAS DE CABILDO" };
  const a = { ...base, id: "aaaa1111-0000", creadoEn: "2026-09-17T22:55:17.778Z", archivoUrl: "https://archivos.northadigital.com/cms-municipal/x/transparencia/sevac/26470bd4-2d30-4ad3-95d8-bd52d8ead652.pdf" };
  const b = { ...base, id: "bbbb2222-0000", creadoEn: "2026-10-05T10:00:00.000Z", archivoUrl: "https://archivos.northadigital.com/cms-municipal/x/transparencia/sevac/9f00aa11-0000-4000-8000-000000000000.pdf" };
  const solo = construirEnlaces([a]);
  const ambos = construirEnlaces([b, a]);
  assert.equal(solo.get(a.id), "/transparencia/sevac/2026/t3/actas-de-cabildo.pdf");
  assert.equal(ambos.get(a.id), solo.get(a.id), "subir otro con el mismo título no cambia el enlace del primero");
  assert.equal(ambos.get(b.id), "/transparencia/sevac/2026/t3/actas-de-cabildo-9f00aa11.pdf");
  // Mismo título en otro trimestre: no choca.
  const c = { ...a, id: "cccc", trimestre: "2" };
  assert.equal(construirEnlaces([a, c]).get(c.id), "/transparencia/sevac/2026/t2/actas-de-cabildo.pdf");
});

test("un sufijo nunca le quita el nombre a otro documento", () => {
  const url = (n) => `https://archivos.northadigital.com/s/${n}.pdf`;
  const viejo = { id: "1", anio: 2026, trimestre: "1", titulo: "Informe", creadoEn: "2026-01-01", archivoUrl: url("abcdef12-0000") };
  const nuevo = { id: "2", anio: 2026, trimestre: "1", titulo: "Informe", creadoEn: "2026-02-01", archivoUrl: url("11112222-0000") };
  // Un tercero cuyo título produce justo el nombre con sufijo del segundo.
  const tramposo = { id: "3", anio: 2026, trimestre: "1", titulo: "Informe 11112222", creadoEn: "2026-03-01", archivoUrl: url("99998888") };
  const e = construirEnlaces([viejo, nuevo, tramposo]);
  assert.equal(e.get("3"), "/transparencia/sevac/2026/t1/informe-11112222.pdf");
  assert.notEqual(e.get("2"), e.get("3"));
  assert.equal(new Set(e.values()).size, 3);
});

test("sufijo: del UUID de R2 o del id de Cloudinary", () => {
  assert.equal(sufijoDe({ archivoUrl: "https://archivos.northadigital.com/a/18accabf-ce54-4a6c-acc1-6a7fb533d8fd.pdf" }), "18accabf");
  assert.equal(sufijoDe({ archivoUrl: "https://res.cloudinary.com/x/image/upload/v1/a/xzbjutnygqwugesgsvem.pdf" }), "xzbjutny");
  assert.equal(sufijoDe({ id: "AB-12", archivoUrl: "https://x/a/q.pdf" }), "qab12");
});

test("rutas que no existen o mal formadas no resuelven", () => {
  const docs = datos("bacadehuachi");
  for (const r of ["/transparencia/sevac/2026/t2/no-existe.pdf", "/transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal", "/transparencia/sevac/2025/t2/mantenimiento-de-puente-peatonal.pdf", "/transparencia/sevac/%E0%A4%A.pdf", "", null]) {
    assert.equal(resolverDocumento(docs, r), null, String(r));
  }
  assert.equal(resolverDocumento(null, "/x"), null);
  assert.ok(resolverDocumento(docs, "/transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal.pdf/"), "acepta barra final");
});

test("solo se sirven archivos https de R2 y Cloudinary", () => {
  assert.ok(origenPermitido("https://archivos.northadigital.com/cms-municipal/a.pdf"));
  assert.ok(origenPermitido("https://res.cloudinary.com/dtpxt4a2p/image/upload/a.pdf"));
  for (const u of ["http://archivos.northadigital.com/a.pdf", "https://evil.com/a.pdf", "https://archivos.northadigital.com.evil.com/a.pdf", "file:///etc/passwd", "", null]) {
    assert.ok(!origenPermitido(u), String(u));
  }
});

test("nombre de descarga", () => {
  assert.equal(nombreDeDescarga("/transparencia/sevac/2026/t2/puente.pdf"), "puente.pdf");
  assert.equal(nombreDeDescarga(null), "documento.pdf");
});

// El portal calcula los enlaces con el documento ya normalizado (url, nombreArchivo) y la ruta que
// sirve el archivo con el crudo de la API (archivoUrl, fileName). Tienen que coincidir siempre.
const normalizar = (d) => ({ id: d.id, titulo: d.titulo, descripcion: d.descripcion, url: d.archivoUrl, nombreArchivo: d.fileName, categoria: d.categoria, tipo: d.tipo, anio: d.anio, trimestre: d.trimestre, creadoEn: d.creadoEn, actualizadoEn: d.actualizadoEn });
for (const m of MUNICIPIOS) {
  test(`${m}: documento crudo y normalizado dan la misma ruta`, () => {
    const crudos = datos(m);
    assert.deepEqual([...construirEnlaces(crudos.map(normalizar))], [...construirEnlaces(crudos)]);
  });
}

test("si se borra el más antiguo, el enlace con sufijo ya compartido sigue funcionando", () => {
  const url = (n) => `https://archivos.northadigital.com/s/${n}.pdf`;
  const viejo = { id: "1", anio: 2026, trimestre: "3", titulo: "Actas de cabildo", creadoEn: "2026-07-01", archivoUrl: url("aaaa0000-1") };
  const nuevo = { id: "2", anio: 2026, trimestre: "3", titulo: "Actas de cabildo", creadoEn: "2026-08-01", archivoUrl: url("bbbb1111-2") };
  const compartido = construirEnlaces([viejo, nuevo]).get("2");
  assert.equal(compartido, "/transparencia/sevac/2026/t3/actas-de-cabildo-bbbb1111.pdf");
  assert.equal(construirEnlaces([nuevo]).get("2"), "/transparencia/sevac/2026/t3/actas-de-cabildo.pdf");
  assert.equal(resolverDocumento([nuevo], compartido)?.id, "2");
});

test("extensión desde el nombre original si la URL no la trae", () => {
  assert.equal(extensionDe({ archivoUrl: "https://archivos.northadigital.com/a/sin-ext", fileName: "Tabla.XLSX" }), "xlsx");
  assert.equal(extensionDe({ url: "https://archivos.northadigital.com/a/sin-ext", nombreArchivo: "Tabla.xlsx" }), "xlsx");
  assert.equal(extensionDe({ url: "/transparencia/sevac/ya-relativa" }), "pdf");
});
