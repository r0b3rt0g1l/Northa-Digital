"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Mail, RotateCcw, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { StarIcon } from "@/components/ui/StarIcon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { asistente } from "@/lib/content/asistente";
import {
  aplica,
  aplicarRespuesta,
  consulta,
  consultaCompleta,
  correoValido,
  lineasResumen,
  mensajeConsulta,
  OPCION_OTRA,
  opcionDesdeTexto,
  pasos,
  pasosVisibles,
  preguntaSola,
  quitarRespuesta,
  respuestasDesde,
  siguientePaso,
} from "@/lib/content/consulta";
import { interpretar, responderTema, responderTexto, temaPorId } from "@/lib/asistente";
import { site, textoWhatsapp } from "@/lib/site";
import { EnlaceWhatsapp } from "@/components/ui/EnlaceWhatsapp";
import { irASeccion } from "@/lib/acciones";

const CLAVE = "northa-asistente-v4";
const MAX_MENSAJES = 60;
const MODOS = ["consulta", "resumen", "dudas", "persona"];
// Datos que se conservan si el visitante empieza otra consulta desde la página.
const DATOS_PERSONALES = ["organizacion", "nombre", "contacto", "correo"];
// Frases explícitas para pedir una persona en cualquier momento.
const PIDE_PERSONA =
  /hablar con (una |un |alguna |alg[uú]n )?(persona|alguien|asesor(a)?|humano|ejecutiv[oa])|persona del equipo|atenci[oó]n humana|asesor(a)? humano/i;
// Dudas frecuentes que se contestan a mitad de la conversación sin guardarlas
// como respuesta; después se repite la pregunta pendiente.
const DUDAS_EN_CURSO = ["costos", "tiempos", "proceso", "asistente", "ubicacion", "redes-northa", "mantenimiento", "seguridad"];
/** Recorta por caracteres reales (no parte un emoji por la mitad). */
const recortar = (t, n) => Array.from(t).slice(0, n).join("");

let contador = 0;
const nuevoId = (prefijo) => `${prefijo}${Date.now().toString(36)}${(contador++).toString(36)}`;
const bot = (texto, extra = {}) => ({ id: nuevoId("b"), autor: "bot", texto, ...extra });
const usuario = (texto) => ({ id: nuevoId("u"), autor: "usuario", texto });

const normalizar = (t) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Tema de la conversación cuando empieza desde un servicio. */
function temaDe(r) {
  if (r.necesidad) return `Hablemos de ${r.necesidad.toLowerCase()}.`;
  if (r.tipo) return `Hablemos de tu ${r.tipo.toLowerCase()}.`;
  return "";
}

/** Primer mensaje: saludo breve y la primera pregunta que haga falta. */
function saludo(r, paso) {
  if (paso === 0 && !r.tiposSugeridos) return [bot(consulta.bienvenida)];
  const hola = ["¡Hola! Soy el asistente de Northa Digital.", temaDe(r)];
  if (paso >= pasos.length) return [bot(hola.filter(Boolean).join(" ")), bot(consulta.cierre, { tipo: "resumen" })];
  return [bot([...hola, preguntaSola(paso, r)].filter(Boolean).join(" "))];
}

function estadoInicial(respuestas = {}) {
  const paso = siguientePaso(respuestas);
  return {
    mensajes: saludo(respuestas, paso),
    modo: paso >= pasos.length ? "resumen" : "consulta",
    paso: Math.min(paso, pasos.length - 1),
    respuestas,
  };
}

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
      typeof g.respuestas === "object"
    ) {
      return g;
    }
  } catch {}
  return estadoInicial();
}

function guardarEstado(estado) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ ...estado, mensajes: estado.mensajes.slice(-MAX_MENSAJES) }));
  } catch {}
}

/** Mensajes con la tarjeta del cierre al final (sin duplicarla). */
const conCierre = (mensajes) =>
  mensajes.at(-1)?.tipo === "resumen" ? mensajes : [...mensajes, bot(consulta.cierre, { tipo: "resumen" })];

const reducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const chip =
  "inline-flex min-h-11 items-center rounded-full border border-line-strong bg-white/[0.03] px-4 text-left text-[14px] font-medium leading-snug text-text-2 transition-colors hover:border-white/25 hover:text-text";
const chipSecundario = "border-dashed text-muted";
const accion =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-accent/35 bg-accent/[0.08] px-4 text-[13.5px] font-medium text-text transition-colors hover:border-accent/60 hover:bg-accent/[0.14]";
const principal =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-text px-5 text-[14.5px] font-semibold text-bg transition-[background-color,scale] hover:bg-white active:scale-[0.98]";
const enlaceTexto =
  "inline-flex min-h-11 items-center rounded-full px-2 text-[13px] font-medium text-muted underline-offset-4 transition-colors hover:text-text hover:underline";

/**
 * Panel del asistente: una conversación breve con opciones claras que termina
 * en un mensaje listo para WhatsApp. Pregunta qué busca el visitante, para qué
 * municipio u organización, qué necesita, su nombre y cómo prefiere que lo
 * contacten; si no sabe qué necesita, le ayuda con una pregunta simple.
 * También responde dudas frecuentes y ofrece hablar con una persona. Nada se
 * envía solo: WhatsApp se abre cuando el visitante lo pide. No es
 * inteligencia artificial y no simula escribir.
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
  // El visitante respondió escribiendo: el foco sigue en el campo.
  const escribiendo = useRef(false);

  const { mensajes, modo, paso, respuestas } = estado;
  const pasoActual = modo === "consulta" ? pasos[paso] : null;

  useEffect(() => {
    guardarEstado(estado);
  }, [estado]);

  // Lleva la conversación al final y el foco a las nuevas opciones. En el
  // cierre se ancla en la última burbuja del visitante: así quedan a la vista
  // la respuesta a lo último que escribió y el principio de la tarjeta.
  useLayoutEffect(() => {
    const lista = listaRef.current;
    if (lista) {
      const ancla = modo === "resumen" ? [...lista.children].findLast((n) => n.tagName === "P") : null;
      const top = ancla
        ? lista.scrollTop + ancla.getBoundingClientRect().top - lista.getBoundingClientRect().top - 12
        : lista.scrollHeight;
      lista.scrollTo({ top, behavior: reducido() ? "auto" : "smooth" });
    }
    if (!enfocarControles.current) return;
    enfocarControles.current = false;
    // Pasos que se responden escribiendo (municipio, nombre, correo): el foco
    // va al campo con puntero fino; en táctil no se abre el teclado solo.
    const soloTexto =
      modo === "consulta" && pasos[paso]?.texto && !pasos[paso].opciones(respuestas).length &&
      window.matchMedia("(pointer: fine)").matches;
    // Quien responde escribiendo sigue en el campo mientras dura la consulta;
    // el cierre lleva el foco a la tarjeta del resumen.
    const seguirEscribiendo = escribiendo.current;
    escribiendo.current = false;
    if (modo === "consulta" && (seguirEscribiendo || soloTexto)) {
      inputRef.current?.focus({ preventScroll: true });
      return;
    }
    const primero =
      controlesRef.current?.querySelector("button, a, input") ??
      (modo === "resumen" ? listaRef.current?.querySelector("[data-resumen] button") : null);
    (primero ?? inputRef.current)?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ---------- Conversación ----------

  /** Pasa a la pregunta que falte o, si ya está todo, al cierre. */
  const avanzar = (prev, r, nuevos) => {
    const sig = siguientePaso(r);
    if (sig >= pasos.length) {
      return { ...prev, respuestas: r, modo: "resumen", mensajes: conCierre([...prev.mensajes, ...nuevos]) };
    }
    return {
      ...prev,
      respuestas: r,
      modo: "consulta",
      paso: sig,
      mensajes: [...prev.mensajes, ...nuevos, bot(pasos[sig].pregunta(r))],
    };
  };

  const iniciarConsulta = useCallback((servicioId) => {
    actualizar((prev) => {
      if (!servicioId) {
        // Sin servicio: sigue la conversación en curso o vuelve al cierre.
        if (prev.modo === "consulta") {
          return { ...prev, mensajes: [...prev.mensajes, bot(`Sigamos. ${preguntaSola(prev.paso, prev.respuestas)}`)] };
        }
        if (consultaCompleta(prev.respuestas)) {
          return { ...prev, modo: "resumen", mensajes: conCierre(prev.mensajes) };
        }
        const sig = siguientePaso(prev.respuestas);
        const intro = Object.keys(prev.respuestas).length ? "Sigamos. " : "";
        return {
          ...prev,
          modo: "consulta",
          paso: sig,
          mensajes: [...prev.mensajes, bot(intro + preguntaSola(sig, prev.respuestas))],
        };
      }
      // Desde un servicio de la página: nueva consulta sobre ese servicio que
      // conserva los datos que el visitante ya dio.
      const conservados = Object.fromEntries(
        DATOS_PERSONALES.filter((k) => k in prev.respuestas).map((k) => [k, prev.respuestas[k]]),
      );
      const r = { ...conservados, ...respuestasDesde(servicioId) };
      const sinConversar = prev.mensajes.length === 1 && !Object.keys(prev.respuestas).length;
      if (sinConversar) return estadoInicial(r);
      const sig = siguientePaso(r);
      const tema = temaDe(r);
      if (sig >= pasos.length) {
        return { ...prev, respuestas: r, modo: "resumen", mensajes: conCierre([...prev.mensajes, bot(tema)]) };
      }
      // Si esa misma pregunta ya es la última del chat, solo se nombra el tema.
      const pregunta = preguntaSola(sig, r);
      const yaPreguntada = prev.modo === "consulta" && prev.paso === sig && prev.mensajes.at(-1)?.texto?.endsWith(pregunta);
      return {
        ...prev,
        respuestas: r,
        modo: "consulta",
        paso: sig,
        mensajes: [...prev.mensajes, bot(yaPreguntada ? tema : [tema, pregunta].filter(Boolean).join(" "))],
      };
    });
  }, []);

  /** Guarda la respuesta del paso actual y sigue. */
  const responderPaso = (valor, eco) => {
    actualizar((prev) => {
      const p = pasos[prev.paso];
      const r = aplicarRespuesta(prev.respuestas, p.campo, valor);
      return avanzar(prev, r, [usuario(eco ?? valor)]);
    });
  };

  const elegirOpcion = (opcion) => {
    if (opcion === OPCION_OTRA) {
      inputRef.current?.focus();
      return;
    }
    responderPaso(opcion);
  };

  /** Paso anterior con respuesta (para «Atrás»), o -1. */
  const anterior = pasoActual
    ? pasos.findLastIndex(
        (p, i) => i < paso && aplica(p, respuestas) && p.campo in respuestas && !respuestas.precargados?.includes(p.campo),
      )
    : -1;

  const atras = () => {
    if (anterior < 0) return;
    actualizar((prev) => {
      const r = quitarRespuesta(prev.respuestas, pasos[anterior].campo);
      const sig = siguientePaso(r);
      return { ...prev, respuestas: r, paso: sig, mensajes: [...prev.mensajes, usuario("Atrás"), bot(preguntaSola(sig, r))] };
    });
  };

  /** Cambiar una respuesta desde el cierre: se vuelve a preguntar solo eso. */
  const cambiar = (campo) => {
    const i = pasos.findIndex((p) => p.campo === campo);
    if (i < 0) return;
    actualizar((prev) => {
      const r = quitarRespuesta(prev.respuestas, campo);
      const sig = siguientePaso(r);
      return {
        ...prev,
        respuestas: r,
        modo: "consulta",
        paso: sig,
        mensajes: [...prev.mensajes, usuario(`Cambiar: ${pasos[i].titulo.toLowerCase()}`), bot(preguntaSola(sig, r))],
      };
    });
  };

  // ---------- Dudas y persona ----------

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
      const nuevos = [...prev.mensajes, usuario(deUsuario), bot(respuesta.texto, respuesta)];
      if (prev.modo === "consulta") {
        return { ...prev, mensajes: [...nuevos, bot(`Sigamos. ${preguntaSola(prev.paso, prev.respuestas)}`)] };
      }
      return {
        ...prev,
        modo: prev.modo === "consulta" || prev.modo === "resumen" ? prev.modo : "dudas",
        // En el cierre, la tarjeta con «Continuar por WhatsApp» vuelve a quedar al final.
        mensajes: prev.modo === "resumen" ? conCierre(nuevos) : nuevos,
      };
    });
    // En el cierre el foco se queda en el campo de texto.
    if (modo === "resumen") enfocarControles.current = false;
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

  /** Un aviso del asistente sin cambiar de paso ni mover el foco. */
  const avisar = (deUsuario, texto) => {
    setEstado((prev) => ({ ...prev, mensajes: [...prev.mensajes, usuario(deUsuario), bot(texto)] }));
    inputRef.current?.focus({ preventScroll: true });
  };

  const enviarTexto = (valor) => {
    const limpio = recortar(valor.trim(), 200);
    if (!limpio) return;
    const paso = pasoActual?.campo;
    const pidePersona = PIDE_PERSONA.test(limpio) && (paso !== "necesidad" || limpio.split(/\s+/).length <= 7);
    if ((modo === "consulta" || modo === "resumen") && pidePersona) {
      setTexto("");
      mostrarPersona(limpio);
      return;
    }
    if (modo === "consulta" && pasoActual) {
      // El correo se valida antes de borrar el campo: si falla, sigue ahí.
      if (paso === "correo") {
        if (!correoValido(limpio)) {
          avisar(limpio, consulta.correoInvalido);
          return;
        }
        setTexto("");
        escribiendo.current = true;
        responderPaso(limpio);
        return;
      }
      setTexto("");
      escribiendo.current = true;
      const tema = interpretar(limpio).tema?.id;
      // Un saludo en el primer paso: se saluda y se repite la pregunta.
      if (paso === "tipo" && tema === "saludo") {
        actualizar((prev) => ({ ...prev, mensajes: [...prev.mensajes, usuario(limpio), bot(`¡Hola! ${preguntaSola(0, prev.respuestas)}`)] }));
        return;
      }
      // Contacto: un correo escrito elige «Correo» y lo guarda de una vez.
      if (paso === "contacto" && correoValido(limpio)) {
        actualizar((prev) => {
          const r = aplicarRespuesta(aplicarRespuesta(prev.respuestas, "contacto", "Correo"), "correo", limpio);
          return avanzar(prev, r, [usuario(limpio)]);
        });
        return;
      }
      // Contacto: no hay llamadas; se aclara y se pide elegir WhatsApp o correo.
      if (paso === "contacto" && /llam|marc|telef|celular/i.test(limpio) && !/whats|wasap|wpp|correo|mail/i.test(limpio)) {
        avisar(limpio, consulta.sinLlamadas);
        return;
      }
      // Pasos de solo opciones: se entienden sinónimos («por WhatsApp», «es para mi negocio»).
      const opcion = !pasoActual.texto ? opcionDesdeTexto(paso, limpio) : null;
      if (opcion) {
        responderPaso(opcion, limpio);
        return;
      }
      // Dudas a mitad (precio, plazos, quién responde…) o una pregunta donde
      // va un nombre: se contestan y la pregunta del paso sigue pendiente.
      const esDuda = DUDAS_EN_CURSO.includes(tema) && paso !== "contacto";
      const preguntaEnDato = (paso === "organizacion" || paso === "nombre") && /[¿?]/.test(limpio);
      if (esDuda || preguntaEnDato) {
        responderDuda(limpio, responderTexto(limpio));
        return;
      }
      if (pasoActual.texto) {
        responderPaso(paso === "nombre" ? recortar(limpio, 60) : limpio);
        return;
      }
      // Paso de solo opciones sin coincidencia: se pide elegir, sin cambiar de paso.
      avisar(limpio, tema && tema !== "saludo" ? responderTexto(limpio).texto : "Elige una de las opciones de abajo o escríbela con otras palabras.");
      return;
    }
    setTexto("");
    responderDuda(limpio, responderTexto(limpio));
  };

  // Una petición desde fuera: CTA, menú de servicios, banda o pregunta.
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
  const completa = consultaCompleta(respuestas);
  const mensajeFinal = textoWhatsapp(mensajeConsulta(respuestas), respuestas.nombre);
  const visibles = pasosVisibles(respuestas);
  const numeroPaso = pasoActual ? visibles.indexOf(pasoActual) + 1 : 0;

  const contacto = (
    <div className="flex flex-wrap gap-2">
      <EnlaceWhatsapp
        texto={textoWhatsapp(
          lineasResumen(respuestas).length
            ? `${mensajeConsulta(respuestas)}\n\n${consulta.mensajePersona}`
            : consulta.mensajePersona,
          respuestas.nombre,
        )}
        className={principal}
      >
        <WhatsAppIcon className="h-4 w-4 text-[#128C7E]" />
        Escribir por WhatsApp
      </EnlaceWhatsapp>
      <a href={site.contact.emailHref} className={accion}>
        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
        {site.contact.email}
      </a>
    </div>
  );

  const pintarAccion = (a) => {
    if (a.tipo === "whatsapp") {
      return (
        <EnlaceWhatsapp
          key={a.label}
          texto={textoWhatsapp(
            completa ? `${mensajeConsulta(respuestas)}\n\n${a.texto ?? ""}`.trim() : a.texto ?? "",
            respuestas.nombre,
          )}
          className={accion}
        >
          <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
          {a.label}
        </EnlaceWhatsapp>
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
  };

  // Atajos discretos: hablar con una persona y, al empezar, resolver una duda.
  const atajos = (
    <div className="flex w-full flex-wrap items-center gap-x-1">
      <button type="button" onClick={() => mostrarPersona()} className={enlaceTexto}>
        Hablar con una persona
      </button>
      {modo === "consulta" && numeroPaso <= 1 ? (
        <button type="button" onClick={mostrarDudas} className={enlaceTexto}>
          Tengo una duda
        </button>
      ) : null}
    </div>
  );

  let controles = null;
  if (pasoActual) {
    controles = (
      <>
        {opcionesPaso.map((o) => (
          <button key={o} type="button" onClick={() => elegirOpcion(o)} className={chip}>
            {o}
          </button>
        ))}
        {pasoActual.otra ? (
          <button type="button" className={cn(chip, chipSecundario)} onClick={() => elegirOpcion(OPCION_OTRA)}>
            {OPCION_OTRA}
          </button>
        ) : null}
        {pasoActual.reserva ? (
          <button type="button" className={cn(chip, chipSecundario)} onClick={() => responderPaso(pasoActual.reserva)}>
            {pasoActual.reserva}
          </button>
        ) : null}
        <div className="flex w-full items-center justify-between gap-2 pt-1">
          {anterior >= 0 ? (
            <button type="button" onClick={atras} className={cn(enlaceTexto, "gap-1.5 no-underline hover:no-underline")}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Atrás
            </button>
          ) : (
            <span />
          )}
          <span className="font-mono text-[11px] text-faint" aria-hidden="true">
            {numeroPaso} / {visibles.length}
          </span>
        </div>
        {atajos}
      </>
    );
  } else if (modo === "dudas") {
    controles = (
      <>
        <button type="button" className={chip} onClick={() => iniciarConsulta()}>
          {completa ? "Volver a mi consulta" : "Seguir con mi consulta"}
        </button>
        {atajos}
      </>
    );
  } else if (modo === "persona") {
    controles = (
      <>
        <button type="button" className={chip} onClick={() => iniciarConsulta()}>
          {Object.keys(respuestas).length ? "Volver a mi consulta" : "Mejor cuéntame tu proyecto"}
        </button>
        <button type="button" className={chip} onClick={mostrarDudas}>
          Tengo una duda
        </button>
      </>
    );
  }

  const placeholder = pasoActual ? pasoActual.entrada ?? "Escribe tu respuesta…" : "Escribe tu pregunta…";

  return (
    <div
      ref={panelRef}
      id="asistente-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${uid}-titulo`}
      aria-describedby={`${uid}-desc ${uid}-aviso`}
      data-asistente=""
      className="glass-strong panel-opaco panel-in fixed inset-x-3 bottom-3 z-[60] flex max-h-[min(86svh,700px)] flex-col overflow-hidden rounded-[24px] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:max-h-[min(680px,calc(100svh-110px))]"
    >
      <header className="flex items-center gap-3 border-b border-line py-3 pl-4 pr-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-line-strong bg-gradient-to-b from-[#171a20] to-[#0e1014]">
          <StarIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${uid}-titulo`} className="text-[15px] leading-tight tracking-[-0.01em]">
            {asistente.nombre}
          </h2>
          <p id={`${uid}-desc`} className="m-0 text-xs leading-snug text-muted">
            {asistente.descripcion}
          </p>
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
              {m.texto ? (
                <p className="m-0 whitespace-pre-line rounded-2xl rounded-tl-md border border-line bg-white/[0.04] px-4 py-3 text-[14.5px] leading-relaxed text-text-2">
                  <span className="sr-only">Asistente: </span>
                  {m.texto}
                </p>
              ) : null}

              {m.tipo === "resumen" && m === ultimo ? (
                <div data-resumen="" className="flex flex-col gap-3 rounded-2xl border border-line-strong bg-bg/50 p-4">
                  <dl className="m-0 flex flex-col gap-2">
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
                  <EnlaceWhatsapp texto={mensajeFinal} className={cn(principal, "w-full")}>
                    <WhatsAppIcon className="h-[18px] w-[18px] text-[#128C7E]" />
                    Continuar por WhatsApp
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only"> (abre WhatsApp; tú decides si envías el mensaje)</span>
                  </EnlaceWhatsapp>
                  <p className="m-0 text-[12px] leading-snug text-faint">
                    Se abre WhatsApp con el mensaje listo. Nada se envía hasta que tú lo mandes.
                  </p>
                  <details className="group rounded-xl bg-white/[0.03] px-3 py-1">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[13px] font-medium text-text-2">
                      Ver el mensaje
                      <span aria-hidden="true" className="transition-transform group-open:rotate-180">
                        ⌄
                      </span>
                    </summary>
                    <p className="m-0 whitespace-pre-line wrap-anywhere pb-2.5 text-[13px] leading-relaxed text-text-2">
                      {mensajeFinal}
                    </p>
                  </details>
                  <div className="flex flex-wrap gap-x-1">
                    <button type="button" onClick={reiniciar} className={enlaceTexto}>
                      Empezar de nuevo
                    </button>
                    <button type="button" onClick={() => mostrarPersona()} className={enlaceTexto}>
                      Hablar con una persona
                    </button>
                  </div>
                </div>
              ) : null}

              {m.tipo === "persona" && m === ultimo ? contacto : null}

              {m.acciones?.length ? (
                <div className="flex flex-wrap gap-2">
                  {m.acciones
                    // «Contar mi proyecto» sobra si ya se está contando o ya está completo.
                    .filter((a) => !(a.tipo === "consulta" && !a.servicio && (m !== ultimo || modo === "consulta" || completa)))
                    .map(pintarAccion)}
                </div>
              ) : null}

              {m === ultimo && m.sugerencias?.length && modo === "dudas" ? (
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
          aria-label={pasoActual ? `Paso ${numeroPaso} de ${visibles.length}. ${pasoActual.pregunta(respuestas)}` : "Opciones"}
          className="flex max-h-[42svh] min-h-0 shrink flex-wrap gap-2 overflow-y-auto border-t border-line px-4 py-3"
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
          {pasoActual?.etiqueta ?? placeholder.replace("…", "")}
        </label>
        <input
          ref={inputRef}
          id={`${uid}-texto`}
          type="text"
          inputMode={pasoActual?.campo === "correo" ? "email" : undefined}
          autoComplete={pasoActual?.campo === "nombre" ? "given-name" : pasoActual?.campo === "correo" ? "email" : "off"}
          maxLength={200}
          aria-invalid={ultimo?.texto === consulta.correoInvalido || undefined}
          aria-describedby={ultimo?.texto === consulta.correoInvalido ? `${uid}-error` : undefined}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-bg/60 px-4 text-base text-text outline-hidden transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25 sm:text-[15px]"
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
      {ultimo?.texto === consulta.correoInvalido ? (
        <p id={`${uid}-error`} className="sr-only">
          {consulta.correoInvalido}
        </p>
      ) : null}
      <p id={`${uid}-aviso`} className="m-0 px-4 pb-3 text-[12px] leading-snug text-faint">
        {consulta.aviso}
      </p>
    </div>
  );
}
