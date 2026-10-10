"use client";

import { abrirWhatsapp, enlaceWhatsapp, MENSAJE_WHATSAPP } from "@/lib/whatsapp";

/**
 * Enlace que abre WhatsApp directo en el chat con Northa (ver lib/whatsapp.js).
 * Sin JavaScript sigue funcionando: es un enlace wa.me normal.
 */
export function EnlaceWhatsapp({ texto = MENSAJE_WHATSAPP, onClick, children, ...props }) {
  return (
    <a
      href={enlaceWhatsapp(texto)}
      data-whatsapp=""
      onClick={(e) => {
        onClick?.(e);
        abrirWhatsapp(e, texto);
      }}
      {...props}
    >
      {children}
    </a>
  );
}

export default EnlaceWhatsapp;
