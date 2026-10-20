# Demo del SDK de navegador

Página mínima con botones que provocan cada tipo de error, para ver cómo llegan al backend.

```bash
pnpm infra:up && pnpm db:migrate
pnpm build
pnpm dev                                   # api (3000) y worker
node examples/browser-demo/serve.mjs       # demo en http://localhost:5500
```

1. Crea un usuario, una organización y un proyecto (ver `/api/docs`) y copia la DSN del proyecto.
2. Abre `http://localhost:5500/?dsn=<tu DSN>` y pulsa **Inicializar SDK**.
3. Pulsa los botones y mira los issues que se forman en la base de datos (`issue` y `event`).

Los frames de la pila apuntan a `demo.js` con su línea real, y los 5 errores del botón de agrupación se unen en un único issue.

## Rendimiento

La demo inicia el SDK con `tracesSampleRate: 1`, así que además de errores mide:

- la **carga de página** (con FCP, LCP, CLS, INP y TTFB) y las **navegaciones** (`Navegar…`);
- cada `fetch` como un span `http.client`, con la cabecera `traceparent` si es del mismo origen;
- tus propias operaciones con `Sentinel.startTransaction` y `Sentinel.trace` (botón *Medir una operación*).

### Una traza que cruza al backend

Con `examples/node-demo` (un servidor con `@argus-isolator/node`) la traza empieza en el navegador y continúa en el servidor:

```bash
pnpm build                                          # compila los SDK
node examples/node-demo/server.mjs --dsn <tu DSN>   # backend en http://localhost:5601
```

Hay uno equivalente en Python (Flask + `sentinel-sdk`):

```bash
pnpm --filter @sentinel/python setup                # crea el entorno virtual la primera vez
packages/sdk-python/.venv/bin/python examples/python-demo/server.py --dsn <tu DSN>   # http://localhost:5602
```

Pulsa **Llamar al backend Node** (o **…Python**): el SDK del navegador añade `traceparent` a la petición (`tracePropagationTargets`), el servidor continúa esa traza y las dos transacciones quedan con el mismo `trace_id`. Cada una se ve en **Rendimiento** con sus spans.

Míralo en **Rendimiento** dentro del proyecto. Para ver datos de ejemplo sin abrir la demo: `pnpm seed:demo` (o `node examples/seed/seed.mjs --only transactions`).
