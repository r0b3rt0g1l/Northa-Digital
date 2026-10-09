import { Check } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Palabras } from "@/components/ui/Palabras";
import { BotonConsulta } from "@/components/ui/BotonConsulta";
import { seguridad } from "@/lib/content/servicios";
import { IlustracionAcceso } from "./IlustracionAcceso";

/**
 * Seguridad: describe en términos generales el servicio de acceso protegido
 * (VPN y Cloudflare Zero Trust para paneles de administración). Sin
 * configuraciones, nombres de paneles, direcciones ni procedimientos. La
 * ilustración es un esquema conceptual, nunca una pantalla de acceso.
 */
export function Seguridad() {
  return (
    <section id="seguridad" aria-labelledby="seguridad-title" className="relative px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <Reveal className="flex flex-col gap-5">
          <p className="eyebrow m-0">Seguridad</p>
          <h2 id="seguridad-title" className="text-[length:var(--text-h2)]">
            <Palabras>{seguridad.titular}</Palabras>
          </h2>
          <p className="m-0 max-w-[52ch] text-[length:var(--text-lead)] leading-[1.55] text-text-2">
            {seguridad.description}
          </p>
          <ul className="m-0 mt-1 flex list-none flex-col gap-3 p-0">
            {seguridad.puntos.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15.5px] leading-relaxed text-text-2">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/35 bg-accent/[0.1]">
                  <Check className="h-3.5 w-3.5 text-accent-2" strokeWidth={2} aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <BotonConsulta servicio={seguridad.id} variant="secondary">
              Consultar sobre seguridad
            </BotonConsulta>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <IlustracionAcceso />
        </Reveal>
      </div>
    </section>
  );
}

export default Seguridad;
