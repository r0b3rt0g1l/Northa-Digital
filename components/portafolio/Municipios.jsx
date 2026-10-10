import { Fragment } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { StarIcon } from "@/components/ui/StarIcon";
import capturas from "@/lib/content/capturas.json";
import { slugMunicipio } from "@/lib/content/slug";

const sinGuion = (t) => t.replace(/­/g, "");
const dominio = (url) => new URL(url).hostname.replace(/^www\./, "");
// Puntos naturales de corte: «aconchi|transparencia|.com.mx».
const partesDominio = (d) => d.split(/(?=transparencia|\.com\.mx$)/);
const capturaDe = (m) => capturas[slugMunicipio(m.nombre)] ?? null;

/**
 * Portales municipales en un solo contenedor de vidrio, del mismo ancho que
 * el resto del sitio: todos a la vista y fáciles de recorrer, sin un recuadro
 * grande que acapare la atención.
 *
 *  - Escritorio: una cuadrícula de 5 columnas (3 filas para los 15). Cada
 *    portal muestra su página de inicio real, el nombre y el dominio.
 *  - Tableta: 3 columnas. Celular: una lista compacta con la miniatura a la
 *    izquierda, fácil de escanear con el pulgar.
 *
 * Cada elemento es un enlace al portal (pestaña nueva). Las capturas viven en
 * public/portafolio/portales/ y se actualizan con scripts/capturar-portales.mjs
 * (índice en lib/content/capturas.json); si falta una, se muestra un respaldo
 * con el color institucional del municipio. Funciona sin JavaScript.
 */
export function Municipios({ enlaces }) {
  return (
    <div className="portales-marco glass">
      <div className="portales-cabeza">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-[clamp(1.2rem,0.9vw+1rem,1.5rem)] tracking-[-0.02em]">Portales municipales</h3>
          <p className="m-0 inline-flex items-center gap-1.5 text-[13.5px] text-muted">
            <StarIcon className="h-3.5 w-3.5" />
            Hechos por Northa Digital
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line-strong px-3 py-1 font-mono text-[11.5px] text-text-2">
          {enlaces.length} publicados
        </span>
      </div>
      <ul className="portales m-0 list-none p-0">
        {enlaces.map((e) => {
          const nombre = sinGuion(e.nombre);
          const captura = capturaDe(e);
          return (
            <li key={e.url}>
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="portal glass glass-interior"
                style={{ "--color": e.color }}
              >
                <span className="portal-captura">
                  {captura ? (
                    <Image
                      src={captura.src}
                      alt=""
                      width={captura.width}
                      height={captura.height}
                      sizes="(min-width: 1024px) 210px, (min-width: 640px) 30vw, 112px"
                      loading="lazy"
                    />
                  ) : (
                    <span className="portal-respaldo" aria-hidden="true">
                      {nombre.charAt(0)}
                    </span>
                  )}
                </span>
                <span className="portal-cuerpo">
                  <span className="portal-nombre">{e.nombre}</span>
                  <span className="portal-dominio">
                    {partesDominio(dominio(e.url)).map((p, i) => (
                      <Fragment key={p}>
                        {i > 0 && <wbr />}
                        {p}
                      </Fragment>
                    ))}
                  </span>
                  <ArrowUpRight className="portal-flecha" aria-hidden="true" />
                </span>
                <span className="sr-only"> (abre el portal de {nombre} en una pestaña nueva)</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Municipios;
