import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { BotonAsistente } from "@/components/ui/BotonAsistente";
import { StarIcon } from "@/components/ui/StarIcon";
import { Palabras } from "@/components/ui/Palabras";
import { site } from "@/lib/site";
import { ctaPrincipal } from "@/lib/content/nav";

/**
 * ¿Cómo contacto? Cierre limpio: la estrella como señal, un titular, una
 * línea, el CTA principal, el asistente y el contacto directo en una línea.
 */
export function Cierre() {
  return (
    <section
      id="empezar"
      aria-labelledby="cierre-title"
      className="relative overflow-hidden px-5 pb-28 pt-20 text-center sm:px-8 sm:pb-40 sm:pt-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-35%] left-1/2 h-[720px] w-[1200px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(79,140,255,0.12),rgba(79,140,255,0)_70%)]"
      />
      <Reveal data-cielo-claro className="relative mx-auto flex w-full max-w-[860px] flex-col items-center gap-6">
        <StarIcon className="h-9 w-9 [filter:drop-shadow(0_0_18px_rgba(127,211,255,0.55))]" />
        <h2 id="cierre-title" className="text-[length:var(--text-cierre)] leading-[1.02] tracking-[-0.035em]">
          <Palabras>Tu siguiente proyecto puede empezar aquí.</Palabras>
        </h2>
        <p className="m-0 max-w-[50ch] text-[length:var(--text-lead)] text-text-2">
          Cuéntanos qué quieres construir, mejorar o comunicar. Te diremos con claridad cómo
          podemos ayudarte.
        </p>
        <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button href={ctaPrincipal.href}>{ctaPrincipal.label}</Button>
          <BotonAsistente />
        </div>
        <p className="m-0 mt-1 text-sm text-muted">
          También por{" "}
          <a
            href={site.contact.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-3 text-text-2 underline decoration-white/25 underline-offset-4 transition-colors hover:text-text"
          >
            WhatsApp
          </a>{" "}
          o{" "}
          <a
            href={site.contact.emailHref}
            className="inline-block py-3 text-text-2 underline decoration-white/25 underline-offset-4 transition-colors hover:text-text"
          >
            correo
          </a>
          .
        </p>
      </Reveal>
    </section>
  );
}

export default Cierre;
