# Admin: enlace "Ver sitio público" de cada municipio

**Pedido del operador, 2 de octubre de 2026:** que en cada panel de administración aparezca el enlace al sitio del municipio correspondiente.

`cms-admin` es una sola aplicación para los 15 municipios: cada persona entra a su municipio. El enlace sale de `Municipio.dominio`, que la API pública ya publica en `GET /api/municipios/<slug>`. Así cada panel muestra el dominio de su municipio sin escribir direcciones a mano. Cuando un municipio compre su dominio propio, el enlace se actualiza solo.

Ejemplos de lo que ve hoy cada municipio:
- Carbó: `carbotransparencia.com.mx`
- Villa Pesqueira: `villapesqueira.vercel.app`

## Qué cambia

| Archivo | Cambio |
|---|---|
| `src/lib/api.js` | Función nueva `getSitioPublico()` al final del archivo. |
| `src/app/(admin)/layout.jsx` | Pide `getSitioPublico()` junto con el usuario (en paralelo) y se la pasa al menú. |
| `src/components/Sidebar.jsx` | Muestra **"Ver sitio público"**, con la dirección debajo, arriba de la persona que entró. Se abre en pestaña nueva y también aparece en el menú del celular. |

## Qué pasa si algo falla

`getSitioPublico()` nunca rompe el panel:
- Si la API no responde, tarda más de 4 s, el municipio no tiene dominio o el dominio no tiene formato válido, devuelve `null` y el enlace **simplemente no aparece**.
- Una redirección de sesión vencida sigue su curso.

## Uso

```
node aplicar-enlace-sitio.mjs --dry-run ~/Developer/cms-admin
node aplicar-enlace-sitio.mjs --build --commit --push ~/Developer/cms-admin
```

Trabaja todo o nada: si algún archivo no es como se esperaba, no toca nada. Si falla el build, deja el repo como estaba. Solo lo frenan los cambios sin guardar en los 3 archivos que toca. El commit lleva solo esos 3 archivos.

## Comprobado

- **`npm test`:** 11 pruebas sobre réplicas de tu `layout.jsx` y `Sidebar.jsx`, con la función nueva cargada y ejecutada de verdad. Cubren:
  - El formato del dominio, incluidos casos inválidos como `javascript:` o con ruta.
  - La API caída o lenta.
  - La redirección de sesión.
  - La idempotencia.
  - Los rechazos.
  - Los cambios sin guardar ajenos.
  - El rollback si falla el build.
- **Next 16.3.8, mini admin con tus 2 archivos ya parchados:** la función nueva consulta la API pública real con el municipio Carbó.
  - Aparece "Ver sitio público · carbotransparencia.com.mx", con enlace `https://carbotransparencia.com.mx`, en pestaña nueva y con `rel="noopener noreferrer"`.
  - También aparece en el cajón del celular.
  - Con la API caída, el panel carga igual y el enlace no aparece.
- **Dominios:** el formato aceptado coincide con el dominio real de los 15 municipios.

## Lo que no se pudo ver

El admin real está detrás de Cloudflare Access. `src/lib/api.js` completo y `getCurrentUser` no se tenían: la función usa solo `apiFetch` y `getMunicipioSlug`, que existen en ese archivo, y el script se detiene si no los encuentra. Falta que el operador confirme a la vista el enlace en el panel.
