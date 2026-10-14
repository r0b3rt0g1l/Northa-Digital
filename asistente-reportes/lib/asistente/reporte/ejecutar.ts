// Orquesta el reporte mensual: genera, guarda, envía por correo y purga.
// Sin dependencias de Next ni de red: todo entra inyectado.

import type { AlmacenAsistente } from "./almacen";
import { generarReporte } from "./generar";
import { periodoAnterior, nombrePeriodo, esPeriodoValido } from "./periodo";
import { renderReporteHtml } from "./plantilla";
import type { IdentidadMunicipio, ReporteGuardado } from "./tipos";

export interface CorreoReporte {
  para: string[];
  asunto: string;
  html: string;
}

export interface OpcionesEjecutar {
  almacen: AlmacenAsistente;
  municipio: string;
  identidad: IdentidadMunicipio;
  destinatarios: string[];
  /** Adaptador sobre lib/asistente/envio.ts. */
  enviarCorreo: (correo: CorreoReporte) => Promise<void>;
  /** YYYY-MM; por defecto el mes anterior en hora de Sonora. */
  periodo?: string;
  /** Si es false, solo genera y guarda. */
  enviar?: boolean;
  /** Meses de retención de conversaciones; 0 desactiva la purga. */
  mesesRetencion?: number;
  ahora?: Date;
}

export interface ResultadoEjecutar {
  periodo: string;
  reporte: ReporteGuardado;
  enviadoA: string[];
  conversacionesPurgadas: number;
}

export async function ejecutarReporteMensual(op: OpcionesEjecutar): Promise<ResultadoEjecutar> {
  const ahora = op.ahora ?? new Date();
  const periodo = op.periodo ?? periodoAnterior(ahora);
  if (!esPeriodoValido(periodo)) throw new Error(`Periodo inválido: ${periodo}`);

  const conversaciones = await op.almacen.conversacionesDelPeriodo(op.municipio, periodo);
  const reporte = generarReporte({ municipio: op.municipio, periodo, conversaciones, ahora });
  const html = renderReporteHtml(reporte, op.identidad);
  const guardado = await op.almacen.guardarReporte(op.municipio, periodo, reporte, html);

  let enviadoA: string[] = [];
  const destinatarios = op.destinatarios.map((d) => d.trim()).filter(Boolean);
  if (op.enviar !== false && destinatarios.length > 0) {
    await op.enviarCorreo({
      para: destinatarios,
      asunto: `${op.identidad.nombre}: reporte del asistente ciudadano, ${nombrePeriodo(periodo)}`,
      html,
    });
    await op.almacen.marcarEnviado(guardado.id, destinatarios);
    enviadoA = destinatarios;
  }

  let conversacionesPurgadas = 0;
  const meses = op.mesesRetencion ?? 12;
  if (meses > 0) {
    const limite = new Date(ahora);
    limite.setUTCMonth(limite.getUTCMonth() - meses);
    conversacionesPurgadas = await op.almacen.purgarAnterioresA(op.municipio, limite);
  }

  return { periodo, reporte: { ...guardado, enviadoA, enviadoEn: enviadoA.length ? ahora.toISOString() : guardado.enviadoEn }, enviadoA, conversacionesPurgadas };
}
