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

La oferta completa vive en el banner de servicios de «Lo que construimos», en el
menú «Servicios» de la barra superior y en el asistente.

## Concepto visual: "Signal in the dark"

- **Fondo:** un espacio en vivo en canvas. Tres capas de estrellas con
  profundidad derivan despacio, cada una a su ritmo; las estrellas son puntos
  nítidos de tamaños, brillos y colores suaves (blanco, azul claro y amarillo
  pálido), muchas centellean a su propio ritmo y las más brillantes llevan un
  destello fino. Hay una franja tenue de Vía Láctea y estrellas fugaces cada pocos
  segundos, con una estela que se afina y se apaga con suavidad. Al hacer scroll
  las capas se desplazan a distinto ritmo (paralaje), con un leve retardo para que
  nunca sea brusco. Brilla al 100 % en el hero y la escena final y al 85 % detrás
  del contenido. El lienzo mide el alto grande de la pantalla, así que la barra
  del navegador del celular no mueve las estrellas, y las posiciones salen de una
  semilla fija: al girar el teléfono conservan su sitio.
- **Señal:** el hero gira alrededor de un punto de luz con destello de ocho puntas,
  la estrella polar de la marca. Debajo, un indicador «Explorar» invita a bajar. La
  página nunca se desplaza sola.
- **Liquid Glass:** un solo material, translúcido y ligero, en barra, menús,
  tarjetas, botones secundarios, banners, secciones, pie, asistente y controles:
  desenfoque real del fondo, bordes suaves con filo de luz, brillo interno sutil y
  reflejos delicados. Con el cursor encima, el borde se enciende donde está el
  puntero y el reflejo lo sigue. El vidrio dentro de otro vidrio no vuelve a
  desenfocar (`glass-interior`), para cuidar el rendimiento.
- **Lo que construimos:** el sello giratorio de Northa, seis beneficios cortos
  (presencia digital, información ordenada, seguridad, trámites, comunicación y
  administración) y un banner de servicios en una franja de vidrio: avanza
  siempre hacia la derecha en un bucle continuo, despacio para leerlo, y cada
  servicio da un brinco lento y rítmico, como conejos en fila. Tiene botón de
  pausa y se detiene al pasar el puntero, al enfocarlo con teclado, al tocarlo o
  fuera de pantalla. Cada servicio abre el asistente.
- **Portafolio:** los 15 portales municipales en un solo contenedor de vidrio del
  ancho del sitio, todos a la vista: cuadrícula de 5 columnas en escritorio, 3 en
  tableta y una lista compacta en celular. Cada uno muestra su página de inicio
  real, el nombre y el dominio, y abre el portal. Si falta una captura, se muestra
  un diseño con el color institucional del municipio.
- **Seguridad:** cuatro puntos claros (acceso protegido con VPN, login
  administrativo seguro, protección para portales municipales, control de acceso
  y monitoreo) y una demostración visual: túnel VPN, login seguro y panel
  administrativo protegido. Es una ilustración: no tiene campos ni botones reales
  y no imita pantallas de terceros. Debajo, «Así se entra al panel de tu portal»
  muestra tres capturas reales del acceso al CMS (correo en Cloudflare Access,
  código de un solo uso y login del panel con verificación anti-bots), rotuladas
  como capturas: son imágenes, no formularios. En tableta y celular se deslizan
  de lado.
- **Escena final:** la estrella del norte se enciende y da una vuelta completa al
  entrar en pantalla.
- **Puntero:** en escritorio, un puntero adaptable al estilo de iPadOS. Es un círculo
  translúcido que se vuelve el resaltado del botón o enlace que toca. Sobre el texto
  se vuelve una barra de escritura y en los campos vuelve el cursor del sistema.
- **Tipografía:** Sora para títulos, Manrope para texto y JetBrains Mono para
  etiquetas cortas.
- Se mueven de forma continua el cielo, los destellos de la señal y el banner de
  servicios. El botón «Pausar animaciones» del pie los detiene todos y la
  elección se recuerda en el navegador (`lib/movimiento.js`); el banner tiene
  además su propio botón de pausa. La demostración de Seguridad dura menos de
  5 s y se detiene sola. Todo respeta `prefers-reduced-motion`: el cielo queda
  como un cuadro fijo (tampoco se mueve con el scroll) y el banner se muestra
  fijo, centrado y en varias filas. El contenido funciona sin JavaScript.

Los valores viven en `app/globals.css` (tokens en `@theme`) y en `lib/fonts.js`.

## Capturas del acceso (Seguridad)

Viven en `public/seguridad/` y sus textos en `lib/content/servicios.js`
(`seguridad.acceso`). Antes de reemplazarlas:

- Tapa con un bloque opaco (no con desenfoque) el dominio privado de acceso y
  cualquier código de verificación, y usa solo el correo de Northa.
- Exporta a WebP sin metadatos (por ejemplo, con `sharp`, que no los copia).
- Nunca subas las capturas originales al repositorio.

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
asistente se abre con su botón flotante, con el banner de servicios o desde el
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
