import { test } from "node:test";
import assert from "node:assert/strict";
import { ejecutarReporteMensual } from "./ejecutar";
import type { AlmacenAsistente } from "./almacen";
import type { Reporte, ReporteGuardado } from "./tipos";

function almacenFalso(): AlmacenAsistente & { guardado?: ReporteGuardado; enviado?: string[]; purgadoAntesDe?: Date } {
  const a: ReturnType<typeof almacenFalso> = {
    async guardarTurno() { return "x"; },
    async marcarEscalada() {},
    async conversacionesDelPeriodo(municipio, periodo) {
      assert.equal(municipio, "aconchi");
      assert.equal(periodo, "2026-09");
      return [{
        id: "c1", municipio, correoCiudadano: "v@c.mx", iniciadaEn: "2026-09-03T15:00:00Z", ultimaActividad: "2026-09-03T15:00:00Z", escalada: false,
        mensajes: [{ id: "m1", conversacionId: "c1", rol: "ciudadano", texto: "Hola", secciones: [], creadoEn: "2026-09-03T15:00:00Z" }],
      }];
    },
    async guardarReporte(municipio, periodo, reporte: Reporte, html) {
      a.guardado = { id: "r1", municipio, periodo, generadoEn: reporte.generadoEn, html, json: reporte, enviadoA: [], enviadoEn: null };
      return a.guardado;
    },
    async marcarEnviado(_id, destinatarios) { a.enviado = destinatarios; },
    async listarReportes() { return []; },
    async obtenerReporte() { return null; },
    async purgarAnterioresA(_m, fecha) { a.purgadoAntesDe = fecha; return 3; },
  };
  return a;
}

const identidad = { nombre: "Aconchi", escudoUrl: "https://a/escudo.png", color: "#7a1f2b" };

test("ejecutarReporteMensual genera el mes anterior, envía y purga", async () => {
  const almacen = almacenFalso();
  const correos: Array<{ para: string[]; asunto: string }> = [];
  const r = await ejecutarReporteMensual({
    almacen,
    municipio: "aconchi",
    identidad,
    destinatarios: [" admin@aconchi.gob.mx ", "", "sec@aconchi.gob.mx"],
    enviarCorreo: async (c) => { correos.push({ para: c.para, asunto: c.asunto }); },
    ahora: new Date("2026-10-01T13:00:00Z"),
  });
  assert.equal(r.periodo, "2026-09");
  assert.equal(r.reporte.json.resumen.conversaciones, 1);
  assert.deepEqual(correos, [{ para: ["admin@aconchi.gob.mx", "sec@aconchi.gob.mx"], asunto: "Aconchi: reporte del asistente ciudadano, Septiembre de 2026" }]);
  assert.deepEqual(almacen.enviado, ["admin@aconchi.gob.mx", "sec@aconchi.gob.mx"]);
  assert.equal(r.conversacionesPurgadas, 3);
  assert.equal(almacen.purgadoAntesDe?.toISOString(), "2025-10-01T13:00:00.000Z");
});

test("ejecutarReporteMensual con enviar=false y sin retención", async () => {
  const almacen = almacenFalso();
  let enviados = 0;
  const r = await ejecutarReporteMensual({
    almacen, municipio: "aconchi", identidad, destinatarios: ["a@b.mx"], periodo: "2026-09",
    enviarCorreo: async () => { enviados += 1; }, enviar: false, mesesRetencion: 0,
  });
  assert.equal(enviados, 0);
  assert.deepEqual(r.enviadoA, []);
  assert.equal(r.conversacionesPurgadas, 0);
  assert.ok(almacen.guardado?.html.includes("Transcripciones (1)"));
});

test("ejecutarReporteMensual rechaza periodo inválido", async () => {
  await assert.rejects(
    () => ejecutarReporteMensual({ almacen: almacenFalso(), municipio: "aconchi", identidad, destinatarios: [], enviarCorreo: async () => {}, periodo: "2026-9" }),
    /Periodo inválido/,
  );
});
