// Render HTML del reporte. Sirve igual para el correo (estilos inline) y para el panel.

import type { ConversacionRegistrada, IdentidadMunicipio, Reporte } from "./tipos";
import { fechaHoraLocal, nombrePeriodo } from "./periodo";

export function renderReporteHtml(reporte: Reporte, identidad: IdentidadMunicipio): string {
  const r = reporte.resumen;
  const titulo = `Reporte del asistente ciudadano · ${nombrePeriodo(r.periodo)}`;
  const color = colorSeguro(identidad.color);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} · ${esc(identidad.nombre)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f1f1f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="background:${color};padding:24px;color:#ffffff;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:16px;vertical-align:middle;">
          <img src="${esc(identidad.escudoUrl)}" alt="Escudo de ${esc(identidad.nombre)}" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:contain;background:#ffffff;border-radius:8px;padding:4px;">
        </td>
        <td style="vertical-align:middle;">
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">${esc(identidad.nombre)}</div>
          <div style="font-size:22px;font-weight:700;line-height:1.2;">${esc(titulo)}</div>
        </td>
      </tr></table>
    </td>
  </tr>
  <tr><td style="padding:24px;">
    ${seccionResumen(r)}
    ${seccionTemas(r.temas)}
    ${seccionPorDia(r.porDia)}
  </td></tr>
  <tr><td style="padding:0 24px 24px;">
    <h2 style="font-size:18px;margin:0 0 12px;color:${color};">Transcripciones (${r.conversaciones})</h2>
    ${reporte.transcripciones.length === 0
      ? `<p style="margin:0;color:#666;">No hubo conversaciones en este periodo.</p>`
      : reporte.transcripciones.map((c, i) => transcripcion(c, i + 1, color)).join("\n")}
  </td></tr>
  <tr><td style="padding:16px 24px;background:#faf8f5;color:#777;font-size:12px;">
    Generado el ${esc(fechaHoraLocal(reporte.generadoEn))} (hora de Sonora). Este reporte contiene datos personales de ciudadanos; trátese conforme al aviso de privacidad del municipio.
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function seccionResumen(r: Reporte["resumen"]): string {
  const celdas: Array<[string, string | number]> = [
    ["Conversaciones", r.conversaciones],
    ["Mensajes", r.mensajes],
    ["Ciudadanos (correos únicos)", r.ciudadanosUnicos],
    ["Escalados a una persona", r.escalamientos],
    ["Mensajes por conversación", r.promedioMensajes],
    ["Preguntas / respuestas", `${r.mensajesCiudadano} / ${r.mensajesAsistente}`],
  ];
  return `<h2 style="font-size:18px;margin:0 0 12px;">Resumen</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px;margin:-8px;">
${filas(celdas, 2)
  .map(
    (fila) =>
      `<tr>${fila
        .map(
          ([k, v]) =>
            `<td width="50%" style="background:#faf8f5;border-radius:8px;padding:12px 14px;vertical-align:top;"><div style="font-size:12px;color:#666;">${esc(k)}</div><div style="font-size:22px;font-weight:700;">${esc(String(v))}</div></td>`,
        )
        .join("")}</tr>`,
  )
  .join("\n")}
</table>`;
}

function seccionTemas(temas: Reporte["resumen"]["temas"]): string {
  if (temas.length === 0) return "";
  const max = temas[0].consultas || 1;
  return `<h2 style="font-size:18px;margin:24px 0 12px;">Temas más consultados</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${temas
  .map(
    (t) => `<tr>
  <td style="padding:4px 8px 4px 0;white-space:nowrap;font-size:14px;">${esc(t.seccion)}</td>
  <td width="100%" style="padding:4px 0;"><div style="background:#e9e4dc;border-radius:4px;height:10px;"><div style="width:${Math.round((t.consultas / max) * 100)}%;background:#8a7b64;border-radius:4px;height:10px;"></div></div></td>
  <td style="padding:4px 0 4px 8px;font-size:14px;text-align:right;">${t.consultas}</td>
</tr>`,
  )
  .join("\n")}
</table>`;
}

function seccionPorDia(porDia: Reporte["resumen"]["porDia"]): string {
  if (porDia.length === 0) return "";
  return `<h2 style="font-size:18px;margin:24px 0 12px;">Conversaciones por día</h2>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">
<tr><th align="left" style="padding:4px 16px 4px 0;border-bottom:1px solid #e9e4dc;">Fecha</th><th align="right" style="padding:4px 0;border-bottom:1px solid #e9e4dc;">Conversaciones</th></tr>
${porDia
  .map(
    (d) =>
      `<tr><td style="padding:4px 16px 4px 0;">${esc(d.fecha)}</td><td align="right" style="padding:4px 0;">${d.conversaciones}</td></tr>`,
  )
  .join("\n")}
</table>`;
}

function transcripcion(c: ConversacionRegistrada, n: number, color: string): string {
  return `<div style="border:1px solid #e9e4dc;border-radius:10px;padding:14px;margin:0 0 12px;">
  <div style="font-size:13px;color:#555;margin-bottom:10px;">
    <strong>#${n}</strong> · ${esc(fechaHoraLocal(c.iniciadaEn))}
    · ${c.correoCiudadano ? esc(c.correoCiudadano) : "sin correo"}
    ${c.escalada ? `· <span style="color:#b3261e;font-weight:600;">escalada a una persona</span>` : ""}
  </div>
  ${c.mensajes
    .map((m) =>
      m.rol === "ciudadano"
        ? `<div style="margin:0 0 8px;"><span style="display:inline-block;background:#f0ece5;border-radius:10px;padding:8px 12px;max-width:85%;font-size:14px;line-height:1.4;"><span style="font-size:11px;color:#666;display:block;">Ciudadano</span>${escMultilinea(m.texto)}</span></div>`
        : `<div style="margin:0 0 8px;text-align:right;"><span style="display:inline-block;text-align:left;background:${color};color:#ffffff;border-radius:10px;padding:8px 12px;max-width:85%;font-size:14px;line-height:1.4;"><span style="font-size:11px;opacity:.8;display:block;">Asistente</span>${escMultilinea(m.texto)}${
            m.secciones.length ? `<span style="display:block;font-size:11px;opacity:.8;margin-top:4px;">Fuente: ${esc(m.secciones.join(", "))}</span>` : ""
          }</span></div>`,
    )
    .join("\n")}
</div>`;
}

function filas<T>(items: T[], porFila: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += porFila) out.push(items.slice(i, i + porFila));
  return out;
}

function colorSeguro(color: string): string {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(color) ? color : "#3b3b3b";
}

export function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escMultilinea(texto: string): string {
  return esc(texto).replace(/\r?\n/g, "<br>");
}
