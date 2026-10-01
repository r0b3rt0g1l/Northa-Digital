"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ExternalLink, FileText } from "lucide-react";

export function PDFViewer({
  pdfUrl,
  title,
  subtitle,
  trigger,
  open: openProp,
  onOpenChange,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  // El PDF de Cloudinary es embebible directo (200, application/pdf, sin
  // X-Frame-Options ni CSP de frame, CORS *). En ESCRITORIO el navegador lo
  // renderiza nativo dentro del <iframe>. En MÓVIL los navegadores NO embeben
  // PDFs en iframe (saldría en blanco), así que mostramos un botón grande que
  // abre el PDF en pestaña nueva. Sin Google Docs Viewer (deprecado/inestable).
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="glass-panel fixed left-1/2 top-1/2 z-50 flex h-[92vh] w-[min(96vw,1180px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl"
              >
                <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 text-[var(--color-text)] sm:px-5 sm:py-4">
                  <div className="hidden rounded-full bg-[var(--color-dorado)]/10 p-2 text-[var(--color-dorado)] sm:block">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="truncate font-display text-sm font-bold leading-tight md:text-base">
                      {title}
                    </Dialog.Title>
                    <Dialog.Description className="mt-0.5 truncate text-[11px] text-[var(--color-text-secondary)] sm:text-xs">
                      {subtitle ?? "Documento oficial del Ayuntamiento"}
                    </Dialog.Description>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <a
                      href={pdfUrl}
                      download
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text)] transition hover:border-[var(--color-text-muted)] hover:bg-[var(--color-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dorado)]"
                      aria-label={`Descargar ${title}`}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Descargar</span>
                    </a>
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text)] transition hover:border-[var(--color-text-muted)] hover:bg-[var(--color-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dorado)]"
                      aria-label="Abrir PDF en pestaña nueva"
                    >
                      <ExternalLink
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      <span className="hidden sm:inline">Pestaña</span>
                    </a>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        aria-label="Cerrar visor de PDF"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dorado)]"
                      >
                        <X className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </Dialog.Close>
                  </div>
                </div>

                <div className="relative flex-1 bg-[var(--color-bg)]">
                  {pdfUrl ? (
                    <>
                      {/* ESCRITORIO (md+): PDF embebido directo de Cloudinary, sin gview */}
                      <iframe
                        src={pdfUrl}
                        title={title}
                        className="absolute inset-0 hidden h-full w-full border-0 md:block"
                        loading="lazy"
                      />
                      {/* MÓVIL (<md): los navegadores móviles no embeben PDFs en
                          iframe → CTA claro que abre el PDF en pestaña nueva */}
                      <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center md:hidden">
                        <div className="rounded-2xl bg-[var(--color-guinda)]/10 p-4 text-[var(--color-guinda)]">
                          <FileText className="h-10 w-10" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="font-display text-base font-bold text-[var(--color-text)]">
                            {title}
                          </p>
                          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            El documento se abre en una pestaña nueva de tu navegador.
                          </p>
                        </div>
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-light inline-flex min-h-[48px] items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-[var(--color-text)] transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dorado)] focus-visible:ring-offset-2"
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          Abrir documento
                        </a>
                        <a
                          href={pdfUrl}
                          download
                          className="text-xs font-semibold text-[var(--color-dorado-700)] underline-offset-2 hover:underline"
                        >
                          o descargar el PDF
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--color-text-secondary)]">
                      Documento no disponible.
                    </div>
                  )}
                </div>

                <div className="hidden border-t border-[var(--color-border)] bg-white px-4 py-2 text-[11px] text-[var(--color-text-muted)] md:block">
                  Si el documento no se muestra, usa el botón{" "}
                  <strong>Pestaña</strong> o <strong>Descargar</strong> arriba.
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export default PDFViewer;
