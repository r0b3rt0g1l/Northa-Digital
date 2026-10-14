# Reporte mensual del asistente ciudadano

Paquete listo para copiarse al repositorio canónico de la flota (Baviácora) y propagarse con `flota`. Guarda cada conversación del asistente y, el día 1 de cada mes, genera un reporte con resumen y transcripciones que se envía por correo a los administradores del municipio y queda disponible para el panel del CMS.

Todo lo que está aquí se escribió sin acceso al código del CMS, así que los archivos de `lib/asistente/reporte/` son autocontenidos y probados, y los puntos de contacto con el código existente están marcados como `TODO(integración)`.

## Qué contiene

| Ruta | Qué hace | Estado |
|---|---|---|
| `supabase/migrations/20261014_asistente_reportes.sql` | Tablas `conversaciones`, `mensajes`, `reportes`, índices, trigger y RLS | Listo |
| `lib/asistente/reporte/tipos.ts` | Tipos del reporte | Listo |
| `lib/asistente/reporte/periodo.ts` | Mes anterior, rango del mes y fechas en hora de Sonora (UTC-7 fijo) | Listo, probado |
| `lib/asistente/reporte/generar.ts` | Métricas, temas, por día y transcripciones. Función pura | Listo, probado |
| `lib/asistente/reporte/plantilla.ts` | HTML del reporte con escudo y color del municipio, apto para correo | Listo, probado |
| `lib/asistente/reporte/almacen.ts` | Acceso a Supabase vía PostgREST con `fetch`, sin dependencias | Listo, probado |
| `lib/asistente/reporte/registro.ts` | `registrarTurno` y `registrarEscalamiento`; nunca rompen el chat | Listo, probado |
| `lib/asistente/reporte/ejecutar.ts` | Orquesta generar → guardar → enviar → purgar (12 meses) | Listo, probado |
| `app/api/asistente/reporte/route.ts` | Endpoint para Vercel Cron (GET) y para el panel (POST `?periodo=`) | Requiere integración |
| `vercel.cron.json` | Fragmento de cron mensual para `vercel.json` | Listo |

Pruebas: `npx tsx --test lib/asistente/reporte/*.test.ts` (16 pruebas). En el canónico, usar el registrador de `lib/asistente/pruebas/`.

## Integración en el canónico

1. **Base de datos.** Crear un proyecto Supabase para la flota (uno solo; cada fila lleva `municipio`) y aplicar la migración. Guardar en cada proyecto de Vercel:
   - `ASISTENTE_SUPABASE_URL`
   - `ASISTENTE_SUPABASE_SERVICE_KEY` (service role; solo se usa en el servidor)
   - `CRON_SECRET` (Vercel lo manda en el header del cron)
2. **Registrar los turnos.** En `lib/asistente/atender.ts`, después de obtener la respuesta del asistente:
   ```ts
   import { registrarTurno } from "@/lib/asistente/reporte/registro";
   const conversacionId = await registrarTurno({
     conversacionId: entrada.conversacionId,   // lo manda el cliente a partir del 2.º turno
     municipio: municipalConfig.slug,
     correoCiudadano: entrada.correo ?? null,
     pregunta: entrada.texto,
     respuesta: respuesta.texto,
     secciones: respuesta.fuentes?.map((f) => f.seccion) ?? [],
   });
   // devolver conversacionId en la respuesta para que el cliente lo reenvíe
   ```
   En `lib/asistente/escalamiento.ts`, al escalar: `await registrarEscalamiento(conversacionId)`.
   El componente `components/contacto/asistente/Conversacion.tsx` guarda `conversacionId` en estado y lo incluye en cada `POST /api/asistente/mensaje`.
3. **Aviso de privacidad.** En `lib/asistente/textos.ts`, agregar al saludo inicial: "Esta conversación se guarda para dar seguimiento y mejorar la atención."
4. **Correo.** En `app/api/asistente/reporte/route.ts`, ajustar `enviarCorreo` a la firma real de `lib/asistente/envio.ts`.
5. **Destinatarios.** En `lib/municipalConfig.js`, agregar:
   ```js
   asistente: { reportes: { destinatarios: ["presidencia@municipio.gob.mx"] } },
   ```
   Si no existe, el endpoint usa `contacto.correo`.
6. **Cron.** Fusionar `vercel.cron.json` en `vercel.json`.
7. **Panel del CMS: sección "Reportes del asistente".** Página nueva siguiendo el patrón de las secciones existentes del admin. Datos con `almacen.listarReportes(slug)` y `almacen.obtenerReporte(slug, periodo)`; mostrar `html` en un `iframe` con `srcDoc`, botón "Descargar JSON" (`json`) y "Reenviar por correo" (POST al endpoint con `?periodo=`). Hereda la autenticación del panel.
8. **Receta de flota.** Crear `scripts/flota/recetas/reporte-mensual-asistente.mjs` en `cmsmunicipal` que copie los archivos nuevos y parche `atender.ts`, `escalamiento.ts`, `textos.ts`, `municipalConfig.js` y `vercel.json`.

## Verificación

1. `npx tsx --test lib/asistente/reporte/*.test.ts`.
2. Local: chatear con el asistente y ver filas en `conversaciones` y `mensajes`.
3. `curl -X POST -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/asistente/reporte?periodo=2026-09"` devuelve `{ ok: true, ... }`, crea la fila en `reportes` y llega el correo.
4. En producción, disparar el cron desde el panel de Vercel y revisar el correo del administrador.
