import { Reveal } from "@/components/ui/Reveal";
import { Palabras } from "@/components/ui/Palabras";
import { BarraServicios } from "./BarraServicios";
import { SelloNortha } from "./SelloNortha";
import { beneficios } from "@/lib/content/servicios";

/**
 * Lo que construimos: una frase directa, el sello de Northa, los beneficios
 * para el cliente en seis piezas cortas y la banda de servicios en movimiento,
 * a todo el ancho. La oferta completa vive en el menú «Servicios» y en el
 * asistente; aquí no se repiten tarjetas de servicios.
 */
export function Servicios() {
  return (
    <section id="servicios" aria-labelledby="servicios-title" className="relative py-24 sm:py-32">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-5 sm:gap-16 sm:px-8">
        <Reveal className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between md:gap-12">
          <div className="flex max-w-[680px] flex-col gap-5">
            <p className="eyebrow m-0">Servicios</p>
            <h2 id="servicios-title" className="text-[length:var(--text-h2)]">
              <Palabras>Lo que construimos</Palabras>
            </h2>
            <p className="m-0 max-w-[48ch] text-[length:var(--text-lead)] leading-[1.55] text-text-2">
              Portales municipales, sitios web y soluciones digitales con diseño limpio y tecnología bien hecha.
            </p>
          </div>
          <SelloNortha className="self-center md:self-auto" />
        </Reveal>

        <Reveal delay={80}>
          <ul className="beneficios m-0 grid list-none grid-cols-1 gap-3 p-0 min-[420px]:grid-cols-2 lg:grid-cols-3">
            {beneficios.map((b) => (
              <li key={b.titulo} className="beneficio">
                <span className="beneficio-icono" aria-hidden="true">
                  <b.Icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-text">{b.titulo}</h3>
                  <p className="m-0 text-[14px] leading-snug text-muted">{b.texto}</p>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal delay={120} className="mt-14 sm:mt-20">
        <BarraServicios />
      </Reveal>
    </section>
  );
}

export default Servicios;
