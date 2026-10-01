// ============================================================================
// ÚNICO PUNTO DE CAMBIO para conectar un CMS / portal administrador.
// Todo el sitio lee su contenido a través de lib/content (index.ts), que a su
// vez usa estas funciones. Conectar otra herramienta = ajustar SOLO este archivo
// (la URL base, el slug, los endpoints y los mappers). El resto del sitio es
// agnóstico de la herramienta.
//
// Convenciones de retorno (las consumen los getters de index.ts):
//   null  → no hay API (NEXT_PUBLIC_API_URL ausente), error de red o respuesta
//           inválida → el getter cae al fallback estático.
//   []    → el CMS respondió OK pero sin items activos (hero/cabildo) → el getter
//           decide (mostrar vacío o caer al fallback).
// ============================================================================
import type {
  Atractivo,
  Contenido,
  Documento,
  DocumentoFiltros,
  Estadistica,
  Funcionario,
  HeroSlide,
  ImagenGaleria,
  Noticia,
  RawCmsItem,
  TipoMiembro,
} from "./types";

const MUNICIPIO_SLUG = process.env.NEXT_PUBLIC_MUNICIPIO_SLUG || "municipio";
const TIMEOUT_MS = 30000;
// Techo del cache de fetch, NO el valor efectivo. Next toma el MINIMO entre este
// numero y el `export const revalidate` de cada ruta, asi que dejarlo bajo anula en
// silencio lo que declare la pagina. Se mantiene alto a proposito: manda la ruta.
const REVALIDATE_S = 86400;

type FetchInit = RequestInit & { next?: { revalidate?: number; tags?: string[] } };

/** Fetch crudo al endpoint del municipio. Devuelve el JSON parseado o null.
 *  revalidateOverride: para rutas cuyo `export const revalidate` de página NUNCA se
 *  aplica (p.ej. transparencia/sevac, que lee searchParams y por eso Next la vuelve
 *  100% dinámica sin ISR de página). En esos casos el ÚNICO control de frescura que
 *  queda es este fetch, así que necesita su propio revalidate en vez de heredar el
 *  techo genérico REVALIDATE_S.
 *  recurso: nombre del tipo de contenido (p.ej. "noticias", "hero", "sevac"). Etiqueta
 *  el fetch como `${slug}:${recurso}` para que /api/revalidate (T2-bis) pueda invalidar
 *  SOLO este recurso cuando el backend avisa que cambió, en vez de esperar el `revalidate`
 *  fijo o depender de un purge manual (un redeploy de Vercel NO limpia el Data Cache). */
async function cmsFetch(
  path: string,
  recurso: string,
  revalidateOverride?: number,
): Promise<unknown | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) return null;

  const url = `${baseUrl}/api/municipios/${MUNICIPIO_SLUG}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const init: FetchInit = {
      signal: controller.signal,
      next: {
        revalidate: revalidateOverride ?? REVALIDATE_S,
        tags: [`${MUNICIPIO_SLUG}:${recurso}`],
      },
    };
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function asArray(data: unknown): RawCmsItem[] | null {
  return Array.isArray(data) ? (data as RawCmsItem[]) : null;
}

function timeMs(value: unknown): number {
  return new Date((value as string) || 0).getTime();
}

// ---------------------------------------------------------------- mappers ----
// (Copia parcial para las pruebas: solo lo que usa la página SEvAC.)

function mapDocumento(item: RawCmsItem, withAmbito: boolean): Documento {
  return {
    id: item.id,
    titulo: item.titulo,
    descripcion: item.descripcion || "",
    url: item.archivoUrl,
    portadaUrl: item.portadaUrl ?? null,
    tamanoBytes: item.fileSize ?? null,
    nombreArchivo: item.fileName ?? null,
    // Sin fallback inventado: si el CMS no trae categoría, queda null (ver types.ts).
    categoria: item.categoria || null,
    tipo: item.tipo || "PDF",
    ambito: withAmbito ? item.ambito ?? null : null,
    anio: item.anio ?? null,
    trimestre: item.trimestre ?? null,
    creadoEn: item.creadoEn ?? null,
    actualizadoEn: item.actualizadoEn ?? null,
  };
}

function sortDocs(a: Documento, b: Documento): number {
  const anioA = a.anio ?? 0;
  const anioB = b.anio ?? 0;
  if (anioB !== anioA) return anioB - anioA;
  return timeMs(b.creadoEn) - timeMs(a.creadoEn);
}

function buildDocsQuery(filtros: DocumentoFiltros, includeAmbito: boolean): string {
  const params = new URLSearchParams();
  if (filtros.categoria) params.set("categoria", filtros.categoria);
  if (filtros.anio) params.set("anio", String(filtros.anio));
  if (filtros.trimestre) params.set("trimestre", String(filtros.trimestre));
  if (includeAmbito && filtros.ambito) params.set("ambito", filtros.ambito);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function cmsSevac(
  filtros: DocumentoFiltros = {},
): Promise<Documento[] | null> {
  // 1800s = el revalidate que la pagina declara y que nunca se aplica por si sola,
  // porque searchParams vuelve la ruta dinamica. Este es el unico control real.
  const data = asArray(
    await cmsFetch(`/sevac${buildDocsQuery(filtros, false)}`, "sevac", 1800),
  );
  if (!data || data.length === 0) return null;
  return data.map((i) => mapDocumento(i, false)).sort(sortDocs);
}
