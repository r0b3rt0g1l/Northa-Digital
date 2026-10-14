// Tipos del reporte mensual del asistente ciudadano.
// Son independientes de lib/asistente/tipos.ts: el almacén traduce entre ambos.

export type RolMensaje = "ciudadano" | "asistente";

export interface MensajeRegistrado {
  id: string;
  conversacionId: string;
  rol: RolMensaje;
  texto: string;
  /** Secciones o fuentes del sitio que el asistente consultó para responder. */
  secciones: string[];
  /** ISO 8601. */
  creadoEn: string;
}

export interface ConversacionRegistrada {
  id: string;
  municipio: string;
  correoCiudadano: string | null;
  /** ISO 8601. */
  iniciadaEn: string;
  /** ISO 8601. */
  ultimaActividad: string;
  escalada: boolean;
  mensajes: MensajeRegistrado[];
}

export interface TemaConsultado {
  seccion: string;
  consultas: number;
}

export interface ConversacionesPorDia {
  /** YYYY-MM-DD en la zona del municipio. */
  fecha: string;
  conversaciones: number;
}

export interface ResumenReporte {
  municipio: string;
  /** YYYY-MM. */
  periodo: string;
  conversaciones: number;
  mensajes: number;
  mensajesCiudadano: number;
  mensajesAsistente: number;
  ciudadanosUnicos: number;
  escalamientos: number;
  /** Mensajes por conversación, redondeado a un decimal. */
  promedioMensajes: number;
  temas: TemaConsultado[];
  porDia: ConversacionesPorDia[];
}

export interface Reporte {
  resumen: ResumenReporte;
  transcripciones: ConversacionRegistrada[];
  /** ISO 8601. */
  generadoEn: string;
}

export interface IdentidadMunicipio {
  nombre: string;
  /** URL absoluta del escudo; en correo debe ser pública. */
  escudoUrl: string;
  /** Color institucional en hex, p. ej. "#7a1f2b". */
  color: string;
}

export interface ReporteGuardado {
  id: string;
  municipio: string;
  periodo: string;
  generadoEn: string;
  html: string;
  json: Reporte;
  enviadoA: string[];
  enviadoEn: string | null;
}
