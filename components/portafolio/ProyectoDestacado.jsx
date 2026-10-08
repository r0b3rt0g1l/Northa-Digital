import Image from "next/image";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";

/**
 * El caso principal: captura real dentro de un marco de navegador, la
 * descripción y los portales publicados en un desplegable. Sin cifras ni
 * detalles técnicos. Los enlaces son URLs reales del proyecto.
 */
export function ProyectoDestacado({ proyecto }) {
  const { title, description, imagen, enlaces = [] } = proyecto;
  const dominio = imagen?.enlace ? new URL(imagen.enlace.url).host : null;

  return (
    <Reveal as="article" className="flex flex-col gap-8 sm:gap-10">
      {imagen ? (
        <figure className="m-0 flex flex-col gap-3">
          <a
            href={imagen.enlace.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card card-hover group block overflow-hidden rounded-[24px] p-2 sm:p-3"
          >
            <span className="flex h-9 items-center gap-1.5 px-3" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-white/[0.16]" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/[0.16]" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/[0.16]" />
              <span className="ml-3 truncate font-mono text-xs text-faint">{dominio}</span>
            </span>
            <span className="block overflow-hidden rounded-[16px]">
              <Image
                src={imagen.src}
                alt={imagen.alt}
                width={imagen.width}
                height={imagen.height}
                sizes="(min-width: 1240px) 1176px, 100vw"
                loading="lazy"
                style={{ "--proporcion": `${imagen.width} / ${imagen.height}` }}
                className="portada-scroll aspect-[16/11] h-auto w-full object-cover object-left-top sm:aspect-[var(--proporcion)]"
              />
            </span>
            <span className="sr-only">Visitar el portal de {imagen.enlace.nombre} (se abre en una pestaña nueva)</span>
          </a>
          {imagen.credito ? (
            <figcaption className="px-2 text-[13px] text-faint">
              Portal del Municipio de {imagen.enlace.nombre}.{" "}
              <a
                href={imagen.credito.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-text-2"
              >
                {imagen.credito.texto}
              </a>
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-12">
        <div className="flex flex-col gap-4">
          <h3 className="text-[clamp(1.6rem,1.6vw+1rem,2.25rem)] tracking-[-0.025em]">{title}</h3>
          <p className="m-0 max-w-[54ch] text-[length:var(--text-lead)] leading-[1.55] text-text-2">
            {description}
          </p>
        </div>

        {enlaces.length ? (
          <details className="card group/lista self-start rounded-[20px] [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-[20px] px-5 text-[15px] font-medium text-text">
              Ver portales publicados
              <ChevronDown
                className="h-4 w-4 text-muted transition-transform duration-300 group-open/lista:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <ul className="m-0 grid list-none grid-cols-2 gap-x-2 border-t border-line p-2 sm:grid-cols-3 md:grid-cols-2">
              {enlaces.map((e) => (
                <li key={e.url}>
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-sm text-text-2 transition-colors hover:bg-white/[0.04] hover:text-text"
                  >
                    {e.nombre}
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                    <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Reveal>
  );
}

export default ProyectoDestacado;
