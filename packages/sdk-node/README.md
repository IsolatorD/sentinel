# @sentinel/node

> Instalación (las SDK aún no están en npm): ver [Instalar las SDK](../../README.md#instalar-las-sdk).

SDK de Sentinel para Node.js (20 o superior). Captura los errores, mide cada petición que atiende tu servidor y **continúa las trazas que empiezan en el navegador**.

- Sin dependencias en tiempo de ejecución. ESM y CommonJS.
- Nunca lanza ni rompe tu aplicación.
- Funciona con cualquier framework basado en `http`/`https`: Express, Fastify, Nest, Koa...

## Uso

```ts
import * as Sentinel from "@sentinel/node";

// Antes de crear el servidor: así se miden también sus peticiones.
Sentinel.init({
	dsn: "https://<clave>@sentinel.example.com/<projectId>",
	release: "1.4.2",
	environment: "production",
	tracesSampleRate: 1, // opcional: activa el rendimiento
});

// Al apagar, envía lo pendiente.
process.on("SIGTERM", async () => {
	await Sentinel.close();
	process.exit(0);
});
```

## Qué hace solo

- **Errores del proceso**: captura `uncaughtException` (nivel `fatal`) y `unhandledRejection`. Tras una excepción no controlada envía lo pendiente y termina con código 1, como haría Node sin handler (si tu app tiene su propio `uncaughtException`, decides tú). Una promesa rechazada se registra y se avisa por consola; con `unhandledRejection: "strict"` se relanza como excepción, y con `"none"` solo se captura.
- **Peticiones que atiende el servidor** (con `tracesSampleRate > 0`): una transacción `http.server` por petición, nombrada `GET /users/:id` (los ids numéricos, UUID y hexadecimales largos se sustituyen por `:id`, para no crear una transacción por cada id). Un 5xx marca la transacción como fallida; un 4xx no. Si la petición trae `traceparent`, **continúa esa traza** (mismo `trace_id`, con el span del llamador como padre) y respeta su decisión de muestreo.
- **Peticiones salientes**: un span `http.client` por cada petición hecha con `http`, `https` o `fetch` (axios, got, node-fetch...). La cabecera `traceparent` solo se añade a las URLs de `tracePropagationTargets` (por defecto a ninguna: no se le cuentan tus trazas a terceros).
- **Contexto en los errores**: un error capturado durante una petición lleva la petición (ruta sin query y user-agent) y el `trace_id` de su transacción, para saltar del error a su traza.
- **Breadcrumbs**: consola y peticiones salientes.

Cada petición tiene su propia transacción aunque haya miles en paralelo (se usa `AsyncLocalStorage`).

## API

| Función | Descripción |
|---|---|
| `init(options)` | Inicializa el SDK. Con una DSN inválida queda desactivado, sin lanzar. |
| `captureException(error, hint?)`, `captureMessage(texto, nivel?)` | Envían un error o un mensaje. |
| `addBreadcrumb()`, `setUser()`, `setTag()`, `setTags()`, `setContext()`, `setExtra()` | Datos que acompañan a los eventos siguientes. |
| `trace(op, descripción, fn)` | Mide una función (síncrona o async) como un span de la transacción en curso; marca error si lanza. |
| `startSpan(op, descripción?)` | Span manual: termina con `span.end()`. |
| `startTransaction({ name, op })` | Transacción manual (un trabajo en segundo plano, un job). Termina con `finish()`. |
| `runTransaction(ctx, fn)` | Como `startTransaction`, pero solo es "la en curso" dentro de `fn`: útil para medir varios trabajos a la vez. |
| `getActiveTransaction()` | La transacción en curso (p. ej. la de la petición), para renombrarla o etiquetarla. |
| `flush(ms?)`, `close(ms?)` | Esperan los envíos pendientes; `close` además quita la instrumentación. |

### Express

```ts
app.use(Sentinel.expressRequestHandler()); // nombra la transacción con la ruta (`GET /api/users/:id`)
// ...tus rutas...
app.use(Sentinel.expressErrorHandler()); // captura los errores (los 4xx no)
```

### Fastify (y Nest con el adaptador de Fastify)

```ts
Sentinel.setupFastify(app); // nombra la transacción con la ruta registrada y captura los errores 5xx
```

### Un trabajo en segundo plano

```ts
await Sentinel.runTransaction({ name: "enviar-resumen-diario", op: "task" }, async (tx) => {
	await Sentinel.trace("db.query", "cargar usuarios", () => loadUsers());
	await Sentinel.trace("email", "enviar", () => send());
	tx.finish();
});
```

## Opciones de `init`

| Opción | Por defecto | |
|---|---|---|
| `dsn` | — | Obligatoria. |
| `release`, `environment` | — | Para filtrar y detectar regresiones. |
| `sampleRate` | `1` | Fracción de eventos que se envían. |
| `tracesSampleRate` | `0` | Fracción de transacciones que se registran. Con 0 el rendimiento está apagado. |
| `tracing` | todo | `false`, o `{ server, http }` para elegir qué se mide solo. |
| `tracePropagationTargets` | ninguna | URLs (string o RegExp) a las que se añade `traceparent`. |
| `transactionName({ method, path })` | — | Nombre de las transacciones del servidor; `undefined` usa el de por defecto. |
| `captureGlobalErrors` | `true` | Captura `uncaughtException` y `unhandledRejection`. |
| `exitOnUncaughtException` | `true` | Termina el proceso tras una excepción no controlada (con tiempo para enviar). |
| `unhandledRejection` | `"warn"` | `"warn"`, `"strict"` o `"none"`. |
| `shutdownTimeoutMs` | `2000` | Cuánto esperar a enviar lo pendiente antes de terminar. |
| `breadcrumbs` | todos | `false`, o `{ console, http }`. |
| `maxSpans` | `100` | Máximo de spans por transacción. |
| `ignoreErrors`, `beforeSend`, `beforeSendTransaction`, `tags`, `user`, `enabled`, `debug` | — | Igual que en el SDK del navegador. |

## Cómo envía

`POST <host>/api/<projectId>/events` (errores) y `/transactions` (rendimiento), con la clave en `X-Sentinel-Key`, con reintentos y pausa ante un 429. Los datos sensibles (cabeceras `authorization`, tokens en URLs, contraseñas...) los filtra el servidor antes de guardar, y el SDK nunca envía la query de las URLs ni las cabeceras de la petición, salvo el `user-agent`.

## Limitaciones

- Las peticiones salientes se miden con `http`, `https` y `fetch`; los clientes que usan otro mecanismo (p. ej. `http2`) no generan spans.
- No hay medición automática de consultas a bases de datos: usa `trace("db.query", ...)`.

## Desarrollo

```bash
pnpm --filter @sentinel/node build
pnpm --filter @sentinel/node test
```

Los tests levantan servidores `http` reales en `localhost` (incluidos dos que se llaman entre sí para comprobar la continuación de la traza) y validan cada evento y transacción contra los esquemas reales del backend.
