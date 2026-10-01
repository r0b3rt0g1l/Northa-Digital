# Enlaces SEvAC en el dominio del municipio: estado

Código y detalle técnico: `para-portales/sevac-enlaces/LEEME.md`.

## Piloto: Bacadéhuachi (1 de octubre de 2026)

| Comprobación | Resultado |
|---|---|
| Despliegue | `dpl_8KS8zs2aaftRJGwryrDMa6ZdkMXS`, en producción desde las 21:40 UTC |
| `verificar-enlaces-sevac.mjs --completo bacadehuachi` | **18/18 OK**, con descarga completa y el mismo tamaño que el original, incluido el PDF de **14.8 MB**: el streaming funciona en Vercel. La página ya no publica direcciones de `archivos.northadigital.com` ni de Cloudinary. Salida: `bacadehuachi-verificacion-2140utc.txt` |
| Cabeceras | `200`, `application/pdf`, `content-disposition: inline; filename="mantenimiento-de-puente-peatonal.pdf"`, sin redirección |
| Navegador (producción) | El iframe, "Descargar" y "Pestaña" usan `/transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal.pdf`. "Copiar enlace" copia `https://bacadehuachitransparencia.com.mx/transparencia/sevac/2026/t2/mantenimiento-de-puente-peatonal.pdf` y muestra "Copiado". Captura: `bacadehuachi-visor-copiar-enlace.png` |

Nota: el Chromium sin interfaz de las pruebas no dibuja PDFs, por eso el visor sale en blanco en la captura. Que el PDF se vea dentro del visor se confirma en un navegador normal.

## Resto de la flota

| Portal | Estado |
|---|---|
| Aconchi, Bacanora, Banámichi, Baviácora, Carbó, Cucurpe, Huachinera, Mazatán, Rayón, Sahuaripa, San Javier | Aplicado. `verificar-enlaces-sevac.mjs`: **OK en las 12 páginas** (incluida Bacadéhuachi), **137 documentos** sin fallas y ninguna dirección de northadigital/Cloudinary en las páginas. Salida: `flota-12-verificacion.txt` |
| Documento más grande de la flota | Banámichi, `…/2025/t2/evaluacion-fismdf-2025.pdf`: **90,787,806 bytes completos** a través del portal, `200 application/pdf`. El streaming aguanta |
| Soyopa | Pendiente. La primera corrida lo saltó por un archivo suelto (`cinemagoer.db`); el script ya no se bloquea por eso |
| Tepache, Villa Pesqueira | Pendientes. Se quedaron sin procesar por un error del script, ya corregido: con `--build` se detenía ante cualquier falla, no solo ante un build roto |
