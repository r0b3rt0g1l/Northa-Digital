import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";
import { ctaPrincipal } from "@/lib/content/nav";

/**
 * Cierre minimalista: un titular, un texto breve, dos acciones y los datos
 * de contacto reales. Enlaza al bloque de contacto (#contacto).
 */
export function Cierre() {
  return (
    <section
      id="empezar"
      aria-labelledby="cierre-title"
      className="relative scroll-mt-24 overflow-hidden px-5 pb-[88px] pt-16 sm:px-8 sm:pb-28 lg:pb-32 lg:pt-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-40%] left-1/2 h-[700px] w-[1200px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(79,140,255,0.12),rgba(79,140,255,0)_70%)]"
      />
      <Reveal className="relative mx-auto flex w-full max-w-[820px] flex-col items-center gap-6 text-center">
        <h2
          id="cierre-title"
          className="text-[length:var(--text-cierre)] leading-[1.02] tracking-[-0.035em]"
        >
          Tu siguiente proyecto puede empezar aquí.
        </h2>
        <p className="m-0 max-w-[52ch] text-[length:var(--text-lead)] text-text-2">
          Cuéntanos qué quieres construir, mejorar o comunicar. Te
          responderemos con claridad sobre cómo podemos ayudarte.
        </p>
        <div className="mt-1 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button href={ctaPrincipal.href}>{ctaPrincipal.label}</Button>
          <Button href={site.contact.whatsappHref} variant="secondary" external>
            Escribir por WhatsApp
          </Button>
        </div>
        <ul className="m-0 mt-3 flex list-none flex-col items-center gap-1 p-0 font-mono text-sm text-muted sm:flex-row sm:gap-5">
          <li>
            <a
              href={site.contact.emailHref}
              className="transition-colors hover:text-text"
            >
              {site.contact.email}
            </a>
          </li>
          <li aria-hidden="true" className="hidden sm:block">
            ·
          </li>
          <li>
            <a
              href={site.contact.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-text"
            >
              {site.contact.whatsappDisplay}
            </a>
          </li>
        </ul>
      </Reveal>
    </section>
  );
}

export default Cierre;
