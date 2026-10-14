import { test } from "node:test";
import assert from "node:assert/strict";
import { generarReporte } from "./generar";
import { fechaLocal, nombrePeriodo, periodoAnterior, rangoPeriodo } from "./periodo";
import type { ConversacionRegistrada } from "./tipos";

function conversacion(
  id: string,
  iniciadaEn: string,
  extra: Partial<ConversacionRegistrada> = {},
): ConversacionRegistrada {
  return {
    id,
    municipio: "aconchi",
    correoCiudadano: `${id}@correo.mx`,
    iniciadaEn,
    ultimaActividad: iniciadaEn,
    escalada: false,
    mensajes: [
      { id: `${id}-1`, conversacionId: id, rol: "ciudadano", texto: "¿Horario?", secciones: [], creadoEn: iniciadaEn },
      { id: `${id}-2`, conversacionId: id, rol: "asistente", texto: "De 8 a 15.", secciones: ["Trámites"], creadoEn: iniciadaEn },
    ],
    ...extra,
  };
}

test("rangoPeriodo usa UTC-7 (Sonora) y fin exclusivo", () => {
  const { inicio, fin } = rangoPeriodo("2026-09");
  assert.equal(inicio.toISOString(), "2026-09-01T07:00:00.000Z");
  assert.equal(fin.toISOString(), "2026-10-01T07:00:00.000Z");
  assert.throws(() => rangoPeriodo("2026-13"));
  assert.throws(() => rangoPeriodo("sept"));
});

test("periodoAnterior respeta la hora de Sonora en el cambio de mes", () => {
  // 1 de octubre 03:00 UTC sigue siendo 30 de septiembre en Sonora → mes anterior = agosto.
  assert.equal(periodoAnterior(new Date("2026-10-01T03:00:00Z")), "2026-08");
  // 1 de octubre 13:00 UTC ya es 1 de octubre en Sonora → mes anterior = septiembre.
  assert.equal(periodoAnterior(new Date("2026-10-01T13:00:00Z")), "2026-09");
  assert.equal(periodoAnterior(new Date("2027-01-15T12:00:00Z")), "2026-12");
});

test("fechaLocal y nombrePeriodo", () => {
  assert.equal(fechaLocal("2026-09-01T03:00:00Z"), "2026-08-31");
  assert.equal(nombrePeriodo("2026-09"), "Septiembre de 2026");
});

test("generarReporte filtra por municipio y periodo, y ordena", () => {
  const reporte = generarReporte({
    municipio: "aconchi",
    periodo: "2026-09",
    ahora: new Date("2026-10-01T13:00:00Z"),
    conversaciones: [
      conversacion("b", "2026-09-20T18:00:00Z"),
      conversacion("a", "2026-09-02T15:00:00Z"),
      conversacion("fuera-antes", "2026-08-31T20:00:00Z"), // 31 ago 13:00 Sonora
      conversacion("fuera-despues", "2026-10-01T07:00:00Z"), // 1 oct 00:00 Sonora
      conversacion("otro", "2026-09-10T15:00:00Z", { municipio: "rayon" }),
    ],
  });
  assert.deepEqual(
    reporte.transcripciones.map((c) => c.id),
    ["a", "b"],
  );
  assert.equal(reporte.generadoEn, "2026-10-01T13:00:00.000Z");
  assert.equal(reporte.resumen.conversaciones, 2);
});

test("generarReporte calcula métricas, temas y días", () => {
  const reporte = generarReporte({
    municipio: "aconchi",
    periodo: "2026-09",
    conversaciones: [
      conversacion("a", "2026-09-02T15:00:00Z", { escalada: true }),
      conversacion("b", "2026-09-02T20:00:00Z", { correoCiudadano: "A@correo.mx" }),
      conversacion("c", "2026-09-15T20:00:00Z", {
        correoCiudadano: null,
        mensajes: [
          { id: "c-1", conversacionId: "c", rol: "ciudadano", texto: "Agua", secciones: [], creadoEn: "2026-09-15T20:00:00Z" },
          { id: "c-2", conversacionId: "c", rol: "asistente", texto: "...", secciones: ["Servicios", "Trámites", "Servicios"], creadoEn: "2026-09-15T20:00:10Z" },
          { id: "c-3", conversacionId: "c", rol: "ciudadano", texto: "Gracias", secciones: [], creadoEn: "2026-09-15T20:01:00Z" },
          { id: "c-4", conversacionId: "c", rol: "asistente", texto: "De nada", secciones: [""], creadoEn: "2026-09-15T20:01:05Z" },
        ],
      }),
    ],
  });
  const r = reporte.resumen;
  assert.equal(r.mensajes, 8);
  assert.equal(r.mensajesCiudadano, 4);
  assert.equal(r.mensajesAsistente, 4);
  assert.equal(r.escalamientos, 1);
  // "a@correo.mx" y "A@correo.mx" son la misma persona; "c" no dejó correo.
  assert.equal(r.ciudadanosUnicos, 1);
  assert.equal(r.promedioMensajes, 2.7);
  assert.deepEqual(r.temas, [
    { seccion: "Trámites", consultas: 3 },
    { seccion: "Servicios", consultas: 1 },
  ]);
  assert.deepEqual(r.porDia, [
    { fecha: "2026-09-02", conversaciones: 2 },
    { fecha: "2026-09-15", conversaciones: 1 },
  ]);
});

test("generarReporte con mes vacío", () => {
  const reporte = generarReporte({ municipio: "aconchi", periodo: "2026-09", conversaciones: [] });
  assert.equal(reporte.transcripciones.length, 0);
  assert.equal(reporte.resumen.promedioMensajes, 0);
  assert.deepEqual(reporte.resumen.temas, []);
});

test("generarReporte ordena mensajes dentro de cada conversación", () => {
  const reporte = generarReporte({
    municipio: "aconchi",
    periodo: "2026-09",
    conversaciones: [
      conversacion("a", "2026-09-02T15:00:00Z", {
        mensajes: [
          { id: "2", conversacionId: "a", rol: "asistente", texto: "R", secciones: [], creadoEn: "2026-09-02T15:00:05Z" },
          { id: "1", conversacionId: "a", rol: "ciudadano", texto: "P", secciones: [], creadoEn: "2026-09-02T15:00:00Z" },
        ],
      }),
    ],
  });
  assert.deepEqual(reporte.transcripciones[0].mensajes.map((m) => m.id), ["1", "2"]);
});
