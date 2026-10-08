import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { ProyectoDestacado } from "./ProyectoDestacado";
import { proyectoDestacado, proyectosSecundarios } from "@/lib/content/proyectos";

/**
 * Portafolio honesto: un caso principal y, solo si existen, proyectos
 * secundarios en cuadrícula. Añadir un proyecto = una entrada en
 * lib/content/proyectos.js.
 */
export function Portafolio() {
  return (
    <Section id="portafolio" labelledBy="portafolio-title">
      <SectionHeader
        eyebrow="Portafolio"
        title="Trabajo seleccionado"
        titleId="portafolio-title"
        description="Un primer proyecto que refleja nuestra experiencia creando plataformas informativas y funcionales. El portafolio seguirá creciendo con nuevos proyectos."
      />

      <div className="mt-12 flex flex-col gap-6 sm:mt-14">
        {proyectoDestacado ? (
          <ProyectoDestacado proyecto={proyectoDestacado} />
        ) : null}

        {proyectosSecundarios.length ? (
          <ul className="m-0 grid list-none gap-6 p-0 md:grid-cols-2">
            {proyectosSecundarios.map((p, i) => (
              <Reveal
                as="li"
                key={p.slug}
                delay={i * 60}
                className="glass glass-hover flex flex-col gap-3 rounded-[24px] p-6"
              >
                <h3 className="text-[length:var(--text-h3)]">{p.title}</h3>
                <p className="m-0 text-text-2">{p.description}</p>
                {p.tags?.length ? (
                  <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">
                    {p.tags.map((t) => (
                      <li
                        key={t}
                        className="inline-flex h-7 items-center rounded-full border border-line-strong px-2.5 text-xs text-text-2"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Reveal>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}

export default Portafolio;
