import { Hero } from "@/components/hero/Hero";
import { Servicios } from "@/components/servicios/Servicios";
import { Seguridad } from "@/components/seguridad/Seguridad";
import { Portafolio } from "@/components/portafolio/Portafolio";
import { EscenaFinal } from "@/components/cierre/EscenaFinal";
import { organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";

// Orden de scroll: hero → lo que construimos → portafolio → seguridad (la
// pieza de confianza que invita a escribir) → escena final. El contacto vive
// en el pie y en el asistente.
export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd()),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />
      <Hero />
      <Servicios />
      <Portafolio />
      <Seguridad />
      <EscenaFinal />
    </>
  );
}
