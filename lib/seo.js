import { site } from "./site";

const SITE_URL = site.url;

export function buildMetadata({
  title,
  description,
  path = "/",
  image,
  noIndex = false,
} = {}) {
  const fullTitle = title
    ? `${title} · ${site.name}`
    : `${site.name} · ${site.tagline}`;

  const fullDescription = description || site.description;
  const url = `${SITE_URL}${path}`;

  const openGraph = {
    type: "website",
    locale: site.locale,
    url,
    siteName: site.name,
    title: fullTitle,
    description: fullDescription,
  };

  const twitter = {
    card: "summary_large_image",
    title: fullTitle,
    description: fullDescription,
  };

  // Si se pasa una imagen, úsala; si no, Next.js detecta app/opengraph-image.js.
  if (image) {
    const imageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;
    openGraph.images = [
      { url: imageUrl, width: 1200, height: 630, alt: site.name },
    ];
    twitter.images = [imageUrl];
  }

  return {
    title: fullTitle,
    description: fullDescription,
    metadataBase: new URL(SITE_URL),
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
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph,
    twitter,
  };
}

export const defaultViewport = {
  themeColor: "#07080a",
  width: "device-width",
  initialScale: 1,
};
