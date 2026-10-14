// Generador puro del reporte mensual: no toca red ni base de datos.

import type {
  ConversacionRegistrada,
  ConversacionesPorDia,
  Reporte,
  ResumenReporte,
  TemaConsultado,
} from "./tipos";
import { fechaLocal, rangoPeriodo } from "./periodo";

const MAX_TEMAS = 10;

export interface EntradaReporte {
  municipio: string;
  /** YYYY-MM. */
  periodo: string;
  /** Pueden venir de más meses; se filtran por `iniciadaEn`. */
  conversaciones: ConversacionRegistrada[];
  ahora?: Date;
}

export function generarReporte(entrada: EntradaReporte): Reporte {
  const { municipio, periodo } = entrada;
  const { inicio, fin } = rangoPeriodo(periodo);

  const transcripciones = entrada.conversaciones
    .filter((c) => c.municipio === municipio)
    .filter((c) => {
      const t = new Date(c.iniciadaEn).getTime();
      return t >= inicio.getTime() && t < fin.getTime();
    })
    .map((c) => ({
      ...c,
      mensajes: [...c.mensajes].sort(
        (a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime(),
      ),
    }))
    .sort((a, b) => new Date(a.iniciadaEn).getTime() - new Date(b.iniciadaEn).getTime());

  return {
    resumen: resumir(municipio, periodo, transcripciones),
    transcripciones,
    generadoEn: (entrada.ahora ?? new Date()).toISOString(),
  };
}

function resumir(
  municipio: string,
  periodo: string,
  conversaciones: ConversacionRegistrada[],
): ResumenReporte {
  let mensajes = 0;
  let mensajesCiudadano = 0;
  let mensajesAsistente = 0;
  let escalamientos = 0;
  const correos = new Set<string>();
  const temas = new Map<string, number>();
  const dias = new Map<string, number>();

  for (const c of conversaciones) {
    if (c.escalada) escalamientos += 1;
    const correo = c.correoCiudadano?.trim().toLowerCase();
    if (correo) correos.add(correo);
    const dia = fechaLocal(c.iniciadaEn);
    dias.set(dia, (dias.get(dia) ?? 0) + 1);

    for (const m of c.mensajes) {
      mensajes += 1;
      if (m.rol === "ciudadano") mensajesCiudadano += 1;
      else mensajesAsistente += 1;
      if (m.rol === "asistente") {
        for (const s of new Set(m.secciones.map(normalizarSeccion).filter(Boolean))) {
          temas.set(s, (temas.get(s) ?? 0) + 1);
        }
      }
    }
  }

  const total = conversaciones.length;
  const promedioMensajes = total === 0 ? 0 : Math.round((mensajes / total) * 10) / 10;

  return {
    municipio,
    periodo,
    conversaciones: total,
    mensajes,
    mensajesCiudadano,
    mensajesAsistente,
    ciudadanosUnicos: correos.size,
    escalamientos,
    promedioMensajes,
    temas: ordenarTemas(temas),
    porDia: ordenarDias(dias),
  };
}

function normalizarSeccion(s: string): string {
  return (s ?? "").trim();
}

function ordenarTemas(temas: Map<string, number>): TemaConsultado[] {
  return [...temas.entries()]
    .map(([seccion, consultas]) => ({ seccion, consultas }))
    .sort((a, b) => b.consultas - a.consultas || a.seccion.localeCompare(b.seccion, "es"))
    .slice(0, MAX_TEMAS);
}

function ordenarDias(dias: Map<string, number>): ConversacionesPorDia[] {
  return [...dias.entries()]
    .map(([fecha, conversaciones]) => ({ fecha, conversaciones }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
