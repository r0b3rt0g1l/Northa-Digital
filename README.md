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
- **Lo que construimos:** el sello giratorio de Northa, seis beneficios cortos
  (presencia digital, información ordenada, turismo, trámites, comunicación y
  administración) y una banda a todo el ancho con los servicios: los botones
  recorren la pantalla en un ciclo continuo y rebotan uno tras otro. Tiene botón
  de pausa y se detiene al pasar el puntero, al enfocarla o al tocarla.
- **Portafolio:** un widget al estilo de Apple que pasa solo por los 15 municipios
  con portal publicado (cada 2,6 s, con pausa), con la insignia «Hecho por Northa
  Digital», y la lista con el enlace a cada portal. Mazatán lleva la portada real
  de su portal; el resto, un diseño con su color institucional, tomado de su
  escudo o logotipo oficial.
- **Seguridad:** una sola pieza de confianza: implementamos medidas modernas de
  protección y control de acceso para las plataformas administrativas. Sin
  detalles técnicos, herramientas ni pantallas de acceso.
- **Escena final:** la estrella del norte se enciende y da una vuelta completa al
  entrar en pantalla.
- **Puntero:** en escritorio, un puntero adaptable al estilo de iPadOS. Es un círculo
  translúcido que se vuelve el resaltado del botón o enlace que toca. Sobre el texto
  se vuelve una barra de escritura y en los campos vuelve el cursor del sistema.
- **Tipografía:** Sora para títulos, Manrope para texto y JetBrains Mono para
  etiquetas cortas.
- Se mueven de forma continua el cielo, los destellos de la señal, la banda de
  servicios y el widget del portafolio; la banda y el widget tienen botón de pausa.
  El resto de animaciones dura unos segundos y se detiene solo. Todo respeta
  `prefers-reduced-motion`: el cielo queda quieto, la banda se muestra fija y el
  widget no avanza solo. El contenido funciona sin JavaScript.

Los valores viven en `app/globals.css` (tokens en `@theme`) y en `lib/fonts.js`.

## Contacto

Los datos salen de un solo lugar, `lib/site.js`:

- WhatsApp y teléfono: 662 205 5021 (`https://wa.me/526622055021`,
  `tel:+526622055021`).
- Correo: northadigital@gmail.com (`mailto:`).

El sitio no tiene formulario ni guarda datos. Cada botón «Cuéntanos tu proyecto»
abre el asistente. Sin JavaScript, el mismo botón abre WhatsApp directamente.

## Asistente del sitio

Asistente con respuestas automáticas. No es inteligencia artificial ni atención en
tiempo real, y lo dice en el panel. Hace pocas preguntas, con opciones claras:

1. «¿Buscas un portal municipal, una página web o algún sistema digital?». Si el
   visitante no sabe, pregunta si es para un municipio, un negocio o un proyecto
   personal. También entiende texto libre (portal, turismo, trámites, formularios,
   galería, transparencia…).
2. ¿Para qué municipio u organización sería? (opcional)
3. ¿Qué es lo principal que necesitas?
4. ¿Cómo te llamas? (opcional)
5. ¿Cómo prefieres que te contactemos? WhatsApp, llamada o correo (el correo es
   opcional).

Al final muestra un resumen que se puede cambiar línea por línea y «Continuar por
WhatsApp» abre el chat con el mensaje listo. Nada se envía hasta que el visitante
lo manda. Los datos solo viajan en ese mensaje; el sitio no los guarda en ningún
servidor (la conversación queda en la sesión del navegador).

También responde dudas frecuentes y ofrece hablar con una persona por WhatsApp,
teléfono o correo. Cualquier servicio de la página abre el asistente ya en ese
servicio.

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
public/portafolio/   portada del portal de Mazatán (sin menú ni escudo)
```

### Añadir un municipio al portafolio

Agrega una entrada en `enlaces` dentro de `lib/content/proyectos.js` con el nombre,
la dirección del portal publicado y su color institucional (el tono dominante de su
escudo o logotipo oficial). Solo portales reales y en línea. Las imágenes de
terceros, como los escudos municipales, solo se usan con permiso y con su crédito.

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
