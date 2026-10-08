import { Logo } from "@/components/ui/Logo";
import { site } from "@/lib/site";
import { navSections } from "@/lib/content/nav";

/** Pie mínimo: marca, tres enlaces y derechos. El contacto vive en el cierre. */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-line px-5 pb-28 pt-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Ancla dentro de la página; desde la 404 lleva al inicio. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/#inicio" aria-label="Northa Digital, inicio" className="inline-flex min-h-11 w-fit items-center rounded-full">
          <Logo />
        </a>
        <nav aria-label="Enlaces del pie de página">
          <ul className="m-0 flex list-none flex-wrap gap-x-2 p-0 text-sm">
            {navSections.map((s) => (
              <li key={s.id}>
                <a
                  href={s.href}
                  className="inline-flex min-h-11 items-center px-2 text-muted transition-colors hover:text-text"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="m-0 text-[13px] text-faint">
          © {year} {site.name}
        </p>
      </div>
    </footer>
  );
}

export default Footer;
