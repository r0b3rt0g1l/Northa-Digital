# Northa-Digital

Reportes y herramientas de operación de la flota de portales municipales (`cmsmunicipal`, `cms-admin` y un portal por municipio).

| Carpeta | Contenido |
|---|---|
| `_reportes/` | Reportes de estado por municipio, con línea base (texto y capturas) para comparar antes y después de cada cambio |
| `para-cmsmunicipal/docs/` | Documentos que se **copian** a `cmsmunicipal/docs/`: plan de replicación y problemas conocidos de la flota |
| `para-cmsmunicipal/scripts/verificacion/` | Scripts de solo lectura (Node 18 o superior, sin dependencias) que se **copian** a `cmsmunicipal/scripts/verificacion/`: verificación post-alta, aislamiento público, medición de publicación y barrido de restos de otros municipios |
| `para-cmsmunicipal/scripts/herramienta-alta/` | `derivar-plantillas.mjs`, que se **copia** a `cmsmunicipal/scripts/herramienta-alta/` |

Para copiarlos, desde la raíz de este repo:

```bash
cp -R para-cmsmunicipal/docs/. ~/Developer/cmsmunicipal/docs/
cp -R para-cmsmunicipal/scripts/. ~/Developer/cmsmunicipal/scripts/
```

Para correr las pruebas:

```bash
node --test para-cmsmunicipal/scripts/*/*.test.mjs   # funciona en Node 18, 20 y 22 (desde Node 21, pasar una carpeta ya no sirve)
```

Por qué viven aquí: la sesión que los generó solo tenía acceso a este repositorio, no a `NorthaDigital/cmsmunicipal`.
