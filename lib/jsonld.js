import { site } from "./site";

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
    address: { "@type": "PostalAddress", addressRegion: "Sonora", addressCountry: "MX" },
    knowsAbout: [
      "Portales y sistemas digitales",
      "Desarrollo web",
      "Redes sociales",
      "Fotografía",
      "Video",
      "Diseño gráfico",
    ],
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
