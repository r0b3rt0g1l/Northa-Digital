// Documentos SEvAC en el dominio del municipio:
//   /transparencia/sevac/<año>/<t1..t4|anual>/<nombre>.pdf  ->  el archivo, directo.
// Toda la lógica está en lib/sevac/servir-documento.js.
import { crearManejador } from "__IMPORTAR__";

const manejar = crearManejador({ municipio: "__MUNICIPIO__" });

export async function GET(request) {
  return manejar(request);
}

export async function HEAD(request) {
  return manejar(request);
}
