import { Mail } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { BotonAsistente } from "@/components/ui/BotonAsistente";
import { BotonWhatsapp } from "@/components/ui/BotonWhatsapp";
import { site } from "@/lib/site";
import { navSections } from "@/lib/content/nav";

const enlace =
  "group inline-flex min-h-11 items-center gap-3 rounded-full pr-2 text-[15px] text-text-2 transition-colors hover:text-text";
const icono =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong bg-white/[0.04] transition-colors group-hover:border-white/25";

/**
 * Pie con el contacto directo (#contacto): el botón de WhatsApp (abre el chat
 * directo, sin mostrar el número), el correo y el asistente. Todos los datos
 * salen de lib/site.js.
 */
export function Footer() {
  const year = new Date().getFullYear();
  const { contact } = site;

  return (
    <footer id="contacto" aria-labelledby="contacto-title" className="relative z-10 border-t border-line px-5 pb-28 pt-14 sm:px-8 sm:pt-16">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 md:grid-cols-[1fr_1.2fr_auto] md:gap-12">
        <div className="flex flex-col gap-4">
          {/* Ancla dentro de la página; desde la 404 lleva al inicio. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/#inicio" aria-label="Northa Digital, inicio" className="inline-flex min-h-11 w-fit items-center rounded-full">
            <Logo />
          </a>
          <p className="m-0 max-w-[32ch] text-[14.5px] leading-relaxed text-muted">{site.tagline}.</p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 id="contacto-title" className="eyebrow m-0 text-[13px] font-normal tracking-[0.08em]">
            Contacto
          </h2>
          <div>
            <BotonWhatsapp size="sm" magnetic={false} className="pl-2.5">
              Escríbenos por WhatsApp
            </BotonWhatsapp>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            <li>
              <a href={contact.emailHref} className={enlace}>
                <span className={icono}>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-text">{contact.email}</span>
              </a>
            </li>
          </ul>
          <div>
            <BotonAsistente size="sm">Abrir el asistente</BotonAsistente>
          </div>
        </div>

        <nav aria-label="Enlaces del pie de página">
          <ul className="m-0 flex list-none flex-col gap-0 p-0 text-sm">
            {navSections.map((s) => (
              <li key={s.id}>
                <a
                  href={s.href}
                  className="inline-flex min-h-11 items-center text-muted transition-colors hover:text-text"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-10 w-full max-w-[1200px] border-t border-line pt-6 text-[13px] text-faint">
        © {year} {site.name}
      </p>
    </footer>
  );
}

export default Footer;
