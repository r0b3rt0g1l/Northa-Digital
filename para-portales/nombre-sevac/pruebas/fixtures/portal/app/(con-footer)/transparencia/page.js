// Reconstrucción para pruebas: solo las líneas conocidas (grep del 1-oct-2026) son reales.
import { buildMetadata } from "@/lib/seo";
import { municipalConfig } from "@/lib/municipalConfig";

export const metadata = buildMetadata({
  title: "Transparencia",
  description: `Hub de Transparencia del ${municipalConfig.identidad.nombreCompleto}: información pública, leyes, estructura orgánica, SEvAC y enlaces a las plataformas nacional y estatal de transparencia.`,
  path: "/transparencia",
});

const SECCIONES = [
  {
    label: "Información pública",
    description: "Leyes, reglamentos y obligaciones de transparencia.",
    href: "/transparencia/informacion",
  },
  {
    label: "SEvAC",
    description:
      "Sistema de Evaluaciones de la Armonización Contable: cumplimiento por categoría e informes trimestrales del ejercicio fiscal.",
    href: "/transparencia/sevac",
  },
];

export default function TransparenciaPage() {
  return (
    <main>
      <p>
              Información pública, marco legal, evaluaciones SEvAC y el
              organigrama completo del Ayuntamiento — todo en un solo lugar.
      </p>
      <ul>{SECCIONES.map((s) => <li key={s.href}>{s.label}</li>)}</ul>
    </main>
  );
}
