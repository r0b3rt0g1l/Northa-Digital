import { Breadcrumbs } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo";
import { municipalConfig } from "@/lib/municipalConfig";
import { sevac } from "@/lib/sevac";
import { getSevac } from "@/lib/content";
import { SevacFiltros } from "@/components/transparencia/SevacFiltros";
import { SevacDocumentList } from "@/components/transparencia/SevacDocumentList";
import { PageHeader } from "@/components/common/PageHeader";

export const revalidate = 1800;

export const metadata = buildMetadata({
  title: "SEvAC",
  description: sevac.descripcion,
  path: "/transparencia/sevac",
});

const CATEGORIA_LABEL = {
  BOLETIN_OFICIAL: "Boletín Oficial",
  INFORME_TRIMESTRAL: "Informe Trimestral",
  CUENTA_PUBLICA: "Cuenta Pública",
  PRESUPUESTO_EGRESOS: "Presupuesto de Egresos",
  LEY_INGRESOS: "Ley de Ingresos",
};

const CATEGORIA_BADGE = {
  BOLETIN_OFICIAL:
    "bg-[var(--color-dorado)]/15 text-[var(--color-dorado-700)] border-[var(--color-dorado)]/30",
  INFORME_TRIMESTRAL:
    "bg-[var(--color-guinda)]/10 text-[var(--color-guinda)] border-[var(--color-guinda)]/20",
  CUENTA_PUBLICA:
    "bg-[var(--color-guinda-deep)]/10 text-[var(--color-guinda-deep)] border-[var(--color-guinda-deep)]/20",
  PRESUPUESTO_EGRESOS:
    "bg-[var(--color-dorado)]/15 text-[var(--color-dorado-700)] border-[var(--color-dorado)]/30",
  LEY_INGRESOS:
    "bg-[var(--color-dorado)]/15 text-[var(--color-dorado-700)] border-[var(--color-dorado)]/30",
};

const BADGE_FALLBACK =
  "bg-[var(--color-guinda)]/10 text-[var(--color-guinda)] border-[var(--color-guinda)]/20";

function asString(v) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SevacPage({ searchParams }) {
  const params = (await searchParams) ?? {};
  const anioRaw = asString(params.anio);
  const trimestreRaw = asString(params.trimestre);
  const anio = anioRaw ? Number(anioRaw) : undefined;
  const trimestre = trimestreRaw || undefined;

  const documentos = await getSevac({ anio, trimestre });
  const hayFiltros = Boolean(anio || trimestre);

  return (
    <main className="flex flex-1 flex-col">
      <Breadcrumbs items={[{ name: "Inicio", path: "/" }, { name: "Transparencia", path: "/transparencia" }, { name: "SEvAC", path: "/transparencia/sevac" }]} />
      <PageHeader
        clave="header-sevac"
        eyebrow="Armonización contable"
        fallbackTitulo="SEvAC"
        fallbackDescripcion={sevac.titulo}
        bg="bg"
        narrow
      >
        <p className="mt-3 max-w-3xl text-sm text-[var(--color-text-secondary)] md:text-base">
          {sevac.descripcionCorta}
        </p>
      </PageHeader>

      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
        <div className="space-y-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
          <p>{sevac.descripcion}</p>
          <p>{sevac.marcoLegal}</p>
        </div>
      </section>

      <section
        aria-label="Documentos SEvAC"
        className="border-y border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-guinda)]">
              Publicaciones oficiales
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
              Documentos SEvAC
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-[var(--color-text-secondary)]">
              Información financiera y presupuestal publicada por el{" "}
              {municipalConfig.identidad.nombreCompleto} en cumplimiento de la
              armonización contable. Los documentos se visualizan directamente
              en este portal.
            </p>
          </header>

          <div className="mb-6">
            <SevacFiltros
              anioActivo={anio}
              trimestreActivo={trimestre}
            />
          </div>

          <SevacDocumentList
            hayFiltros={hayFiltros}
            items={documentos.map((doc) => {
              // Sin fallback inventado: si no hay categoría real, no hay label ni badge
              // (ver types.ts/cms.ts) -- antes cualquier documento sin categoría real
              // mostraba "otros" a la fuerza, sin serlo.
              const label = doc.categoria
                ? CATEGORIA_LABEL[doc.categoria] || doc.categoria
                : null;
              const badgeClass = doc.categoria
                ? (CATEGORIA_BADGE[doc.categoria] ?? BADGE_FALLBACK)
                : BADGE_FALLBACK;
              const subtitlePartes = [];
              if (label) subtitlePartes.push(label);
              if (doc.anio != null) subtitlePartes.push(`Ejercicio ${doc.anio}`);
              if (doc.trimestre != null)
                subtitlePartes.push(`Trim. ${doc.trimestre}`);

              return {
                doc,
                label,
                badgeClass,
                subtitle: subtitlePartes.join(" · "),
              };
            })}
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 md:py-12">
        <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-xs italic text-[var(--color-text-muted)]">
          Fuente: {sevac.fuente}
        </p>
      </section>
    </main>
  );
}
