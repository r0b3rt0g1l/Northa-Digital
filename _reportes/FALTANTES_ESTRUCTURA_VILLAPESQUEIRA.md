# Villa Pesqueira: qué falta en la estructura del portal

**Fecha:** 1 de octubre de 2026. **Método:** comparé la configuración (`municipalConfig`) y el código que el navegador recibe del portal de Villa Pesqueira contra el de **Carbó**, que es el molde completo de referencia. Solo lectura.

> **Qué no pude hacer:**
> - **Facebook:** exige iniciar sesión para ver la página (responde 400 y redirige al login), así que **no puedo leer ni la historia ni los datos de contacto ahí**. Tampoco puedo confirmar desde aquí que el enlace exista; ábrelo tú.
> - **INAFED:** el proxy de este entorno lo bloquea.
> - **Repo del portal:** no tengo acceso, así que no puedo editar el código. Abajo van los cambios exactos para que los pegues.

---

## 1. Resumen

Hay dos tipos de huecos, y se cargan en sitios distintos:

| Tipo | Dónde se carga | Quién | Después hay que |
|---|---|---|---|
| **A. Está en el código del portal** | `lib/municipalConfig.js` y el componente de Historia, del repo del portal | Tú (o yo, si me das acceso al repo) | Hacer commit y desplegar en Vercel. Es parte del código que recibe el navegador, así que **no basta con revalidar** |
| **B. Está en el panel (CMS)** | `admin.northadigital.com`, con el administrador | Tú | Nada: se ve al regenerarse el home (hasta 5 minutos) |

---

## 2. Tabla de huecos

| # | Qué falta | Tipo | Estado hoy en Villa Pesqueira | Evidencia | Prioridad |
|---|---|---|---|---|---|
| 1 | **Botón de Facebook** en el pie | A | `redes.facebook = null`. El pie dice "Nuestro canal oficial en redes estará disponible próximamente" | El pie de Carbó dibuja el botón cuando `redes.facebook` tiene valor ("Facebook oficial / Página oficial") | **Alta** |
| 2 | **Historia: subtítulo y párrafos** | A | `historia.subtitulo = ""` y `historia.parrafos = []`. La sección solo muestra el título "Historia" | En Carbó traen un subtítulo y 3 párrafos | **Alta** |
| 3 | **Línea de tiempo** | A | No hay hitos | En Carbó es una lista `ano / titulo / descripcion` escrita dentro del componente de Historia, no en el CMS ni en la configuración | **Alta** |
| 4 | **Portada de Historia** (imagen de fondo) | B | `portadaHistoriaUrl = null`, así que la sección usa el degradado gris `placeholder.jpg` | Carbó tiene su portada en Cloudinary | Media |
| 5 | **Hero** (2 slides) | B | Vacío: el hero **no se muestra** | Ver [CONTENIDO_INICIAL_VILLAPESQUEIRA.md](CONTENIDO_INICIAL_VILLAPESQUEIRA.md) | **Alta** |
| 6 | **Estadísticas** | B | Vacías; el home usa el respaldo | Ver la misma hoja | Media |
| 7 | **Cabildo y directorio** (funcionarios) | B | 0 funcionarios; `/gobierno/cabildo` y `/gobierno/directorio` muestran el estado vacío | `GET …/villapesqueira/funcionarios` → `[]` | **Alta** |
| 8 | **Turismo** (atractivos) | B | 0 atractivos; `/turismo` vacío | `GET …/atractivos` → `[]` | Media |
| 9 | **Galería** (imágenes) | B | 0 imágenes | `GET …/imagenes` → `[]` | Media |
| 10 | **Noticias, SEvAC y documentos** | B | Todo vacío | Las 3 subrutas devuelven `[]` | Media (se llenan con el uso) |
| 11 | **Formulario de contacto** | Vercel | Desactivado: falta la clave de Web3Forms | `/contacto` muestra "estará disponible en breve" | Media |
| 12 | **Datos de contacto** (dirección, teléfonos, correo, horarios) | A | Todos vacíos | **Carbó también los deja vacíos**, así que el molde no los exige | Baja, pero recomendable |
| 13 | Colindancias (norte, noreste, suroeste), `lada`, `cp`, `comunidades`, `lema`, `sitiosHistoricos`, `actividadesEconomicas` | A | Vacíos | Carbó también los deja vacíos | Baja |

Lo que **ya está bien**: nombre y datos de identidad, coordenadas, altitud media, clima, hidrografía (Río Mátape), localidades (Villa Pesqueira, Nacori Grande, Adivino), escudo, metadatos, menú móvil y las 12 rutas.

---

## 3. Cambios de código (tipo A) listos para pegar

> **Atajo: el script `para-portal-villapesqueira/aplicar-facebook-historia.mjs` aplica 3.1 y 3.2 en `lib/municipalConfig.js` y los hitos en `lib/hitos.js`** del repo del portal, con una sola orden. Es de todo o nada: si no encuentra un bloque, o el bloque ya tiene contenido distinto, no escribe nada y lo dice. Tiene `--dry-run` para ver el cambio antes. **Se aplicó con éxito en el repo real de Villa Pesqueira el 1 de octubre de 2026:** modificó `lib/municipalConfig.js` (facebook e historia) y `lib/hitos.js` (hitos), y `npm run build` pasó con las 20 páginas generadas. Las rutas de archivo se confirmaron al aplicarlo.
>
> ```bash
> cd ~/Developer/VillaPesqueira            # raíz del repo del portal
> git switch -c feat/facebook-historia
> node /ruta/a/aplicar-facebook-historia.mjs --dry-run   # revisa el cambio
> node /ruta/a/aplicar-facebook-historia.mjs             # aplica
> git diff && npm run lint && npm run build
> ```


### 3.1 Botón de Facebook

En `lib/municipalConfig.js` del repo del portal, dentro de `redes`:

```js
redes: {
  facebook: "https://www.facebook.com/ayuntamientodevillapesqueira",
  instagram: null,
  twitter: null,
  youtube: null,
},
```

El pie lee `redes.facebook` y, cuando tiene valor, dibuja el botón con el texto accesible "Facebook oficial del H. Ayuntamiento de Villa Pesqueira, Sonora". Carbó usa un enlace con `profile.php?id=…`; uno con nombre de usuario funciona igual.

### 3.2 Historia y línea de tiempo

Se investigaron en internet. El texto listo para pegar (historia en `municipalConfig.historia` y hitos en el componente de Historia), las fuentes y lo que falta validar están en [HISTORIA_VILLAPESQUEIRA_BORRADOR.md](HISTORIA_VILLAPESQUEIRA_BORRADOR.md). **Solo está activo lo respaldado por más de una fuente**: la fundación en 1629, el origen del nombre, el decreto del 11 de febrero de 1867 y las tradiciones.

Para encontrar el componente donde va la lista de hitos:

```bash
grep -rn -E 'Historia de|aria-label.*Historia|ano:' components app 2>/dev/null | head
```

> **Dato en conflicto, no publicar todavía:** la fecha en que Villa Pesqueira adquiere la categoría de municipio. Wikipedia dice 11 de diciembre de 1930; Wikidata, citando a INAFED, dice 26 de junio de 1934. `municipioLibre: 1934` en la configuración **no se muestra en ningún sitio hoy**. Hay que confirmarlo con el ayuntamiento (ver el borrador de historia).

### 3.4 Después de editar

1. Commit y push en el repo del portal; Vercel despliega solo.
2. Verificación desde esta sesión, que yo corro cuando me avises:
   ```bash
   node scripts/verificacion/verificar-alta.mjs villapesqueira --nombre "Villa Pesqueira" \
     --portal https://villapesqueira.vercel.app --esperar-texto "Facebook oficial" \
     --esperar-texto "Martín de Azpilcueta"
   node scripts/verificacion/barrido-portal.mjs --portal https://villapesqueira.vercel.app \
     --slug villapesqueira --nombre "Villa Pesqueira"
   ```

---

## 4. Lo que se carga en el panel (tipo B)

**Esto lo cargan las personas que administran el panel del ayuntamiento**, y no requiere cambios de código ni despliegue: lo que publican allí llega al portal solo. Mientras no lo carguen, el portal muestra los estados vacíos.

Según la ruta de Cloudinary que usa Carbó, la portada de Historia está en `apariencia/portada-historia`; **los nombres exactos de las pantallas del panel los verá quien lo opere**.

1. **Hero** (2 slides) y **estadísticas**: hoja [CONTENIDO_INICIAL_VILLAPESQUEIRA.md](CONTENIDO_INICIAL_VILLAPESQUEIRA.md). Mientras el hero esté vacío, el home no lo muestra.
2. **Portada de Historia:** una foto de la cabecera (misión, templo o vista del pueblo), de buena resolución.
3. **Funcionarios** (presidente municipal, síndico, regidores y titulares de área), con cargo y foto. Las pantallas de Cabildo y Directorio se llenan solas con eso. Los correos y teléfonos que se capturen **se publican sin autenticación en la API**: conviene confirmarlo con cada persona.
4. **Atractivos turísticos** y **galería**.
5. Noticias.

---

## 5. Qué sigue

1. **Facebook, historia y línea de tiempo** (tipo A): cambios en el repo del portal. Faltan dos decisiones: quién los aplica (con los fragmentos de [§3](#3-cambios-de-código-tipo-a-listos-para-pegar) y de [HISTORIA_VILLAPESQUEIRA_BORRADOR.md](HISTORIA_VILLAPESQUEIRA_BORRADOR.md)), y si el repositorio del portal se comparte con esta sesión para que se haga y se verifique desde aquí.
2. **Validar con el ayuntamiento** los datos del borrador de historia: sobre todo la fecha en que Villa Pesqueira adquirió la categoría de municipio, que las fuentes dan distinta.
3. **Después del despliegue**, se verifica con `verificar-alta.mjs` y `barrido-portal.mjs` (comandos en §3.4).
