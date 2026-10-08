# Northa Digital — landing

Sitio de Northa Digital: diseño, sistemas y presencia digital para organizaciones.
Una sola página, en español, pensada para entender en segundos qué hace la empresa y
empezar una conversación sin fricción.

## Estructura de la página (orden de scroll)

1. **Navbar** fija en cápsula de vidrio: Servicios · Portafolio · Contacto · CTA.
2. **Hero**: etiqueta, titular, subtítulo, dos acciones y una composición abstracta.
3. **Servicios**: lista editorial de seis líneas de trabajo. La seguridad va dentro de
   "Portales y sistemas digitales", no como servicio aparte.
4. **Contacto en 30 segundos**: bloque de conversión principal (texto libre, chips
   opcionales, un dato de contacto). Envía por Web3Forms; sin clave, ofrece WhatsApp.
5. **Portafolio**: un caso principal (portales municipales) y espacio para más.
6. **Cierre** con datos de contacto reales y **footer** mínimo.

## Sistema visual

Negro grafito, vidrio oscuro tratado como material (liquid glass con borde iluminado y
reflejo que sigue al puntero), un solo acento azul, tipografía Sora + Manrope +
JetBrains Mono, campo de estrellas en canvas de bajo costo y cursor con halo e imán en
escritorio. Todo respeta `prefers-reduced-motion` y funciona sin JavaScript.

Las decisiones viven en `app/globals.css` (tokens en `@theme`, `.glass`, `.reveal`,
secuencia del hero, cursor) y en `lib/fonts.js`.

## Estructura del proyecto

```
app/              rutas, metadatos, sitemap, robots, opengraph, estilos globales
components/       secciones de la página y primitivas de UI
  fondo/          Starfield (canvas) y GlassPointer (reflejo del vidrio)
  cursor/         halo + imán del cursor (solo puntero fino)
lib/content/      contenido editable: servicios, proyectos, chips, navegación
lib/site.js       identidad, contacto y URLs
hooks/            useReducedMotion, useScrollSpy
public/           ícono y lockups de marca
```

El contenido vive en `lib/content/`, separado de los componentes.

### Añadir un proyecto al portafolio

Agrega una entrada en `lib/content/proyectos.js`. El primero con `destacado: true` se
muestra como caso principal; el resto aparece en una cuadrícula secundaria solo cuando
existe. No inventes enlaces, cifras ni clientes: lo que no se pueda verificar se omite.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Variables de entorno (ver `.env.example`):

- `NEXT_PUBLIC_SITE_URL` — URL canónica (canonical, sitemap, robots, OpenGraph).
- `NEXT_PUBLIC_WEB3FORMS_KEY` — clave pública de Web3Forms para el bloque de contacto.
  Sin ella, el formulario ofrece enviar el mensaje por WhatsApp.

## Despliegue

Vercel. El proyecto `northa-landing` se publica desde el repositorio `northa-landing`;
hasta que la GitHub App de Vercel tenga acceso, cada cambio requiere `vercel --prod`.

## Contacto

**Roberto Gil** · rgilh@hotmail.com · +52 662 386 6834
