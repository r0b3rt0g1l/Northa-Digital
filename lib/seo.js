import { site } from "./site";

export function buildMetadata() {
  const title = `${site.name} · ${site.tagline}`;
  const description = site.description;
  const url = `${site.url}/`;

  return {
    title,
    description,
    metadataBase: new URL(site.url),
    alternates: { canonical: url },
    keywords: [
      "portales digitales",
      "sistemas digitales",
      "desarrollo web",
      "diseño gráfico",
      "redes sociales",
      "fotografía y video",
      "Northa Digital",
    ],
    authors: [{ name: site.founder }],
    creator: site.name,
    openGraph: {
      type: "website",
      locale: site.locale,
      url,
      siteName: site.name,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const defaultViewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
};
