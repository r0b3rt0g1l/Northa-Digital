import { ShieldCheck } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";
import { servicios } from "@/lib/content/servicios";

/**
 * Servicios: ¿qué ofrecemos? Cuadrícula editorial. Una sola tarjeta de
 * vidrio, la de sistemas, que incluye la nota de seguridad; las otras cinco
 * son mate, con ícono visible en todos los anchos y dos líneas de texto.
 */
export function Servicios() {
  const [destacado, ...resto] = servicios;

  return (
    <Section id="servicios" labelledBy="servicios-title">
      <SectionHeader
        eyebrow="Servicios"
        title="Lo que construimos"
        titleId="servicios-title"
        description="Diseño, tecnología y contenido, bajo un mismo criterio."
      />

      <ul className="m-0 mt-12 grid list-none grid-cols-1 gap-4 p-0 sm:mt-16 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        <Reveal as="li" className="md:col-span-2 lg:row-span-2">
          <article className="glass glass-hover flex h-full flex-col justify-between gap-10 rounded-[24px] p-7 sm:p-9 lg:p-11">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line-strong bg-white/[0.04]">
              <destacado.Icon className="h-6 w-6 text-accent-2" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-4">
              <h3 className="text-[clamp(1.6rem,1.6vw+1rem,2.25rem)] tracking-[-0.025em]">
                {destacado.title}
              </h3>
              <p className="m-0 max-w-[66ch] text-[17px] leading-[1.6] text-text-2 sm:text-lg">
                {destacado.description}
              </p>
              <p className="m-0 mt-2 flex max-w-[56ch] items-start gap-3 border-t border-line pt-5 text-[15px] leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.5} aria-hidden="true" />
                {destacado.nota}
              </p>
            </div>
          </article>
        </Reveal>

        {resto.map((s, i) => (
          <Reveal
            as="li"
            key={s.id}
            delay={(i + 1) * 60}
            className={cn(i === resto.length - 1 && "md:col-span-2 lg:col-span-1")}
          >
            <article className="card card-hover flex h-full flex-col gap-5 p-6 sm:p-7">
              <s.Icon className="h-6 w-6 text-muted" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex flex-col gap-2">
                <h3 className="text-[length:var(--text-h3)] tracking-[-0.02em]">{s.title}</h3>
                <p className="m-0 text-[15.5px] leading-relaxed text-text-2">{s.description}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

export default Servicios;
