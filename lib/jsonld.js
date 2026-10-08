import { site } from "./site";
import { servicios } from "./content/servicios";

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
    knowsAbout: servicios.map((s) => s.title),
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
