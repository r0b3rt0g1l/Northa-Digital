import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { PortalPreview } from "./PortalPreview";

/**
 * Caso principal del portafolio: una sola tarjeta de vidrio, honesta y
 * directa. Los enlaces (si existen) son URLs reales del proyecto.
 */
export function ProyectoDestacado({ proyecto }) {
  const { etiqueta, title, description, tags = [], enlaces = [] } = proyecto;

  return (
    <Reveal
      as="article"
      className="glass glass-hover grid gap-8 rounded-[24px] p-5 sm:rounded-[28px] sm:p-8 lg:grid-cols-2 lg:items-center lg:gap-10 lg:p-10"
    >
      <div className="flex flex-col gap-4 lg:order-1">
        {etiqueta ? (
          <span className="inline-flex h-[30px] w-fit items-center rounded-full border border-accent/35 bg-accent/[0.08] px-3 font-mono text-xs tracking-[0.06em] text-[#bfd3ff]">
            {etiqueta}
          </span>
        ) : null}
        <h3 className="text-[clamp(1.6rem,2vw+1rem,2.125rem)] tracking-[-0.025em]">
          {title}
        </h3>
        <p className="m-0 text-text-2">{description}</p>
        {tags.length ? (
          <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">
            {tags.map((t) => (
              <li
                key={t}
                className="inline-flex h-[30px] items-center rounded-full border border-line-strong px-3 text-[13px] text-text-2"
              >
                {t}
              </li>
            ))}
          </ul>
        ) : null}
        {enlaces.length ? (
          <div className="mt-2 flex flex-col gap-2">
            <p className="m-0 font-mono text-xs tracking-[0.06em] text-faint">
              En línea
            </p>
            <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1.5 p-0 text-[13.5px]">
              {enlaces.map((e) => (
                <li key={e.url}>
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-muted transition-colors hover:text-text"
                  >
                    {e.nombre}
                    <ArrowUpRight className="h-3 w-3 opacity-60" aria-hidden="true" />
                    <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <PortalPreview className="h-[260px] sm:h-[320px] lg:order-2 lg:h-[360px]" />
    </Reveal>
  );
}

export default ProyectoDestacado;
