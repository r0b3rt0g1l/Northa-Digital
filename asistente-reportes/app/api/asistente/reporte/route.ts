// Endpoint del reporte mensual del asistente.
// Vercel Cron lo llama por GET el día 1 de cada mes con `Authorization: Bearer $CRON_SECRET`.
// El panel del CMS lo llama por POST con `?periodo=YYYY-MM` para regenerar o reenviar.
//
// PUNTOS DE INTEGRACIÓN (ajustar al copiar al canónico):
//  1. `municipalConfig`: nombre, escudo, color y correos del administrador.
//  2. `enviarCorreo`: envolver lib/asistente/envio.ts con la firma { para, asunto, html }.

import { NextResponse } from "next/server";
import { municipalConfig } from "@/lib/municipalConfig";
import { almacenDesdeEntorno } from "@/lib/asistente/reporte/almacen";
import { ejecutarReporteMensual, type CorreoReporte } from "@/lib/asistente/reporte/ejecutar";
import { esPeriodoValido } from "@/lib/asistente/reporte/periodo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function enviarCorreo(correo: CorreoReporte): Promise<void> {
  // TODO(integración): usar el mismo proveedor que lib/asistente/envio.ts.
  // Ejemplo con Resend:
  //   await resend.emails.send({ from: REMITENTE, to: correo.para, subject: correo.asunto, html: correo.html });
  const { enviar } = await import("@/lib/asistente/envio");
  await enviar({ para: correo.para, asunto: correo.asunto, html: correo.html });
}

function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secreto}`;
}

async function manejar(req: Request): Promise<Response> {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const almacen = almacenDesdeEntorno();
  if (!almacen) {
    return NextResponse.json({ error: "almacén del asistente no configurado" }, { status: 503 });
  }

  const url = new URL(req.url);
  const periodo = url.searchParams.get("periodo") ?? undefined;
  if (periodo && !esPeriodoValido(periodo)) {
    return NextResponse.json({ error: "periodo inválido, usar YYYY-MM" }, { status: 400 });
  }
  const enviar = url.searchParams.get("enviar") !== "0";

  const cfg = municipalConfig as {
    slug: string;
    nombre: string;
    sitio?: { url?: string };
    identidad: { escudo: string; color?: string; colorPrimario?: string };
    asistente?: { reportes?: { destinatarios?: string[] } };
    contacto?: { correo?: string };
  };
  const destinatarios = cfg.asistente?.reportes?.destinatarios ?? (cfg.contacto?.correo ? [cfg.contacto.correo] : []);
  const baseUrl = (cfg.sitio?.url ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const escudoUrl = cfg.identidad.escudo.startsWith("http") ? cfg.identidad.escudo : `${baseUrl}${cfg.identidad.escudo}`;

  try {
    const resultado = await ejecutarReporteMensual({
      almacen,
      municipio: cfg.slug,
      identidad: { nombre: cfg.nombre, escudoUrl, color: cfg.identidad.color ?? cfg.identidad.colorPrimario ?? "#3b3b3b" },
      destinatarios,
      enviarCorreo,
      periodo,
      enviar,
    });
    return NextResponse.json({
      ok: true,
      periodo: resultado.periodo,
      conversaciones: resultado.reporte.json.resumen.conversaciones,
      enviadoA: resultado.enviadoA,
      conversacionesPurgadas: resultado.conversacionesPurgadas,
    });
  } catch (error) {
    console.error("[asistente/reporte]", error);
    return NextResponse.json({ error: "no se pudo generar el reporte" }, { status: 500 });
  }
}

export const GET = manejar;
export const POST = manejar;
