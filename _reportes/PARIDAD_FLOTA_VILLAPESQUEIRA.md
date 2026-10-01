# Villa Pesqueira frente a la flota: comparación de estructura

**Fecha:** 1 de octubre de 2026, alrededor de las 18:25 UTC. **Método:** solo lectura sobre los 15 portales en producción (configuración `municipalConfig` del código que recibe el navegador, secciones del home, rutas) y sobre la API pública (contenido por tipo).

## Conclusión

- **Portal: la estructura es igual a la de sus hermanos.** Villa Pesqueira es de la **generación A** del molde, igual que Bacadéhuachi, Bacanora, Carbó, Cucurpe, Mazatán, Sahuaripa y San Javier. Tiene las mismas 15 rutas con las mismas respuestas, las mismas 12 secciones de configuración y el mismo pie con botón de Facebook. En historia y línea de tiempo tiene **más** contenido que todos (6 párrafos y 12 hitos, frente a 3 párrafos y de 3 a 6 hitos).
- **Home:** de las 4 secciones que tienen Carbó y sus hermanos, a Villa Pesqueira le falta solo **"Vistas destacadas"** (el carrusel del hero), porque el hero está vacío en el panel. Las otras 3 (Datos del municipio, Acciones recientes e Historia) son iguales.
- **Panel:** es la **misma aplicación** (`cms-admin`) para todos los municipios, con datos separados por municipio. No hay diferencia de estructura; la diferencia es el **contenido cargado**, que en Villa Pesqueira es 0 en todos los tipos.
- **Diferencias reales que no son de contenido:**
  1. **Sin dominio propio:** los 14 restantes tienen `<municipio>transparencia.com.mx` o equivalente.
  2. **La sincronización del panel con la web no está confirmada** (ver el reporte de estado).
- **Igual que la flota, para bien o para mal:** el formulario de contacto está desactivado en todos los portales revisados (Carbó, Mazatán, Cucurpe, San Javier, Sahuaripa y Villa Pesqueira). Los datos de contacto de la configuración también están vacíos en la mayoría.

## Tabla completa

| Municipio | Generación del molde | Botón Facebook | Párrafos de historia | Hitos | Portada de Historia | Hero | Estadísticas | Funcionarios | Atractivos | Noticias | SEvAC |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bacadehuachi | A | ✅ | 3 | 3 | — | 1 | 4 | 6 | 4 | 2 | 13 |
| bacanora | A | ✅ | 3 | 5 | ✅ | 1 | 3 | 16 | 3 | 34 | 0 |
| banamichi | ? | — | - | 6 | ✅ | 3 | 5 | 17 | 4 | 51 | 20 |
| baviacora | B | ✅ | - | 6 | ✅ | 5 | 5 | 15 | 6 | 1 | 4 |
| carbo | A | ✅ | 3 | 4 | ✅ | 1 | 5 | 7 | 1 | 123 | 0 |
| cucurpe | A | ✅ | 3 | 5 | ✅ | 1 | 3 | 14 | 3 | 10 | 1 |
| huachinera | B | ✅ | - | 6 | ✅ | 1 | 5 | 17 | 6 | 9 | 18 |
| mazatan | A | ✅ | 3 | 4 | ✅ | 1 | 2 | 16 | 1 | 20 | 5 |
| rayon | ? | — | - | 5 | ✅ | 2 | 5 | 15 | 5 | 17 | 14 |
| sahuaripa | A | ✅ | 3 | 4 | — | 1 | 5 | 18 | 5 | 51 | 16 |
| sanjavier | A | ✅ | 3 | 6 | ✅ | 1 | 5 | 13 | 4 | 5 | 17 |
| soyopa | ? | — | - | 6 | ✅ | 3 | 5 | 16 | 6 | 32 | 12 |
| tepache | B | ✅ | - | 5 | ✅ | 1 | 5 | 16 | 4 | 30 | 21 |
| **villapesqueira** | **A** | **✅** | **6** | **12** | **✅** | **0** | **0** | **0** | **0** | **0** | **0** |
| aconchi | B | ✅ | - | 6 | ✅ | 2 | 5 | 15 | 5 | 29 | 15 |

"Generación A": la historia está en `municipalConfig.historia`. "Generación B": la historia está escrita dentro del componente. Banámichi, Rayón y Soyopa salen como "1" en generación porque su configuración no se pudo extraer automáticamente (otro formato).

## Qué falta para igualar a los demás

| Prioridad | Qué | Quién | Referencia en la flota |
|---|---|---|---|
| 1 | **Hero** en el panel (1 a 3 slides con imagen) | Personal del ayuntamiento | Todos tienen de 1 a 3 |
| 2 | **Funcionarios** (cabildo y directorio) | Personal del ayuntamiento | Entre 6 y 18 |
| 3 | **Estadísticas** | Personal del ayuntamiento | Entre 2 y 5 |
| 4 | **Atractivos turísticos** | Personal del ayuntamiento | Entre 1 y 6 |
| 5 | **Noticias y SEvAC** | Personal del ayuntamiento | Se llenan con el uso |
| 6 | **Dominio propio** (DNS, Vercel, `Municipio.dominio`, `siteUrl`) | Tú | Los 14 restantes lo tienen |
| 7 | **Confirmar que el panel avisa al portal** | Tú y Claude | Medición pendiente |
