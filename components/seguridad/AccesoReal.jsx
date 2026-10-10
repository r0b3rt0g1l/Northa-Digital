import Image from "next/image";
import { seguridad } from "@/lib/content/servicios";
import { DesplazableAccesible } from "@/components/ui/DesplazableAccesible";

/**
 * Así se entra al panel de un portal: tres capturas reales del acceso al CMS
 * (correo en Cloudflare Access, código de un solo uso y login del panel con
 * verificación anti-bots). Son imágenes con su descripción, no formularios:
 * no se puede escribir ni pulsar nada. El dominio privado y el código están
 * tapados, y el correo es el de Northa.
 *
 *  - Desde 1200 px: tres columnas de la misma altura, con la explicación de
 *    cada paso arriba.
 *  - Más angosto: tarjetas que se deslizan de lado (con teclado, la franja
 *    recibe el foco y las flechas avanzan una tarjeta).
 */
export function AccesoReal() {
  const { titulo, texto, pasos } = seguridad.acceso;
  return (
    <div className="ingreso">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="text-[clamp(1.15rem,0.8vw+1rem,1.4rem)] tracking-[-0.02em]">{titulo}</h3>
          <p className="m-0 text-[14.5px] leading-snug text-muted">{texto}</p>
        </div>
        <span className="shrink-0 rounded-full border border-line-strong px-3 py-1 font-mono text-[11.5px] text-text-2">
          Capturas reales
        </span>
      </div>
      <DesplazableAccesible className="ingreso-ventana" etiqueta="Pasos del acceso al panel. Desliza para ver los tres.">
        <ol className="ingreso-pasos">
          {pasos.map((p, i) => (
            <li key={p.src} className="ingreso-paso glass glass-interior">
              <figure className="m-0 flex flex-col gap-3">
                <figcaption className="flex flex-col gap-1">
                  <span className="ingreso-num">Paso {i + 1}</span>
                  <strong className="text-[15.5px] font-semibold leading-snug tracking-[-0.01em] text-text">{p.titulo}</strong>
                  <span className="text-[13.5px] leading-snug text-muted">{p.texto}</span>
                </figcaption>
                <Image
                  src={p.src}
                  alt={p.alt}
                  width={p.width}
                  height={p.height}
                  sizes="(min-width: 1200px) 340px, (min-width: 640px) 320px, 70vw"
                  loading="lazy"
                  className="ingreso-captura"
                />
              </figure>
            </li>
          ))}
        </ol>
      </DesplazableAccesible>
    </div>
  );
}

export default AccesoReal;
