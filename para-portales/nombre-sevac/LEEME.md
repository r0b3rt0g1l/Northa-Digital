# SEvAC pasa a llamarse "SEvAC/Cumplimiento" (15 portales y cms-admin)

Pedido del operador, 1 de octubre de 2026, con sus decisiones:

- **Nombre:** se escribe "SEvAC/Cumplimiento". En el menú se ve en mayúsculas por el estilo.
- **Apartado:** queda solo esta descripción: *"Este apartado tiene como objetivo concentrar y dar cumplimiento a las obligaciones normativas vigentes del municipio, incluyendo las evaluaciones del SEVAC y demás disposiciones aplicables."*
  - Se quitan el subtítulo, la explicación del sistema y el marco legal, que hablaban de armonización contable.
  - La Fuente queda "CONAC y Auditoría Superior de la Federación (ASF)".
- **Dirección:** no cambia (`/transparencia/sevac`). Los enlaces de documentos ya compartidos siguen funcionando.

## Qué cambia

| Dónde | Cambio |
|---|---|
| `lib/sevac.js` | Título, descripción nueva y CONAC en siglas. Se quitan `descripcionCorta` y `marcoLegal`, que solo usaba el apartado. |
| `app/(con-footer)/transparencia/sevac/page.js` | Pestaña, migas de pan y encabezado. El subtítulo pasa a ser "Obligaciones normativas". Se quita la sección de explicación y marco legal. La lista se titula "Documentos" y su texto ya no menciona la armonización contable. |
| `app/(con-footer)/transparencia/page.js` | Tarjeta del hub con el nombre y la descripción nuevos. |
| `components/layout/navItems.js`, `Footer.jsx`, `components/home/TransparenciaCTA.jsx` | Etiqueta "SEvAC/Cumplimiento". |
| Componentes del menú (se localizan por sus clases: contenedor en `MainNav.jsx`, opciones en otros archivos de `components/`) | Separación entre opciones `gap-5` → `gap-3` (20 → 12 px) y letra `text-sm` → `text-[13px] leading-5` en sus 3 variantes: enlace normal, enlace externo y botón con submenú. Ver abajo. |
| cms-admin | Menú lateral, acceso rápido, tablero, títulos y encabezados de las páginas de SEvAC, y catálogo de encabezados. |

### Por qué se compacta el menú

Se midió en producción a 1024, 1150, 1279, 1280, 1366, 1440, 1536 y 1920 px, con Villa Pesqueira (el nombre más largo) y Bacadéhuachi:

- **Solo con el texto nuevo**, el menú no cabe:
  - A 1366 px, el nombre del municipio se aprieta a 4 renglones.
  - A 1024 px, el nombre se encima con "INICIO" y la página se desborda.
- **Con 12 px de separación y letra de 13 px** (la variante B de las cuatro probadas), el encabezado queda igual que hoy en todos los anchos:
  - Marca de 88 px de alto por debajo de 1280 px y de 64 px desde 1280 px.
  - Sin encimarse ni desbordarse.

## Uso

```
node aplicar-nombre-sevac.mjs --dry-run <repos...>
node aplicar-nombre-sevac.mjs --build --commit --push <repos...>
```

- Detecta solo si cada repo es un portal o el admin.
- Trabaja todo o nada por repo.
- Solo lo frenan los cambios sin guardar en los archivos que toca. Otros cambios se avisan y no entran al commit.
- Si el build falla, deja el repo como estaba y se detiene.

## Comprobado

- **`npm test`:** 7 pruebas sobre réplicas de los archivos reales, armadas con las líneas exactas que dio el `grep` del operador. Cubren:
  - El resultado esperado y que no quede ninguna "armonización contable".
  - Que correrlo dos veces no cambia nada.
  - Que no toca un archivo distinto al molde.
  - Que los cambios sin guardar ajenos no entran al commit.
  - Que deshace todo si el build falla.
- **Next 16.3.8:** compila la página del apartado ya renombrada (con los enlaces SEvAC).
  - Pestaña "SEvAC/Cumplimiento", subtítulo "Obligaciones normativas" y descripción nueva.
  - 0 apariciones de "armonización" en el HTML.
  - Los 18 documentos de Bacadéhuachi siguen con su enlace propio.

---

## Paso 2: el nombre todo en mayúsculas (2 de octubre de 2026)

**Pedido del operador:** "SEvAC/Cumplimiento debe ir todo en mayúsculas". El nombre pasa a **SEVAC/CUMPLIMIENTO** en la web (título, pestaña, menú, pie, acceso del inicio, tarjeta del hub) y en el admin. La dirección no cambia. El menú ya se veía en mayúsculas por el estilo.

`mayusculas-sevac.mjs` parte del nombre que puso `aplicar-nombre-sevac.mjs`. Reemplaza el nombre en **todos** los archivos de código del repo, para que no quede ninguna aparición atrás. Si el nombre aparece escrito de otra forma, o falta en algún archivo esperado, no toca nada y lo dice.

### Ajuste solo en los portales: el título grande puede partirse tras la barra

Medido en producción, "SEVAC/CUMPLIMIENTO" no tiene espacios y a 320 px de ancho mide 351 px, así que se sale de la pantalla. El título del apartado ahora sale de `sevac.titulo.replace("/", "/​")`: el carácter invisible U+200B tras la barra permite partirlo en dos renglones. Solo afecta al título grande. La pestaña, las migas y las etiquetas siguen con el texto limpio.

Revisado en producción, con la fuente real del sitio:

| Ancho | Título |
|---|---|
| 375, 390, 414, 768 y 1366 px | 1 renglón |
| 320 y 360 px | 2 renglones: "SEVAC/" y "CUMPLIMIENTO". No se sale de la pantalla |

En el admin, el menú lateral cabe: el texto ocupa 158 px de 178 disponibles, medido con una fuente más ancha que la real.

### Uso

```
node mayusculas-sevac.mjs --dry-run ~/Developer/Carbo ~/Developer/cms-admin
node mayusculas-sevac.mjs --build --commit --push ~/Developer/Carbo ~/Developer/cms-admin
```

Trabaja todo o nada por repo, deja el repo como estaba si falla el build y hace un commit solo con los archivos del cambio. Las pruebas (`npm test`, 18 en total con las del paso 1) parten del repo en el estado real de la flota: molde, más el paso 1 aplicado.
