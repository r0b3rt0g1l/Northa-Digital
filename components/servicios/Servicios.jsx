import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { servicios } from "@/lib/content/servicios";

/**
 * Servicios como lista editorial: numeración, nombre, descripción breve e
 * ícono sobrio. Sin tarjetas grandes ni discursos técnicos.
 */
export function Servicios() {
  return (
    <Section id="servicios" labelledBy="servicios-title">
      <SectionHeader
        eyebrow="Servicios"
        title="Lo que construimos"
        titleId="servicios-title"
        description="Seis líneas de trabajo que cubren lo que una organización muestra y lo que la hace funcionar."
      />

      <ol className="mt-12 list-none border-b border-line p-0 sm:mt-14">
        {servicios.map((s, i) => (
          <Reveal
            as="li"
            key={s.id}
            delay={i * 60}
            className="group border-t border-line"
          >
            <article className="grid gap-3 rounded-2xl px-3 py-7 transition-colors group-hover:bg-white/[0.025] md:grid-cols-[56px_1fr_1.4fr_40px] md:gap-6 md:py-8">
              <span className="font-mono text-[13px] text-faint md:pt-1.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-[length:var(--text-h3)] tracking-[-0.02em]">
                {s.title}
              </h3>
              <div className="flex flex-col gap-2.5">
                <p className="m-0 text-text-2">{s.description}</p>
                {s.nota ? (
                  <p className="m-0 flex items-start gap-2 text-sm text-muted">
                    <span
                      aria-hidden="true"
                      className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-accent"
                    />
                    {s.nota}
                  </p>
                ) : null}
              </div>
              <s.Icon
                className="hidden h-7 w-7 text-muted transition-colors group-hover:text-text md:block"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </article>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

export default Servicios;
