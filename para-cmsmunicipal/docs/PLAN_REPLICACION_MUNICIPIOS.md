# Plan de replicación: alta de un municipio nuevo en la flota

> **Destino:** `cmsmunicipal/docs/PLAN_REPLICACION_MUNICIPIOS.md`. Este archivo se escribió en `r0b3rt0g1l/Northa-Digital/para-cmsmunicipal/`, porque la sesión que lo generó no tenía acceso a `cmsmunicipal`. Cópialo tal cual.
>
> **Origen:** el alta de Villa Pesqueira (septiembre de 2026) y una auditoría de solo lectura de los 14 portales en producción. Lo que se verificó en vivo está marcado con ✔︎. Lo que viene de tu proceso actual y no se pudo revisar en el código lleva la marca (sin verificar en código).

**Convenciones:**
- `<slug>`: minúsculas, sin acentos ni espacios (ejemplo: `villapesqueira`).
- `<Nombre>`: nombre oficial con acentos (ejemplo: `Villa Pesqueira`).
- En **Quién**, **U** significa Usuario (tú) y **C** significa Claude. Los pasos que tocan producción (base de datos, Render, Cloudflare, Vercel o DNS) los ejecuta siempre **U**.

---

## Resumen del flujo

```
PRE-ALTA ──► ALTA EN BD ──► VERIFICAR ──► ADMIN + ZERO TRUST ──► CARGAR CONTENIDO ──► PRUEBAS E2E ──► PUSH cmsmunicipal ──► DOMINIO PROPIO
 (repos)       (U)          (C, script)        (U)                    (U, panel)            (U + C)          (U decide)            (U)
```

Hay tres dependencias de orden que **no son obvias** (se aprendieron en Villa Pesqueira):

1. **Zero Trust tiene que funcionar antes del alta.** Después del alta, la API responde `[]`, y el hero y las estadísticas del home pueden desaparecer si el portal no conserva el respaldo con listas vacías ([P-2](#p-2-el-respaldo-debe-sobrevivir-a-listas-vacías)). Para evitarlo, el admin tiene que poder entrar a cargar contenido en los primeros 5 minutos, antes de que el ISR regenere el home.
2. **El correo del admin tiene que poder recibir correo.** Cloudflare Access ("CMS Admin Northa") solo acepta entrar con un código enviado por correo ✔︎. El dominio `northa.digital` no existe en DNS ✔︎, así que un código enviado a `admin-<slug>@northa.digital` nunca llega.
3. **La prueba "noticia en menos de 1 min" puede requerir el push de `cmsmunicipal`.** El portal solo refleja al instante lo publicado si el backend llama a `POST <portal>/api/revalidate` ✔︎. Si el backend saca la URL del portal de `flota.config.json`, la entrada nueva no existe en Render hasta que hagas merge a `main` (sin verificar en código).

---

## 1. PRE-ALTA

| ✔ | Paso | Quién | Cómo verificarlo |
|---|---|---|---|
| [ ] | Crear `_material-ayuntamientos/<slug>/` con `README.md` (formato Bacadéhuachi), `datos.md`, `CREDITS.md`, `escudo/` (PNG en alta resolución y verificado), `lib/municipalConfig.js`, `fotos/` y `documentos/` (vacías) | C | `ls -R _material-ayuntamientos/<slug>` |
| [ ] | Crear el repo del portal `~/Developer/<Municipio>/` → `NorthaDigital/<slug>` copiando **Carbó** (el molde más reciente y limpio de la generación A) | C | `git log -1` en el repo nuevo |
| [ ] | Personalizar `lib/municipalConfig.js`: nombre, `nombreCompleto: "H. Ayuntamiento de <Nombre>, Sonora"` (en Rayón y Soyopa falta ", Sonora"), `fundacion.anio` y `fundacion.texto`, superficie y población, coordenadas, colindancias, `servicios.siteUrl` y enlace de transparencia estatal | C | `barrido-portal.mjs` (§5) |
| [ ] | **Textos de respaldo del servidor** (hero `bienvenida` y `gobierno`, estadísticas `default-*`): reescribirlos para el municipio. Estos textos **no viajan al JS del cliente**, así que el barrido en vivo solo los ve si se renderizan. Hay que revisarlos en el código | C | `grep -rn -i -E "1639|r[ií]o sonora|bavi[aá]cora|sahuaripa|carb[oó]" app lib components` en el repo del portal debe dar 0 |
| [ ] | Confirmar que el respaldo sobrevive a listas vacías ([P-2](#p-2-el-respaldo-debe-sobrevivir-a-listas-vacías)) | C | Revisión de código |
| [ ] | Verificar el escudo **a ojo** contra la fuente oficial (INAFED o Wikimedia Commons) | U + C | Captura lado a lado |
| [ ] | Subir el escudo a Cloudinary en `cms-municipal/<slug>/identidad/escudo-<slug>.png` (la ruta que usan los 14 ✔︎) | U | `curl -sI https://res.cloudinary.com/dtpxt4a2p/image/upload/cms-municipal/<slug>/identidad/escudo-<slug>.png` debe dar 200 `image/png` |
| [ ] | Quitar el favicon, `CREDITS.md` y los comentarios que vengan del molde (Sahuaripa, Carbó) | C | `barrido-portal.mjs` y grep en el repo |
| [ ] | Variables de entorno en Vercel: clave de **Web3Forms** (sin ella el formulario de contacto queda desactivado ✔︎ en Villa Pesqueira) y secreto de **revalidación** (el mismo que usa el backend) | U | `/contacto` muestra el formulario; la prueba de punta a punta tarda menos de 1 min |
| [ ] | Desplegar en Vercel sin dominio (`<slug>.vercel.app`) y comprobar las 12 rutas internas | U + C | §5, rutas |
| [ ] | Generar el contrato `cmsmunicipal/scripts/herramienta-alta/contratos/<slug>.json` a partir de la plantilla (§6) | C | JSON válido; `nombre` = `"H. Ayuntamiento de <Nombre>"` (13 de 14 ✔︎) |
| [ ] | Generar el script de BD `contratos/db-alta-<slug>.js` a partir de la plantilla | C | `node --check` |
| [ ] | Agregar el municipio a `flota.config.json` (sin dominio propio todavía) | C | (sin verificar en código) |
| [ ] | Agregar el slug a `SLUGS_FLOTA` en `alta-municipio.js` | C | (sin verificar en código) |
| [ ] | Crear `scripts/lotes-db/operador-<slug>.json` a partir de la plantilla, **sin contraseña** | C | `grep -i password` debe dar 0 |
| [ ] | Commits en una rama `feat/alta-<slug>`, **sin push** | C | `git log --oneline origin/main..feat/alta-<slug>` |
| [ ] | **Decidir el correo real** que va en Zero Trust y agregarlo a la política de "CMS Admin Northa" | U | Entrar con ese correo a `admin.northadigital.com` desde una ventana privada |
| [ ] | Guardar la línea base del portal antes del alta (texto por ruta y capturas) | C | Carpeta `_reportes/<slug>-baseline-pre-alta/` |

## 2. ALTA EN BASE DE DATOS

| ✔ | Paso | Quién | Cómo verificarlo |
|---|---|---|---|
| [ ] | Verificación local, solo lectura: rama activa, archivos, `node --check`, JSON válido, sin restos de otros municipios, sin contraseña (bloque "Paso 0" del reporte de Villa Pesqueira; se reutiliza cambiando el slug) | U | Pegar la salida a Claude |
| [ ] | `git switch feat/alta-<slug>`, porque el script solo existe en esa rama | U | `git branch --show-current` |
| [ ] | Correr el alta (abajo) | U | Mensaje de COMMIT del script |
| [ ] | `verificar-alta.mjs <slug>` → código 0. Antes del alta devuelve 2 (`ALTA_PENDIENTE`) | C | §5 |
| [ ] | `aislamiento-publico.mjs --incluir <slug>` → código 0 | C | §5 |
| [ ] | Agregar el slug a `const TENANTS` de `suite-aislamiento.mjs` y correrla completa, **solo después** de que la API responda 200 | C | Salida de la suite |

```bash
cd ~/Developer/cmsmunicipal
git switch feat/alta-<slug>
export SESSION_URL="$(node --env-file=.env -e 'const u=new URL(process.env.DATABASE_URL);u.port="5432";u.searchParams.delete("pgbouncer");u.searchParams.delete("connection_limit");process.stdout.write(u.toString())')"
node -e 'const u=new URL(process.env.SESSION_URL); console.log("Destino:", u.hostname + ":" + u.port + u.pathname)'
node --env-file=.env scripts/herramienta-alta/contratos/db-alta-<slug>.js
```

## 3. CREAR ADMINISTRADOR

| ✔ | Paso | Quién | Cómo verificarlo |
|---|---|---|---|
| [ ] | `scripts/lotes-db/operador-<slug>.json` ya existe (lo crea la PRE-ALTA) | C | — |
| [ ] | `create-operator.js --dry-run` y después sin `--dry-run` (abajo) | U | Mensaje del script |
| [ ] | La política de Zero Trust incluye un correo **que recibe mensajes** | U | Login real |
| [ ] | Entrar al panel y cargar **en los primeros 5 minutos** el hero y las estadísticas, al menos población y superficie | U | `verificar-alta.mjs … --esperar-texto "Bienvenidos a <Nombre>"` |

```bash
cd ~/Developer/cmsmunicipal
echo -n "Contraseña admin: "; read -s OPERATOR_PASSWORD; echo; export OPERATOR_PASSWORD
node scripts/create-operator.js scripts/lotes-db/operador-<slug>.json --dry-run
node scripts/create-operator.js scripts/lotes-db/operador-<slug>.json
unset OPERATOR_PASSWORD
```

## 4. PRUEBAS

| ✔ | Paso | Quién | Cómo verificarlo |
|---|---|---|---|
| [ ] | Noticia de punta a punta: arrancar `medir-publicacion.mjs` **antes** de publicar, publicar con imagen propia y medir API, home, `/acciones-de-gobierno` y detalle | U + C | Código 0 (todo en 60 s o menos) |
| [ ] | La URL de las noticias es **`/acciones-de-gobierno`**, no `/noticias` (que da 404 ✔︎). **No abrir** el detalle antes de publicar: el 404 se queda en caché 15 min o más ✔︎ | — | — |
| [ ] | Borrar la noticia de prueba: primero Claude muestra qué se va a borrar, luego U confirma y la borra en el panel, y Claude verifica que la API responda 404 | U + C | `GET /api/municipios/<slug>/noticias/<slug-noticia>` debe dar 404 |
| [ ] | Sin hardcoding de otros municipios: `barrido-portal.mjs` (en vivo) más el grep del repo (PRE-ALTA) | C | Código 0, o menciones legítimas revisadas y permitidas con `--permitir` |
| [ ] | Sin correos ni teléfonos de otros municipios | C | Avisos de `barrido-portal.mjs` |
| [ ] | Consola de Chrome sin errores en las 12 rutas, en escritorio y en móvil | C | Playwright. Hay que precargar `localStorage.gob_terms_accepted_v1`, porque si no, el modal de Términos tapa la página |
| [ ] | Menú hamburguesa en 390×844: abre, muestra los enlaces, navega y cierra con la X y con Escape | C | Captura |
| [ ] | `/contacto` muestra el formulario, no el aviso "estará disponible en breve" | C | HTML de `/contacto` |

## 5. POST-ALTA

| ✔ | Paso | Quién | Cómo verificarlo |
|---|---|---|---|
| [ ] | **Decidir el push de `cmsmunicipal`**: el merge a `main` redespliega Render | U | Render en verde; `GET /` de la API responde `status: ok` |
| [ ] | Si la revalidación depende de `flota.config.json`, este push va **antes** de la prueba de punta a punta | U | — |
| [ ] | **Dominio propio:** DNS (A y CNAME), `alta-municipio.js` para conectar el dominio, actualizar `Municipio.dominio`, y `siteUrl`, canonical y sitemap del portal (hoy apuntan a `*.vercel.app` ✔︎) | U | `verificar-alta.mjs` y `barrido-portal.mjs` con `--portal https://<dominio>` |
| [ ] | Redirigir `<slug>.vercel.app` y la variante `www` al dominio propio. Solo Baviácora lo tiene bien hoy ✔︎: 6 `*.vercel.app` y 7 variantes `www` responden 200 sin redirigir | U | `curl -sI https://<slug>.vercel.app` debe dar 307 o 308 |
| [ ] | Agregar el municipio a `northa-landing`, **solo con dominio propio y tu OK** | C, con OK de U | — |

---

## 6. Plantillas reutilizables

No se escribieron a mano. Se **derivan de los archivos reales ya validados** de Villa Pesqueira, para que tengan exactamente el mismo formato que funciona en producción:

```bash
cd ~/Developer/cmsmunicipal
node scripts/herramienta-alta/derivar-plantillas.mjs --slug villapesqueira --nombre "Villa Pesqueira" \
  --material ../_material-ayuntamientos/villapesqueira/README.md --extra "Mátape,San José,1629"
# → scripts/herramienta-alta/plantillas/{plantilla-contrato.json, plantilla-db-alta.js, plantilla-operador.json, plantilla-README-material.md, LEEME.md}
```

- **Sustituye:** las variantes del nombre y del slug por `{{NOMBRE}}`, `{{SLUG}}`, `{{NOMBRE_MAYUS}}`, etc. Cada UUID pasa a ser `{{UUID_n}}`, con el mismo número en todos los archivos, porque el operador puede referenciar el `municipioId`.
- **No sustituye, solo reporta** en `LEEME.md` para revisión manual: fechas, años, cifras (población, superficie), correos, teléfonos, coordenadas, versiones de Cloudinary y los términos de `--extra`.
- **Alerta** si encuentra una clave tipo `password` con valor.
- **Nunca** modifica las entradas y **nunca** sobrescribe salidas sin `--forzar`.

Para usar una plantilla: se copia, se reemplaza cada `{{…}}` (genera un UUID nuevo con `node -e 'console.log(crypto.randomUUID())'`) y se comprueba con `grep -n '{{' <archivo>` que no quede ningún marcador.

Script de origen: `para-cmsmunicipal/scripts/herramienta-alta/derivar-plantillas.mjs`, con sus pruebas `node --test …/derivar-plantillas.test.mjs`. Se probó con datos sintéticos, **todavía no con los archivos reales**. Revisa el `LEEME.md` generado la primera vez.

---

## 7. Scripts de verificación (solo lectura, sin dependencias, Node 18 o superior)

Van en `cmsmunicipal/scripts/verificacion/`. Todos aceptan `--json` y `--ayuda`.

| Script | Para qué | Códigos de salida |
|---|---|---|
| `verificar-alta.mjs <slug> [--nombre] [--portal] [--esperar-texto …]` | Revisa la fila `Municipio`, las 8 subrutas, el `municipioId`, el escudo, el portal y los textos esperados | 0 OK, 1 falla, **2 alta pendiente**, 3 error de red |
| `aislamiento-publico.mjs [--incluir <slug>]` | Fugas entre municipios en la API **pública**: `municipioId` cruzados, ids repetidos y detalle de un municipio pedido bajo otro. **Complementa**, no reemplaza, `suite-aislamiento.mjs` | 0 sin fugas, 1 fuga, 3 error |
| `medir-publicacion.mjs --slug --portal --titulo` | Tiempo que tarda una noticia en llegar a la API, al home, a `/acciones-de-gobierno` y al detalle, sin tocar el detalle antes de tiempo | 0 en 60 s o menos, 1 lento, 2 no apareció, 3 error |
| `barrido-portal.mjs --portal --slug [--nombre]` | Restos de otros municipios en el HTML y el JS en vivo; correos, teléfonos y Cloudinary con otro slug | 0 limpio, 1 restos, 3 error |

Esperar a que termine el alta sin sondear a mano:

```bash
until node scripts/verificacion/verificar-alta.mjs <slug>; do [ $? -eq 2 ] || break; sleep 10; done
```

---

## 8. Automatización

| Estado | Qué | Notas |
|---|---|---|
| ✅ Hecho | Verificación post-alta, aislamiento público, medición de publicación y barrido de restos | Los 4 scripts de §7 |
| ✅ Hecho | Derivar plantillas a partir de un alta real | `derivar-plantillas.mjs` |
| ⏳ Pendiente | **Instanciar** las plantillas: `nuevo-municipio.mjs --slug --nombre` que genere contrato, script de BD y operador; falle si queda algún `{{…}}`; y nunca sobrescriba | Siguiente paso natural, después de validar las plantillas derivadas con Villa Pesqueira |
| ⏳ Pendiente | Crear toda la estructura `_material-ayuntamientos/<slug>/` de una vez | Trivial una vez fijado el formato Bacadéhuachi |
| ⏳ Pendiente | Validación automática del escudo: hash perceptual contra la imagen de Wikimedia Commons o INAFED | Villa Pesqueira cita `File:Escudo_de_Villa_Pesqueira_Sonora.png` en sus créditos |
| ⏳ Pendiente | CI después del alta: `verificar-alta` + `aislamiento-publico` + `suite-aislamiento` + `barrido-portal` | GitHub Actions en `cmsmunicipal`, con disparo manual por slug |
| ⏳ Pendiente | Prueba en el molde que falle si el respaldo de un municipio contiene el nombre, el año o la región de otro | Evita que se repita el caso de Baviácora (ver PROBLEMAS_FLOTA_CONOCIDOS.md) |
| ⏳ Pendiente | En `alta-municipio.js`: resolver rutas respecto al script y no al `cwd`, ignorar comentarios en el filtro de "sahuaripa", y generar el favicon desde el escudo | Ver PROBLEMAS_FLOTA_CONOCIDOS.md, P-5 a P-7 |

---

## P-2. El respaldo debe sobrevivir a listas vacías

Los componentes del cliente `HeroCarousel` y `Estadisticas` devuelven `null` cuando reciben una lista vacía ✔︎ (se comprobó en el bundle de Villa Pesqueira). El servidor del portal tiene que elegir el respaldo **cuando la lista está vacía**, no solo cuando la petición falla:

```js
// ✅ conserva el respaldo con [] (municipio recién dado de alta, o admin que borró todo)
const slides = heroApi?.length ? heroApi.map(aSlide) : SLIDES_RESPALDO
// ⚠️ con [] el hero desaparece
const slides = heroApi ?? SLIDES_RESPALDO
```
