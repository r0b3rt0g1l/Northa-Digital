"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Mail, Phone, RotateCcw, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { StarIcon } from "@/components/ui/StarIcon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { asistente } from "@/lib/content/asistente";
import {
  consulta,
  lineasResumen,
  mensajeConsulta,
  OPCION_OMITIR,
  OPCION_TEXTO,
  pasos,
  servicioPorEtiqueta,
  servicioPorId,
  SERVICIO_NO_SE,
} from "@/lib/content/consulta";
import { interpretar, responderTema, responderTexto, temaPorId } from "@/lib/asistente";
import { site, textoWhatsapp, whatsappConTexto } from "@/lib/site";
import { irASeccion } from "@/lib/acciones";

const CLAVE = "northa-asistente-v2";
const MAX_MENSAJES = 60;

// Temas del asistente que equivalen a un servicio: si alguien escribe
// "necesito un sitio" en el paso del servicio, se reconoce.
const TEMA_A_SERVICIO = {
  portales: "portales-sistemas",
  web: "desarrollo-web",
  redes: "redes-sociales",
  foto: "fotografia",
  video: "video",
  diseno: "diseno-grafico",
  seguridad: "seguridad",
};

let contador = 0;
const nuevoId = (prefijo) => `${prefijo}${Date.now().toString(36)}${(contador++).toString(36)}`;

const bot = (texto, extra = {}) => ({ id: nuevoId("b"), autor: "bot", texto, ...extra });
const usuario = (texto) => ({ id: nuevoId("u"), autor: "usuario", texto });

const estadoInicial = () => ({
  mensajes: [bot(consulta.bienvenida)],
  modo: "inicio", // inicio | consulta | resumen | dudas | persona
  paso: 0,
  respuestas: {},
  seleccion: [],
  editando: false, // se está cambiando una respuesta desde el resumen
  pendientes: [], // campos que faltan por volver a preguntar antes del resumen
});

const MODOS = ["inicio", "consulta", "resumen", "dudas", "persona"];

function leerEstado() {
  try {
    const g = JSON.parse(sessionStorage.getItem(CLAVE) || "null");
    // Solo se recupera un estado con la forma esperada; si no, se empieza de cero.
    if (
      g &&
      Array.isArray(g.mensajes) &&
      g.mensajes.length &&
      MODOS.includes(g.modo) &&
      Number.isInteger(g.paso) &&
      g.paso >= 0 &&
      g.paso < pasos.length &&
      g.respuestas &&
      typeof g.respuestas === "object" &&
      Array.isArray(g.seleccion)
    ) {
      return { ...estadoInicial(), ...g, pendientes: Array.isArray(g.pendientes) ? g.pendientes : [] };
    }
  } catch {}
  return estadoInicial();
}

/** La consulta tiene todas las respuestas obligatorias. */
const consultaCompleta = (r) => !!r?.servicio && pasos.every((p) => p.opcional || (r[p.campo] != null && r[p.campo] !== ""));

/** Mensajes con la tarjeta del resumen al final (sin duplicarla). */
const conResumen = (mensajes) =>
  mensajes.at(-1)?.tipo === "resumen" ? mensajes : [...mensajes, bot(consulta.resumen, { tipo: "resumen" })];

// Frases explícitas para pedir una persona mientras se responde la consulta.
const PIDE_PERSONA = /hablar con (una |alguna )?persona|hablar con alguien|persona del equipo|asesor(a)? humano|atenci[oó]n humana/i;

function guardarEstado(estado) {
  try {
    sessionStorage.setItem(
      CLAVE,
      JSON.stringify({ ...estado, mensajes: estado.mensajes.slice(-MAX_MENSAJES) }),
    );
  } catch {}
}

const reducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const chip =
  "inline-flex min-h-11 items-center rounded-full border border-line-strong bg-white/[0.03] px-4 text-left text-[13.5px] font-medium leading-snug text-text-2 transition-colors hover:border-white/25 hover:text-text";
const chipActivo = "border-accent/60 bg-accent/[0.16] text-text";
const accion =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-accent/35 bg-accent/[0.08] px-4 text-[13.5px] font-medium text-text transition-colors hover:border-accent/60 hover:bg-accent/[0.14]";
const principal =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-text px-5 text-[14px] font-semibold text-bg transition-[background-color,scale] hover:bg-white active:scale-[0.98]";

/**
 * Panel del asistente: una consulta guiada con opciones predefinidas que
 * termina en un resumen revisable y un mensaje listo para WhatsApp. También
 * responde dudas frecuentes con información del sitio y ofrece hablar con una
 * persona. Nada se envía solo: WhatsApp se abre cuando el visitante lo pide.
 * No es inteligencia artificial y no simula escribir.
 */
export default function AsistentePanel({ onCerrar, peticion, onPeticionUsada }) {
  const uid = useId();
  const [estado, setEstado] = useState(leerEstado);
  const [texto, setTexto] = useState("");
  const panelRef = useRef(null);
  const listaRef = useRef(null);
  const controlesRef = useRef(null);
  const inputRef = useRef(null);
  const enfocarControles = useRef(true);

  const { mensajes, modo, paso, respuestas, seleccion, editando } = estado;
  const pasoActual = modo === "consulta" ? pasos[paso] : null;

  useEffect(() => {
    guardarEstado(estado);
  }, [estado]);

  // Lleva la conversación al final y el foco a las nuevas opciones.
  useLayoutEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTo({ top: lista.scrollHeight, behavior: reducido() ? "auto" : "smooth" });
    if (!enfocarControles.current) return;
    enfocarControles.current = false;
    const primero =
      controlesRef.current?.querySelector("button, a, input") ??
      (modo === "resumen" ? listaRef.current?.querySelector("[data-resumen] button") : null);
    (primero ?? inputRef.current)?.focus({ preventScroll: true });
  }, [mensajes.length, modo, paso]);

  // Escape cierra el panel esté donde esté el foco; solo lo devuelve al botón
  // de origen si estaba dentro del panel. Se escucha en window, que recibe la
  // tecla después de document: los menús de la barra la detienen antes y un
  // mismo Escape no cierra dos cosas.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const activo = document.activeElement;
      onCerrar(!activo || activo === document.body || !!panelRef.current?.contains(activo));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const actualizar = (fn) => {
    enfocarControles.current = true;
    setEstado((prev) => fn(prev));
  };

  // ---------- Consulta guiada ----------

  const preguntaDe = (p) => bot(p.pregunta);

  const iniciarConsulta = useCallback((servicioId) => {
    actualizar((prev) => {
      const s = servicioId ? servicioPorId(servicioId) : null;
      if (!s) {
        // Sin servicio: se retoma la consulta en curso, se vuelve al resumen si
        // ya está completa o se empieza desde el principio.
        if (prev.modo === "consulta") return prev;
        if (prev.modo === "resumen" || consultaCompleta(prev.respuestas)) {
          return { ...prev, modo: "resumen", editando: false, pendientes: [], mensajes: conResumen(prev.mensajes) };
        }
        if (prev.respuestas?.servicio) {
          return {
            ...prev,
            modo: "consulta",
            editando: false,
            pendientes: [],
            mensajes: [...prev.mensajes, bot(`Sigamos con tu consulta. ${pasos[prev.paso].pregunta}`)],
          };
        }
        return {
          ...prev,
          modo: "consulta",
          paso: 0,
          respuestas: {},
          seleccion: [],
          editando: false,
          pendientes: [],
          mensajes: [...prev.mensajes, preguntaDe(pasos[0])],
        };
      }
      return {
        ...prev,
        modo: "consulta",
        paso: 1,
        respuestas: { servicio: s.label, servicioId: s.id },
        seleccion: [],
        editando: false,
        pendientes: [],
        mensajes: [...prev.mensajes, usuario(s.label), bot(`Perfecto: ${s.label}. ${pasos[1].pregunta}`)],
      };
    });
  }, []);

  /** Guarda la respuesta del paso actual y avanza (o vuelve al resumen). */
  const responderPaso = (valor, etiqueta) => {
    actualizar((prev) => {
      const p = pasos[prev.paso];
      const respuestas = { ...prev.respuestas };
      if (p.campo === "servicio") {
        const s = servicioPorEtiqueta(valor);
        respuestas.servicio = s ? s.label : valor;
        respuestas.servicioId = s ? s.id : SERVICIO_NO_SE;
        // Objetivo y requisitos dependen del servicio: se vuelven a preguntar.
        if (prev.editando) {
          delete respuestas.objetivo;
          delete respuestas.requisitos;
        }
      } else if (valor === null) {
        delete respuestas[p.campo];
      } else {
        respuestas[p.campo] = valor;
      }
      const burbuja = usuario(etiqueta ?? (Array.isArray(valor) ? valor.join(", ") : valor ?? OPCION_OMITIR));

      // Siguiente pregunta: la que sigue en orden o, si se está cambiando una
      // respuesta desde el resumen, la siguiente pendiente.
      let siguiente = prev.paso + 1;
      let pendientes = prev.pendientes ?? [];
      if (prev.editando) {
        siguiente = pendientes.length ? pasos.findIndex((x) => x.campo === pendientes[0]) : pasos.length;
        pendientes = pendientes.slice(1);
      }

      if (siguiente >= pasos.length) {
        return {
          ...prev,
          respuestas,
          seleccion: [],
          editando: false,
          pendientes: [],
          modo: "resumen",
          mensajes: [...prev.mensajes, burbuja, bot(consulta.resumen, { tipo: "resumen" })],
        };
      }
      const prox = pasos[siguiente];
      return {
        ...prev,
        respuestas,
        pendientes,
        paso: siguiente,
        seleccion:
          prev.editando && prox.multiple && Array.isArray(respuestas[prox.campo]) ? respuestas[prox.campo] : [],
        mensajes: [...prev.mensajes, burbuja, preguntaDe(prox)],
      };
    });
  };

  const elegirOpcion = (opcion) => {
    if (opcion === OPCION_TEXTO) {
      inputRef.current?.focus();
      return;
    }
    if (opcion === OPCION_OMITIR) {
      responderPaso(null, pasoActual?.campo === "comentario" ? "Nada más" : OPCION_OMITIR);
      return;
    }
    if (pasoActual?.multiple) {
      setEstado((prev) => ({
        ...prev,
        seleccion: prev.seleccion.includes(opcion)
          ? prev.seleccion.filter((o) => o !== opcion)
          : [...prev.seleccion, opcion],
      }));
      return;
    }
    responderPaso(opcion);
  };

  const confirmarSeleccion = () => {
    if (!seleccion.length) return;
    responderPaso([...seleccion]);
  };

  const atras = () => {
    actualizar((prev) => {
      if (prev.paso <= 0) return prev;
      const anterior = prev.paso - 1;
      const respuestas = { ...prev.respuestas };
      delete respuestas[pasos[anterior].campo];
      if (pasos[anterior].campo === "servicio") delete respuestas.servicioId;
      return {
        ...prev,
        paso: anterior,
        respuestas,
        seleccion: [],
        editando: false,
        pendientes: [],
        mensajes: [...prev.mensajes, usuario("Atrás"), preguntaDe(pasos[anterior])],
      };
    });
  };

  const cambiar = (campo) => {
    const i = pasos.findIndex((p) => p.campo === campo);
    if (i < 0) return;
    actualizar((prev) => ({
      ...prev,
      modo: "consulta",
      paso: i,
      seleccion: campo === "requisitos" && Array.isArray(prev.respuestas.requisitos) ? prev.respuestas.requisitos : [],
      editando: true,
      // Si cambia el servicio, cambian las opciones de objetivo y requisitos.
      pendientes: campo === "servicio" ? ["objetivo", "requisitos"] : [],
      mensajes: [...prev.mensajes, usuario(`Cambiar: ${pasos[i].titulo.toLowerCase()}`), preguntaDe(pasos[i])],
    }));
  };

  // ---------- Dudas, persona y menú ----------

  const mostrarDudas = () => {
    actualizar((prev) => ({
      ...prev,
      modo: "dudas",
      mensajes: [...prev.mensajes, usuario("Tengo una duda"), bot(consulta.dudas, { sugerencias: asistente.sugerenciasIniciales })],
    }));
  };

  const mostrarPersona = (eco = "Quiero hablar con una persona") => {
    actualizar((prev) => ({
      ...prev,
      modo: "persona",
      mensajes: [...prev.mensajes, usuario(eco), bot(consulta.persona, { tipo: "persona" })],
    }));
  };

  const responderDuda = (deUsuario, respuesta) => {
    actualizar((prev) => {
      const mensajes = [...prev.mensajes, usuario(deUsuario), bot(respuesta.texto, respuesta)];
      return {
        ...prev,
        modo: prev.modo === "consulta" || prev.modo === "resumen" ? prev.modo : "dudas",
        // En el resumen, la tarjeta con «Abrir en WhatsApp» vuelve a quedar al final.
        mensajes: prev.modo === "resumen" ? conResumen(mensajes) : mensajes,
      };
    });
  };

  const elegirTema = (id) => {
    const tema = temaPorId(id);
    const r = responderTema(id);
    if (tema && r) responderDuda(tema.pregunta, r);
  };

  const reiniciar = () => {
    enfocarControles.current = true;
    setTexto("");
    setEstado(estadoInicial());
  };

  // Acciones que trae una respuesta.
  const ejecutar = (a) => {
    if (a.tipo === "consulta") {
      iniciarConsulta(a.servicio);
    } else if (a.tipo === "persona") {
      mostrarPersona(a.label);
    } else if (a.tipo === "seccion") {
      if (!document.getElementById(a.destino)) {
        window.location.assign(`/#${a.destino}`);
        return;
      }
      irASeccion(a.destino);
      if (window.matchMedia("(max-width: 639px)").matches) onCerrar(false);
    }
  };

  // ---------- Texto libre ----------

  const enviarTexto = (valor) => {
    const limpio = valor.trim().slice(0, 300);
    if (!limpio) return;
    setTexto("");
    if (modo === "consulta" && pasoActual) {
      if (PIDE_PERSONA.test(limpio)) {
        mostrarPersona(limpio);
        return;
      }
      if (pasoActual.campo === "servicio") {
        const { tema } = interpretar(limpio);
        const s = servicioPorId(TEMA_A_SERVICIO[tema?.id]);
        responderPaso(s ? s.label : limpio, limpio);
        return;
      }
      if (pasoActual.multiple) {
        responderPaso([...seleccion, limpio], [...seleccion, limpio].join(", "));
        return;
      }
      responderPaso(limpio);
      return;
    }
    responderDuda(limpio, responderTexto(limpio));
  };

  // Una petición desde fuera: CTA, menú de servicios, banner o pregunta.
  useEffect(() => {
    if (!peticion) return;
    const t = setTimeout(() => {
      if (peticion.modo === "consulta") iniciarConsulta(peticion.servicio);
      else if (peticion.modo === "persona") mostrarPersona();
      else if (peticion.pregunta) responderDuda(peticion.pregunta, responderTexto(peticion.pregunta));
      else if (peticion.modo === "dudas") mostrarDudas();
      onPeticionUsada?.();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peticion]);

  // ---------- Pintado ----------

  const ultimo = mensajes[mensajes.length - 1];
  const opcionesPaso = pasoActual ? pasoActual.opciones(respuestas) : [];
  const enlaceWhatsapp = whatsappConTexto(mensajeConsulta(respuestas));

  const contacto = (
    <div className="flex flex-wrap gap-2">
      <a
        href={whatsappConTexto(
          consultaCompleta(respuestas) ? `${mensajeConsulta(respuestas)}\n\n${consulta.mensajePersona}` : consulta.mensajePersona,
        )}
        target="_blank"
        rel="noopener noreferrer"
        className={principal}
      >
        <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
        Escribir por WhatsApp
        <span className="sr-only"> (se abre en una pestaña nueva)</span>
      </a>
      <a href={site.contact.phoneHref} className={accion}>
        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
        Llamar al {site.contact.phoneDisplay}
      </a>
      <a href={site.contact.emailHref} className={accion}>
        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
        {site.contact.email}
      </a>
    </div>
  );

  const pintarAccion = (a) => {
    if (a.tipo === "whatsapp") {
      return (
        <a key={a.label} href={whatsappConTexto(a.texto ?? "")} target="_blank" rel="noopener noreferrer" className={accion}>
          <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
          {a.label}
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
    if (a.tipo === "llamar") {
      return (
        <a key={a.label} href={site.contact.phoneHref} className={accion}>
          {a.label} al {site.contact.phoneDisplay}
        </a>
      );
    }
    return (
      <button key={a.label} type="button" onClick={() => ejecutar(a)} className={accion}>
        {a.label}
      </button>
    );
  };

  let controles = null;
  if (modo === "inicio") {
    controles = (
      <>
        <button type="button" className={cn(chip, chipActivo)} onClick={() => iniciarConsulta()}>
          Empezar mi consulta
        </button>
        <button type="button" className={chip} onClick={mostrarDudas}>
          Tengo una duda
        </button>
        <button type="button" className={chip} onClick={() => mostrarPersona()}>
          Hablar con una persona
        </button>
      </>
    );
  } else if (modo === "consulta" && pasoActual) {
    controles = (
      <>
        {(pasoActual.multiple
          ? [...opcionesPaso, ...seleccion.filter((o) => !opcionesPaso.includes(o))]
          : opcionesPaso
        ).map((o) => {
          const activa = pasoActual.multiple && seleccion.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={pasoActual.multiple ? activa : undefined}
              onClick={() => elegirOpcion(o)}
              className={cn(chip, activa && chipActivo)}
            >
              {o}
            </button>
          );
        })}
        {pasoActual.texto ? (
          <button type="button" className={cn(chip, "border-dashed")} onClick={() => elegirOpcion(OPCION_TEXTO)}>
            {OPCION_TEXTO}
          </button>
        ) : null}
        {pasoActual.opcional ? (
          <button type="button" className={cn(chip, "border-dashed")} onClick={() => elegirOpcion(OPCION_OMITIR)}>
            {pasoActual.campo === "comentario" ? "Nada más" : OPCION_OMITIR}
          </button>
        ) : null}
        <button type="button" className={cn(chip, "border-dashed")} onClick={() => mostrarPersona()}>
          Hablar con una persona
        </button>
        <div className="flex w-full items-center justify-between gap-2 pt-1">
          {paso > 0 && !editando ? (
            <button
              type="button"
              onClick={atras}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13px] text-muted hover:text-text"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Atrás
            </button>
          ) : (
            <span />
          )}
          <span className="font-mono text-[11px] text-faint" aria-hidden="true">
            {paso + 1} / {pasos.length}
          </span>
          {pasoActual.multiple ? (
            <button type="button" onClick={confirmarSeleccion} disabled={!seleccion.length} className={cn(principal, "disabled:opacity-40")}>
              Continuar
            </button>
          ) : (
            <span />
          )}
        </div>
      </>
    );
  } else if (modo === "dudas" && !(ultimo?.autor === "bot" && ultimo?.sugerencias?.length)) {
    controles = (
      <>
        <button type="button" className={cn(chip, chipActivo)} onClick={() => iniciarConsulta()}>
          Empezar mi consulta
        </button>
        <button type="button" className={chip} onClick={() => mostrarPersona()}>
          Hablar con una persona
        </button>
      </>
    );
  } else if (modo === "persona") {
    controles = (
      <>
        <button type="button" className={cn(chip, chipActivo)} onClick={() => iniciarConsulta()}>
          {respuestas.servicio ? "Volver a mi consulta" : "Mejor empiezo la consulta"}
        </button>
        <button type="button" className={chip} onClick={mostrarDudas}>
          Tengo una duda
        </button>
      </>
    );
  }

  const placeholder =
    modo === "consulta" && pasoActual
      ? pasoActual.campo === "servicio"
        ? "Escribe qué necesitas…"
        : "Escribe tu respuesta…"
      : "Escribe tu pregunta…";

  return (
    <div
      ref={panelRef}
      id="asistente-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${uid}-titulo`}
      aria-describedby={`${uid}-aviso`}
      data-asistente=""
      className="glass-strong panel-opaco panel-in fixed inset-x-3 bottom-3 z-[60] flex max-h-[min(86svh,700px)] flex-col overflow-hidden rounded-[24px] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:max-h-[min(700px,calc(100svh-110px))]"
    >
      <header className="flex items-center gap-3 border-b border-line py-3 pl-4 pr-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-line-strong bg-gradient-to-b from-[#171a20] to-[#0e1014]">
          <StarIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${uid}-titulo`} className="text-[15px] leading-tight tracking-[-0.01em]">
            {asistente.nombre}
          </h2>
          <p className="m-0 text-xs leading-snug text-muted">{asistente.descripcion}</p>
        </div>
        <button
          type="button"
          onClick={reiniciar}
          aria-label="Empezar de nuevo"
          title="Empezar de nuevo"
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
        className="flex min-h-[120px] flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {mensajes.map((m) =>
          m.autor === "usuario" ? (
            <p
              key={m.id}
              className="mensaje-in m-0 ml-auto max-w-[85%] whitespace-pre-line wrap-anywhere rounded-2xl rounded-tr-md border border-accent/25 bg-accent/[0.14] px-4 py-2.5 text-[14.5px] leading-relaxed text-text"
            >
              <span className="sr-only">Tú: </span>
              {m.texto}
            </p>
          ) : (
            <div key={m.id} className="mensaje-in flex max-w-[94%] flex-col gap-2.5">
              <p className="m-0 whitespace-pre-line rounded-2xl rounded-tl-md border border-line bg-white/[0.04] px-4 py-3 text-[14.5px] leading-relaxed text-text-2">
                <span className="sr-only">Asistente: </span>
                {m.texto}
              </p>

              {m.tipo === "resumen" && m === ultimo ? (
                <div data-resumen="" className="flex flex-col gap-3 rounded-2xl border border-line-strong bg-bg/50 p-4">
                  <dl className="m-0 flex flex-col gap-2.5">
                    {lineasResumen(respuestas).map((l) => (
                      <div key={l.campo} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <dt className="font-mono text-[11px] tracking-[0.06em] text-faint">{l.titulo}</dt>
                          <dd className="m-0 text-[14px] leading-snug text-text wrap-anywhere">{l.texto}</dd>
                        </div>
                        <button
                          type="button"
                          onClick={() => cambiar(l.campo)}
                          className="inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-[12.5px] font-medium text-accent-2 hover:text-text"
                          aria-label={`Cambiar ${l.titulo.toLowerCase()}`}
                        >
                          Cambiar
                        </button>
                      </div>
                    ))}
                  </dl>
                  {pasos.some((p) => p.opcional && !respuestas[p.campo]) ? (
                    <div className="flex flex-wrap gap-2">
                      {pasos
                        .filter((p) => p.opcional && !respuestas[p.campo])
                        .map((p) => (
                          <button key={p.campo} type="button" onClick={() => cambiar(p.campo)} className={accion}>
                            Añadir {p.titulo.toLowerCase()}
                          </button>
                        ))}
                    </div>
                  ) : null}
                  <div className="border-t border-line pt-3">
                    <p className="m-0 mb-1.5 font-mono text-[11px] tracking-[0.06em] text-faint">Mensaje para WhatsApp</p>
                    <p className="m-0 whitespace-pre-line wrap-anywhere rounded-xl bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed text-text-2">
                      {textoWhatsapp(mensajeConsulta(respuestas))}
                    </p>
                  </div>
                  <a href={enlaceWhatsapp} target="_blank" rel="noopener noreferrer" className={cn(principal, "w-full")}>
                    <WhatsAppIcon className="h-[18px] w-[18px] text-[#128C7E]" />
                    Abrir en WhatsApp
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only"> (se abre en una pestaña nueva; tú decides si envías el mensaje)</span>
                  </a>
                  <p className="m-0 text-[12px] leading-snug text-faint">
                    WhatsApp se abre con el mensaje listo. Nada se envía hasta que tú lo mandes.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={reiniciar} className={accion}>
                      Empezar de nuevo
                    </button>
                    <button type="button" onClick={() => mostrarPersona()} className={accion}>
                      Hablar con una persona
                    </button>
                  </div>
                </div>
              ) : null}

              {m.tipo === "persona" && m === ultimo ? contacto : null}

              {m.acciones?.length ? <div className="flex flex-wrap gap-2">{m.acciones.map(pintarAccion)}</div> : null}

              {m === ultimo && m.sugerencias?.length && (modo === "dudas" || modo === "inicio") ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Preguntas frecuentes">
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
      </div>

      {controles ? (
        <div
          ref={controlesRef}
          role="group"
          aria-label={pasoActual ? `Paso ${paso + 1} de ${pasos.length}. ${pasoActual.pregunta}` : "Opciones"}
          className="flex max-h-[42%] shrink-0 flex-wrap gap-2 overflow-y-auto border-t border-line px-4 py-3"
        >
          {controles}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviarTexto(texto);
        }}
        className="flex items-center gap-2 border-t border-line p-3"
      >
        <label htmlFor={`${uid}-texto`} className="sr-only">
          {placeholder.replace("…", "")}
        </label>
        <input
          ref={inputRef}
          id={`${uid}-texto`}
          type="text"
          autoComplete="off"
          maxLength={300}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-bg/60 px-4 text-base text-text sm:text-[15px] outline-hidden transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        <button
          type="submit"
          aria-label="Enviar"
          disabled={!texto.trim()}
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-text text-bg transition-[background-color,opacity,scale] active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
      <p id={`${uid}-aviso`} className="m-0 px-4 pb-3 text-[12px] leading-snug text-faint">
        {consulta.aviso}
      </p>
    </div>
  );
}
