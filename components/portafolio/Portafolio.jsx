import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { Municipios } from "./Municipios";
import { proyectoDestacado } from "@/lib/content/proyectos";

/**
 * ¿Qué trabajo real han hecho? Todos los municipios con portal publicado, en
 * un solo contenedor compacto con la página de inicio real de cada uno y su
 * enlace. Añadir un municipio = una entrada en lib/content/proyectos.js y su
 * captura (scripts/capturar-portales.mjs).
 */
export function Portafolio() {
  const proyecto = proyectoDestacado;
  if (!proyecto) return null;
  const { enlaces = [] } = proyecto;

  return (
    <Section id="portafolio" labelledBy="portafolio-title">
      <SectionHeader
        eyebrow="Portafolio"
        title="Trabajo seleccionado"
        titleId="portafolio-title"
        description="Portales municipales en línea, diseñados y construidos por Northa Digital."
      />
      <Reveal className="mt-12 sm:mt-16">
        <Municipios enlaces={enlaces} />
      </Reveal>
    </Section>
  );
}

export default Portafolio;
