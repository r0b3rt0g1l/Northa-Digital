# Guía: conectar el dominio propio de un municipio (Akky, Cloudflare y Vercel)

> **Destino:** `cmsmunicipal/docs/GUIA_DOMINIO_CLOUDFLARE_AKKY.md`.
>
> **Origen:** la configuración DNS real de 7 municipios de la flota, revisada el 1 de octubre de 2026 (Carbó, Cucurpe, Mazatán, Bacanora, Baviácora, San Javier y Huachinera). Es la misma en todos. Las pantallas de Akky, Cloudflare y Vercel no las pude ver; si un botón se llama distinto, busca el equivalente.
>
> **Ejemplo de esta guía:** Villa Pesqueira con `villapesqueiratransparencia.com.mx`, el nombre que sigue el patrón de la flota (`<municipio>transparencia.com.mx`). El 1 de octubre de 2026 ese nombre no existía en DNS, así que probablemente está libre. Confírmalo en Akky al comprar.

---

## El patrón de la flota (verificado)

| Qué | Valor en todos los municipios |
|---|---|
| Registrador | Akky (dominios `.com.mx`) |
| Nameservers (en Akky) | Cloudflare: `gabriella.ns.cloudflare.com` y `vern.ns.cloudflare.com` |
| Registro `A` de la raíz (`@`) | `76.76.21.21` (Vercel), **sin proxy** (nube gris, "DNS only") |
| Registro `CNAME` de `www` | `cname.vercel-dns.com`, **sin proxy** |
| Correo (MX), TXT, CAA | Ninguno |
| Certificado HTTPS | Lo emite Vercel solo |
| Redirecciones (como Baviácora, el único que lo tiene bien) | `www` → dominio sin `www` con **308**; `<slug>.vercel.app` → dominio con **307** |

Los registros son "DNS only" porque, si Cloudflare los tuviera en proxy (nube naranja), las direcciones serían de Cloudflare y no de Vercel. En los 7 dominios apuntan directo a Vercel.

---

## Orden de los pasos

```
1. Akky: comprar el dominio
2. Cloudflare: agregar el dominio y sus 2 registros → te da 2 nameservers
3. Akky: poner esos 2 nameservers
4. Vercel: agregar el dominio al proyecto del portal y las redirecciones
5. Esperar a que Cloudflare diga "Active" y Vercel diga "Valid Configuration"
6. Código del portal: siteUrl
7. CMS: Municipio.dominio y flota.config.json
8. Verificación (Claude)
```

### 1. Akky: comprar

Compra `villapesqueiratransparencia.com.mx` (o el nombre que acuerdes). No configures nada más ahí todavía.

### 2. Cloudflare: agregar el dominio

1. En la misma cuenta de Cloudflare de los demás municipios: **Add a domain** (o *Add site*), escribe `villapesqueiratransparencia.com.mx` y elige el plan **Free**.
2. Si encuentra registros, bórralos. En **DNS → Records** deja **solo estos dos**:

   | Type | Name | Content | Proxy status | TTL |
   |---|---|---|---|---|
   | `A` | `@` | `76.76.21.21` | **DNS only** (nube gris) | Auto |
   | `CNAME` | `www` | `cname.vercel-dns.com` | **DNS only** (nube gris) | Auto |

3. Continúa hasta que Cloudflare te muestre **los 2 nameservers** que debes poner en el registrador. En la flota han sido `gabriella.ns.cloudflare.com` y `vern.ns.cloudflare.com`, pero **usa exactamente los que te muestre Cloudflare**.

### 3. Akky: cambiar los nameservers

1. **Mis dominios** → `villapesqueiratransparencia.com.mx` → la opción de **DNS / servidores de nombres**.
2. Elige usar **otros servidores** (no los de Akky), pega los 2 nameservers de Cloudflare y quita cualquier otro que haya.
3. Guarda. El cambio en `.mx` suele tardar de minutos a unas horas, aunque puede llegar a 24-48 horas. Cloudflare avisa por correo cuando el dominio queda **Active**.

### 4. Vercel: agregar el dominio al proyecto

En el proyecto del portal (repo `NorthaDigital/Villapesqueira`) → **Settings → Domains**:

1. Agrega `villapesqueiratransparencia.com.mx`, que será el dominio principal.
2. Agrega `www.villapesqueiratransparencia.com.mx` con **Redirect to** `villapesqueiratransparencia.com.mx` (**308**).
3. **Al final, cuando el dominio ya tenga candado (HTTPS),** edita `villapesqueira.vercel.app` y ponle **Redirect to** `villapesqueiratransparencia.com.mx` (**307**), como en Baviácora.

Si Vercel muestra "Invalid Configuration" y te propone otros valores (en 2025 Vercel empezó a recomendar `216.198.79.1` y CNAME del tipo `xxxx.vercel-dns-0xx.com`), **usa los que te muestre Vercel**. Los de la flota (`76.76.21.21` y `cname.vercel-dns.com`) siguen funcionando.

### 5. Esperar a que todo esté en verde

- Cloudflare: el dominio en **Active**.
- Vercel: los dos dominios en **Valid Configuration**, con certificado emitido.

Comprobación desde tu Mac:

```bash
dig +short NS villapesqueiratransparencia.com.mx && dig +short A villapesqueiratransparencia.com.mx && dig +short CNAME www.villapesqueiratransparencia.com.mx
```

Lo esperado: los 2 nameservers de Cloudflare, `76.76.21.21` y `cname.vercel-dns.com.`.

### 6. Código del portal: `siteUrl`

`servicios.siteUrl` (en `lib/municipalConfig.js`) alimenta el canonical, el sitemap, robots.txt y las imágenes para redes sociales. En Carbó vale `https://carbotransparencia.com.mx`. Primero hay que ver dónde aparece el dominio provisional:

```bash
cd ~/Developer/Villapesqueira && grep -rn "villapesqueira.vercel.app" app lib components public 2>/dev/null
```

Pega la salida y te doy el cambio exacto. Lo normal es que sea una sola línea en `lib/municipalConfig.js`. Después: build, commit y unir a `main`, como con la historia.

### 7. CMS: registrar el dominio

- **`Municipio.dominio`** = `villapesqueiratransparencia.com.mx`, sin `https://` ni `www`, como en los demás. Tu checklist dice que esto se hace con `alta-municipio.js` ("conectar dominio"). Pégame la salida de `node scripts/herramienta-alta/alta-municipio.js --help` y te doy el comando exacto.
- **`scripts/flota/flota.config.json`:** la entrada de Villa Pesqueira se agregó "sin dominio propio todavía". Hay que ponerle el dominio igual que las demás.
- **northa-landing:** agregarlo solo con tu OK.

### 8. Verificación (la hago yo)

```bash
node scripts/verificacion/verificar-alta.mjs villapesqueira --nombre "Villa Pesqueira" --portal https://villapesqueiratransparencia.com.mx --esperar-texto "Facebook oficial"
node scripts/verificacion/barrido-portal.mjs --portal https://villapesqueiratransparencia.com.mx --slug villapesqueira
```

Además reviso: HTTPS con certificado válido; que `www` redirija con 308 y `villapesqueira.vercel.app` con 307; y que el canonical y el sitemap ya usen el dominio nuevo.

---

## Errores comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Vercel dice "Invalid Configuration" durante horas | Los nameservers en Akky no son los de Cloudflare, o todavía no propagan | Revisa el paso 3 con `dig +short NS …` |
| El sitio responde con un certificado de Cloudflare o hay redirecciones infinitas | Los registros quedaron con la nube naranja (proxy) | Ponlos en **DNS only** (gris) |
| `www` no carga | Falta el CNAME de `www` en Cloudflare o falta agregar `www` en Vercel | Pasos 2 y 4 |
| El buscador muestra `villapesqueira.vercel.app` | `siteUrl` sigue con el dominio provisional | Paso 6 |
