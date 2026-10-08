"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, RotateCcw, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { StarIcon } from "@/components/ui/StarIcon";
import { asistente } from "@/lib/content/asistente";
import { responderTema, responderTexto, temaPorId } from "@/lib/asistente";
import { site, whatsappConTexto } from "@/lib/site";
import { CLAVE_MENSAJE_PENDIENTE, irAlFormulario, irASeccion } from "@/lib/acciones";

const CLAVE = "northa-asistente-v1";
const MAX_MENSAJES = 40;

const saludo = () => ({
  id: "saludo",
  autor: "bot",
  texto: asistente.saludo,
  sugerencias: asistente.sugerenciasIniciales,
});

function leerHistorial() {
  let guardado = null;
  try {
    guardado = JSON.parse(sessionStorage.getItem(CLAVE) || "null");
  } catch {}
  if (!Array.isArray(guardado) || !guardado.length) return [saludo()];
  // Si el panel se cerró antes de responder, la respuesta se agrega ahora.
  const ultimo = guardado[guardado.length - 1];
  if (ultimo?.autor === "usuario") {
    const r = ultimo.tema ? responderTema(ultimo.tema) : responderTexto(ultimo.texto ?? "");
    if (r) return [...guardado, { id: `b${Date.now()}`, autor: "bot", ...r }];
  }
  return guardado;
}

function guardarHistorial(mensajes) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(mensajes.slice(-MAX_MENSAJES)));
  } catch {}
}

const esMovil = () => window.matchMedia("(max-width: 639px)").matches;
const reducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const chip =
  "inline-flex min-h-10 items-center rounded-full border border-line-strong bg-white/[0.03] px-3.5 text-[13px] font-medium text-text-2 transition-colors hover:border-white/25 hover:text-text";
const accion =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-accent/35 bg-accent/[0.08] px-3.5 text-[13px] font-medium text-text transition-colors hover:border-accent/60 hover:bg-accent/[0.14]";

/**
 * Panel de conversación del asistente. Respuestas predefinidas: el visitante
 * puede tocar una sugerencia o escribir con sus palabras. Lo que no sabe
 * responder lo deriva al equipo por WhatsApp o al formulario, con la
 * pregunta ya escrita. La conversación se guarda solo durante la sesión.
 */
export default function AsistentePanel({ onCerrar, preguntaInicial, onPreguntaUsada }) {
  const uid = useId();
  // El panel solo existe en el cliente (se carga bajo demanda), así que
  // puede leer el historial de la sesión al iniciar.
  const [mensajes, setMensajes] = useState(leerHistorial);
  const [texto, setTexto] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const panelRef = useRef(null);
  const listaRef = useRef(null);
  const inputRef = useRef(null);
  const timers = useRef([]);

  // Foco en el campo al abrir.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    const pendientes = timers.current;
    return () => pendientes.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    guardarHistorial(mensajes);
    const lista = listaRef.current;
    if (lista) lista.scrollTo({ top: lista.scrollHeight, behavior: reducido() ? "auto" : "smooth" });
  }, [mensajes, escribiendo]);

  // Escape cierra y devuelve el foco al botón del asistente, solo si el foco
  // está en el panel (o en ninguna parte): no interfiere con otros campos.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const activo = document.activeElement;
      if (panelRef.current?.contains(activo) || !activo || activo === document.body) onCerrar(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const responder = (deUsuario, respuesta, tema) => {
    setMensajes((prev) => [
      ...prev,
      { id: `u${Date.now()}`, autor: "usuario", texto: deUsuario, ...(tema ? { tema } : {}) },
    ]);
    setEscribiendo(true);
    const t = setTimeout(
      () => {
        setEscribiendo(false);
        setMensajes((prev) => [...prev, { id: `b${Date.now()}`, autor: "bot", ...respuesta() }]);
      },
      reducido() ? 120 : 520,
    );
    timers.current.push(t);
  };

  const enviarTexto = (valor) => {
    const limpio = valor.trim().slice(0, 300);
    if (!limpio || escribiendo) return;
    setTexto("");
    responder(limpio, () => responderTexto(limpio));
  };

  const elegirTema = (id) => {
    const tema = temaPorId(id);
    if (!tema || escribiendo) return;
    responder(tema.pregunta, () => responderTema(id), id);
  };

  // Una pregunta enviada desde fuera (botón "Hablar con el asistente").
  useEffect(() => {
    if (!preguntaInicial) return;
    const t = setTimeout(() => {
      enviarTexto(preguntaInicial);
      onPreguntaUsada?.();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preguntaInicial]);

  const reiniciar = () => {
    timers.current.forEach(clearTimeout);
    setEscribiendo(false);
    setMensajes([saludo()]);
    inputRef.current?.focus();
  };

  const ejecutar = (a) => {
    const enInicio = Boolean(document.getElementById("contacto"));
    if (a.tipo === "seccion") {
      if (!document.getElementById(a.destino)) {
        window.location.assign(`/#${a.destino}`);
        return;
      }
      irASeccion(a.destino);
      if (esMovil()) onCerrar(false);
    } else if (a.tipo === "formulario") {
      if (!enInicio) {
        // Desde otra página: la pregunta viaja guardada y el formulario la recoge.
        try {
          if (a.texto) sessionStorage.setItem(CLAVE_MENSAJE_PENDIENTE, a.texto);
        } catch {}
        window.location.assign("/#contacto");
        return;
      }
      irAlFormulario(a.texto ?? "");
      onCerrar(false);
    }
  };

  const ultimoBot = [...mensajes].reverse().find((m) => m.autor === "bot");

  return (
    <div
      ref={panelRef}
      id="asistente-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${uid}-titulo`}
      data-asistente=""
      className="glass-strong panel-in fixed inset-x-3 bottom-3 z-[60] flex max-h-[min(80svh,640px)] flex-col overflow-hidden rounded-[24px] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:max-h-[min(640px,calc(100svh-120px))]"
    >
      <header className="flex items-center gap-3 border-b border-line py-3 pl-4 pr-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-line-strong bg-gradient-to-b from-[#171a20] to-[#0e1014]">
          <StarIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${uid}-titulo`} className="truncate text-[15px] tracking-[-0.01em]">
            {asistente.nombre}
          </h2>
          <p className="m-0 truncate text-xs text-muted">{asistente.descripcion}</p>
        </div>
        <button
          type="button"
          onClick={reiniciar}
          aria-label="Empezar una conversación nueva"
          className="grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-white/[0.06] hover:text-text"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onCerrar(true)}
          aria-label="Cerrar asistente"
          className="grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-white/[0.06] hover:text-text"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div
        ref={listaRef}
        role="log"
        aria-live="polite"
        aria-label="Conversación"
        className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {mensajes.map((m) =>
          m.autor === "usuario" ? (
            <p
              key={m.id}
              className="m-0 ml-auto max-w-[85%] whitespace-pre-line rounded-2xl rounded-tr-md border border-accent/25 bg-accent/[0.14] px-4 py-2.5 text-[14.5px] leading-relaxed text-text"
            >
              <span className="sr-only">Tú: </span>
              {m.texto}
            </p>
          ) : (
            <div key={m.id} className="flex max-w-[92%] flex-col gap-2.5">
              <p className="m-0 whitespace-pre-line rounded-2xl rounded-tl-md border border-line bg-white/[0.04] px-4 py-3 text-[14.5px] leading-relaxed text-text-2">
                <span className="sr-only">Asistente: </span>
                {m.texto}
              </p>
              {m.acciones?.length ? (
                <div className="flex flex-wrap gap-2">
                  {m.acciones.map((a) => {
                    if (a.tipo === "whatsapp") {
                      return (
                        <a
                          key={a.label}
                          href={whatsappConTexto(a.texto ?? "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={accion}
                        >
                          {a.label}
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="sr-only"> (se abre en una pestaña nueva)</span>
                        </a>
                      );
                    }
                    if (a.tipo === "correo") {
                      return (
                        <a key={a.label} href={site.contact.emailHref} className={accion}>
                          {a.label}
                        </a>
                      );
                    }
                    return (
                      <button key={a.label} type="button" onClick={() => ejecutar(a)} className={accion}>
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {m === ultimoBot && m.sugerencias?.length && !escribiendo ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Preguntas sugeridas">
                  {m.sugerencias.map((id) => {
                    const t = temaPorId(id);
                    return t ? (
                      <button key={id} type="button" onClick={() => elegirTema(id)} className={chip}>
                        {t.chip}
                      </button>
                    ) : null;
                  })}
                </div>
              ) : null}
            </div>
          ),
        )}
        {escribiendo ? (
          <p className="escribiendo m-0 inline-flex w-fit items-center gap-1 rounded-2xl rounded-tl-md border border-line bg-white/[0.04] px-4 py-3.5">
            <span className="sr-only">El asistente está escribiendo</span>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </p>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviarTexto(texto);
        }}
        className="flex items-center gap-2 border-t border-line p-3"
      >
        <label htmlFor={`${uid}-texto`} className="sr-only">
          Escribe tu pregunta
        </label>
        <input
          ref={inputRef}
          id={`${uid}-texto`}
          type="text"
          autoComplete="off"
          maxLength={300}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe tu pregunta…"
          className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-bg/60 px-4 text-[15px] text-text outline-hidden transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        <button
          type="submit"
          aria-label="Enviar pregunta"
          disabled={!texto.trim() || escribiendo}
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-text text-bg transition-[background-color,opacity,scale] active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
      <p className="m-0 px-4 pb-3 text-[12px] leading-snug text-faint">{asistente.aviso}</p>
    </div>
  );
}
