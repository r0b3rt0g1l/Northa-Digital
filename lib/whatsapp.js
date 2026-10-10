// Apertura directa de WhatsApp con el número de Northa y un mensaje listo.
//
//  - El enlace base es https://wa.me/526622055021?text=… (funciona sin
//    JavaScript y es el que WhatsApp recomienda).
//  - En celular y tableta se abre en la misma pestaña: iOS y Android lo
//    entregan directo a la app de WhatsApp (enlace universal / App Link).
//  - En computadora se abre WhatsApp Web en el chat, sin la página intermedia
//    de wa.me («Continuar al chat», «Descargar»).
// Nada se envía solo: el visitante revisa el mensaje y lo manda.
import { MENSAJE_WHATSAPP, site } from "@/lib/site";

export { MENSAJE_WHATSAPP };
export const NUMERO_WHATSAPP = site.contact.whatsappNumber; // 526622055021

// toWellFormed: un emoji partido no rompe la codificación.
const codificar = (texto) => encodeURIComponent(texto.toWellFormed?.() ?? texto);

/** Enlace universal: https://wa.me/526622055021?text=… */
export function enlaceWhatsapp(texto = MENSAJE_WHATSAPP) {
  return `https://wa.me/${NUMERO_WHATSAPP}${texto ? `?text=${codificar(texto)}` : ""}`;
}

/** WhatsApp Web directo al chat (computadora). */
export function enlaceWhatsappWeb(texto = MENSAJE_WHATSAPP) {
  return `https://web.whatsapp.com/send?phone=${NUMERO_WHATSAPP}${texto ? `&text=${codificar(texto)}` : ""}`;
}

/**
 * Celular o tableta. Incluye iPadOS (se presenta como Mac) y las tabletas
 * Android con «sitio de escritorio» (se presentan como Linux): pantalla
 * táctil sin ningún puntero fino. Una laptop táctil con trackpad o ratón
 * sigue contando como computadora.
 */
export function esDispositivoMovil() {
  if (typeof navigator === "undefined") return false;
  if (navigator.userAgentData?.mobile === true) return true;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return navigator.maxTouchPoints > 1 && window.matchMedia?.("(any-pointer: fine)").matches === false;
}

/**
 * Manejador de clic de cualquier enlace a WhatsApp del sitio. En celular deja
 * que el enlace wa.me navegue (abre la app); en computadora abre WhatsApp Web
 * en una pestaña nueva, con un enlace temporal (noopener) dentro del mismo
 * gesto del visitante: la página del sitio se queda donde está.
 */
export function abrirWhatsapp(evento, texto = MENSAJE_WHATSAPP) {
  if (esDispositivoMovil()) return;
  if (evento?.defaultPrevented) return;
  // Ctrl/Cmd/Shift-clic o clic medio: el navegador decide (pestaña nueva con wa.me).
  if (evento && (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button === 1)) return;
  evento?.preventDefault();
  const enlace = document.createElement("a");
  enlace.href = enlaceWhatsappWeb(texto);
  enlace.target = "_blank";
  enlace.rel = "noopener noreferrer";
  enlace.click();
}
