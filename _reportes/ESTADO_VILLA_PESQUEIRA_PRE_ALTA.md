# Villa Pesqueira: estado previo al alta

- **Fecha de verificación:** 30 de septiembre de 2026, entre las 21:00 y las 22:10 UTC (14:00 a 15:10 hora de Sonora).
- **Método:** solo lectura. Únicamente se hicieron peticiones GET, HEAD y OPTIONS contra el portal, la API pública y los portales de la flota. No se escribió nada en la base de datos, en Vercel, en Cloudflare ni en ningún repositorio de municipio.
- **Fase:** 0 (verificación previa al alta). La Fase 1 (alta en la base de datos) espera tu confirmación.

---

## 0. Resumen

| # | Punto | Estado | Evidencia |
|---|---|---|---|
| 1 | Portal en vivo | ✅ 12 de 12 rutas internas en 200 | [§2.1](#21-portal-httpsvillapesqueiravercelapp) |
| 2 | Hero corregido | ✅ | Se lee "Antigua misión de San José de Mátape, fundada en 1629." |
| 3 | Restos de otros municipios en el portal | ✅ ninguno | Barrido de 14 HTML, 29 chunks JS, CSS, sitemap y robots |
| 4 | Metadatos (title, canonical, og, JSON-LD, sitemap, robots, iconos) | ✅ todos apuntan a Villa Pesqueira | §2.1 |
| 5 | Menú móvil (hamburguesa) | ✅ abre, navega y cierra | [captura](villapesqueira-baseline-pre-alta/capturas/movil-menu-abierto.png) |
| 6 | Consola de Chrome | ✅ sin `pageerror` | Solo avisos menores y errores del widget de clima (open-meteo), probablemente causados por el propio entorno de pruebas |
| 7 | Escudo en Cloudinary | ✅ 200 `image/png` | `cms-municipal/villapesqueira/identidad/escudo-villapesqueira.png` |
| 8 | API | ⏳ 404 `Municipio 'villapesqueira' no encontrado` | Es lo esperado antes del alta |
| 9 | Archivos y commits en `cmsmunicipal` | ❓ no se pueden verificar desde aquí | [§1](#1-alcance-qué-sí-y-qué-no-pude-verificar). Hay que correr el Paso 0 en tu máquina |
| 10 | Acceso del admin por Zero Trust | ⛔ **bloqueado** | [H1](#h1--bloqueo-el-correo-del-admin-no-puede-recibir-el-código-de-zero-trust): el dominio `northa.digital` no existe en DNS |
| 11 | Hero y estadísticas después del alta | ❌ **confirmado: el hero desaparece** ([§0-bis](#0-bis-actualización-alta-ejecutada-1-de-octubre-de-2026-1531-utc)) | [H2](#h2--alto-el-hero-y-las-estadísticas-pueden-desaparecer-del-home-después-del-alta) |
| 12 | Prueba "noticia visible en menos de 1 min" | ⚠️ depende de la revalidación bajo demanda | [H3](#h3--alto-la-prueba-de-menos-de-1-min-depende-de-la-revalidación-bajo-demanda) |
| 13 | URL de la prueba de punta a punta | ⚠️ `/noticias` da 404 | La ruta real es `/acciones-de-gobierno` ([H4](#h4--medio-la-url-de-la-prueba-es-incorrecta-y-un-404-temprano-queda-en-caché)) |

---

## 0-bis. Actualización: alta ejecutada (1 de octubre de 2026, 15:31 UTC)

El alta se corrió y quedó bien. Lo que se verificó después, en vivo:

| Comprobación | Resultado |
|---|---|
| `verificar-alta.mjs villapesqueira …` | **20 OK · 3 AVISO · 0 FALLA** (código 0). Los avisos son esperados: sin dominio propio, y hero y estadísticas vacíos |
| Fila creada | id `86fbe8fd-6e3f-4aa6-b378-f22ea1f785f6`, `nombre` "H. Ayuntamiento de Villa Pesqueira", `activo` true, `dominio` null, `creadoEn` 2026-10-01T15:31:39Z |
| Escudo | 200 `image/png` (62 KB) |
| `aislamiento-publico.mjs --incluir villapesqueira` | **15 de 15 municipios revisados, 0 fugas**, 283 peticiones. Villa Pesqueira: detalle propio 6/6 con 200 y cruzado 6/6 con 404 |
| Las 8 subrutas de la API | Todas 200 `[]` |
| **Home después de regenerarse** | ❌ **El hero desapareció** (riesgo H2 confirmado). Las estadísticas conservaron el respaldo |

**Evidencia del hero (H2):** el home regenerado a las 15:31:53 UTC ya no tiene `"slides"` en su payload; donde estaba el carrusel hay un `null`. El texto "Bienvenidos a Villa Pesqueira" y "Mátape" ya no aparecen en el HTML. Las estadísticas siguen siendo las `default-*` (1,043, 1124.3 km², "Por designar"). Conclusión: el servidor del portal usa el respaldo cuando la API falla o da 404, pero con `200 []` pasa la lista vacía al hero y este no se dibuja. **Solución inmediata:** cargar el hero en el panel (ver [CONTENIDO_INICIAL_VILLAPESQUEIRA.md](CONTENIDO_INICIAL_VILLAPESQUEIRA.md)). **Solución de fondo:** corregir la condición en el servidor del portal (P-2 de PROBLEMAS_FLOTA_CONOCIDOS.md).

---

## 1. Alcance: qué sí y qué no pude verificar

Esta sesión solo tiene acceso al repositorio `r0b3rt0g1l/Northa-Digital`. No se pudieron adjuntar `NorthaDigital/cmsmunicipal`, `NorthaDigital/villapesqueira` ni `NorthaDigital/carbo` (acceso denegado). Por eso:

- **Sí verifiqué** todo lo que es público: el portal, la API, Cloudinary, DNS, la página de acceso de Cloudflare y los 14 portales de la flota.
- **No pude verificar** el contenido de `db-alta-villapesqueira.js`, `villapesqueira.json`, `operador-villapesqueira.json`, `suite-aislamiento.mjs`, `create-operator.js`, `alta-municipio.js` y `flota.config.json`, ni los commits de la rama. Tampoco el código de servidor del portal. Lo que se dice sobre ellos en este reporte viene de tu descripción o es una inferencia marcada como tal.
- Para darme acceso: conecta GitHub en <https://claude.ai/connect-github> e instala la app de Claude en la organización `NorthaDigital`. Después se agrega `cmsmunicipal` a la sesión, o se abre una sesión nueva con el repositorio seleccionado.

---

## 2. Verificado en vivo

### 2.1 Portal: https://villapesqueira.vercel.app

Despliegue `dpl_6aABiDfhevUuqE5YxAJQNpHRxgY4`. Según el `lastmod` del sitemap, el build se hizo el 2026-09-30 a las 17:58:37Z. El portal usa Next.js con turbopack, y los datos se resuelven en el servidor (RSC con ISR). El navegador nunca llama a `api.northadigital.com`.

| Ruta | HTTP | Caché observada |
|---|---|---|
| `/` | 200 | ISR de unos 300 s (HIT con age 295, luego STALE con age 316, luego age 20) |
| `/gobierno` | 200 | ISR de más de 17 min, o estática |
| `/gobierno/directorio` | 200 | ISR de más de 17 min, o estática |
| `/gobierno/cabildo` | 200 | ISR de más de 26 min, o estática |
| `/gobierno/plan-municipal` | 200 | ISR de más de 17 min, o estática |
| `/acciones-de-gobierno` | 200 | ISR de unos 300 s |
| `/transparencia` | 200 | ISR de más de 17 min, o estática |
| `/transparencia/sevac` | 200 | **Dinámica** (`no-store`): refleja la API al momento |
| `/turismo` | 200 | ISR de más de 17 min, o estática |
| `/galeria` | 200 | No está en el sitemap |
| `/contacto` | 200 | Dinámica |
| `/creditos` | 200 | No está en el sitemap |
| `/noticias` | **404** | Esa ruta no existe en el molde (ver H4) |
| `/sitemap.xml`, `/robots.txt` | 200 | El host es `villapesqueira.vercel.app` |
| `/opengraph-image`, `/icon.png`, `/apple-icon.png` | 200 | Todas con el escudo de Villa Pesqueira |
| `OPTIONS /api/revalidate` | 204 | `allow: OPTIONS, POST`. Existe revalidación bajo demanda |

Otras comprobaciones:
- **Contenido de respaldo que sirve hoy el servidor:**
  - Hero "Bienvenidos a Villa Pesqueira / Antigua misión de San José de Mátape, fundada en 1629."
  - Estadísticas: `default-poblacion` 1,043 y `default-superficie` 1124.3 km²; las otras cuatro dicen "Por designar".
  - Noticias: estado vacío, "Próximamente publicaremos…".
- **Barrido de restos de otros municipios:** 0 coincidencias. Se buscaron los 14 de la flota más Arivechi, Moctezuma, Huásabas y otros de Sonora, además de "1639", "misión jesuita" y "Río Sonora". El único "Hermosillo" que aparece es la zona horaria `America/Hermosillo` del widget de clima, y es correcto.
- **Correos y teléfonos:** no hay ninguno de otros municipios. El único correo es el ejemplo `tu@correo.com` del formulario.
- **Móvil (390×844, iPhone):**
  - El botón "Abrir menú de navegación" abre un diálogo con Inicio, Gobierno (Directorio, Cabildo, Plan Municipal), Transparencia (externo), SEvAC, Acciones de Gobierno, Turismo y Contacto.
  - El diálogo se cierra con la X y con Escape.
  - No hay scroll horizontal.
  - En la primera visita aparece el modal de **Términos y Condiciones**, que tapa la página. Así funciona el molde; para pruebas automáticas se puede precargar `localStorage.gob_terms_accepted_v1`.
- **Línea base para comparar después del alta:**
  - El texto visible de las 14 rutas está en [`villapesqueira-baseline-pre-alta/texto/`](villapesqueira-baseline-pre-alta/texto/).
  - Las capturas del home (escritorio y móvil) y del menú móvil están en [`villapesqueira-baseline-pre-alta/capturas/`](villapesqueira-baseline-pre-alta/capturas/).

### 2.2 API: https://api.northadigital.com

| Petición | Resultado |
|---|---|
| `GET /` | 200 `{"name":"CMS Municipal API","version":"1.0.0","status":"ok"}` |
| `GET /api/municipios` | 200, 14 municipios, **villapesqueira no aparece** |
| `GET /api/municipios/villapesqueira` | 404 `{"error":"Municipio no encontrado"}` |
| `GET /api/municipios/villapesqueira/{hero,noticias,…}` | 404 `{"error":"Municipio 'villapesqueira' no encontrado"}` |
| `GET /api/municipios/carbo/hero` (control) | 200 |

- **Subrutas públicas de cada municipio** (confirmadas con carbo, sanjavier y bacadehuachi después de probar unos 230 nombres): `hero`, `noticias`, `sevac`, `estadisticas`, `documentos`, `funcionarios`, `atractivos`, `imagenes`. Todas devuelven un array.
- **Rutas de detalle:** `noticias/:slug`, `atractivos/:slug` y `funcionarios/:id`.
- **Forma de la fila `Municipio`** (así la devuelve la API): `id, nombre, slug, estado, escudoUrl, dominio, portadaHistoriaUrl, portadaHistoriaPublicId, activo, creadoEn, actualizadoEn`.
  - 13 de 14 usan `nombre = "H. Ayuntamiento de X"`. Aconchi es la excepción: `"Municipio de Aconchi"`.
  - Los 14 tienen `dominio`. **Villa Pesqueira será el primer municipio con `dominio = null`.**
- **Aislamiento en la superficie pública:** es correcto. Pedir una noticia, un atractivo o un funcionario de carbo bajo la ruta de sanjavier (y al revés) siempre da 404. Todos los `municipioId` de cada lista coinciden con el id de su municipio.
- **Línea base de aislamiento antes del alta:** `aislamiento-publico.mjs --incluir villapesqueira --muestras 2` sobre los 14 municipios.
  - Resultado: **0 fugas, 0 errores**, 276 peticiones GET en 38.9 s, código 0. Villa Pesqueira se omitió con un aviso porque todavía no existe.
  - Hubo una coincidencia legítima: Carbó y Baviácora tienen cada uno su propia noticia con el slug `consejo-municipal-de-participacion-escolar`, con ids distintos.
  - Después del alta se repite el mismo comando, que debe seguir dando 0.
- **`verificar-alta.mjs`, control con Carbó:** 22 OK, 0 avisos, 0 fallas, código 0. Con Villa Pesqueira devuelve código 2 (`ALTA_PENDIENTE`), que es lo esperado.
- **`barrido-portal.mjs` sobre el portal de Villa Pesqueira:** revisó 12 rutas, 28 chunks JS, 2 CSS, sitemap y robots con 62 términos. Sin restos, código 0.
- **CORS:** la API no concede `Access-Control-Allow-Origin` a ningún origen, ni siquiera a los dominios propios. No afecta a Villa Pesqueira por dos razones: el portal renderiza en el servidor, y el formulario de contacto envía a `api.web3forms.com`, no a la API.

### 2.3 Cloudinary, Cloudflare y DNS

| Comprobación | Resultado |
|---|---|
| `res.cloudinary.com/dtpxt4a2p/image/upload/cms-municipal/villapesqueira/identidad/escudo-villapesqueira.png` | 200 `image/png`. La ruta sigue el mismo patrón que los otros 14 |
| `admin.northadigital.com` | 302 hacia Cloudflare Access (`holy-meadow-6229.cloudflareaccess.com`), app "**CMS Admin Northa**" |
| Métodos de acceso en esa app | **Solo** correo con código ("Send login code"). No hay Google ni otro proveedor de identidad |
| DNS de `northa.digital` (NS, A, MX y TXT, consultado en Cloudflare DNS y en Google DNS) | **NXDOMAIN**: el dominio no está delegado. La respuesta autoritativa viene del TLD `.digital` |
| DNS de `northadigital.com` | Existe (NS en Cloudflare), pero **no tiene registros MX** |

---

## 3. Archivos y commits (según tu reporte; falta confirmarlos)

| Elemento | Ruta en `cmsmunicipal` | Estado |
|---|---|---|
| Contrato | `scripts/herramienta-alta/contratos/villapesqueira.json` | Pendiente de confirmar (Paso 0) |
| Script de BD | `scripts/herramienta-alta/contratos/db-alta-villapesqueira.js` | Pendiente de confirmar (Paso 0) |
| Operador | `scripts/lotes-db/operador-villapesqueira.json` | Pendiente de confirmar (Paso 0) |
| Commit | `be363f4` feat(alta): Villa Pesqueira — contrato, script de DB y registro en la flota | En `feat/alta-villapesqueira`, sin push |
| Commit | `4653533` chore(lotes-db): operador-villapesqueira.json | En `feat/alta-villapesqueira`, sin push |
| README de material | `_material-ayuntamientos/villapesqueira/README.md` | Pendiente de confirmar |

> Importante: `db-alta-villapesqueira.js` **solo existe en la rama `feat/alta-villapesqueira`**. Tiene que estar activa al correr el alta. Para correrlo no hace falta push ni merge.

---

## 4. Hallazgos que afectan el alta (por prioridad)

### H1 · BLOQUEO: el correo del admin no puede recibir el código de Zero Trust

- **Evidencia:** la app "CMS Admin Northa" de Cloudflare Access solo permite entrar con un código enviado por correo. El dominio `northa.digital` da NXDOMAIN en dos resolvedores, y `northadigital.com` no tiene MX.
- **Consecuencia:** aunque `admin-villapesqueira@northa.digital` se agregue a la política de Access, el código nunca llega y nadie puede entrar al panel con ese correo.
- **Qué hay que decidir** (tú):
  - **(a)** En la política de Access se agrega el **correo real** de quien va a operar Villa Pesqueira, y `admin-villapesqueira@northa.digital` queda solo como usuario interno del CMS.
  - **(b)** Se activa el dominio `northa.digital` (delegación DNS más Cloudflare Email Routing hacia un buzón real) para que los `admin-*@northa.digital` reciban correo.
- **Pregunta:** ¿cómo entran hoy los admins de los otros 14 municipios? Si usan el mismo patrón `admin-<slug>@northa.digital`, lo más probable es que Access tenga registrados sus correos reales, y entonces la opción (a) es la que ya usas.

### H2 · ALTO: el hero y las estadísticas pueden desaparecer del home después del alta

- **Evidencia:**
  - Hoy la API responde 404 y el servidor del portal arma un respaldo (slides `bienvenida` y `gobierno`, estadísticas `default-*`).
  - Después del alta la API responderá **200 con `[]`**.
  - En el cliente, `HeroCarousel` y `Estadisticas` hacen `if(!e||0===e.length)return null;` (chunk `35qky3qgyj8j8.js`). Con una lista vacía, **no se muestra nada**.
  - Que el respaldo se conserve depende de la condición en el código de servidor, y ese código no es visible desde fuera: `lista?.length ? lista : respaldo` lo conserva; `lista ?? respaldo`, o un respaldo que solo se usa si la petición falla, lo pierde.
  - Ninguno de los 14 municipios tiene hero o estadísticas vacíos, así que no hay con qué comparar.
- **Qué hacer:** antes del Paso 1, revisa la condición en el repositorio del portal. El comando está en el Paso 0-bis. Si no la conserva, hay dos caminos:
  - **(a)** Justo después del alta, cargar el hero y las estadísticas en el panel. Hay unos 5 minutos antes de que el home se regenere (ISR). Esto requiere resolver antes H1. El contenido exacto, listo para copiar, está en [CONTENIDO_INICIAL_VILLAPESQUEIRA.md](CONTENIDO_INICIAL_VILLAPESQUEIRA.md).
  - **(b)** Corregir la condición en el portal. Es un cambio en el repositorio de Villa Pesqueira y necesita tu OK.

### H3 · ALTO: la prueba de menos de 1 min depende de la revalidación bajo demanda

- **Evidencia:**
  - `/` y `/acciones-de-gobierno` se regeneran por ISR cada unos 300 s, y además hace falta una visita que dispare la regeneración.
  - El portal tiene `POST /api/revalidate`.
  - Para ver una noticia en menos de 1 minuto, el backend tiene que llamar a ese endpoint al publicar, con el secreto correcto.
- **Inferencia (sin verificar):** el backend necesita saber la URL del portal para llamar a `/api/revalidate`. Si la saca de `flota.config.json`, la entrada de Villa Pesqueira está en el commit `be363f4`, que **no está en `main`** y por tanto no está desplegado en Render. En ese caso, la prueba de punta a punta tardará al menos 300 s hasta que hagas push y merge. Si la saca de `Municipio.dominio`, con `dominio = null` **nunca** revalidará.
- **Cómo confirmarlo** (Paso 0, comandos de `revalidat` y `flota.config`): si resulta que depende del push, la decisión de la Fase 4.2 (push y merge) va **antes** de la Fase 3.

### H4 · MEDIO: la URL de la prueba es incorrecta y un 404 temprano queda en caché

- `https://villapesqueira.vercel.app/noticias` da **404**. Las noticias salen en el home (sección "Acciones de Gobierno") y en `/acciones-de-gobierno`. El detalle está en `/acciones-de-gobierno/noticias/<slug>`.
- Un 404 del detalle queda en caché de Vercel **al menos 15 minutos**: se observó un HIT con age de 904 s. Por eso no hay que abrir la URL de la noticia antes de publicarla. El script `medir-publicacion.mjs` ya lo respeta.
- Sube una imagen propia a la noticia de prueba. Si la noticia no tiene imagen, el molde muestra una foto aleatoria de `loremflickr.com`.

### H5 · MEDIO: la convención del nombre en la base de datos

13 de los 14 municipios usan `"H. Ayuntamiento de <Nombre>"`. Confirma en el Paso 0 que el contrato use `"H. Ayuntamiento de Villa Pesqueira"`, salvo que quieras otra cosa a propósito.

### H6 · MEDIO: el formulario de contacto está desactivado

La página `/contacto` recibe `accessKey: undefined` (falta la clave de Web3Forms en Vercel) y muestra "El formulario de contacto estará disponible en breve". Sin embargo, el pie de página invita a "Escríbenos por el formulario". Hay que configurar la variable de entorno en Vercel o ajustar el texto. No bloquea el alta.

### H7 · BAJO: detalles del portal (no bloquean)

- Las subpáginas no tienen `og:image`, y el sitemap omite `/galeria` y `/creditos`.
- La página 404 hereda el canonical del home.
- Queda contenido de relleno visible:
  - La imagen del hero es lisa y su `alt` dice "(placeholder)".
  - El `alt` de Historia menciona la "Sierra Madre Occidental", un texto genérico del molde que está en los 15 portales.
- El escudo se sirve en local a 150×196 px, en lugar del de Cloudinary.
- Los errores de open-meteo en consola (CORS y 429) aparecieron solo en el entorno de pruebas. Vale la pena confirmarlos en un navegador normal.

---

## 5. Comandos exactos (copiar y pegar)

### Paso 0: verificación local, solo lectura (tú, unos 30 s)

Pega la salida en el chat y la reviso.

```bash
cd ~/Developer/cmsmunicipal
git fetch origin --quiet
git branch --show-current
git status --short
git log --oneline origin/main..feat/alta-villapesqueira      # esperado: exactamente be363f4 y 4653533
ls -la scripts/herramienta-alta/contratos/villapesqueira.json \
       scripts/herramienta-alta/contratos/db-alta-villapesqueira.js \
       scripts/lotes-db/operador-villapesqueira.json
node --check scripts/herramienta-alta/contratos/db-alta-villapesqueira.js && echo "OK: db-alta sin errores de sintaxis"
node -e 'for (const f of process.argv.slice(1)) { JSON.parse(require("fs").readFileSync(f, "utf8")); console.log("OK: JSON válido", f) }' \
  scripts/herramienta-alta/contratos/villapesqueira.json scripts/lotes-db/operador-villapesqueira.json
grep -n -i -E '"(nombre|slug|estado|escudo[a-z]*|dominio|email|rol)"' \
  scripts/herramienta-alta/contratos/villapesqueira.json scripts/lotes-db/operador-villapesqueira.json
grep -n -i -E 'sahuaripa|carb[oó]\b|mazat[aá]n|cucurpe|bacanora|bacad[eé]huachi|bavi[aá]cora|1639|r[ií]o sonora' \
  scripts/herramienta-alta/contratos/villapesqueira.json \
  scripts/herramienta-alta/contratos/db-alta-villapesqueira.js \
  scripts/lotes-db/operador-villapesqueira.json || echo "OK: sin restos de otros municipios"
grep -n -i -E 'password|contrase' scripts/lotes-db/operador-villapesqueira.json || echo "OK: el operador no guarda contraseña"
# H3: ¿de dónde saca el backend la URL del portal para revalidar?
grep -rn -i 'revalidat' --include='*.js' --include='*.mjs' --include='*.ts' . | grep -v node_modules | head -20
grep -rn 'flota.config' --include='*.js' --include='*.mjs' --include='*.ts' . | grep -v node_modules | head -10
```

### Paso 0-bis: condición del respaldo en el portal (tú, unos 10 s; es H2)

Ajusta la ruta del repositorio del portal si es distinta.

```bash
cd ~/Developer/VillaPesqueira   # repositorio del portal (el que despliega villapesqueira.vercel.app)
# 1) dónde se DEFINE el respaldo
grep -rn -E "bienvenida|default-poblacion" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' app lib components 2>/dev/null
# 2) dónde se ELIGE entre la API y el respaldo
grep -rn -E "\?\?|\.length *(\?|>|===? *0)|catch" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' app lib 2>/dev/null \
  | grep -i -E "hero|slide|estad|respaldo|fallback|default"
```

Qué buscar en la salida:
- ✅ `lista?.length ? lista : respaldo` (o equivalente): con `[]` conserva el respaldo.
- ⚠️ `lista ?? respaldo`, o un respaldo que solo entra en el `catch`: con `[]` el hero o las estadísticas desaparecen.

### Paso 1: alta en la base de datos (tú, cuando confirmes)

```bash
cd ~/Developer/cmsmunicipal
git switch feat/alta-villapesqueira   # el script solo existe en esta rama; no hace falta push
export SESSION_URL="$(node --env-file=.env -e 'const u=new URL(process.env.DATABASE_URL);u.port="5432";u.searchParams.delete("pgbouncer");u.searchParams.delete("connection_limit");process.stdout.write(u.toString())')"
node -e 'const u=new URL(process.env.SESSION_URL); console.log("Destino:", u.hostname + ":" + u.port + u.pathname)'   # muestra host, puerto y BD; nunca la contraseña
node --env-file=.env scripts/herramienta-alta/contratos/db-alta-villapesqueira.js
```

Qué hace, según tu descripción: inserta la fila en `"Municipio"` (id, nombre, slug, estado, activo, escudoUrl y timestamps) dentro de una transacción, verifica que exista exactamente 1 fila y hace COMMIT. Si algo falla, revierte todo.

### Paso 1.2: verificación después del alta (la corro yo en cuanto me avises)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.northadigital.com/api/municipios/villapesqueira/hero      # esperado: 200 (hoy: 404)
curl -s https://api.northadigital.com/api/municipios/villapesqueira | python3 -m json.tool                      # la fila recién creada
for r in hero noticias sevac estadisticas documentos funcionarios atractivos imagenes; do
  printf "%-13s " "$r"; curl -s -w "  [%{http_code}]\n" "https://api.northadigital.com/api/municipios/villapesqueira/$r"
done                                                                                                           # esperado: []  [200] en las 8
node para-cmsmunicipal/scripts/verificacion/verificar-alta.mjs villapesqueira \
  --nombre "Villa Pesqueira" --portal https://villapesqueira.vercel.app \
  --esperar-texto "Bienvenidos a Villa Pesqueira" --esperar-texto "1,043"
node para-cmsmunicipal/scripts/verificacion/aislamiento-publico.mjs --incluir villapesqueira --muestras 2
```

Después, pasados unos 5 minutos y con una visita al home de por medio, repito `verificar-alta.mjs` y comparo el home con `villapesqueira-baseline-pre-alta/texto/inicio.txt` para detectar H2.

### Paso 2: cuenta de administrador (tú, después del Paso 1)

```bash
cd ~/Developer/cmsmunicipal
echo -n "Contraseña admin: "; read -s OPERATOR_PASSWORD; echo; export OPERATOR_PASSWORD
node scripts/create-operator.js scripts/lotes-db/operador-villapesqueira.json --dry-run
node scripts/create-operator.js scripts/lotes-db/operador-villapesqueira.json
unset OPERATOR_PASSWORD
```

- Necesita que el Paso 1 esté hecho, porque el operador se liga al municipio.
- La contraseña no se guarda en ningún archivo. `unset` la borra de la sesión de la terminal.
- Si el script se queja de que falta `DATABASE_URL`, usa `node --env-file=.env scripts/create-operator.js …`, como en el Paso 1.

### Paso 2.2: Zero Trust (tú; primero hay que decidir H1)

En Cloudflare: **Zero Trust → Access → Applications → "CMS Admin Northa" → Policies → la política Allow → Include → Emails**. Ahí agregas el correo **que realmente recibe mensajes** y guardas.

### Paso 3: prueba de punta a punta (los dos)

1. Acordamos un título único con la hora (por ejemplo "Prueba Villa Pesqueira 15:40"). El medidor exige el título **y** el enlace a esa noticia concreta, y con la hora se evitan choques con pruebas anteriores.
2. Yo arranco el medidor **antes** de que publiques:
   ```bash
   node para-cmsmunicipal/scripts/verificacion/medir-publicacion.mjs --slug villapesqueira \
     --portal https://villapesqueira.vercel.app --titulo "Prueba Villa Pesqueira 15:40" --limite 600
   ```
3. Tú publicas en el panel la noticia con ese título (cuerpo "Test") y una imagen propia.
4. El medidor registra cuándo aparece en la API, en el home, en `/acciones-de-gobierno` y en el detalle.
5. Limpieza: antes de borrar, te muestro el detalle exacto (`GET /api/municipios/villapesqueira/noticias/<slug>`). Tú la borras en el panel y yo confirmo que la API responde 404.

---

## 6. Qué esperar justo después del alta

| Momento | API | Portal |
|---|---|---|
| Al instante | 200 `[]` en las 8 subrutas | `/transparencia/sevac` (dinámica) sigue diciendo "Aún no hay documentos publicados" |
| Unos 300 s después, más una visita | Sin cambio | El home se regenera. Pueden pasar dos cosas: conserva el respaldo (bien) o pierde el hero y las estadísticas (H2) |
| Más de 17 a 26 min | Sin cambio | Se regeneran `/gobierno`, `/gobierno/*`, `/turismo`, `/galeria` y `/transparencia` (valor exacto sin determinar) |

---

## 7. Decisiones pendientes para ti

1. **H1:** qué correo real va en la política de Zero Trust.
2. **H2:** resultado del Paso 0-bis. Si la condición no conserva el respaldo, elegir entre cargar contenido justo después del alta o corregir el portal.
3. **H3:** si la revalidación depende de `flota.config.json`, el push y merge de `cmsmunicipal` (que redespliega Render) va **antes** de la prueba de punta a punta.
4. **H6:** clave de Web3Forms para el formulario de contacto.

## 8. Material de apoyo

- Línea base, antes del alta:
  - [`villapesqueira-baseline-pre-alta/texto/`](villapesqueira-baseline-pre-alta/texto/): texto visible de 14 rutas. Al comparar, ignora la fecha y la hora del encabezado, que son un reloj en vivo.
  - [`villapesqueira-baseline-pre-alta/capturas/`](villapesqueira-baseline-pre-alta/capturas/): home en escritorio y en móvil, y menú móvil abierto.
- Scripts de verificación: [`para-cmsmunicipal/scripts/verificacion/`](../para-cmsmunicipal/scripts/verificacion/).
- Plan de replicación: [`para-cmsmunicipal/docs/PLAN_REPLICACION_MUNICIPIOS.md`](../para-cmsmunicipal/docs/PLAN_REPLICACION_MUNICIPIOS.md).
- Problemas de la flota: [`para-cmsmunicipal/docs/PROBLEMAS_FLOTA_CONOCIDOS.md`](../para-cmsmunicipal/docs/PROBLEMAS_FLOTA_CONOCIDOS.md).
