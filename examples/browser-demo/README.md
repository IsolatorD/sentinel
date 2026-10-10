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

Míralo en **Rendimiento** dentro del proyecto. Para ver datos de ejemplo sin abrir la demo: `pnpm seed:demo` (o `node examples/seed/seed.mjs --only transactions`).
