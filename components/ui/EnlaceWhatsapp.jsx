"use client";

import { abrirWhatsapp, enlaceWhatsapp, MENSAJE_WHATSAPP } from "@/lib/whatsapp";
import { usePestanaNueva } from "@/hooks/usePestanaNueva";

/**
 * Enlace que abre WhatsApp directo en el chat con Northa (ver lib/whatsapp.js).
 * Sin JavaScript sigue funcionando: es un enlace wa.me normal. En computadora,
 * el nombre accesible avisa que se abre en una pestaña nueva.
 */
export function EnlaceWhatsapp({ texto = MENSAJE_WHATSAPP, onClick, children, ...props }) {
  const pestana = usePestanaNueva();
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
      {pestana ? <span className="sr-only"> (se abre en una pestaña nueva)</span> : null}
    </a>
  );
}

export default EnlaceWhatsapp;
