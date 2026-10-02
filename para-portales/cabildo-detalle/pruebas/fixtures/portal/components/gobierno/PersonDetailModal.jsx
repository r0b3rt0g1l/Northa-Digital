"use client";
// Reemplazo mínimo SOLO PARA PRUEBAS: el real (con foto, contacto y avisos) no se tiene en este
// repo. Tiene la misma firma: { person, open, onOpenChange }.
import * as Dialog from "@radix-ui/react-dialog";

export function PersonDetailModal({ person, open, onOpenChange }) {
  if (!person) return null;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>{person.nombre}</Dialog.Title>
          <Dialog.Description>{person.cargo}</Dialog.Description>
          <Dialog.Close aria-label="Cerrar">x</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default PersonDetailModal;
