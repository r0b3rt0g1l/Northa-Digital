# Historia y línea de tiempo de Villa Pesqueira (borrador investigado en internet)

**Fecha de la investigación:** 1 de octubre de 2026. **Estado:** borrador para que el ayuntamiento lo valide antes de publicarlo.

**Cómo está organizado:** separé los datos por nivel de respaldo. Solo el nivel 1 está activo en el código de abajo. El nivel 2 va comentado para que lo actives cuando lo validen. El nivel 3 no se publica hasta resolver la contradicción.

---

## 1. Qué quedó confirmado y qué no

### Nivel 1: respaldado por más de una fuente consistente (activo)

| Dato | Fuentes que lo dicen |
|---|---|
| **1629:** el misionero jesuita Martín de Azpilcueta funda San José de Mátapa | Configuración del portal; Wikipedia ES (localidad y municipio); reseña histórica del blog de Mátape; página que reproduce a INAFED |
| **Origen del nombre:** del opata, "mata" (metal) y "pa" (lugar), es decir "lugar de metales" | Reseña del blog de Mátape; página que reproduce a INAFED |
| **11 de febrero de 1867:** por decreto del Congreso del Estado, a petición de los habitantes, el pueblo de Mátape se erige en Villa Pesqueira | Wikipedia ES y EN; reseña del blog; página que reproduce a INAFED (con el texto del decreto) |
| **Ubicación:** al pie de la sierra baja de Sonora, a unos 100 km de Hermosillo | Wikipedia ES (localidad); reseña del blog |
| **Tradiciones:** Semana Santa (procesiones, fariseos y danza de los matachines) y fiestas de la Virgen en septiembre | Wikipedia ES (localidad); blog de Mátape (detalle del viernes santo, sábado de gloria y domingo de resurrección) |
| **Población 1,043** (Censo 2020) | Tabla de Wikipedia ES ("Total municipal 1043") y Wikidata, que cita el Censo de Población y Vivienda 2020 del INEGI. Confirma la cifra del portal |

### Nivel 2: una sola fuente (comentado; validar)

| Dato | Fuente | Por qué es de nivel 2 |
|---|---|---|
| **1865:** los jefes imperialistas Francisco Barceló y Santiago Campillo sitian Mátape; el general Jesús García Morales y los matapeños, a las órdenes de Ignacio Pesqueira, rechazan el sitio | Reseña del blog de Mátape (marcada "Autor: Desconocido") | No encontré una segunda fuente que lo confirme. La búsqueda web solo repitió el texto del blog |
| **1866:** una columna de matapeños, baviácoras y nácoris, al mando de García Morales, participa en la toma de Hermosillo, ocupada por los franceses | La misma reseña | Igual |

### Nivel 3: fuentes que se contradicen (no publicar todavía)

**Fecha en que Villa Pesqueira adquiere la categoría de municipio:**

| Fuente | Qué dice |
|---|---|
| **Wikipedia ES y EN** (y la wiki de FamilySearch, que copia a Wikipedia) | "El municipio fue creado el **11 de diciembre de 1930**, con la escisión territorial del municipio adyacente de Ures". La frase no trae cita |
| **Wikidata**, con referencia a la Enciclopedia de los Municipios de INAFED (copia archivada del 24 de abril de 2020) | Fecha de inicio: **26 de junio de 1934** |
| Configuración del portal | `municipioLibre: 1934` (no se muestra en ningún sitio) |
| Portal de San Javier | Dice que San Javier fue "adscrito a Hermosillo (1930), **Villa Pesqueira (1931)** y La Colorada (1934)", lo que sugiere que Villa Pesqueira ya existía como municipio en 1931 |

No pude leer la página de INAFED directamente: el proxy de este entorno la bloquea, y tampoco abre su copia archivada. Una posibilidad es que ambas fechas correspondan a hechos distintos (por ejemplo, una escisión en 1930 y un reconocimiento posterior en 1934), pero es una hipótesis mía y no está confirmada. **Hace falta el decreto del Congreso de Sonora o que el ayuntamiento confirme la fecha.**

### Pistas sin verificar (no se usan)

La búsqueda web resumió, como si fueran de INAFED, dos hechos más: en **1620**, el primer contacto del capitán Diego Martínez de Hurdaide con los aivinos, y en **1622**, la visita de los padres jesuitas Tomás Basilio y Francisco Oliñano a los pueblos aivinos del río Mátape. **No pude leerlos en una página, así que no los incluyo.** Si el ayuntamiento los confirma, serían hitos valiosos.

**Sobre el nombre de la villa:** el decreto de 1867 y la reseña del blog mencionan al general Ignacio Pesqueira, pero **ninguna fuente que leí dice que el nombre lo honre**. Por eso el texto de abajo no lo afirma.

---

## 2. Código listo para pegar

### 2.1 Historia: `lib/municipalConfig.js`, dentro de `historia`

```js
historia: {
  subtitulo: "De la misión jesuita de San José de Mátape, en 1629, a Villa Pesqueira, en 1867.",
  parrafos: [
    "Villa Pesqueira, también llamada Mátape, se encuentra al pie de la sierra baja de Sonora, a unos 100 km de Hermosillo. Su origen es la misión de San José de Mátapa, fundada en 1629 por el padre jesuita Martín de Azpilcueta.",
    "Mátapa viene del opata: «mata», metal, y «pa», lugar; es decir, «lugar de metales». El 11 de febrero de 1867, por decreto del Congreso del Estado y a petición de sus habitantes, el pueblo de Mátape se erigió en Villa Pesqueira.",
    "Entre sus tradiciones destacan la Semana Santa, con procesiones, los fariseos y la danza de los matachines, y las fiestas de la Virgen en septiembre.",
    // NIVEL 2 (una sola fuente; descomentar tras validar con el ayuntamiento):
    // "Durante la Intervención Francesa, en 1865, Mátape fue sitiado por jefes imperialistas; el general Jesús García Morales y los matapeños, a las órdenes de Ignacio Pesqueira, rechazaron el sitio. Al año siguiente, una columna de matapeños, baviácoras y nácoris participó en la toma de Hermosillo.",
  ],
},
```

### 2.2 Línea de tiempo: lista de hitos del componente de Historia

Para encontrar el componente en el repo del portal:

```bash
grep -rn -E 'Historia de|aria-label.*Historia|ano:' components app 2>/dev/null | head
```

El formato es el mismo que usa Carbó (`ano`, `titulo`, `descripcion`). Los hitos van en orden cronológico y cada `ano` debe ser único:

```js
const hitos = [
  { ano: "1629", titulo: "Fundación de San José de Mátapa",
    descripcion: "El misionero jesuita Martín de Azpilcueta funda la misión de San José de Mátapa, hoy Villa Pesqueira (Mátape)." },
  // NIVEL 2 (descomentar tras validar):
  // { ano: "1865", titulo: "Sitio de Mátape",
  //   descripcion: "Los jefes imperialistas Francisco Barceló y Santiago Campillo sitian Mátape; el general Jesús García Morales y los matapeños, a las órdenes de Ignacio Pesqueira, rechazan el sitio." },
  // { ano: "1866", titulo: "Toma de Hermosillo",
  //   descripcion: "Una columna de matapeños, baviácoras y nácoris, al mando del general Jesús García Morales, participa en la toma de Hermosillo, ocupada por los franceses." },
  { ano: "1867-02-11", titulo: "Se erige la Villa Pesqueira",
    descripcion: "Por decreto del Congreso del Estado, y a petición de sus habitantes, el pueblo de Mátape se erige en Villa Pesqueira." },
  // NIVEL 3 (NO publicar hasta confirmar la fecha; ver la sección 1):
  // { ano: "1934-06-26", titulo: "Categoría de municipio", descripcion: "…" },
];
```

---

## 3. Qué pedirle al ayuntamiento

1. **El decreto o la fecha confirmada** en que Villa Pesqueira adquirió la categoría de municipio (¿1930, 1934 u otra?). Es el dato que más pesa en la línea de tiempo.
2. **Validar los hechos de 1865 y 1866** y, si los tienen, los de 1620 y 1622.
3. **Si el nombre de la villa honra al general Ignacio Pesqueira**, para poder decirlo con seguridad.
4. **Hechos locales posteriores a 1934** (obras, personajes, instituciones, fechas de fiestas): ninguna fuente que leí los trae, y son los que más le importan a la gente del pueblo.

---

## 4. Fuentes consultadas

| Fuente | Cómo la verifiqué |
|---|---|
| [Wikipedia ES: Municipio de Villa Pesqueira](https://es.wikipedia.org/wiki/Municipio_de_Villa_Pesqueira) | Leída directamente |
| [Wikipedia ES: Villa Pesqueira](https://es.wikipedia.org/wiki/Villa_Pesqueira) | Leída directamente |
| [Wikipedia EN: Villa Pesqueira](https://en.wikipedia.org/wiki/Villa_Pesqueira) | Leída directamente. Repite lo de Wikipedia ES |
| [Wikidata: Municipio de Villa Pesqueira (Q3844354)](https://www.wikidata.org/wiki/Q3844354) | Leída directamente (JSON), con sus referencias |
| [Blog "Mátape, Villa Pesqueira"](http://matapevillapesqueirason.blogspot.com/) | Leída directamente. Reseña histórica sin autor y sin fecha. Es la única fuente del nivel 2 |
| [GuiaTuristicaMexico: Villa Pesqueira](https://www.guiaturisticamexico.com/municipio.php?id_e=26&id_Municipio=02094) | Leída directamente. Dice que su información la proporciona INAFED |
| [FamilySearch Wiki](https://www.familysearch.org/es/wiki/Villa_Pesqueira,_Centro_Costa,_Sonora,_M%C3%A9xico_-_Genealog%C3%ADa) | Leída. Copia a Wikipedia, así que no cuenta como fuente independiente |
| [INAFED: Enciclopedia de los Municipios, Villa Pesqueira](http://www.inafed.gob.mx/work/enciclopedia/EMM26sonora/municipios/26068a.html) | **No pude abrirla** (el proxy la bloquea). Solo vi extractos reproducidos por las páginas de arriba y por Wikidata |
| Facebook del ayuntamiento | **No se puede leer sin iniciar sesión.** Se usa solo para el botón de acceso directo |
