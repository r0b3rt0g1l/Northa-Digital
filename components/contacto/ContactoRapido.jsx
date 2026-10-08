"use client";

import { useId, useState } from "react";
import { Send, Loader2, CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { opcionesContacto } from "@/lib/content/contacto";
import { site } from "@/lib/site";

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

const fieldClasses =
  "w-full border border-line-strong bg-bg/60 px-4 text-base text-text outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25";

/**
 * "Cuéntanos qué necesitas en 30 segundos": texto libre, chips opcionales y
 * un solo dato de contacto. Envía por Web3Forms; sin clave configurada,
 * ofrece mandar el mismo mensaje por WhatsApp. Nunca bloquea con preguntas.
 */
export function ContactoRapido({ accessKey = "" }) {
  const uid = useId();
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error | whatsapp
  const [errorMsg, setErrorMsg] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [contacto, setContacto] = useState("");
  const [interes, setInteres] = useState([]);

  const toggleInteres = (id) =>
    setInteres((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const interesLabels = opcionesContacto
    .filter((o) => interes.includes(o.id))
    .map((o) => o.label);

  const whatsappText = encodeURIComponent(
    [
      "Hola, les escribo desde northa.digital.",
      interesLabels.length ? `Interés: ${interesLabels.join(", ")}.` : "",
      mensaje.trim(),
      contacto.trim() ? `Contacto: ${contacto.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const whatsappUrl = `${site.contact.whatsappHref}?text=${whatsappText}`;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!accessKey) {
      setStatus("whatsapp");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(WEB3FORMS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: accessKey,
          subject: "Nuevo mensaje — Northa Digital",
          from_name: "Northa Digital · Sitio",
          mensaje: mensaje.trim(),
          contacto: contacto.trim(),
          interes: interesLabels.join(", "),
          botcheck: "",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "No se pudo enviar.");
      setStatus("success");
      setMensaje("");
      setContacto("");
      setInteres([]);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err?.message || "");
    }
  };

  if (status === "success") {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-4 rounded-[20px] border border-accent/30 bg-accent/[0.07] p-6 sm:p-8"
      >
        <CheckCircle2 className="h-7 w-7 text-accent-2" aria-hidden="true" />
        <h3 className="text-[length:var(--text-h3)]">Mensaje enviado</h3>
        <p className="m-0 max-w-[50ch] text-text-2">
          Gracias por escribir. Lo leeremos con atención y te responderemos con
          claridad sobre el siguiente paso.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-text"
        >
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate={false}>
      {/* Chips opcionales */}
      <div role="group" aria-label="Orienta tu mensaje (opcional)" className="flex flex-wrap gap-2">
        {opcionesContacto.map((o) => {
          const on = interes.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleInteres(o.id)}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium transition-[border-color,background-color,color] duration-200",
                on
                  ? "border-accent/60 bg-accent/10 text-text"
                  : "border-line-strong bg-white/[0.03] text-text-2 hover:border-white/25 hover:text-text",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${uid}-mensaje`} className="text-sm font-semibold text-text">
          Tu mensaje
        </label>
        <textarea
          id={`${uid}-mensaje`}
          name="mensaje"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Por ejemplo: necesitamos un portal para publicar información y recibir solicitudes…"
          className={cn(fieldClasses, "resize-y rounded-2xl py-3.5 leading-relaxed")}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${uid}-contacto`} className="text-sm font-semibold text-text">
            Correo o WhatsApp para responderte
          </label>
          <input
            id={`${uid}-contacto`}
            name="contacto"
            type="text"
            inputMode="email"
            autoComplete="email"
            required
            minLength={6}
            maxLength={120}
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="tu@correo.com o +52 …"
            className={cn(fieldClasses, "h-[52px] rounded-full")}
          />
        </div>
        <button
          type="submit"
          disabled={status === "submitting"}
          data-magnetic=""
          className="inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-text px-6 text-[15px] font-semibold text-bg shadow-[0_12px_40px_-16px_rgba(79,140,255,0.6)] transition-[background-color,box-shadow] duration-300 hover:bg-white hover:shadow-[0_16px_48px_-16px_rgba(79,140,255,0.8)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Enviando…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Enviar mensaje
            </>
          )}
        </button>
      </div>

      {/* Honeypot de Web3Forms */}
      <input
        type="checkbox"
        name="botcheck"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {status === "error" ? (
        <p
          role="alert"
          className="m-0 flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            No se pudo enviar. Intenta de nuevo o{" "}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              mándanos el mensaje por WhatsApp
            </a>
            .
            {errorMsg ? (
              <span className="mt-1 block text-xs text-red-200/70">{errorMsg}</span>
            ) : null}
          </span>
        </p>
      ) : null}

      {status === "whatsapp" ? (
        <p
          role="status"
          className="m-0 flex flex-wrap items-center gap-3 rounded-2xl border border-accent/30 bg-accent/[0.07] px-4 py-3 text-sm text-text-2"
        >
          <span>Tu mensaje está listo.</span>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-semibold text-text underline underline-offset-4"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Enviarlo por WhatsApp
          </a>
        </p>
      ) : (
        <p className="m-0 text-sm text-muted">
          Si lo prefieres, escríbenos directo por{" "}
          <a
            href={site.contact.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-2 underline underline-offset-4 transition-colors hover:text-text"
          >
            WhatsApp
          </a>
          .
        </p>
      )}
    </form>
  );
}

export default ContactoRapido;
