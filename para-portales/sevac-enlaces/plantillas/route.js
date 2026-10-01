// Documentos SEvAC en el dominio del municipio:
//   /transparencia/sevac/<año>/<t1..t4|anual>/<nombre>.pdf  ->  el archivo, directo.
// Toda la lógica está en lib/sevac-enlaces/servir-documento.js. El slug y la API salen de las
// mismas variables que usa lib/content/cms.ts, así que este archivo es igual en todos los portales.
import { crearManejador } from "@/lib/sevac-enlaces/servir-documento";

const manejar = crearManejador({
  municipio: process.env.NEXT_PUBLIC_MUNICIPIO_SLUG,
  api: process.env.NEXT_PUBLIC_API_URL,
});

export async function GET(request) {
  return manejar(request);
}

export async function HEAD(request) {
  return manejar(request);
}
