# Problemas conocidos de la flota

> **Destino:** `cmsmunicipal/docs/PROBLEMAS_FLOTA_CONOCIDOS.md`.
>
> **Fuente:** una auditoría de solo lectura del 30 de septiembre de 2026 (unos 250 archivos de HTML y JS de los 14 portales, y unas 400 peticiones GET a la API), más los problemas que reportaste. **No se corrigió nada**: ningún municipio se modifica sin tu autorización.
>
> **Leyenda:** ✔︎ verificado en vivo · 🔎 inferido o sin verificar en código (esta sesión no tenía acceso a `cmsmunicipal` ni a los repos de los portales) · 📝 reportado por ti.

---

## Prioridades

| Nivel | Criterio | Problemas |
|---|---|---|
| **1. Crítico** | Rompe una función: acceso, publicación o herramienta de alta | [P-1](#p-1-el-correo-de-los-admins-no-puede-recibir-el-código-de-zero-trust) Zero Trust · [P-3](#p-3-la-revalidación-bajo-demanda-depende-de-configuración-que-puede-no-estar-desplegada) revalidación · [P-5](#p-5-alta-municipiojs-falla-en-cloudinary-si-no-se-corre-desde-la-raíz) / [P-6](#p-6-alta-municipiojs-se-detiene-por-un-comentario-sahuaripa-del-molde) herramienta de alta |
| **2. Importante** | El ciudadano ve un error, o se pierde contenido | [P-2](#p-2-hero-y-estadísticas-desaparecen-con-listas-vacías) listas vacías · [P-4](#p-4-hero-de-respaldo-con-texto-de-otro-municipio-el-caso-sahuaripa) respaldo ajeno · [P-8](#p-8-errores-de-contenido-visibles-hoy-en-el-hero-del-cms) textos del hero · [P-9](#p-9-despliegues-duplicados-y-viejos-accesibles-públicamente) duplicados · [P-10](#p-10-formulario-de-contacto-desactivado-en-villa-pesqueira) formulario |
| **3. Menor** | Cosmético, higiene o seguridad de bajo impacto | [P-7](#p-7-alta-municipiojs-sube-el-favicon-del-molde) favicon · [P-11](#p-11-api-datos-personales-cabeceras-y-paginación) API · [P-12](#p-12-convenciones-inconsistentes-en-la-bd) convenciones · [P-13](#p-13-restos-genéricos-del-molde) restos del molde · [P-14](#p-14-la-historia-y-la-línea-de-tiempo-viven-en-el-código-no-en-el-cms) historia y línea de tiempo en el código |

**Orden de corrección propuesto:**
1. P-1 y P-3, porque bloquean que Villa Pesqueira quede al 100%.
2. P-2, antes de la próxima alta.
3. P-8, visible hoy en Mazatán y Cucurpe; se corrige desde el panel, sin código.
4. P-5 y P-6, que hacen fallar la herramienta de alta.
5. P-4, revisar el código de 4 portales.
6. P-9 y P-10.
7. El resto.

---

## 1. Crítico

### P-1. El correo de los admins no puede recibir el código de Zero Trust
- ✔︎ `admin.northadigital.com` → Cloudflare Access, app "CMS Admin Northa". El **único** método de entrada es un código enviado por correo ("Send login code").
- ✔︎ `northa.digital` da **NXDOMAIN** (NS, A, MX y TXT, en Cloudflare DNS y en Google DNS). `northadigital.com` existe, pero **no tiene MX**.
- **Impacto:** agregar `admin-<slug>@northa.digital` a la política de Access no sirve para entrar, porque el código nunca llega.
- **Solución:** hay dos caminos.
  - **(a)** Registrar en Access el correo real de cada operador.
  - **(b)** Delegar `northa.digital` y activar Cloudflare Email Routing hacia un buzón real.
- **Pendiente:** confirmar cómo entran hoy los admins de los otros 14 municipios.

### P-3. La revalidación bajo demanda depende de configuración que puede no estar desplegada
- ✔︎ Los portales tienen `POST /api/revalidate` (probado en Villa Pesqueira y en Carbó: `OPTIONS` → 204 `allow: OPTIONS, POST`).
- ✔︎ Sin ese endpoint, `/` y `/acciones-de-gobierno` tardan unos 300 s (ISR), más una visita que dispare la regeneración. `/gobierno/*`, `/turismo`, `/galeria` y `/transparencia` tardan 17 a 26 minutos o más.
- 🔎 Si el backend saca la URL del portal de `flota.config.json`, un municipio nuevo no se revalida hasta que su entrada llegue a `main` y se redespliegue Render. Si la saca de `Municipio.dominio`, **Villa Pesqueira será el primer municipio con `dominio = null`**, y no se revalidaría nunca.
- **Solución:**
  - Documentar de dónde sale la URL, con `grep -rn -i revalidat` en `cmsmunicipal`.
  - Si usa el dominio, recurrir a `<slug>.vercel.app` cuando `dominio` sea `null`.
  - Registrar en un log cada llamada fallida a `/api/revalidate`.

### P-5. `alta-municipio.js` falla en Cloudinary si no se corre desde la raíz
- 📝 Reportado por ti; no se pudo ver el código.
- **Solución:** resolver las rutas respecto al script (`path.dirname(fileURLToPath(import.meta.url))` o `__dirname`), no respecto a `process.cwd()`. Como mínimo, comprobar al inicio que se está en la raíz y abortar con un mensaje claro.

### P-6. `alta-municipio.js` se detiene por un comentario "sahuaripa" del molde
- 📝 La guarda que busca restos de Sahuaripa cuenta también los comentarios.
- **Solución:** quitar el comentario del molde, o hacer que la guarda ignore los comentarios. Es mejor lo primero, porque es más simple y además limpia el molde. Complementar con `barrido-portal.mjs`, que revisa lo que realmente se sirve.

---

## 2. Importante

### P-2. Hero y estadísticas desaparecen con listas vacías
- ✔︎ En el cliente, `HeroCarousel` y `Estadisticas` hacen `if(!e||0===e.length)return null;` (bundle de Villa Pesqueira, chunk `35qky3qgyj8j8.js`).
- ✔︎ **Confirmado en vivo con Villa Pesqueira (1 de octubre de 2026):** tras el alta, la API pasó de 404 a `200 []` y el home regenerado **perdió el hero**: no hay `"slides"` en su payload y el carrusel quedó en `null`. Las estadísticas **sí** conservaron el respaldo (`default-*`). Es decir, el respaldo del hero solo se usa cuando la API falla, no cuando devuelve una lista vacía. Le pasará a cualquier municipio nuevo, y también a uno cuyo admin borre todos los slides.
- Efecto práctico: hasta que se cargue el hero en el panel, el home no muestra hero.
- **Solución:** usar `lista?.length ? lista : respaldo` en el servidor del molde. Detalle en PLAN_REPLICACION_MUNICIPIOS.md §P-2.

### P-4. Hero de respaldo con texto de otro municipio (el "caso Sahuaripa")
- 📝 Reporte original: Carbó, Mazatán, Cucurpe y Bacanora tendrían en su hero de respaldo "misión jesuita de 1639, en la región del Río Sonora", visible si el CMS tarda más de 8 s.
- ✔︎ **Corrección de atribución:** esa frase **es de Baviácora, no de Sahuaripa**. Es el subtítulo de Historia de Baviácora, escrito a mano en su componente (chunk `0j4qgopuj_ppq.js`: *"Pueblo de origen ópata y misión jesuita de 1639, en la región del Río Sonora."*). El texto de Sahuaripa es otro: *"Hormiga amarilla en lengua ópata… misión jesuita del siglo XVII"*, con fundación en 1641.
- ✔︎ En el HTML y el JS del cliente de Carbó, Mazatán, Cucurpe y Bacanora, **"1639" y "Río Sonora" aparecen 0 veces**. Los 14 homes muestran hoy el hero de la API, no el de respaldo.
- 🔎 El respaldo del hero se arma **solo en el servidor** y no viaja al cliente (en Villa Pesqueira, el texto de respaldo no está en ningún chunk). Por eso el reporte **no se puede confirmar ni descartar desde fuera**. Es consistente con que Villa Pesqueira, copiado del molde de Carbó, traía esa frase antes de corregirla.
- **Exposición:** el respaldo aparece si la API falla o tarda más de lo que permite el servidor, o si la lista está vacía (P-2). Ojo con el caché: si una regeneración ISR coincide con un arranque en frío de Render que supere el tiempo de espera, el respaldo queda en caché unos 300 s.
- **Verificación local** (tú, solo lectura):
  ```bash
  for r in Carbo Mazatan Cucurpe Bacanora; do echo "== $r"; grep -rn -i -E "1639|r[ií]o sonora|bavi[aá]cora|sahuaripa" ~/Developer/$r/app ~/Developer/$r/lib ~/Developer/$r/components 2>/dev/null; done
  ```
  (Ajusta los nombres de las carpetas si son distintos.)
- **Solución:** reescribir el respaldo de cada uno con su propia historia, que ya está en su `municipalConfig`. Además, agregar al molde la prueba automática de §8 del plan.
- Nota: conviven **dos generaciones del molde** ✔︎.
  - **A:** el subtítulo de Historia sale de `municipalConfig.historia.subtitulo`. Son Bacadéhuachi, Bacanora, Carbó, Cucurpe, Mazatán, Sahuaripa y San Javier.
  - **B:** el subtítulo está escrito a mano en el componente. Son Banámichi, Baviácora, Huachinera, Rayón, Soyopa y Aconchi.
  - Si alguno de la generación A se armó copiando archivos de uno de la B, eso explicaría cómo llegó la frase.

### P-8. Errores de contenido visibles hoy en el hero del CMS
Se corrigen desde el panel de cada municipio; no hace falta tocar código.
- ✔︎ **Mazatán:** el subtítulo dice *"Municipio costero… balnearios, manglares y esteros"*. Mazatán, Sonora está en el centro del estado (lat 29.00, colinda con Ures y Hermosillo); parece confundido con Mazatlán.
- ✔︎ **Cucurpe:** el subtítulo termina en `\r\n\r\nTexto del botón` (se quedó pegada la etiqueta del formulario, y se ve en el HTML). Además, el título *"cuna de la primera misión jesuita en Sonora"* contradice su propia historia (misión de 1647) y a otros municipios de la flota con misiones anteriores (Bacanora 1627; Banámichi, Baviácora y Aconchi 1639).
- ✔︎ **Carbó:** el hero dice *"iglesia colonial"*, pero su historia dice que se fundó en 1888 con el ferrocarril. Hay que revisarlo.
- ✔︎ Espacios sobrantes al inicio o al final, y `\r\n` en títulos y subtítulos de Bacanora, Mazatán, Cucurpe, Tepache, Banámichi y Baviácora.
- **Solución en la API:** aplicar `trim()` al guardar y rechazar subtítulos que contengan textos de etiqueta como "Texto del botón".

### P-9. Despliegues duplicados y viejos accesibles públicamente
- ✔︎ `*.vercel.app` que responden 200 **sin redirigir** al dominio propio:
  - Bacadéhuachi, Bacanora, Cucurpe, Mazatán, Sahuaripa y San Javier.
  - Solo `baviacora.vercel.app` hace 307 al dominio.
- ✔︎ Variante `www` que responde 200 sin redirigir en Bacadéhuachi, Bacanora, Carbó, Cucurpe, Mazatán, Sahuaripa y San Javier. El canonical sí apunta al dominio de la BD, lo que reduce el daño.
- ✔︎ Sitios viejos públicos:
  - `bacanora-gobierno`, `mazatan-gobierno` y `sahuaripa-gobierno` `.vercel.app`: sitios estáticos antiguos.
  - `sanjavier-gobierno.vercel.app`: el molde nuevo **mostrando el hero de respaldo, con canonical a sí mismo**, es decir, indexable.
  - `bacanora-v2.vercel.app`: canonical a `bacanora.gob.mx`.
- ✔︎ `carbo.vercel.app` **no es de Northa**: es un "Carbon Credit Marketplace". El proyecto de Carbó en Vercel tiene otro nombre.
- **Solución:**
  - Configurar en Vercel el dominio primario con redirección 308 (o 307, como Baviácora) para `www` y para `*.vercel.app`.
  - Borrar o proteger con Vercel Authentication los proyectos viejos.
  - Como mínimo, agregar `x-robots-tag: noindex`.

### P-10. Formulario de contacto desactivado en toda la flota
- ✔︎ `/contacto` recibe `accessKey: undefined` y muestra "El formulario de contacto estará disponible en breve". Mientras tanto, el pie de página invita a "Escríbenos por el formulario".
- ✔︎ **No es solo Villa Pesqueira:** `/contacto` muestra "estará disponible en breve" también en Carbó, Mazatán, Cucurpe, San Javier y Sahuaripa (revisado el 1 de octubre de 2026).
- **Solución:** configurar en Vercel, en cada proyecto, la variable de entorno con la clave de Web3Forms del municipio, y agregarla al checklist de PRE-ALTA.

---

## 3. Menor

### P-7. `alta-municipio.js` sube el favicon del molde
- 📝 **Solución:** no copiar el favicon; generarlo a partir del escudo después de copiar el molde.

### P-11. API: datos personales, cabeceras y paginación
- ✔︎ `/funcionarios` expone `email` y `telefono` sin autenticación (por ejemplo, en San Javier el presidente aparece con una cuenta de Gmail). **Confirmar con cada ayuntamiento** si deben ser públicos, o devolver solo un contacto institucional.
- ✔︎ Faltan `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy` y `Referrer-Policy`. Además, se expone `x-powered-by: Express`. **Solución:** `helmet` y `app.disable('x-powered-by')`.
- ✔︎ No se vio límite de peticiones por IP en unas 400 peticiones. **Solución:** `express-rate-limit`, sobre todo en `/api/auth/*`.
- ✔︎ `/noticias` ignora `limit`, `page` y los demás parámetros, y devuelve siempre todo (Carbó: 123 noticias, 51 KB en cada render). **Solución:** paginación real.

### P-12. Convenciones inconsistentes en la BD
- ✔︎ Aconchi usa `nombre = "Municipio de Aconchi"`, mientras los otros 13 usan "H. Ayuntamiento de X". Por eso Aconchi aparece al final de la lista ordenada.
- ✔︎ "Banamichi" está sin acento en la BD y en `municipalConfig`, pero el hero y la historia usan "Banámichi".
- ✔︎ `dominio`: 6 municipios lo tienen con `www` y 8 sin él.
- ✔︎ `portadaHistoriaUrl` es `null` en Bacadéhuachi y Sahuaripa.
- ✔︎ El `orden` del hero empieza en 0 en Huachinera, Rayón, Sahuaripa y Soyopa, y en 1 en los demás.
- ✔︎ En `municipalConfig`, a Rayón y Soyopa les falta ", Sonora" en `nombreCompleto`, y `fundacion.anio` es `null` en Cucurpe, Mazatán, Rayón y Soyopa.

### P-14. La historia y la línea de tiempo viven en el código, no en el CMS
- ✔︎ En Carbó, la línea de tiempo es una lista `{ano, titulo, descripcion}` escrita **dentro del componente de Historia**, y el subtítulo y los párrafos están en `municipalConfig.historia`. Ninguna ruta de la API los expone (probé `timeline`, `linea-tiempo`, `hitos`, `cronologia`, `historia/timeline`, entre otras: todas dan 404).
- **Impacto:** cada cambio de historia, línea de tiempo o enlace de Facebook exige un commit y un despliegue en Vercel; el administrador del municipio no puede hacerlo desde el panel. Además, como la lista de hitos va dentro de un componente, cada municipio tiene su propia copia del componente, lo que dificulta mantener el molde.
- **Solución a mediano plazo:** mover hitos y enlaces de redes al CMS (campos del municipio o una colección) y que el portal los lea con el resto de los datos. Mientras tanto, queda incluido en el checklist de PRE-ALTA.

### P-13. Restos genéricos del molde
- ✔︎ Los 15 portales (14 más Villa Pesqueira) usan como `alt` de la imagen de Historia *"Panorámica de la Sierra Madre Occidental con nubes flotando entre las montañas"*, aunque no corresponde a Carbó, Mazatán ni al valle del Río Sonora. **Solución:** tomar el `alt` del config o del CMS.
- ✔︎ Las noticias sin imagen muestran fotos aleatorias de `loremflickr.com`. **Solución:** usar una imagen institucional local, por ejemplo el escudo.
- ✔︎ En Villa Pesqueira, las subpáginas no tienen `og:image`, el sitemap omite `/galeria` y `/creditos`, y la página 404 hereda el canonical del home.

---

## Lo que está bien (no tocar)

- ✔︎ **Aislamiento entre municipios** en la API pública: pedir una noticia, un atractivo o un funcionario de un municipio bajo la ruta de otro da 404, y el 100% de los `municipioId` coincide con su municipio.
- ✔︎ Los 14 escudos, las 12 portadas y las 24 imágenes de hero en Cloudinary responden 200.
- ✔︎ El portal de Villa Pesqueira no tiene restos de otros municipios, y sus metadatos, sitemap, robots e iconos son correctos.
