# Contenido inicial de Villa Pesqueira para cargar en el panel

**Para qué sirve:** después del alta, la API de Villa Pesqueira responde `[]`. Si el home deja de mostrar el hero y las estadísticas (riesgo H2 del [reporte de estado](ESTADO_VILLA_PESQUEIRA_PRE_ALTA.md)), cargas este contenido en el panel y el home vuelve a verse igual que hoy.

**De dónde salen los textos:** del respaldo que el portal sirve ahora mismo (payload RSC de `/`, capturado el 30 de septiembre de 2026). Son exactamente los textos actuales; no inventé ninguno.

> **Qué no pude ver:** el panel de administración está detrás de Cloudflare Access. Los nombres de los campos de abajo son los de la API (los mismos de Carbó); en la pantalla del panel pueden llamarse distinto.

---

## 1. Hero (2 slides)

Los campos de la API son `etiqueta`, `titulo`, `subtitulo`, `textoBoton`, `linkBoton`, `imagenUrl`, `orden` y `activo`. En Carbó, `textoBoton` y `linkBoton` están vacíos, así que el botón es opcional.

| | Slide 1 | Slide 2 |
|---|---|---|
| Etiqueta | `Villa Pesqueira, Sonora` | `Administración 2024-2027` |
| Título | `Bienvenidos a Villa Pesqueira` | `H. Ayuntamiento de Villa Pesqueira, Sonora` |
| Subtítulo | `Antigua misión de San José de Mátape, fundada en 1629.` | `Una administración cercana a la gente, con transparencia, rendición de cuentas y trabajo en equipo.` |
| Texto del botón | `Conoce el Municipio` | `Conoce el Gobierno` |
| Enlace del botón | `/turismo` | `/gobierno/directorio` |
| Orden | 1 | 2 |
| Imagen | Ver la nota de abajo | Ver la nota de abajo |

**Imagen:** hoy el respaldo usa `/images/placeholder.jpg`, un degradado gris. En el panel tendrás que subir una foto real (en Carbó, el hero tiene su imagen en Cloudinary). Si todavía no hay foto de Villa Pesqueira, sube una provisional y reemplázala cuando llegue el material del ayuntamiento.

**Cuidado con los textos:** en Cucurpe se pegó "Texto del botón" al subtítulo y en varios municipios quedaron espacios o saltos de línea sobrantes. Copia sin espacios al inicio ni al final.

## 2. Estadísticas

Los campos de la API son `titulo`, `valor`, `subtitulo`, `iconoUrl` y `orden`.

| Orden | Título | Valor | Subtítulo | Fuente |
|---|---|---|---|---|
| 1 | `POBLACIÓN` | `1,043` | `HABITANTES` | `municipalConfig.datos.poblacion2020` del portal |
| 2 | `SUPERFICIE` | `1124.3 km²` | (vacío) | `municipalConfig.datos.superficieKm2` del portal |

- **Confirma las cifras.** No las verifiqué contra una fuente oficial (INEGI). La clave `poblacion2020` indica que es un dato de 2020.
- **Solo dos, a propósito.** El respaldo actual tiene otras cuatro estadísticas con el valor "Por designar" (Comunidades, Programas, Obras realizadas, Inversión pública). Cuando la API devuelve al menos una estadística, el portal usa solo las de la API y no mezcla con el respaldo (lo verifiqué en San Javier). Si cargas las cuatro vacías, se mostrarían con "Por designar". Mi recomendación es cargar únicamente las que tienen dato real y agregar las demás cuando existan.
- **Ícono (inferido del código del navegador, sin probar con datos reales):** el portal dibuja un ícono propio solo para las estadísticas del respaldo. Una estadística de la API sin `iconoUrl` quedaría con un espacio vacío en lugar del ícono. Las estadísticas de Carbó tienen todas un ícono. Elige un ícono para cada una en el panel.

## 3. Cómo comprobar que quedó bien

Con `para-cmsmunicipal/scripts/verificacion/verificar-alta.mjs` (ya copiado a `cmsmunicipal`):

```bash
node scripts/verificacion/verificar-alta.mjs villapesqueira --nombre "Villa Pesqueira" \
  --portal https://villapesqueira.vercel.app \
  --esperar-texto "Bienvenidos a Villa Pesqueira" --esperar-texto "1,043"
```

- La API se ve al instante: `hero` debe tener 2 elementos y `estadisticas` 2.
- El home tarda hasta unos 5 minutos en regenerarse. Si el script reporta que falta el texto, espera y reintenta antes de pensar que algo falló.
