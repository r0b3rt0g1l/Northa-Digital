# Northa Digital — landing

Sitio de Northa Digital: diseño, sistemas y presencia digital para organizaciones.
Una sola página en español, construida con el método "una idea por sección":
cada bloque responde una sola pregunta.

| Sección | Pregunta que responde |
|---|---|
| Hero | ¿Qué hacen? |
| Lo que construimos | ¿Qué ofrecen y qué gano yo? |
| Portafolio | ¿Qué trabajo real han hecho? |
| Seguridad | ¿Puedo confiar en ellos? |
| Escena final y pie | ¿Cómo los contacto? |

La oferta completa vive en el banner de cartas de «Lo que construimos», en el
menú «Servicios» de la barra superior y en el asistente.

## Concepto visual: "Signal in the dark"

- **Fondo:** grafito profundo con un cielo vivo en canvas. Las estrellas tienen
  brillo y color de cielo real, hay una franja tenue de Vía Láctea con polvo, el
  centelleo es individual e irregular y las más brillantes llevan destello de
  difracción. Todo el cielo gira alrededor de la señal del hero, la estrella polar,
  y cada estrella deja una estela en arco, como en una foto de larga exposición:
  las estelas siempre se ven. Dos capas con profundidad (la media gira un poco más
  rápido), paralaje con el ratón, giro extra al hacer scroll y estrellas fugaces
  cada pocos segundos. Brilla al 100 % en el hero y la escena final y al 82 %
  detrás del contenido.
- **Señal:** el hero gira alrededor de un punto de luz con destello de ocho puntas,
  la estrella polar de la marca. Debajo, un indicador «Explorar» invita a bajar. La
  página nunca se desplaza sola.
- **Liquid Glass:** un solo material en todo el sitio (barra, menús, tarjetas,
  botones secundarios, banners, secciones destacadas, asistente y controles):
  fondo translúcido con desenfoque real, borde luminoso y reflejo especular. Con el
  cursor encima, el borde se enciende donde está el puntero, el reflejo lo sigue y
  las tarjetas se inclinan en 3D. El vidrio dentro de otro vidrio no vuelve a
  desenfocar (`glass-interior`), para cuidar el rendimiento.
- **Lo que construimos:** el sello giratorio de Northa, seis beneficios cortos
  (presencia digital, información ordenada, seguridad, trámites, comunicación y
  administración) y un banner de servicios en cartas: al llegar a la sección las
  cartas salen del mazo en cascada y rebotan hasta su lugar dejando una estela,
  como al ganar en Solitario («Repartir de nuevo» lo repite). Después quedan
  quietas. Cada carta abre el asistente con ese servicio.
- **Portafolio:** la página de inicio real de cada uno de los 15 portales
  municipales: un widget con forma de ventana de navegador que pasa solo por todos
  (cada 2,6 s, con pausa) y una tarjeta por portal con su captura, el nombre, el
  dominio y «Visitar portal». Si falta una captura, se muestra un diseño con el
  color institucional del municipio.
- **Seguridad:** cuatro puntos claros (acceso protegido con VPN, login
  administrativo seguro, protección para portales municipales, control de acceso
  y monitoreo) y una demostración visual: túnel VPN, login seguro y panel
  administrativo protegido. Es una ilustración: no tiene campos ni botones reales
  y no imita pantallas de terceros.
- **Escena final:** la estrella del norte se enciende y da una vuelta completa al
  entrar en pantalla.
- **Puntero:** en escritorio, un puntero adaptable al estilo de iPadOS. Es un círculo
  translúcido que se vuelve el resaltado del botón o enlace que toca. Sobre el texto
  se vuelve una barra de escritura y en los campos vuelve el cursor del sistema.
- **Tipografía:** Sora para títulos, Manrope para texto y JetBrains Mono para
  etiquetas cortas.
- Se mueven de forma continua el cielo, los destellos de la señal, la
  demostración de seguridad y el widget del portafolio (con botón de pausa; se
  detiene fuera de pantalla). El reparto de cartas dura unos segundos y se detiene
  solo. Todo respeta `prefers-reduced-motion`: el cielo queda quieto (con sus
  estelas), las cartas aparecen en su lugar y el widget no avanza solo. El
  contenido funciona sin JavaScript.

Los valores viven en `app/globals.css` (tokens en `@theme`) y en `lib/fonts.js`.

## Contacto

Los datos salen de un solo lugar, `lib/site.js`:

- WhatsApp: solo el botón, sin el número escrito ni opción de llamada. Abre el
  chat con el número de Northa y el mensaje «Hola, vi su página y me interesa un
  servicio digital.» (`lib/whatsapp.js`): en celular abre la app con el enlace
  `https://wa.me/526622055021?text=…`, y en computadora abre WhatsApp Web
  (`web.whatsapp.com/send`) sin la página intermedia de wa.me. Sin JavaScript es
  un enlace wa.me normal.
- Correo: northadigital@gmail.com (`mailto:`).

El sitio no tiene formulario ni envía datos a ningún servidor. Los botones
«Cuéntanos tu proyecto» con el ícono de WhatsApp abren WhatsApp directo; el
asistente se abre con su botón flotante, con las cartas de servicios o desde el
menú «Servicios».

## Asistente del sitio

Asistente con respuestas automáticas. No es inteligencia artificial ni atención en
tiempo real, y lo aclara si se le pregunta. Hace pocas preguntas, con opciones claras:

1. «¿Buscas un portal municipal, una página web o algún sistema digital?». Si el
   visitante no sabe, pregunta si es para un municipio, un negocio o un proyecto
   personal. También entiende texto libre (portal, turismo, trámites, formularios,
   galería, transparencia…).
2. ¿Para qué municipio u organización sería? (opcional)
3. ¿Qué es lo principal que necesitas?
4. ¿Cómo te llamas? (opcional)
5. ¿Cómo prefieres que te contactemos? WhatsApp o correo (el correo es
   opcional).

Al final muestra un resumen que se puede cambiar línea por línea y «Continuar por
WhatsApp» abre el chat con el mensaje listo. Nada se envía hasta que el visitante
lo manda. Los datos solo viajan en ese mensaje; el sitio no los guarda en ningún
servidor (la conversación queda en la sesión del navegador).

También responde dudas frecuentes y ofrece hablar con una persona por WhatsApp o
correo. Cualquier servicio de la página abre el asistente ya en ese servicio.

- Preguntas, opciones y armado del mensaje: `lib/content/consulta.js`.
- Dudas frecuentes y palabras clave: `lib/content/asistente.js`.
- Motor de respuestas: `lib/asistente.js`.

Regla: nada de precios, plazos, funciones, integraciones, clientes o métricas
inventadas.

## Estructura del proyecto

```
app/                 rutas, metadatos, sitemap, robots, imagen para redes, estilos
components/
  nav/               barra superior y menú de servicios
  hero/ servicios/ seguridad/ portafolio/ cierre/ footer/   secciones
  asistente/         lanzador y panel del asistente
  fondo/             cielo de estrellas y reflejo del vidrio
  cursor/            puntero adaptable
  ui/                botón, logo, sección, encabezado, revelado, iconos
lib/
  content/           textos editables: hero, servicios, consulta, proyectos, asistente
  asistente.js       motor del asistente
  acciones.js        puente entre bloques (abrir el asistente, ir a una sección)
  site.js            identidad, contacto y URL principal
  whatsapp.js        apertura directa de WhatsApp (app o WhatsApp Web)
public/portafolio/portales/   página de inicio de cada portal (WebP 1440 × 900)
scripts/capturar-portales.mjs actualiza esas capturas
```

### Actualizar las capturas de los portales

```bash
npm i --no-save playwright && npx playwright install chromium
node scripts/capturar-portales.mjs              # los 15
node scripts/capturar-portales.mjs Aconchi      # solo uno
```

El script abre cada portal, cierra el aviso de términos de uso con su propio
botón, captura la página de inicio a 1440 × 900 y actualiza
`lib/content/capturas.json` con la fecha. No cambia `package.json`.

### Añadir un municipio al portafolio

Agrega una entrada en `enlaces` dentro de `lib/content/proyectos.js` con el nombre,
la dirección del portal publicado y su color institucional (el tono dominante del
escudo o logotipo que usa su propio portal, provisional en varios casos), y corre
`node scripts/capturar-portales.mjs <Nombre>`. Solo portales reales y en línea.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Variables de entorno, ver `.env.example`:

- `NEXT_PUBLIC_SITE_URL`: dirección canónica. Sin definir, usa
  https://northa-landing.vercel.app.

El sitio no necesita claves ni secretos.

## Despliegue

Vercel publica desde GitHub. Cada rama con cambios genera una Preview, y al
fusionar en `main` se publica en producción (https://northa-landing.vercel.app).
Antes de fusionar, conviene revisar la Preview del pull request.
