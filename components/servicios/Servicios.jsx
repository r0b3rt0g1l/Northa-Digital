import { Reveal } from "@/components/ui/Reveal";
import { Palabras } from "@/components/ui/Palabras";
import { BarraServicios } from "./BarraServicios";
import { SelloNortha } from "./SelloNortha";

/**
 * Lo que construimos: una frase con carácter, el sello de Northa y la barra
 * compacta de servicios. La oferta completa vive en el menú «Servicios» de la
 * barra superior y en el asistente; aquí no se repiten tarjetas.
 */
export function Servicios() {
  return (
    <section id="servicios" aria-labelledby="servicios-title" className="relative px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 sm:gap-14">
        <Reveal className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between md:gap-12">
          <div className="flex max-w-[720px] flex-col gap-5">
            <p className="eyebrow m-0">Servicios</p>
            <h2 id="servicios-title" className="text-[length:var(--text-h2)]">
              <Palabras>Lo que construimos</Palabras>
            </h2>
            <p className="m-0 max-w-[54ch] text-[length:var(--text-lead)] leading-[1.55] text-text-2">
              Diseño limpio, tecnología bien hecha y contenido con intención. Cuidamos cada detalle, de la
              primera idea a la publicación, para que lo que construimos se sienta tan bien como se ve.
            </p>
          </div>
          <SelloNortha className="self-center md:self-auto" />
        </Reveal>

        <Reveal delay={120}>
          <BarraServicios />
        </Reveal>
      </div>
    </section>
  );
}

export default Servicios;
