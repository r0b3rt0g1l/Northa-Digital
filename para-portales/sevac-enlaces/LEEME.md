# Enlaces SEvAC en el dominio del municipio

**Problema:** los documentos SEvAC se ven y se descargan desde `archivos.northadigital.com/…/<código>.pdf` o `res.cloudinary.com/…`, y cada documento no tiene una dirección propia en el sitio del municipio. Si se comparte `/transparencia/sevac`, la página abre al inicio, no en el documento.

**Lo que pidió el operador (1 de octubre de 2026):**
- Nombre legible, con año y trimestre.
- Que el enlace abra el PDF directo.
- Un botón "Copiar enlace" en el visor.
- Aplicarlo a los 15 municipios.

```
https://bacadehuachitransparencia.com.mx/transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal.pdf
https://bacadehuachitransparencia.com.mx/transparencia/sevac/2026/t3/actas-de-cabildo.pdf
https://www.aconchitransparencia.com.mx/transparencia/sevac/2026/anual/programa-anual-de-evaluacion.pdf
```

## Piezas

| Archivo | Qué hace |
|---|---|
| `lib/sevac-enlaces/enlaces.js` | Calcula la ruta de cada documento. El periodo es `t1`…`t4`, o `anual` si no tiene trimestre. Si dos documentos del mismo periodo tienen el mismo título, el más antiguo conserva el nombre y los demás llevan un sufijo fijo del archivo. Sin dependencias. |
| `lib/sevac-enlaces/servir-documento.js` | Resuelve la ruta y sirve el archivo **en streaming** desde R2 o Cloudinary. Sin redirección, con `Range` (el visor de PDF pide por partes), `HEAD`, nombre legible, 404 legible y solo orígenes permitidos. Toma el slug y la API de `NEXT_PUBLIC_MUNICIPIO_SLUG` y `NEXT_PUBLIC_API_URL`, igual que `lib/content/cms.ts`. |
| `plantillas/route.js` | Va a `app/(con-footer)/transparencia/sevac/[anio]/[periodo]/[archivo]/route.js`. Es idéntica en los 15 portales. |
| Parche de `app/(con-footer)/transparencia/sevac/page.js` | Cambia el `url` de cada documento por su ruta pública. La calcula con el listado **completo** aunque haya filtros. |
| Parche de `components/transparencia/PDFViewer.jsx` | Botón "Copiar enlace" junto a "Pestaña". Solo aparece si `pdfUrl` es del propio dominio, es decir, si empieza con `/`. |
| `aplicar-enlaces-sevac.mjs` | Aplica todo lo anterior en uno o varios repos de portal. Es un solo archivo: trae los nuevos dentro (`node construir.mjs` los actualiza). Trabaja todo o nada por repo y, si el build falla, deja el repo como estaba. |
| `verificar-enlaces-sevac.mjs` | Verificación en vivo, de solo lectura, después de publicar. |

## Cómo se aplica (en la Mac, por el operador)

```
node aplicar-enlaces-sevac.mjs --dry-run ~/Developer/Bacadehuachi                 # ver el cambio
node aplicar-enlaces-sevac.mjs --build --commit --push ~/Developer/Bacadehuachi   # piloto
node verificar-enlaces-sevac.mjs --completo bacadehuachi                          # verificación
```

Primero va el piloto en Bacadéhuachi, para confirmar en Vercel que un PDF de 14.8 MB pasa en streaming. Después, el resto de la flota con un solo comando.

### Por qué en streaming y no con redirección

Una redirección mostraría `archivos.northadigital.com` en la barra del navegador. Una respuesta normal de función en Vercel no puede pasar de 4.5 MB, pero en streaming no hay ese límite, y en la flota hay documentos SEvAC de hasta 90 MB.

## Comprobado

- **Pruebas:** `npm test` en esta carpeta, 41 pruebas. Usan los listados reales de Bacadéhuachi, Banámichi, Tepache y Aconchi, y el código real de la página SEvAC y del visor. Comprueban:
  - Rutas únicas, y que cada ruta vuelve a su documento.
  - Que el documento crudo de la API y el normalizado por `mapDocumento` dan la misma ruta.
  - Que los parches son idempotentes y no tocan un archivo que no es como el del molde.
  - Que el script no toca repos con cambios sin guardar ni en otra rama, y deshace todo si el build falla.
- **En vivo (1 de octubre de 2026):** el manejador, contra la API y los archivos reales, sirvió los 18 documentos de Bacadéhuachi **byte por byte idénticos** al original: 7 de R2 y 11 de Cloudinary, el mayor de 14.8 MB. El `Range` respondió `206`.
- **Next 16.3.8 (Turbopack):** se compiló un portal de prueba con la página y el visor reales ya parcheados, más la ruta nueva. Resultados:
  - Los 18 documentos de la página usan `/transparencia/sevac/...`; ninguno usa northadigital ni Cloudinary.
  - Con filtros salen los mismos enlaces.
  - En el navegador, el iframe, "Descargar", "Pestaña" y "Abrir documento" (móvil) usan el enlace propio.
  - "Copiar enlace" copia la dirección completa y muestra "Copiado".
  - Sin errores en la consola.
- **Flota:**
  - Los 15 portales usan **el mismo** visor (`2iaoqpfsvmtgr.js`) y la misma lista SEvAC (`1xn62yqcdxwxz.js`).
  - Ninguno manda `X-Frame-Options` ni CSP que impida mostrar el PDF del propio dominio en el visor.

## Limitaciones conocidas

- Si en el panel cambian el **título, el año o el trimestre** de un documento, su enlace cambia. Hay que registrar el enlace en SEvAC cuando el título ya sea el definitivo.
- Si se borra el más antiguo de dos documentos con el mismo título, el otro pasa a tener el nombre limpio. Su enlace con sufijo, si ya se compartió, sigue funcionando.
- Un documento recién subido funciona de inmediato: si no aparece en la caché de 5 minutos, la ruta vuelve a consultar la API sin caché.
