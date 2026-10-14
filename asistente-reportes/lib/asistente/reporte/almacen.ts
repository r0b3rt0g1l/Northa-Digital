// Almacén del asistente sobre Supabase (PostgREST) usando fetch, sin dependencias.
// Se usa solo desde el servidor con la service key.

import type { ConversacionRegistrada, MensajeRegistrado, Reporte, ReporteGuardado, RolMensaje } from "./tipos";
import { rangoPeriodo } from "./periodo";

export interface NuevoTurno {
  conversacionId?: string;
  municipio: string;
  correoCiudadano?: string | null;
  pregunta: string;
  respuesta: string;
  secciones?: string[];
}

export interface AlmacenAsistente {
  /** Guarda pregunta y respuesta; crea la conversación si no existe. Devuelve el id. */
  guardarTurno(turno: NuevoTurno): Promise<string>;
  marcarEscalada(conversacionId: string): Promise<void>;
  conversacionesDelPeriodo(municipio: string, periodo: string): Promise<ConversacionRegistrada[]>;
  guardarReporte(municipio: string, periodo: string, reporte: Reporte, html: string): Promise<ReporteGuardado>;
  marcarEnviado(id: string, destinatarios: string[]): Promise<void>;
  listarReportes(municipio: string): Promise<Array<Pick<ReporteGuardado, "id" | "periodo" | "generadoEn" | "enviadoA" | "enviadoEn">>>;
  obtenerReporte(municipio: string, periodo: string): Promise<ReporteGuardado | null>;
  /** Borra conversaciones (y sus mensajes) iniciadas antes de la fecha. Devuelve cuántas. */
  purgarAnterioresA(municipio: string, fecha: Date): Promise<number>;
}

export interface OpcionesSupabase {
  url: string;
  serviceKey: string;
  fetchImpl?: typeof fetch;
}

export function crearAlmacenSupabase(op: OpcionesSupabase): AlmacenAsistente {
  const base = op.url.replace(/\/+$/, "") + "/rest/v1";
  const f = op.fetchImpl ?? fetch;

  async function pedir<T>(ruta: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
    const { prefer, ...resto } = init;
    const res = await f(base + ruta, {
      ...resto,
      headers: {
        apikey: op.serviceKey,
        Authorization: `Bearer ${op.serviceKey}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
        ...(resto.headers ?? {}),
      },
    });
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => "");
      throw new Error(`Supabase ${res.status} en ${ruta}: ${cuerpo.slice(0, 300)}`);
    }
    if (res.status === 204) return undefined as T;
    const texto = await res.text();
    return (texto ? JSON.parse(texto) : undefined) as T;
  }

  return {
    async guardarTurno(t) {
      let id = t.conversacionId;
      if (!id) {
        const [fila] = await pedir<Array<{ id: string }>>("/conversaciones", {
          method: "POST",
          prefer: "return=representation",
          body: JSON.stringify({ municipio: t.municipio, correo_ciudadano: t.correoCiudadano ?? null }),
        });
        id = fila.id;
      } else if (t.correoCiudadano) {
        await pedir("/conversaciones?id=eq." + id + "&correo_ciudadano=is.null", {
          method: "PATCH",
          prefer: "return=minimal",
          body: JSON.stringify({ correo_ciudadano: t.correoCiudadano }),
        });
      }
      const ahora = Date.now();
      await pedir("/mensajes", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify([
          { conversacion_id: id, rol: "ciudadano", texto: t.pregunta, secciones: [], creado_en: new Date(ahora).toISOString() },
          { conversacion_id: id, rol: "asistente", texto: t.respuesta, secciones: t.secciones ?? [], creado_en: new Date(ahora + 1).toISOString() },
        ]),
      });
      return id;
    },

    async marcarEscalada(conversacionId) {
      await pedir("/conversaciones?id=eq." + conversacionId, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({ escalada: true }),
      });
    },

    async conversacionesDelPeriodo(municipio, periodo) {
      const { inicio, fin } = rangoPeriodo(periodo);
      const q = new URLSearchParams({
        select: "id,municipio,correo_ciudadano,iniciada_en,ultima_actividad,escalada,mensajes(id,conversacion_id,rol,texto,secciones,creado_en)",
        municipio: "eq." + municipio,
        and: `(iniciada_en.gte.${inicio.toISOString()},iniciada_en.lt.${fin.toISOString()})`,
        order: "iniciada_en.asc",
        limit: "10000",
      });
      const filas = await pedir<FilaConversacion[]>("/conversaciones?" + q.toString());
      return filas.map(aConversacion);
    },

    async guardarReporte(municipio, periodo, reporte, html) {
      const [fila] = await pedir<FilaReporte[]>("/reportes?on_conflict=municipio,periodo", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify({ municipio, periodo, html, json: reporte, generado_en: reporte.generadoEn }),
      });
      return aReporte(fila);
    },

    async marcarEnviado(id, destinatarios) {
      await pedir("/reportes?id=eq." + id, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({ enviado_a: destinatarios, enviado_en: new Date().toISOString() }),
      });
    },

    async listarReportes(municipio) {
      const q = new URLSearchParams({
        select: "id,periodo,generado_en,enviado_a,enviado_en",
        municipio: "eq." + municipio,
        order: "periodo.desc",
      });
      const filas = await pedir<Array<Pick<FilaReporte, "id" | "periodo" | "generado_en" | "enviado_a" | "enviado_en">>>("/reportes?" + q.toString());
      return filas.map((r) => ({
        id: r.id,
        periodo: r.periodo,
        generadoEn: r.generado_en,
        enviadoA: r.enviado_a ?? [],
        enviadoEn: r.enviado_en,
      }));
    },

    async obtenerReporte(municipio, periodo) {
      const q = new URLSearchParams({ select: "*", municipio: "eq." + municipio, periodo: "eq." + periodo, limit: "1" });
      const filas = await pedir<FilaReporte[]>("/reportes?" + q.toString());
      return filas[0] ? aReporte(filas[0]) : null;
    },

    async purgarAnterioresA(municipio, fecha) {
      const q = new URLSearchParams({ municipio: "eq." + municipio, iniciada_en: "lt." + fecha.toISOString(), select: "id" });
      const borradas = await pedir<Array<{ id: string }>>("/conversaciones?" + q.toString(), {
        method: "DELETE",
        prefer: "return=representation",
      });
      return borradas.length;
    },
  };
}

interface FilaMensaje {
  id: string;
  conversacion_id: string;
  rol: RolMensaje;
  texto: string;
  secciones: unknown;
  creado_en: string;
}

interface FilaConversacion {
  id: string;
  municipio: string;
  correo_ciudadano: string | null;
  iniciada_en: string;
  ultima_actividad: string;
  escalada: boolean;
  mensajes: FilaMensaje[];
}

interface FilaReporte {
  id: string;
  municipio: string;
  periodo: string;
  generado_en: string;
  html: string;
  json: Reporte;
  enviado_a: string[] | null;
  enviado_en: string | null;
}

function aConversacion(f: FilaConversacion): ConversacionRegistrada {
  return {
    id: f.id,
    municipio: f.municipio,
    correoCiudadano: f.correo_ciudadano,
    iniciadaEn: f.iniciada_en,
    ultimaActividad: f.ultima_actividad,
    escalada: f.escalada,
    mensajes: (f.mensajes ?? []).map(aMensaje),
  };
}

function aMensaje(f: FilaMensaje): MensajeRegistrado {
  return {
    id: f.id,
    conversacionId: f.conversacion_id,
    rol: f.rol,
    texto: f.texto,
    secciones: Array.isArray(f.secciones) ? f.secciones.map(String) : [],
    creadoEn: f.creado_en,
  };
}

function aReporte(f: FilaReporte): ReporteGuardado {
  return {
    id: f.id,
    municipio: f.municipio,
    periodo: f.periodo,
    generadoEn: f.generado_en,
    html: f.html,
    json: f.json,
    enviadoA: f.enviado_a ?? [],
    enviadoEn: f.enviado_en,
  };
}

/** Lee la configuración de entorno; devuelve null si el almacén no está configurado. */
export function almacenDesdeEntorno(env: Record<string, string | undefined> = process.env): AlmacenAsistente | null {
  const url = env.ASISTENTE_SUPABASE_URL;
  const serviceKey = env.ASISTENTE_SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return null;
  return crearAlmacenSupabase({ url, serviceKey });
}
