import { site } from "./site";
import { servicios, seguridad } from "./content/servicios";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: `${site.url}/northa-lockup-dark.svg`,
    description: site.description,
    founder: { "@type": "Person", name: site.founder },
    email: site.contact.email,
    telephone: site.contact.phoneInternational,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: site.contact.phoneInternational,
      email: site.contact.email,
      availableLanguage: ["es"],
    },
    knowsAbout: [...servicios.map((s) => s.title), seguridad.title],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    inLanguage: "es-MX",
  };
}
