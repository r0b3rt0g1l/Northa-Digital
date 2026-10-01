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

Pendiente: se aplica con un solo comando desde la Mac del operador y después se verifica con `verificar-enlaces-sevac.mjs --todos`.
