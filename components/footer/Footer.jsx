import { Logo } from "@/components/ui/Logo";
import { site } from "@/lib/site";
import { navSections } from "@/lib/content/nav";

/**
 * Pie mínimo: marca, tres enlaces, contacto real y derechos.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-line px-5 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <a href="#inicio" aria-label="Northa Digital — inicio" className="w-fit rounded-full">
          <Logo />
        </a>

        <nav aria-label="Enlaces del pie de página">
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-sm">
            {navSections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-muted transition-colors hover:text-text"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 font-mono text-[13px] text-muted">
          <li>
            <a href={site.contact.emailHref} className="transition-colors hover:text-text">
              {site.contact.email}
            </a>
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
      </div>

      <div className="mx-auto mt-8 flex w-full max-w-[1200px] flex-col gap-1 text-[13px] text-faint sm:flex-row sm:justify-between">
        <p className="m-0">
          © {year} {site.name}
        </p>
        <p className="m-0">{site.location}</p>
      </div>
    </footer>
  );
}

export default Footer;
