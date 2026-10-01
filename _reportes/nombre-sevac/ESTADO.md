# SEvAC → "SEvAC/Cumplimiento": estado

Código y detalle técnico: `para-portales/nombre-sevac/LEEME.md`.

## cms-admin

- **Aplicado y subido.** Commit `985cf93` en `NorthaDigital/cms-admin`.
- **Sin revisar a la vista:** el admin está detrás de Cloudflare Access y no se puede revisar desde fuera. Falta que el operador lo confirme.

## Piloto: Bacadéhuachi (en producción desde las 22:41 UTC del 1 de octubre de 2026)

| Comprobación | Resultado |
|---|---|
| Textos (`/`, `/contacto`, `/transparencia`, `/transparencia/sevac`) | El nombre nuevo aparece en el menú, el pie, la tarjeta del hub y el apartado. **0 apariciones de "armonización"** en el HTML de las 4 páginas |
| Apartado | Pestaña "SEvAC/Cumplimiento · Municipio de Bacadéhuachi". Debajo del título, "Obligaciones normativas" y la descripción nueva. Lista "Documentos" con el texto nuevo. Fuente: "CONAC y Auditoría Superior de la Federación (ASF)". Captura: `bacadehuachi-apartado-1366.png` |
| Encabezado a 1024, 1150, 1279, 1280, 1366, 1440, 1536 y 1920 px | Igual que antes del cambio: marca de 88 px por debajo de 1280 y de 64 px desde 1280. Sin desbordes. Las tres variantes del menú con letra de 13 px. Captura: `bacadehuachi-encabezado-1366.png` |
| Celular (390 px) | El menú de hamburguesa incluye "SEvAC/Cumplimiento". Captura: `bacadehuachi-movil.png` |
| Enlaces de documentos | `verificar-enlaces-sevac.mjs bacadehuachi`: **18/18 OK** |
| Errores de JavaScript | Ninguno |

### Problema que ya existía (no lo causa este cambio)

A 1024 px, en Bacadéhuachi la palabra "Bacadéhuachi" se encima con "INICIO". Con el menú anterior pasa exactamente lo mismo (comparar `bacadehuachi-1024-menu-anterior.png` con `bacadehuachi-1024-menu-nuevo.png`).

La causa es que el nombre del municipio es una sola palabra larga y la marca no tiene ancho mínimo. En Carbó, a ese ancho, no se encima. Se puede corregir aparte, por ejemplo mostrando el menú de hamburguesa por debajo de 1280 px.

## Flota completa: 15 de 15 portales (1 de octubre de 2026)

Corrida del operador: los 14 portales restantes, `aplicado`. Verificación en producción:

| Comprobación | Resultado |
|---|---|
| Textos, 15 portales × 4 páginas (`/`, `/transparencia`, `/transparencia/sevac`, `/contacto`) | **15/15 OK**: pestaña "SEvAC/Cumplimiento", descripción nueva, Fuente "CONAC y Auditoría Superior…", el nombre nuevo en las 4 páginas y **0 apariciones de "armonización"** |
| Encabezado, 15 portales × 1024, 1150, 1279, 1280, 1366 y 1920 px | Comparado en la misma página contra el menú anterior (20 px, 14 px, "SEvAC"): **en ningún caso se ve peor**. A 1024 px, el nombre del municipio ya invadía el espacio del menú antes del cambio (ver arriba) |
| Enlaces de documentos | `verificar-enlaces-sevac.mjs --todos`: **Todo bien**, 173 documentos (Bacanora pasó a 2). Salida: `flota-15-enlaces-tras-renombre.txt` |
| cms-admin | Aplicado (`985cf93`). Falta que el operador lo confirme a la vista |
