import { Hero } from "@/components/hero/Hero";
import { Servicios } from "@/components/servicios/Servicios";
import { ContactoBloque } from "@/components/contacto/ContactoBloque";
import { Portafolio } from "@/components/portafolio/Portafolio";
import { Cierre } from "@/components/cierre/Cierre";
import { organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";

// Orden de scroll: hero → servicios → contacto (30 s) → portafolio → cierre.
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
      <ContactoBloque />
      <Portafolio />
      <Cierre />
    </>
  );
}
