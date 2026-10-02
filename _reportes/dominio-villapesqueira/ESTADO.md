# Dominio propio de Villa Pesqueira: `villapesqueiratransparencia.com.mx`

> Revisión del 2 de octubre de 2026, 19:16 UTC (12:16 en Sonora). Todo se revisó desde fuera, con curl y DNS sobre HTTPS. No tengo acceso a las cuentas de Akky, Cloudflare ni Vercel: el conector de Vercel de esta sesión entra con la cuenta personal `r0b3rt0g1l` y el equipo `northa-digital` le responde **403** ("must re-authenticate to this scope").

## Lo que ya está bien

| Qué | Resultado | Desde |
|---|---|---|
| El dominio existe en `.mx` | ✔ | 18:52:58 UTC |
| Nameservers | ✔ `gabriella.ns.cloudflare.com`, `vern.ns.cloudflare.com` | 18:52:58 UTC |
| `A @` | ✔ `76.76.21.21` | 18:49:55 UTC |
| `CNAME www` | ✔ `cname.vercel-dns.com` | 18:54:00 UTC |
| `https://villapesqueiratransparencia.com.mx/` | ✔ **200**, certificado válido (vence el 31 dic 2026), título "Inicio · Municipio de Villa Pesqueira" | 19:10:23 UTC |
| `http://` → `https://` | ✔ 308 | |
| `/transparencia/sevac`, `/contacto`, `/gobierno/cabildo` | ✔ 200 | |
| `/api/revalidate` en el dominio nuevo | ✔ existe (401 sin el secreto) | |

El `DNS_PROBE_FINISHED_NXDOMAIN` que ve el usuario es **caché de DNS de su Mac o de su red**: la consultó antes de que el dominio existiera (antes de las 18:52 UTC) y guardó la respuesta "no existe". Desde fuera, el dominio resuelve.

## Lo que falta (3 problemas)

| # | Problema | Evidencia | Efecto | Arreglo |
|---|---|---|---|---|
| 1 | **`villapesqueira.vercel.app` ya no existe** y el CMS sigue apuntando ahí | `x-vercel-error: DEPLOYMENT_NOT_FOUND` (404). La API devuelve `dominio: "villapesqueira.vercel.app"` | El backend avisa los cambios con `POST https://${dominio}/api/revalidate` → hoy da 404. **Lo que se cargue en el panel no se ve en la web** hasta que caduque la caché (≈1 h). El enlace "Ver sitio público" del admin lleva a una página de error | `fijar-dominio.mjs --forzar` (abajo). Además, volver a agregar `villapesqueira.vercel.app` en Vercel como redirección 307 |
| 2 | **`www` no está agregado en Vercel** | Con `www.` Vercel entrega el certificado de la raíz: "subjectAltName does not match www…" | `https://www.villapesqueiratransparencia.com.mx` da error de certificado | Vercel → Settings → Domains → agregar `www…` con redirección 308 |
| 3 | **`siteUrl` sigue con el dominio provisional** | `<link rel="canonical" href="https://villapesqueira.vercel.app"/>`; el sitemap también | Google indexaría una dirección que hoy da 404 | Cambiar `servicios.siteUrl` en `lib/municipalConfig.js` del portal |

La causa probable del problema 1: al agregar el dominio nuevo en Vercel se quitó (o se editó) la entrada `villapesqueira.vercel.app` **antes** de cambiar `Municipio.dominio`. La guía ya advierte el orden correcto (ver `GUIA_DOMINIO_CLOUDFLARE_AKKY.md`, paso 4).

En la flota, `<slug>.vercel.app` sigue respondiendo 200 (Bacadehuachi, Carbó y Sahuaripa) y `www` también. Villa Pesqueira es la excepción.

CORS no es un factor: la API no envía `Access-Control-Allow-Origin` a ningún origen (tampoco a Carbó), y el portal no llama a la API desde el navegador.

## Comandos para el operador

**1. Base de datos (lo más urgente):**

```bash
cd ~/Developer/cmsmunicipal
curl -fsSL -o ~/Developer/_herramientas/fijar-dominio.mjs https://raw.githubusercontent.com/r0b3rt0g1l/Northa-Digital/35a82d94b584685a0ff1ec7075b02bd9471dc582/para-cmsmunicipal/scripts/lotes-db/fijar-dominio.mjs
node --env-file=.env ~/Developer/_herramientas/fijar-dominio.mjs --slug villapesqueira --dominio villapesqueiratransparencia.com.mx --forzar
# si dice "PRUEBA EN SECO" y el cambio es el esperado:
node --env-file=.env ~/Developer/_herramientas/fijar-dominio.mjs --slug villapesqueira --dominio villapesqueiratransparencia.com.mx --forzar --aplicar
```

Archivo verificado: idéntico al del repo y con sus 6 pruebas en verde.

**2. Vercel** (proyecto del portal → Settings → Domains):
- Add `www.villapesqueiratransparencia.com.mx` → Redirect to `villapesqueiratransparencia.com.mx` → 308.
- Add `villapesqueira.vercel.app` → Redirect to `villapesqueiratransparencia.com.mx` → 307.

**3. Portal (`siteUrl`):**

```bash
cd ~/Developer/Villapesqueira && git switch main && git pull --ff-only && grep -rn "villapesqueira.vercel.app" app lib components public 2>/dev/null
```

Si solo aparece `lib/municipalConfig.js`:

```bash
sed -i '' 's#https://villapesqueira\.vercel\.app#https://villapesqueiratransparencia.com.mx#g' lib/municipalConfig.js && ! grep -n "villapesqueira.vercel.app" lib/municipalConfig.js && git diff --stat && npm run build && git commit -m "Dominio propio: siteUrl = https://villapesqueiratransparencia.com.mx" -- lib/municipalConfig.js && git push
```

**4. Mac del operador:** `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`, y en Chrome `chrome://net-internals/#dns` → *Clear host cache*.

## Pendiente con autorización

- `scripts/flota/flota.config.json` (cmsmunicipal): poner el dominio. Solo afecta a los scripts de verificación, no a la web. Requiere push a `main` de cmsmunicipal, que redespliega Render → **solo con autorización explícita**.
- northa-landing: agregar Villa Pesqueira **solo con el OK** del usuario (ya tiene dominio propio).
