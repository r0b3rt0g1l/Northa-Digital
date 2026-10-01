// Reconstrucción para pruebas del tablero (líneas reales del grep).
export default async function Tablero() {
  const sevac = [];
  const listas = [
    { label: "SEvAC", href: "/transparencia/sevac", items: sevac, campoTitulo: "titulo" },
  ];
  const tarjetas = [
    { href: "/transparencia/sevac", label: "SEvAC", icon: "shield", count: sevac?.length },
  ];
  const recientes = [
    ...(sevac || []).map((d) => ({
      tipo: "Documento SEvAC",
      titulo: d.titulo,
      href: "/transparencia/sevac",
    })),
  ];
  return null;
}
