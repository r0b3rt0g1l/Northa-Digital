// Copia parcial de lib/content/types.ts del portal (solo lo que usa la página SEvAC).

export interface Documento {
  id: string;
  titulo: string;
  descripcion: string;
  url: string;
  portadaUrl: string | null;
  tamanoBytes: number | null;
  nombreArchivo: string | null;
  categoria: string | null;
  tipo: string;
  ambito: string | null;
  anio: number | null;
  trimestre: number | null;
  creadoEn: string | null;
  actualizadoEn: string | null;
}

export interface DocumentoFiltros {
  categoria?: string;
  anio?: number | string;
  trimestre?: number | string;
  ambito?: string;
}

export type RawCmsItem = Record<string, any>;

// Tipos que importa cms.ts y que esta copia parcial no usa.
export type Atractivo = unknown;
export type Contenido = unknown;
export type Estadistica = unknown;
export type Funcionario = unknown;
export type HeroSlide = unknown;
export type ImagenGaleria = unknown;
export type Noticia = unknown;
export type TipoMiembro = string;
