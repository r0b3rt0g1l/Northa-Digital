"use client";

import { Button } from "./Button";
import { abrirAsistente } from "@/lib/acciones";

/** Botón que abre el asistente del sitio. */
export function BotonAsistente({ children = "Hablar con el asistente", variant = "secondary", ...props }) {
  return (
    <Button variant={variant} onClick={() => abrirAsistente()} aria-haspopup="dialog" {...props}>
      {children}
    </Button>
  );
}

export default BotonAsistente;
