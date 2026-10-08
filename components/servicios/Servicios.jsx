import { ShieldCheck } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { PausaFuera } from "@/components/ui/PausaFuera";
import { cn } from "@/lib/cn";
import { servicios } from "@/lib/content/servicios";
import { ServiciosBanda } from "./ServiciosBanda";

const numero = (i) => String(i + 1).padStart(2, "0");

/**
 * Servicios: ¿qué ofrecemos? Encabezado, la barra de servicios en
 * movimiento a todo el ancho y una cuadrícula editorial. La tarjeta de
 * sistemas es de vidrio, con un haz de luz que recorre su borde y la nota de
 * seguridad; las otras cinco son mate. Todas se inclinan un poco hacia el
 * puntero y llevan su número.
 */
export function Servicios() {
  const [destacado, ...resto] = servicios;

  return (
    <section
      id="servicios"
      aria-labelledby="servicios-title"
      className="relative overflow-hidden px-5 py-24 sm:px-8 sm:py-32 lg:py-40"
    >
      <PausaFuera />
      <div className="mx-auto w-full max-w-[1200px]">
        <SectionHeader
          eyebrow="Servicios"
          title="Lo que construimos"
          titleId="servicios-title"
          description="Diseño, tecnología y contenido, bajo un mismo criterio."
        />
      </div>

      <div className="-mx-5 mt-14 sm:-mx-8 sm:mt-20">
        <ServiciosBanda />
      </div>

      <ul className="mx-auto mt-14 grid w-full max-w-[1200px] list-none grid-cols-1 gap-4 p-0 sm:mt-20 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        <Reveal as="li" className="md:col-span-2 lg:row-span-2">
          <article
            data-tilt="2.5"
            className="glass glass-hover group/card flex h-full flex-col justify-between gap-10 rounded-[24px] p-7 sm:p-9 lg:p-11"
          >
            <span aria-hidden="true" className="haz" />
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line-strong bg-white/[0.04] transition-[border-color,background-color] duration-500 group-hover/card:border-accent-2/40 group-hover/card:bg-accent-2/[0.08]">
                <destacado.Icon className="h-6 w-6 text-accent-2" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span aria-hidden="true" className="font-mono text-xs tracking-[0.08em] text-faint">
                {numero(0)}
              </span>
            </div>
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
            delay={(i + 1) * 70}
            className={cn(i === resto.length - 1 && "md:col-span-2 lg:col-span-1")}
          >
            <article data-tilt="5" className="card card-hover group/card flex h-full flex-col gap-5 p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <s.Icon
                  className="h-6 w-6 text-muted transition-[color,translate] duration-500 group-hover/card:-translate-y-0.5 group-hover/card:text-accent-2"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <span aria-hidden="true" className="font-mono text-xs tracking-[0.08em] text-faint">
                  {numero(i + 1)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-[length:var(--text-h3)] tracking-[-0.02em]">{s.title}</h3>
                <p className="m-0 text-[15.5px] leading-relaxed text-text-2">{s.description}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

export default Servicios;
