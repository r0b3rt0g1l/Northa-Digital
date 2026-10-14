// Registro de turnos del asistente. Nunca lanza: si el almacén falla, el chat sigue.

import type { AlmacenAsistente, NuevoTurno } from "./almacen";
import { almacenDesdeEntorno } from "./almacen";

let almacenPorDefecto: AlmacenAsistente | null | undefined;

function almacen(): AlmacenAsistente | null {
  if (almacenPorDefecto === undefined) almacenPorDefecto = almacenDesdeEntorno();
  return almacenPorDefecto;
}

/** Para pruebas: inyecta un almacén o null para desactivar el registro. */
export function usarAlmacen(a: AlmacenAsistente | null): void {
  almacenPorDefecto = a;
}

/**
 * Guarda un turno (pregunta + respuesta). Devuelve el id de conversación
 * para que el cliente lo mande en el siguiente turno, o null si no se guardó.
 */
export async function registrarTurno(turno: NuevoTurno): Promise<string | null> {
  const a = almacen();
  if (!a) return null;
  try {
    return await a.guardarTurno(turno);
  } catch (error) {
    console.error("[asistente/registro] no se pudo guardar el turno", error);
    return null;
  }
}

export async function registrarEscalamiento(conversacionId: string | null | undefined): Promise<void> {
  const a = almacen();
  if (!a || !conversacionId) return;
  try {
    await a.marcarEscalada(conversacionId);
  } catch (error) {
    console.error("[asistente/registro] no se pudo marcar el escalamiento", error);
  }
}
