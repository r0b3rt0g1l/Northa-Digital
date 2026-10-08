# Northa Digital — landing

Sitio de Northa Digital: diseño, sistemas y presencia digital para organizaciones.
Una sola página en español, construida con el método "una idea por sección":
cada bloque responde una sola pregunta.

| Sección | Pregunta que responde |
|---|---|
| Hero | ¿Qué hacen? |
| Servicios | ¿Qué ofrecen? |
| Cuéntanos qué necesitas en 30 segundos | ¿Cómo empiezo una conversación? |
| Portafolio | ¿Qué trabajo real han hecho? |
| Cierre y footer | ¿Cómo los contacto? |

## Concepto visual: "Signal in the dark"

- **Fondo:** grafito profundo con un cielo realista en canvas. Las estrellas tienen
  brillo y color de cielo real, hay una franja muy tenue de Vía Láctea con polvo, el
  centelleo es irregular y las más brillantes llevan destello de difracción. Todo el
  cielo gira en bloque alrededor de la señal del hero, la estrella polar, una vuelta
  cada 40 minutos. Brilla en el hero y el cierre y baja al 40 % detrás del contenido.
  Solo se anima cuando el hero o el cierre están en pantalla.
- **Señal:** el hero gira alrededor de un punto de luz con destello de ocho puntas,
  la estrella polar de la marca. Las puntas se afinan hacia el extremo y centellean
  cada una a su ritmo.
- **Vidrio:** solo en navbar, menú, panel de contacto, tarjeta de sistemas y
  asistente. El resto son superficies mate.
- **Servicios:** una barra a todo el ancho con los nombres en grande que corre sin fin,
  se acelera un poco con el scroll y tiene botón de pausa. Las tarjetas se inclinan
  hacia el puntero y la de sistemas lleva un haz de luz que recorre su borde.
- **Tipografía:** Sora para títulos, Manrope para texto y JetBrains Mono para
  etiquetas cortas.
- **Movimiento:** revelados suaves, títulos que entran palabra por palabra y la
  captura del portafolio que se acerca al hacer scroll.
- **Puntero:** en escritorio, un puntero adaptable al estilo de iPadOS. Es un círculo
  translúcido que se vuelve el resaltado del botón o enlace que toca y lo mueve unos
  píxeles. Sobre el texto se vuelve una barra de escritura y en los campos vuelve el
  cursor del sistema.
- Todo respeta `prefers-reduced-motion` y funciona sin JavaScript.

Los valores viven en `app/globals.css` (tokens en `@theme`) y en `lib/fonts.js`.

## Contacto: dos vías funcionales

El bloque de 30 segundos y el asistente comparten el mismo destino.

- **Con `NEXT_PUBLIC_WEB3FORMS_KEY`:** "Enviar mensaje" llega por correo vía
  Web3Forms, con respuesta directa al visitante si dejó un correo. WhatsApp queda
  como segunda opción con el mismo mensaje.
- **Sin la clave:** el botón principal abre WhatsApp con el mensaje armado.
- **Sin JavaScript:** el formulario hace un POST directo a Web3Forms o abre
  WhatsApp. Los datos nunca quedan en la URL del sitio.

Para activar el correo: crea la clave en https://web3forms.com con el buzón que
recibirá los mensajes, cárgala en Vercel en Production y Preview, y vuelve a
desplegar. La clave se incrusta al compilar.

## Asistente del sitio

Botón discreto abajo a la derecha. Responde con información predefinida, ofrece
sugerencias ("palabras predeterminadas"), entiende texto libre por palabras clave y
deriva al equipo por WhatsApp o al formulario lo que no sabe responder. El panel se
descarga solo cuando alguien lo abre y la conversación se guarda durante la sesión.

Para cambiar respuestas, sugerencias o palabras clave edita
`lib/content/asistente.js`. El motor está en `lib/asistente.js`. Regla: nada de
precios, plazos, clientes o métricas inventadas.

## Estructura del proyecto

```
app/                 rutas, metadatos, sitemap, robots, imagen para redes, estilos
components/
  nav/ hero/ servicios/ contacto/ portafolio/ cierre/ footer/   secciones
  asistente/         lanzador y panel del asistente
  fondo/             cielo de estrellas y reflejo del vidrio
  cursor/            halo e imán del cursor
  ui/                botón, logo, sección, encabezado, revelado
lib/
  content/           textos editables: hero, servicios, contacto, proyectos, asistente
  asistente.js       motor del asistente
  acciones.js        puente entre bloques (abrir asistente, precargar el formulario)
  site.js            identidad, contacto y URL principal
public/portafolio/   captura del portal de Mazatán (con crédito del escudo)
```

### Añadir un proyecto al portafolio

Agrega una entrada en `lib/content/proyectos.js`. El primero con `destacado: true`
es el caso principal; el resto aparece en una cuadrícula secundaria solo cuando
existe. Solo enlaces y cifras verificables. Las imágenes de terceros, como los
escudos municipales, llevan su crédito.

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
- `NEXT_PUBLIC_WEB3FORMS_KEY`: clave pública de Web3Forms.

## Despliegue

Vercel, proyecto `northa-landing`, desde el repositorio `northa-landing`. La GitHub
App de Vercel no tiene acceso al repositorio, así que cada cambio se publica con
`vercel --prod`. Antes de publicar, conviene revisar una Preview y hacer un envío
real del formulario.

## Contacto

**Roberto Gil** · rgilh@hotmail.com · +52 662 386 6834
