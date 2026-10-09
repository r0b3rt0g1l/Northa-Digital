import Image from "next/image";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { StarIcon } from "@/components/ui/StarIcon";
import { Municipios } from "./Municipios";
import { proyectoDestacado } from "@/lib/content/proyectos";

/**
 * ¿Qué trabajo real han hecho? Los portales municipales: una muestra real
 * (la captura de Mazatán, con el crédito de su escudo) y todos los
 * municipios con portal publicado, cada uno con su enlace. Solo nombres,
 * etiquetas y controles: sin texto descriptivo bajo la muestra.
 * Añadir un municipio = una entrada en lib/content/proyectos.js.
 */
export function Portafolio() {
  const proyecto = proyectoDestacado;
  if (!proyecto) return null;
  const { imagen, enlaces = [] } = proyecto;
  const dominio = imagen?.enlace ? new URL(imagen.enlace.url).host : null;

  return (
    <Section id="portafolio" labelledBy="portafolio-title">
      <SectionHeader
        eyebrow="Portafolio"
        title="Trabajo seleccionado"
        titleId="portafolio-title"
        description="Un proyecto que refleja nuestra experiencia creando plataformas informativas y funcionales. El portafolio seguirá creciendo con nuevos desarrollos."
      />

      <div className="mt-12 grid grid-cols-1 gap-6 sm:mt-16 lg:grid-cols-[1.12fr_1fr] lg:items-start lg:gap-8">
        {imagen ? (
          <Reveal as="figure" className="m-0 flex flex-col gap-3">
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
                <span className="ml-3 min-w-0 truncate font-mono text-xs text-faint">{dominio}</span>
                <span className="hecho-por ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/35 bg-accent/[0.1] py-1 pl-1.5 pr-2.5 text-[11px] font-semibold text-text">
                  <StarIcon className="h-3.5 w-3.5" />
                  Hecho por Northa Digital
                </span>
              </span>
              <span className="block overflow-hidden rounded-[16px]">
                <Image
                  src={imagen.src}
                  alt={imagen.alt}
                  width={imagen.width}
                  height={imagen.height}
                  sizes="(min-width: 1240px) 640px, (min-width: 1024px) 52vw, 100vw"
                  loading="lazy"
                  className="portada-scroll aspect-[16/11] h-auto w-full object-cover object-left-top sm:aspect-[16/9]"
                />
              </span>
              <span className="sr-only">Visitar el portal de {imagen.enlace.nombre} (se abre en una pestaña nueva)</span>
            </a>
            <figcaption className="px-2 text-[13px] text-faint">
              Portal del Municipio de {imagen.enlace.nombre}.{" "}
              {imagen.credito ? (
                <a
                  href={imagen.credito.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-text-2"
                >
                  {imagen.credito.texto}
                </a>
              ) : null}
            </figcaption>
          </Reveal>
        ) : null}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <h3 className="text-[clamp(1.25rem,1vw+1rem,1.6rem)] tracking-[-0.02em]">{proyecto.title}</h3>
            <span className="rounded-full border border-line-strong px-3 py-1 font-mono text-[11.5px] text-text-2">
              {enlaces.length} publicados
            </span>
          </div>
          <Municipios enlaces={enlaces} />
        </div>
      </div>
    </Section>
  );
}

export default Portafolio;
