import { ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { BotonConsulta } from "@/components/ui/BotonConsulta";
import { seguridad } from "@/lib/content/servicios";

/**
 * Seguridad y confianza, en una sola pieza: una frase simple sobre la
 * protección y el control de acceso de las plataformas administrativas, sin
 * explicaciones técnicas, herramientas, configuraciones ni procedimientos.
 * Cierra con la invitación a contar el proyecto por WhatsApp.
 */
export function Seguridad() {
  return (
    <section id="seguridad" aria-labelledby="seguridad-title" className="relative px-5 py-16 sm:px-8 sm:py-24">
      <Reveal className="confianza card mx-auto flex w-full max-w-[1100px] flex-col items-start gap-6 rounded-[28px] p-6 sm:p-10 md:flex-row md:items-center md:gap-10">
        <span className="confianza-escudo" aria-hidden="true">
          <ShieldCheck className="h-8 w-8" strokeWidth={1.5} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <p className="eyebrow m-0">Seguridad</p>
          <h2 id="seguridad-title" className="text-[clamp(1.5rem,1.2vw+1.15rem,2.1rem)] tracking-[-0.025em]">
            {seguridad.titular}
          </h2>
          <p className="m-0 max-w-[52ch] text-[16px] leading-relaxed text-text-2">{seguridad.description}</p>
        </div>
        <BotonConsulta icono className="shrink-0">
          Cuéntanos tu proyecto
        </BotonConsulta>
      </Reveal>
    </section>
  );
}

export default Seguridad;
