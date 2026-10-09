# Northa Digital — landing

Sitio de Northa Digital: diseño, sistemas y presencia digital para organizaciones.
Una sola página en español, construida con el método "una idea por sección":
cada bloque responde una sola pregunta.

| Sección | Pregunta que responde |
|---|---|
| Hero | ¿Qué hacen? |
| Lo que construimos | ¿Qué ofrecen? |
| Seguridad | ¿Cómo protegen sus sistemas? |
| Portafolio | ¿Qué trabajo real han hecho? |
| Escena final y pie | ¿Cómo los contacto? |

La oferta completa vive en el menú «Servicios» de la barra superior y en el
asistente. La página no repite tarjetas de servicios.

## Concepto visual: "Signal in the dark"

- **Fondo:** grafito profundo con un cielo realista en canvas. Las estrellas tienen
  brillo y color de cielo real, hay una franja muy tenue de Vía Láctea con polvo, el
  centelleo es irregular y las más brillantes llevan destello de difracción. Todo el
  cielo gira alrededor de la señal del hero, la estrella polar. La capa lejana da una
  vuelta cada 15 minutos y las cercanas giran un poco más rápido, lo que da
  profundidad. Brilla en el hero y la escena final y baja al 40 % detrás del
  contenido.
- **Señal:** el hero gira alrededor de un punto de luz con destello de ocho puntas,
  la estrella polar de la marca. Debajo, un indicador «Explorar» invita a bajar. La
  página nunca se desplaza sola.
- **Vidrio:** solo en navbar, menú, asistente y controles. El resto son superficies
  mate.
- **Lo que construimos:** el sello giratorio de Northa y una barra compacta con los
  servicios. Las piezas entran una tras otra con un pequeño rebote cuando la barra
  aparece en pantalla y vuelven a saltar al pasar el ratón.
- **Seguridad:** un esquema ilustrativo de acceso protegido (VPN, Zero Trust y
  acceso por persona). Es un dibujo conceptual: no hay pantallas de acceso,
  formularios ni verificaciones reales.
- **Portafolio:** la captura del portal de Mazatán con la insignia «Hecho por
  Northa Digital» y todos los municipios con portal publicado, cada uno con su
  enlace.
- **Escena final:** la estrella del norte se enciende y da una vuelta completa al
  entrar en pantalla.
- **Puntero:** en escritorio, un puntero adaptable al estilo de iPadOS. Es un círculo
  translúcido que se vuelve el resaltado del botón o enlace que toca. Sobre el texto
  se vuelve una barra de escritura y en los campos vuelve el cursor del sistema.
- **Tipografía:** Sora para títulos, Manrope para texto y JetBrains Mono para
  etiquetas cortas.
- Las animaciones de las secciones duran unos segundos al entrar en pantalla y se
  detienen solas. Solo el cielo y los destellos de la señal se mueven de forma
  continua, lentos y discretos. Todo respeta `prefers-reduced-motion`: el cielo queda
  quieto y las piezas aparecen sin animación. El contenido funciona sin JavaScript.

Los valores viven en `app/globals.css` (tokens en `@theme`) y en `lib/fonts.js`.

## Contacto

Los datos salen de un solo lugar, `lib/site.js`:

- WhatsApp y teléfono: 662 205 5021 (`https://wa.me/526622055021`,
  `tel:+526622055021`).
- Correo: northadigital@gmail.com (`mailto:`).

El sitio no tiene formulario ni guarda datos. Cada botón «Cuéntanos tu proyecto»
abre el asistente. Sin JavaScript, el mismo botón abre WhatsApp directamente.

## Asistente del sitio

Asistente guiado con respuestas predefinidas. No es inteligencia artificial ni
atención en tiempo real, y lo dice en el panel.

1. Da la bienvenida y pregunta el servicio entre las opciones reales.
2. Pregunta el objetivo, el tipo de organización, lo que debe incluir y el plazo
   aproximado. Casi todas aceptan una respuesta escrita con palabras propias y
   las opcionales se pueden saltar.
3. Muestra un resumen que se puede revisar y cambiar línea por línea.
4. «Abrir en WhatsApp» abre el chat con el mensaje ya escrito. Nada se envía
   hasta que el visitante lo manda.

También responde dudas frecuentes con información verificada y ofrece hablar con
una persona por WhatsApp, teléfono o correo. No pide nombre, teléfono ni correo. El
panel se descarga solo cuando alguien lo abre y la conversación se guarda durante
la sesión del navegador.

- Preguntas del flujo y armado del mensaje: `lib/content/consulta.js`.
- Dudas frecuentes y palabras clave: `lib/content/asistente.js`.
- Motor de respuestas: `lib/asistente.js`.

Regla: nada de precios, plazos, clientes o métricas inventadas.

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
public/portafolio/   captura del portal de Mazatán (con crédito del escudo)
```

### Añadir un municipio al portafolio

Agrega una entrada en `enlaces` dentro de `lib/content/proyectos.js` con el nombre
y la dirección del portal publicado. Solo portales reales y en línea. Las imágenes
de terceros, como los escudos municipales, llevan su crédito.

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
