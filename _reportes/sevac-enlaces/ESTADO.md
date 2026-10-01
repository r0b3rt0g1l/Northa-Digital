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

## Flota completa: 15 de 15 (1 de octubre de 2026, 22:03 UTC)

`verificar-enlaces-sevac.mjs --todos`: **Todo bien**. Salida: `flota-15-verificacion-2203utc.txt`.

- **15 páginas SEvAC:** ninguna publica ya direcciones de `archivos.northadigital.com` ni de Cloudinary.
- **172 documentos:** todos responden `200 application/pdf` desde el dominio de su municipio, con el mismo tamaño que el original y sin redirección.
- **Villa Pesqueira:** todavía sin documentos. La ruta nueva ya responde con su propio 404 ("Documento no encontrado").
- **Documento más grande de la flota:** Banámichi, `…/2025/t2/evaluacion-fismdf-2025.pdf`, de 90,787,806 bytes. Se descargó completo a través del portal.
- **Archivos subidos durante la corrida:** Huachinera pasó de 19 a 20 documentos y Tepache de 21 a 22. Los nuevos también funcionan.

Incidencias de la corrida, ya resueltas:
- Soyopa tenía un archivo suelto (`cinemagoer.db`) y el script se detuvo como si fuera un build roto, así que Tepache y Villa Pesqueira no se procesaron.
- El script ya está corregido (`ed0a007`): los archivos sueltos solo se avisan, y la corrida solo se detiene si falla un build.
