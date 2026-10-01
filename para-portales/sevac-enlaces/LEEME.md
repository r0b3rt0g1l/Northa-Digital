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

| Archivo | Qué hace | Estado |
|---|---|---|
| `lib/sevac/enlaces.js` | Calcula la ruta de cada documento. El periodo es `t1`…`t4`, o `anual` si no tiene trimestre. Si dos documentos del mismo periodo tienen el mismo título, el más antiguo conserva el nombre y los demás llevan un sufijo fijo del archivo. Sin dependencias. | Listo, con pruebas |
| `lib/sevac/servir-documento.js` | Resuelve la ruta y sirve el archivo **en streaming** desde R2 o Cloudinary. Sin redirección, con `Range` (el visor de PDF pide por partes), `HEAD`, nombre legible, 404 legible y solo orígenes permitidos. | Listo, con pruebas |
| `plantillas/route.js` | La ruta de Next que se copia a `…/transparencia/sevac/[anio]/[periodo]/[archivo]/route.js` de cada portal. | Listo |
| Página SEvAC del portal | Debe cambiar `url` de cada documento por su ruta pública. Hay que calcularla con el listado **completo**, antes de filtrar. | **Falta ver el código fuente** |
| `PDFViewer` del portal | Botón "Copiar enlace". Solo aparece cuando el documento se sirve desde el dominio del municipio, es decir, cuando `pdfUrl` empieza con `/`. | **Falta ver el código fuente** |

### Por qué en streaming y no con redirección

Una redirección mostraría `archivos.northadigital.com` en la barra del navegador. Una respuesta normal de función en Vercel no puede pasar de 4.5 MB, pero en streaming no hay ese límite, y en la flota hay documentos SEvAC de hasta 90 MB.

## Comprobado

- **Pruebas:** `npm test` en esta carpeta, 30 pruebas. Usan los listados reales de Bacadéhuachi, Banámichi, Tepache y Aconchi. Comprueban rutas únicas y que cada ruta vuelve a su documento. También que el documento crudo de la API y el normalizado del portal dan la misma ruta.
- **En vivo (1 de octubre de 2026):** el manejador, contra la API y los archivos reales, sirvió los 18 documentos de Bacadéhuachi **byte por byte idénticos** al original: 7 de R2 y 11 de Cloudinary, el mayor de 14.8 MB. El `Range` respondió `206`.
- **Flota:** los 15 portales usan **el mismo** visor (`2iaoqpfsvmtgr.js`) y la misma lista SEvAC (`1xn62yqcdxwxz.js`), así que un solo parche sirve para todos.

## Limitaciones conocidas

- Si en el panel cambian el **título, el año o el trimestre** de un documento, su enlace cambia. Hay que registrar el enlace en SEvAC cuando el título ya sea el definitivo.
- Si se borra el más antiguo de dos documentos con el mismo título, el otro pasa a tener el nombre limpio. Su enlace con sufijo, si ya se compartió, sigue funcionando.
- Un documento recién subido funciona de inmediato: si no aparece en la caché de 5 minutos, la ruta vuelve a consultar la API sin caché.
