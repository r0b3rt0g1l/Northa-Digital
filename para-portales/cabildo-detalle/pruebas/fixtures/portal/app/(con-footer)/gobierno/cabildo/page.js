import { Breadcrumbs } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo";
import { municipalConfig } from "@/lib/municipalConfig";
import { getCabildo } from "@/lib/content";
import { derivePresidente, deriveSindica, deriveRegidores } from "@/lib/cabildo";
import { Organigrama } from "@/components/gobierno/Organigrama";
import { PageHeader } from "@/components/common/PageHeader";

export const revalidate = 1800;

export const metadata = buildMetadata({
  title: "Cabildo",
  description: `Cabildo del ${municipalConfig.identidad.nombreCompleto}: Presidencia, Sindicatura y Regidurías. Administración ${municipalConfig.identidad.administracion}.`,
  path: "/gobierno/cabildo",
});

export default async function CabildoPage() {
  const lista = await getCabildo();
  // Cabildo electo, jerarquía: Presidencia → Sindicatura → Regidurías.
  const presidente = derivePresidente(lista);
  const sindica = deriveSindica(lista);
  const regidores = deriveRegidores(lista);

  return (
    <main className="flex flex-1 flex-col">
      <Breadcrumbs items={[{ name: "Inicio", path: "/" }, { name: "Gobierno", path: "/gobierno" }, { name: "Cabildo", path: "/gobierno/cabildo" }]} />
      <PageHeader
        clave="header-cabildo"
        eyebrow="Gobierno"
        fallbackTitulo="Cabildo"
        fallbackDescripcion={`Integrantes del Cabildo del ${municipalConfig.identidad.nombreCompleto}: Presidencia, Sindicatura y Regidurías de la Administración ${municipalConfig.identidad.administracion}.`}
        bg="white"
      />

      <section
        aria-label="Organigrama del Cabildo"
        className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 md:py-16"
      >
        <Organigrama
          presidente={presidente}
          sindica={sindica}
          regidores={regidores}
        />
      </section>
    </main>
  );
}
