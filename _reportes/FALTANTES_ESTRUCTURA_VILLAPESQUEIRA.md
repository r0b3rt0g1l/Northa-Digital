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

### 3.2 Historia (borrador)

En el mismo archivo, dentro de `historia`. **Es un borrador con solo datos que pude respaldar; el ayuntamiento debe validarlo y ampliarlo.**

```js
historia: {
  subtitulo: "Antigua misión de San José de Mátape, fundada en 1629 por el jesuita Martín de Azpilcueta.",
  parrafos: [
    "Villa Pesqueira, también conocida como Mátape, es la cabecera del municipio del mismo nombre, en la sierra baja de Sonora, a unos 100 km de Hermosillo. Nació como la misión de San José de Mátape, fundada en 1629 por el misionero jesuita Martín de Azpilcueta.",
    "Sus habitantes se sostienen principalmente de la ganadería, la agricultura y el aprovechamiento de sus recursos forestales.",
    "Entre sus celebraciones destacan la Semana Santa, con procesiones, la tradición de los fariseos y la danza de los matachines, y las fiestas de la Virgen en septiembre.",
    // PENDIENTE (el ayuntamiento): fecha y decreto de erección del municipio, y hechos locales relevantes.
  ],
},
```

**Fuentes de ese borrador:**
- El año, el fundador y el nombre "Mátape": `identidad.fundacion` de la propia configuración del portal y la entrada de Wikipedia en español "Villa Pesqueira" (consultada el 1 de octubre de 2026).
- La distancia, las actividades y las fiestas: solo Wikipedia. **No es una fuente oficial.** Conviene contrastarlas con INAFED o con el ayuntamiento antes de publicar.

### 3.3 Línea de tiempo

Va en el componente de Historia del repo del portal. Para encontrarlo:

```bash
grep -rn -E 'Historia de|aria-label.*Historia|ano:' components app 2>/dev/null | head
```

En Carbó es una lista al inicio del módulo con este formato. En Villa Pesqueira esa lista está vacía:

```js
const hitos = [
  { ano: "1629", titulo: "Fundación de la misión de San José de Mátape",
    descripcion: "El misionero jesuita Martín de Azpilcueta funda la misión de San José de Mátape." },
  // PENDIENTE (el ayuntamiento): resto de hitos, con año, título y descripción.
];
```

Solo incluí el hito de 1629, que es el único que puedo respaldar. **No inventé el resto.** Si el ayuntamiento no tiene más fechas todavía, un solo hito se verá corto; es mejor eso que fechas dudosas.

> **Dato por verificar antes de usarlo en la línea de tiempo.** La configuración tiene `municipioLibre: 1934`. Ese valor **no se muestra en ningún sitio hoy**. Pero el portal de San Javier dice: "San Javier es adscrito a Hermosillo (1930), Villa Pesqueira (1931) y La Colorada (1934)". Eso sugiere que Villa Pesqueira ya era municipio en 1931, así que 1934 podría no ser la fecha correcta de su erección. Confírmalo con el ayuntamiento o con el decreto del Congreso de Sonora.

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

Según la ruta de Cloudinary que usa Carbó, la portada de Historia está en `apariencia/portada-historia`; **los nombres exactos de las pantallas del panel los verás tú**.

1. **Hero** (2 slides) y **estadísticas**: hoja [CONTENIDO_INICIAL_VILLAPESQUEIRA.md](CONTENIDO_INICIAL_VILLAPESQUEIRA.md).
2. **Portada de Historia:** una foto de la cabecera (misión, templo o vista del pueblo), de buena resolución.
3. **Funcionarios** (presidente municipal, síndico, regidores y titulares de área), con cargo y foto. Las pantallas de Cabildo y Directorio se llenan solas con eso. Los correos y teléfonos que captures **se publican sin autenticación en la API**: confirma con cada persona antes de cargarlos.
4. **Atractivos turísticos** y **galería**.
5. Noticias de prueba, cuando lo anterior esté listo.

---

## 5. Qué necesito de ti

1. **El texto de historia del ayuntamiento:** copia de su Facebook (pestaña "Información" o las publicaciones donde cuenten la historia) o del material que te hayan dado. Con eso afino los párrafos y armo los hitos con año, título y descripción.
2. **Confirmar la fecha de erección del municipio** (ver el dato por verificar de §3.3).
3. **Quién edita el repo del portal:** tú con los fragmentos de arriba, o me das acceso al repositorio de Villa Pesqueira para que yo lo haga y lo verifique.
