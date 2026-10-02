# Cabildo con detalle y enlace "Ver sitio público" en el admin: estado

Código y detalle técnico: `para-portales/cabildo-detalle/LEEME.md` y `para-portales/admin-sitio-publico/LEEME.md`.

## Cabildo: al dar clic en una persona se abre su detalle (2 de octubre de 2026)

Aplicado en los 14 portales con personas cargadas (Carbó primero, como piloto, y después los otros 13). Villa Pesqueira también quedó aplicado. Todavía no tiene personas en el panel, así que en cuanto las suban serán clicables.

| Comprobación | Resultado |
|---|---|
| Botones en el Cabildo (15 portales, producción) | Cada persona que muestra el Cabildo es un botón "Ver detalles de…". Antes había 0 en los 15. **0 tarjetas sin clic** |
| Clic real en el navegador (14 portales con personas) | En todos se abre la ventana de la última persona de la lista, con nombre, cargo y administración, y se cierra con Escape. Sin errores de JavaScript |
| Carbó (piloto) | Presidenta, síndico y regidora abren con nombre, cargo, administración y teléfono |
| Directorio | Sigue con sus botones igual que antes |

### Observación sobre Soyopa (ya existía)

En el panel de Soyopa hay **dos registros de Presidente**: C. Paulette Encinas Miranda (orden 1) y C. Nereida Encinas Miranda (orden 12, creado el 30 de junio). El portal muestra uno solo, como siempre. Eso no lo causa este cambio. Si el segundo registro sobra, hay que eliminarlo o desactivarlo en el panel; si es otra persona, hay que ver con quién queda el cargo.

## Admin: enlace "Ver sitio público"

- **Aplicado y subido.** Commit `0bf701c` en `NorthaDigital/cms-admin`.
- **Pendiente de confirmar a la vista:** el admin está detrás de Cloudflare Access y no se puede revisar desde fuera.
- Los 15 municipios tienen un dominio válido en la base de datos, así que cada uno verá el suyo.
