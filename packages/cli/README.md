# @argus-isolator/cli

> Instalación: `npm install -g @argus-isolator/cli`. Alternativas en [Instalar las SDK](../../README.md#instalar-las-sdk).

Sube los source maps de tu build a Sentinel para que los errores muestren el código original.

```bash
sentinel-cli sourcemaps upload ./dist --release 1.4.0
```

Configuración (opción o variable de entorno):

| Opción | Variable | Descripción |
|---|---|---|
| `--release` | `SENTINEL_RELEASE` | Versión del build; debe coincidir con la `release` del SDK |
| `--url` | `SENTINEL_URL` | Origen de la API de Sentinel |
| `--token` | `SENTINEL_AUTH_TOKEN` | Token de API de la organización (se crea en la UI) |
| `--org` | `SENTINEL_ORG` | Id de la organización |
| `--project` | `SENTINEL_PROJECT` | Id del proyecto |
| `--url-prefix` | | Ruta pública de los archivos (por defecto `~/`, la raíz del sitio) |
| `--dry-run` | | Muestra qué se subiría, sin subir nada |

- Sube cada `*.map` del directorio (ignora `node_modules`). `dist/assets/app.3f2a.js.map` se guarda como `~/assets/app.3f2a.js`,
  y se aplica a cualquier origen (producción, staging, CDN).
- **Súbelos antes de desplegar**: solo se simbolizan los eventos que llegan después de la subida.
- Reintenta los errores de red y los 5xx. Códigos de salida: `0` bien, `1` falló alguna subida, `2` uso incorrecto.
- No publiques los `.map` en tu servidor si no quieres exponer tu código: Sentinel no los necesita allí.
