export const metadata = {
  title: "Transparencia · SEvAC — CMS Municipal",
};

export default async function SevacPage() {
  let loadError = null;
  try {
    // ...
  } catch (err) {
    loadError = err?.message || "No se pudieron cargar los documentos SEvAC.";
  }
  return (
    <div>
      <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Transparencia · Armonización contable
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 mt-1">SEvAC</h1>
          <p className="text-sm text-gray-600 mt-1">
            Documentos PDF del Sistema de Evaluación de la Armonización Contable
            (SEvAC) que se muestran en el portal.
          </p>
      </div>
    </div>
  );
}
