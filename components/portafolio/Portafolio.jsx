import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { ProyectoDestacado } from "./ProyectoDestacado";
import { proyectoDestacado, proyectosSecundarios } from "@/lib/content/proyectos";

/**
 * ¿Qué trabajo real han hecho? Un caso principal y, solo si existen,
 * proyectos secundarios. Añadir uno = una entrada en lib/content/proyectos.js.
 */
export function Portafolio() {
  return (
    <Section id="portafolio" labelledBy="portafolio-title">
      <SectionHeader
        eyebrow="Portafolio"
        title="Trabajo seleccionado"
        titleId="portafolio-title"
        description="Un proyecto que refleja nuestra experiencia creando plataformas informativas y funcionales. El portafolio seguirá creciendo con nuevos desarrollos."
      />

      <div className="mt-12 flex flex-col gap-6 sm:mt-16">
        {proyectoDestacado ? <ProyectoDestacado proyecto={proyectoDestacado} /> : null}

        {proyectosSecundarios.length ? (
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {proyectosSecundarios.map((p, i) => (
              <Reveal as="li" key={p.slug} delay={i * 60}>
                <article className="card card-hover flex h-full flex-col gap-3 p-7">
                  <h3 className="text-[length:var(--text-h3)]">{p.title}</h3>
                  <p className="m-0 text-text-2">{p.description}</p>
                </article>
              </Reveal>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}

export default Portafolio;
