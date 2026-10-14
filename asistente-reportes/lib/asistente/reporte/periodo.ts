// Utilidades de periodo mensual en la zona horaria de Sonora.
// America/Hermosillo no usa horario de verano: es UTC-7 todo el año.

export const ZONA_SONORA = "America/Hermosillo";
const OFFSET_HORAS = 7;

const RE_PERIODO = /^(\d{4})-(\d{2})$/;

export function esPeriodoValido(periodo: string): boolean {
  const m = RE_PERIODO.exec(periodo);
  if (!m) return false;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12;
}

/** Inicio (inclusive) y fin (exclusivo) del mes en UTC, según hora de Sonora. */
export function rangoPeriodo(periodo: string): { inicio: Date; fin: Date } {
  const m = RE_PERIODO.exec(periodo);
  if (!m || !esPeriodoValido(periodo)) {
    throw new Error(`Periodo inválido: ${periodo} (se esperaba YYYY-MM)`);
  }
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const inicio = new Date(Date.UTC(anio, mes - 1, 1, OFFSET_HORAS));
  const fin = new Date(Date.UTC(anio, mes, 1, OFFSET_HORAS));
  return { inicio, fin };
}

/** Periodo del mes anterior a `fecha`, en hora de Sonora. */
export function periodoAnterior(fecha: Date = new Date()): string {
  const local = new Date(fecha.getTime() - OFFSET_HORAS * 3600_000);
  let anio = local.getUTCFullYear();
  let mes = local.getUTCMonth(); // 0-11, ya es "mes anterior" en base 1
  if (mes === 0) {
    anio -= 1;
    mes = 12;
  }
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

/** YYYY-MM-DD de un instante, en hora de Sonora. */
export function fechaLocal(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const local = new Date(d.getTime() - OFFSET_HORAS * 3600_000);
  return local.toISOString().slice(0, 10);
}

/** "Septiembre de 2026" para encabezados. */
export function nombrePeriodo(periodo: string): string {
  const { inicio } = rangoPeriodo(periodo);
  const texto = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: ZONA_SONORA,
  }).format(inicio);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "3 de octubre de 2026, 06:00" para transcripciones. */
export function fechaHoraLocal(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ZONA_SONORA,
  }).format(d);
}
