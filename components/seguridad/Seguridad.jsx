import { Reveal } from "@/components/ui/Reveal";
import { BotonWhatsapp } from "@/components/ui/BotonWhatsapp";
import { seguridad } from "@/lib/content/servicios";
import { DemoAcceso } from "./DemoAcceso";
import { AccesoReal } from "./AccesoReal";

/**
 * Seguridad: protección digital, acceso seguro y administración protegida.
 * A la izquierda, cuatro puntos claros (VPN, login, protección y control de
 * acceso); a la derecha, una demostración visual del servicio que no es un
 * formulario ni imita pantallas de terceros. Cierra con WhatsApp directo.
 * Debajo, a todo el ancho, las capturas reales del acceso al panel de un
 * portal (AccesoReal), con los datos sensibles ocultos.
 */
export function Seguridad() {
  return (
    <section id="seguridad" aria-labelledby="seguridad-title" className="relative px-5 py-20 sm:px-8 sm:py-28">
      <Reveal className="seguridad-marco glass mx-auto grid w-full max-w-[1200px] gap-10 rounded-[32px] p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-12 lg:p-12">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="eyebrow m-0">Seguridad</p>
            <h2 id="seguridad-title" className="text-[clamp(1.9rem,2.2vw+1.1rem,3rem)] tracking-[-0.03em]">
              {seguridad.titular}
            </h2>
            <p className="m-0 max-w-[48ch] text-[16.5px] leading-relaxed text-text-2">{seguridad.description}</p>
          </div>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
            {seguridad.puntos.map((p) => (
              <li key={p.titulo} className="seguridad-punto glass glass-interior">
                <span className="beneficio-icono" aria-hidden="true">
                  <p.Icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-[15.5px] font-semibold leading-snug tracking-[-0.01em] text-text">{p.titulo}</h3>
                  <p className="m-0 text-[13.5px] leading-snug text-muted">{p.texto}</p>
                </span>
              </li>
            ))}
          </ul>
          <div>
            <BotonWhatsapp className="shrink-0">Cuéntanos tu proyecto</BotonWhatsapp>
          </div>
        </div>
        <DemoAcceso />
        <div className="min-w-0 lg:col-span-2">
          <AccesoReal />
        </div>
      </Reveal>
    </section>
  );
}

export default Seguridad;
