import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReporteHtml } from "./plantilla";
import { generarReporte } from "./generar";

const identidad = { nombre: "Aconchi", escudoUrl: "https://aconchi.gob.mx/escudo.png", color: "#7a1f2b" };

test("renderReporteHtml escapa texto y usa la identidad", () => {
  const reporte = generarReporte({
    municipio: "aconchi",
    periodo: "2026-09",
    conversaciones: [
      {
        id: "a",
        municipio: "aconchi",
        correoCiudadano: "vecina@correo.mx",
        iniciadaEn: "2026-09-02T15:00:00Z",
        ultimaActividad: "2026-09-02T15:00:00Z",
        escalada: true,
        mensajes: [
          { id: "1", conversacionId: "a", rol: "ciudadano", texto: "<script>alert(1)</script>\nsegunda línea", secciones: [], creadoEn: "2026-09-02T15:00:00Z" },
          { id: "2", conversacionId: "a", rol: "asistente", texto: "Respuesta", secciones: ["Trámites"], creadoEn: "2026-09-02T15:00:05Z" },
        ],
      },
    ],
  });
  const html = renderReporteHtml(reporte, identidad);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;<br>segunda línea"));
  assert.ok(html.includes("Septiembre de 2026"));
  assert.ok(html.includes("#7a1f2b"));
  assert.ok(html.includes("https://aconchi.gob.mx/escudo.png"));
  assert.ok(html.includes("escalada a una persona"));
  assert.ok(html.includes("Fuente: Trámites"));
});

test("renderReporteHtml con mes vacío y color inválido", () => {
  const reporte = generarReporte({ municipio: "aconchi", periodo: "2026-09", conversaciones: [] });
  const html = renderReporteHtml(reporte, { ...identidad, color: "rojo" });
  assert.ok(html.includes("No hubo conversaciones"));
  assert.ok(!html.includes("rojo"));
  assert.ok(html.includes("#3b3b3b"));
});
