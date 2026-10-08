"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Send, Loader2, CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { contacto as textos, opcionesContacto } from "@/lib/content/contacto";
import { site, whatsappConTexto } from "@/lib/site";
import {
  CLAVE_MENSAJE_PENDIENTE,
  EVENTO_MENSAJE,
  abrirAsistente,
  alTerminarScroll,
  irASeccion,
} from "@/lib/acciones";

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
const ES_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const campo =
  "w-full border border-line-strong bg-bg/60 px-4 text-base text-text outline-hidden transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25";

const botonPrimario =
  "inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-text px-6 text-[15px] font-semibold text-bg shadow-[0_12px_40px_-16px_rgba(79,140,255,0.6)] transition-[background-color,box-shadow,scale] duration-300 hover:bg-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60";

const enlaceSuave =
  "inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-medium text-text-2 underline decoration-white/25 underline-offset-4 transition-colors hover:text-text hover:decoration-white/60";

/**
 * "Cuéntanos qué necesitas en 30 segundos": texto libre, temas opcionales y
 * un solo dato para responder. Dos vías, las dos funcionales:
 *  - Con clave de Web3Forms: "Enviar mensaje" envía por correo y WhatsApp
 *    queda como segunda opción con el mismo texto.
 *  - Sin clave: el botón principal abre WhatsApp con el mensaje armado.
 * Sin JavaScript también funciona y nunca deja datos en la URL del sitio.
 */
export function ContactoRapido({ accessKey = "" }) {
  const conClave = Boolean(accessKey);
  const uid = useId();
  const textareaRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error | whatsapp
  const [mensaje, setMensaje] = useState("");
  const [contacto, setContacto] = useState("");
  const [temas, setTemas] = useState([]);
  const [trampa, setTrampa] = useState(false);

  const etiquetasTemas = opcionesContacto.filter((o) => temas.includes(o.id)).map((o) => o.label);
  const textoWhatsapp = [
    etiquetasTemas.length ? `Tema: ${etiquetasTemas.join(", ")}.` : "",
    mensaje.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
  const urlWhatsapp = whatsappConTexto(textoWhatsapp);

  const enfocar = () => textareaRef.current?.focus({ preventScroll: true });

  // El asistente puede traer al visitante aquí con su pregunta precargada.
  useEffect(() => {
    const onMensaje = (e) => {
      const texto = e.detail?.texto?.trim();
      if (texto) setMensaje((prev) => (prev.trim() ? prev : texto));
      setStatus((s) => (s === "success" ? "idle" : s));
      irASeccion("contacto");
      alTerminarScroll(enfocar);
    };
    window.addEventListener(EVENTO_MENSAJE, onMensaje);
    // Mensaje que el asistente dejó pendiente desde otra página (404).
    let pendiente = null;
    try {
      pendiente = sessionStorage.getItem(CLAVE_MENSAJE_PENDIENTE);
      sessionStorage.removeItem(CLAVE_MENSAJE_PENDIENTE);
    } catch {}
    const t = pendiente
      ? setTimeout(() => window.dispatchEvent(new CustomEvent(EVENTO_MENSAJE, { detail: { texto: pendiente } })), 300)
      : null;
    return () => {
      window.removeEventListener(EVENTO_MENSAJE, onMensaje);
      if (t) clearTimeout(t);
    };
  }, []);

  // Los botones "Cuéntanos tu proyecto" dejan el cursor listo para escribir
  // en escritorio o con teclado; en táctil no se abre el teclado sin pedirlo.
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href="/#contacto"], a[href="#contacto"]') : null;
      if (!a || window.location.pathname !== "/") return;
      const conTeclado = e.detail === 0;
      if (!conTeclado && !window.matchMedia("(pointer: fine)").matches) return;
      alTerminarScroll(enfocar);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const toggleTema = (id) =>
    setTemas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const abrirWhatsapp = () => {
    // Sin "noopener" en las opciones: con él, window.open siempre devuelve
    // null y el respaldo se llevaría también esta pestaña.
    const ventana = window.open(urlWhatsapp, "_blank");
    if (ventana) {
      try {
        ventana.opener = null;
      } catch {}
    } else {
      window.location.assign(urlWhatsapp);
    }
    setStatus("whatsapp");
  };

  // Validación con los valores reales (sin espacios) y un dato de contacto
  // que sirva para responder: un correo o un número de al menos 10 dígitos.
  const validar = (form) => {
    textareaRef.current?.setCustomValidity(
      mensaje.trim().length < 10 ? "Cuéntanos un poco más: al menos 10 caracteres." : "",
    );
    const campoContacto = form.elements.namedItem("contacto");
    if (campoContacto) {
      const valor = contacto.trim();
      const digitos = valor.replace(/\D/g, "").length;
      campoContacto.setCustomValidity(
        ES_CORREO.test(valor) || digitos >= 10 ? "" : "Escribe un correo o un número de WhatsApp de 10 dígitos.",
      );
    }
    return form.reportValidity();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validar(e.currentTarget)) return;
    if (!conClave) {
      abrirWhatsapp();
      return;
    }
    if (trampa) return; // honeypot: un humano nunca marca esta casilla
    setStatus("submitting");
    try {
      const correo = ES_CORREO.test(contacto.trim()) ? contacto.trim() : undefined;
      const res = await fetch(WEB3FORMS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: accessKey,
          subject: "Nuevo mensaje desde el sitio de Northa Digital",
          from_name: "Sitio de Northa Digital",
          mensaje: mensaje.trim(),
          contacto: contacto.trim(),
          temas: etiquetasTemas.join(", ") || "Sin tema",
          ...(correo ? { replyto: correo } : {}),
          botcheck: false,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error("envío rechazado");
      setStatus("success");
      setMensaje("");
      setContacto("");
      setTemas([]);
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div role="status" className="mt-8 flex flex-col items-start gap-4 rounded-[20px] border border-accent/30 bg-accent/[0.07] p-6 sm:p-8">
        <CheckCircle2 className="h-7 w-7 text-accent-2" aria-hidden="true" />
        <h3 className="text-[length:var(--text-h3)]">Mensaje enviado</h3>
        <p className="m-0 max-w-[50ch] text-text-2">
          Gracias por escribir. Te responderemos con el siguiente paso.
        </p>
        <button type="button" onClick={() => setStatus("idle")} className={enlaceSuave}>
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  // Sin JavaScript: con clave, POST directo a Web3Forms; sin clave, el
  // mensaje se abre en WhatsApp (el único destino que verá el texto).
  const formSinJs = conClave
    ? { method: "post", action: WEB3FORMS_ENDPOINT }
    : { method: "get", action: site.contact.whatsappHref, target: "_blank" };

  return (
    <form {...formSinJs} onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
      {conClave ? (
        <>
          <input type="hidden" name="access_key" value={accessKey} />
          <input type="hidden" name="subject" value="Nuevo mensaje desde el sitio de Northa Digital" />
          <input type="hidden" name="from_name" value="Sitio de Northa Digital" />
        </>
      ) : null}

      <div className="flex flex-col gap-3">
        <p id={`${uid}-temas`} className="m-0 text-sm text-muted">
          {textos.etiquetaTemas}
        </p>
        <div role="group" aria-labelledby={`${uid}-temas`} className="flex flex-wrap gap-2">
          {opcionesContacto.map((o) => {
            const activo = temas.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={activo}
                onClick={() => toggleTema(o.id)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-[13.5px] font-medium transition-[border-color,background-color,color] duration-200",
                  activo
                    ? "border-accent/60 bg-accent/10 text-text"
                    : "border-line-strong bg-white/[0.03] text-text-2 hover:border-white/25 hover:text-text",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${uid}-mensaje`} className="text-sm font-semibold text-text">
          Tu mensaje
        </label>
        <textarea
          ref={textareaRef}
          id={`${uid}-mensaje`}
          name={conClave ? "mensaje" : "text"}
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          value={mensaje}
          onChange={(e) => {
            e.target.setCustomValidity("");
            setMensaje(e.target.value);
          }}
          placeholder="Por ejemplo: necesitamos un portal para publicar información y recibir solicitudes…"
          className={cn(campo, "resize-y rounded-2xl py-3.5 leading-relaxed")}
        />
      </div>

      {conClave ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${uid}-contacto`} className="text-sm font-semibold text-text">
            Correo o WhatsApp para responderte
          </label>
          <input
            id={`${uid}-contacto`}
            name="contacto"
            type="text"
            autoComplete="on"
            required
            minLength={6}
            maxLength={120}
            value={contacto}
            onChange={(e) => {
              e.target.setCustomValidity("");
              setContacto(e.target.value);
            }}
            placeholder="tu@correo.com o 662 000 0000"
            className={cn(campo, "h-[52px] rounded-full")}
          />
        </div>
      ) : null}

      {/* Honeypot de Web3Forms: invisible para personas. */}
      <input
        type="checkbox"
        name="botcheck"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        checked={trampa}
        onChange={(e) => setTrampa(e.target.checked)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <button type="submit" disabled={status === "submitting"} data-magnetic="" className={botonPrimario}>
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Enviando…
            </>
          ) : conClave ? (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Enviar mensaje
            </>
          ) : (
            <>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Enviar por WhatsApp
            </>
          )}
        </button>
        {conClave ? (
          <a href={urlWhatsapp} target="_blank" rel="noopener noreferrer" className={enlaceSuave}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            o envíalo por WhatsApp
          </a>
        ) : (
          <a href={site.contact.emailHref} className={enlaceSuave}>
            o escríbenos por correo
          </a>
        )}
      </div>

      {status === "whatsapp" ? (
        <p role="status" className="m-0 rounded-2xl border border-accent/30 bg-accent/[0.07] px-4 py-3 text-sm text-text-2">
          Abrimos WhatsApp con tu mensaje para que lo envíes desde ahí. Si no se abrió,{" "}
          <a href={urlWhatsapp} target="_blank" rel="noopener noreferrer" className="font-semibold text-text underline underline-offset-4">
            usa este enlace
          </a>
          .
        </p>
      ) : null}

      {status === "error" ? (
        <p role="alert" className="m-0 flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            No se pudo enviar. Intenta de nuevo o{" "}
            <a href={urlWhatsapp} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
              envíalo por WhatsApp
            </a>
            .
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-1 border-t border-line pt-5 text-sm text-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <p className="m-0">{textos.privacidad}</p>
        <p className="m-0 flex flex-wrap items-center gap-x-1">
          {textos.asistente.replace(/\.$/, "")}:
          <button type="button" onClick={() => abrirAsistente()} aria-haspopup="dialog" className={enlaceSuave}>
            abrir asistente
          </button>
        </p>
      </div>
    </form>
  );
}

export default ContactoRapido;
