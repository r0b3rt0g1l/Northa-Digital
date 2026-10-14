import { test } from "node:test";
import assert from "node:assert/strict";
import { crearAlmacenSupabase } from "./almacen";
import { registrarTurno, usarAlmacen } from "./registro";

function fetchFalso(respuestas: Array<{ status?: number; body?: unknown }>) {
  const llamadas: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    const r = respuestas.shift() ?? { status: 200, body: [] };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { f, llamadas };
}

test("guardarTurno crea la conversación y dos mensajes", async () => {
  const { f, llamadas } = fetchFalso([{ body: [{ id: "conv-1" }] }, { status: 201 }]);
  const a = crearAlmacenSupabase({ url: "https://x.supabase.co/", serviceKey: "k", fetchImpl: f });
  const id = await a.guardarTurno({ municipio: "aconchi", correoCiudadano: "v@c.mx", pregunta: "¿Hola?", respuesta: "Hola", secciones: ["Inicio"] });
  assert.equal(id, "conv-1");
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[0].url, "https://x.supabase.co/rest/v1/conversaciones");
  assert.equal((llamadas[0].init.headers as Record<string, string>).Authorization, "Bearer k");
  const mensajes = JSON.parse(String(llamadas[1].init.body));
  assert.equal(mensajes.length, 2);
  assert.equal(mensajes[0].rol, "ciudadano");
  assert.equal(mensajes[1].rol, "asistente");
  assert.deepEqual(mensajes[1].secciones, ["Inicio"]);
  assert.equal(mensajes[0].conversacion_id, "conv-1");
});

test("conversacionesDelPeriodo filtra por municipio y rango, y traduce filas", async () => {
  const { f, llamadas } = fetchFalso([
    {
      body: [
        {
          id: "c1", municipio: "aconchi", correo_ciudadano: null, iniciada_en: "2026-09-02T15:00:00Z", ultima_actividad: "2026-09-02T15:00:05Z", escalada: false,
          mensajes: [{ id: "m1", conversacion_id: "c1", rol: "ciudadano", texto: "P", secciones: null, creado_en: "2026-09-02T15:00:00Z" }],
        },
      ],
    },
  ]);
  const a = crearAlmacenSupabase({ url: "https://x.supabase.co", serviceKey: "k", fetchImpl: f });
  const conv = await a.conversacionesDelPeriodo("aconchi", "2026-09");
  const url = new URL(llamadas[0].url);
  assert.equal(url.searchParams.get("municipio"), "eq.aconchi");
  assert.equal(url.searchParams.get("and"), "(iniciada_en.gte.2026-09-01T07:00:00.000Z,iniciada_en.lt.2026-10-01T07:00:00.000Z)");
  assert.equal(conv[0].correoCiudadano, null);
  assert.deepEqual(conv[0].mensajes[0].secciones, []);
});

test("errores de Supabase se propagan con estado y ruta", async () => {
  const { f } = fetchFalso([{ status: 401, body: { message: "no" } }]);
  const a = crearAlmacenSupabase({ url: "https://x.supabase.co", serviceKey: "k", fetchImpl: f });
  await assert.rejects(() => a.listarReportes("aconchi"), /Supabase 401 en \/reportes/);
});

test("registrarTurno nunca lanza y devuelve null sin almacén o con fallo", async () => {
  usarAlmacen(null);
  assert.equal(await registrarTurno({ municipio: "aconchi", pregunta: "a", respuesta: "b" }), null);
  const { f } = fetchFalso([{ status: 500, body: {} }]);
  usarAlmacen(crearAlmacenSupabase({ url: "https://x.supabase.co", serviceKey: "k", fetchImpl: f }));
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(await registrarTurno({ municipio: "aconchi", pregunta: "a", respuesta: "b" }), null);
  } finally {
    console.error = original;
  }
});
