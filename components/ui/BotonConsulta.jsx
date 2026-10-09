"use client";

import { Button } from "./Button";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { abrirAsistente } from "@/lib/acciones";
import { whatsappConTexto } from "@/lib/site";

/**
 * Llamado a la acción que abre el asistente en la consulta guiada (con un
 * servicio ya elegido si se indica). Es un enlace a WhatsApp: sin JavaScript,
 * o si el asistente no carga, lleva directo a WhatsApp con un mensaje
 * genérico. Con JavaScript abre el asistente en lugar de salir del sitio.
 */
export function BotonConsulta({
  servicio,
  icono = false,
  children = "Cuéntanos tu proyecto",
  className,
  onAbrir,
  ...props
}) {
  return (
    <Button
      href={whatsappConTexto("Quiero hacer una consulta.")}
      aria-haspopup="dialog"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onAbrir?.();
        abrirAsistente({ modo: "consulta", servicio });
      }}
      {...props}
    >
      {icono ? (
        <span className="-ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_0_0_3px_rgba(37,211,102,0.18)]">
          <WhatsAppIcon className="h-4 w-4" />
        </span>
      ) : null}
      {children}
    </Button>
  );
}

export default BotonConsulta;
