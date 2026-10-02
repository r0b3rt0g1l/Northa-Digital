# Cabildo: detalle al dar clic en cada persona

**Pedido del operador, 2 de octubre de 2026:** en Gobierno / Directorio, al dar clic en una persona se abre una ventana con sus datos. En Gobierno / Cabildo no pasaba nada. Se implementa lo mismo en el Cabildo, en los 15 municipios.

## Causa

`components/gobierno/Organigrama.jsx` ya sabe abrir el detalle: si recibe `onSelect`, cada tarjeta es un botón accesible; si no, es una tarjeta sin acción.

- **Directorio** usa `DirectorioOrganigrama.jsx`, que guarda la persona seleccionada y pasa `onSelect`.
- **Cabildo** usaba `<Organigrama … />` directo, sin `onSelect`.

En producción, la página de Cabildo tenía 0 botones en los 15 portales.

## Qué cambia

| Archivo | Cambio |
|---|---|
| `components/gobierno/CabildoOrganigrama.jsx` (nuevo) | Igual que `DirectorioOrganigrama.jsx`, pero para el Cabildo: Presidencia, Sindicatura y Regidurías, con `onSelect` y `PersonDetailModal`. |
| `app/(con-footer)/gobierno/cabildo/page.js` | Importa y usa `CabildoOrganigrama` en lugar de `Organigrama`, con las mismas props. Solo cambian 2 líneas. |

No se toca `Organigrama.jsx` ni `PersonDetailModal.jsx`. La ventana ya conoce el tipo `regidor` (etiqueta "Regiduría") y ya muestra "Foto pendiente" y "Datos de contacto pendientes de publicación oficial" cuando falta algo.

## Revisado en los 15 portales (producción, 2 de octubre de 2026)

- El código de `Organigrama` es **idéntico** en los 15 y todos aceptan `onSelect`.
- En los 15, la página de Cabildo le pasa `presidente`, `sindica` y `regidores`.
- La ventana de detalle es igual en 12 portales. En Banámichi, Baviácora y Huachinera cambia solo el texto cuando falta un nombre ("Información en actualización" en vez de "Por designar"), y eso no se toca.
- Villa Pesqueira todavía no tiene personas cargadas (0 en la API): el Cabildo mostrará su aviso actual hasta que las suban, y entonces ya serán clicables.

## Uso

```
node aplicar-cabildo-detalle.mjs --dry-run ~/Developer/Carbo
node aplicar-cabildo-detalle.mjs --build --commit --push ~/Developer/Carbo
```

- **Todo o nada por repo:**
  - No toca un repo si la página, el organigrama o el modal no son como el molde, y dice qué no coincidió.
  - Si falla el build, deja el repo como estaba.
  - Solo lo frenan los cambios sin guardar en los archivos que toca.
- **Commit:** solo con los 2 archivos del cambio.

## Comprobado

- **`npm test`:** 10 pruebas sobre el código real de la página de Cabildo, `Organigrama` y `DirectorioOrganigrama`. Cubren el resultado, la idempotencia, los rechazos, los cambios sin guardar ajenos, el rollback si falla el build y el commit con solo 2 archivos.
- **Next 16.3.8 con Tailwind:** se compiló un portal de prueba con el código real, usando los datos reales de Carbó (presidenta, síndico y 5 regidores). En el navegador:
  - Las 7 tarjetas son botones ("Ver detalles de…") y abren el detalle con el nombre y el cargo.
  - Se cierran con Escape y con el botón Cerrar. Se abren con el teclado (Enter) y con un toque en el celular.
  - Un segundo clic abre a otra persona.
  - Directorio sigue funcionando.
  - Sin errores en la consola.
- **Reemplazos solo para pruebas:** `PersonDetailModal`, `lib/cabildo` y `useReducedMotion` no se tenían en este repo y se reemplazaron por versiones mínimas con la misma firma.

## Detalle que ya existía en el Directorio (no lo introduce este cambio)

Al cerrar la ventana, el foco no regresa a la tarjeta que se tocó, porque el modal no tiene un disparador asociado. Cabildo se comporta igual que Directorio.
