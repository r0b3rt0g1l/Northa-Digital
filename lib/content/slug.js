/** Nombre de archivo de un municipio: «Bacadé­huachi» → «bacadehuachi», «Villa Pesqueira» → «villa-pesqueira». */
export function slugMunicipio(nombre) {
  return nombre
    .replace(/­/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
