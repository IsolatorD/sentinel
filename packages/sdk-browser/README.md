# @sentinel/browser

SDK de Sentinel para navegadores. Captura errores y los envía a un servidor Sentinel.

- Sin dependencias en tiempo de ejecución. ~11 KB comprimido (bundle para `<script>`).
- Nunca lanza ni rompe la app anfitriona.
- Privacidad por defecto: no envía el texto de los elementos clickeados y quita la query y el hash de las URLs.

## Uso

```ts
import * as Sentinel from "@sentinel/browser";

Sentinel.init({
	dsn: "https://<clave>@sentinel.example.com/<projectId>",
	release: "1.4.2",
	environment: "production",
});
```

Con `<script>` (expone el global `Sentinel`):

```html
<script src="sentinel.min.js"></script>
<script>Sentinel.init({ dsn: "..." });</script>
```

Con solo llamar a `init`, el SDK captura `window.onerror` y `unhandledrejection` y registra breadcrumbs (consola, clicks, `fetch`, XHR y navegación).

## API

| Función | Descripción |
|---|---|
| `init(options)` | Inicializa el SDK. Con una DSN inválida queda desactivado, sin lanzar. |
| `captureException(error, hint?)` | Envía un error. Acepta cualquier valor (Error, string, objeto) y respeta `error.cause`. Devuelve el id del evento. |
| `captureMessage(texto, nivel \| hint?)` | Envía un mensaje. |
| `addBreadcrumb({ category, message, data })` | Agrega un breadcrumb manual. |
| `setUser(user \| null)`, `setTag(k, v)`, `setTags()`, `setContext(nombre, obj)`, `setExtra(k, v)` | Datos que acompañan a todos los eventos siguientes. |
| `flush(ms?)`, `close(ms?)` | Esperan los envíos pendientes; `close` además restaura consola, `fetch`, historial, etc. |

`hint` acepta `level`, `tags`, `extra`, `user`, `contexts` y `fingerprint` (para agrupar con tu propio criterio).

## Opciones de `init`

| Opción | Por defecto | |
|---|---|---|
| `dsn` | — | Obligatoria. |
| `release`, `environment` | — | Útiles para filtrar y para detectar regresiones. |
| `sampleRate` | `1` | Fracción de eventos que se envían (0 a 1). |
| `maxBreadcrumbs` | `50` | Máximo 100. |
| `maxEventsPerMinute` | `30` | Corta tormentas de errores desde una misma página. |
| `ignoreErrors` | — | Strings o RegExp; se suman a los ignorados por defecto (`Script error.`, avisos de `ResizeObserver`). |
| `denyUrls` / `allowUrls` | — | Filtran por las URLs del stack (p. ej. extensiones del navegador). |
| `beforeSend(event, hint)` | — | Modifica el evento o devuelve `null` para descartarlo. |
| `tags`, `user` | — | Iniciales. |
| `captureGlobalErrors` | `true` | Captura errores no manejados. |
| `breadcrumbs` | todos | `false`, o `{ console, clicks, fetch, xhr, navigation }`. |
| `sendFullUrl` | `false` | Si es `true`, envía la URL con query y hash. |
| `tracesSampleRate` | `0` | Fracción de transacciones de rendimiento que se registran (0 a 1). Con 0 el rendimiento está apagado; con un valor mayor se miden solas las cargas de página y las navegaciones. |
| `tracing` | todo | `false`, o `{ pageload, navigation, http, webVitals }` para elegir qué se mide solo. |
| `tracePropagationTargets` | mismo origen | A qué URLs se añade la cabecera `traceparent`. |
| `maxSpans` | `100` | Máximo de spans por transacción (hasta 200). |
| `beforeSendTransaction(tx)` | — | Modifica la transacción o devuelve `null` para descartarla. |
| `enabled` | `true` | Apaga el SDK sin quitar el código. |
| `debug` | `false` | Mensajes del SDK en la consola. |

## Rendimiento (transacciones y spans)

Una **transacción** es una unidad de trabajo medida (una carga de página, una navegación, una operación tuya); sus **spans** son los tramos que la componen. Con `tracesSampleRate > 0` el SDK mide solo:

- **Carga de página** (`pageload`): desde que empieza la navegación hasta que la página se asienta (evento `load` y 1 s sin actividad, máximo 15 s). Lleva los Web Vitals **FCP, LCP, CLS, INP y TTFB**.
- **Navegaciones** sin recarga (`pushState`, `popstate`): una transacción por pantalla, que se cierra al navegar de nuevo. Cambiar solo la query o el hash no cuenta.
- **Peticiones `fetch`/XHR** como spans `http.client` (`GET /api/items`, sin query) dentro de la transacción en curso. Cada una lleva la cabecera `traceparent` (W3C) para que tu backend continúe la traza; por defecto solo al mismo origen, porque a otro obliga a una petición previa CORS (`tracePropagationTargets` para ampliarlo).

Para medir tu propio código:

```ts
const tx = Sentinel.startTransaction({ name: "importar-csv", op: "task" });

await Sentinel.trace("parse", "leer el archivo", async () => {
	/* ... */
});
const span = Sentinel.startSpan("db.query", "guardar filas");
/* ... */
span?.end();

tx?.setMeasurement("rows", 1200);
tx?.finish();
```

`trace(op, descripción, fn)` mide una función (síncrona o async) y marca el span con error si lanza. Sin una transacción en curso, `startSpan` y `trace` no registran nada. Los errores capturados durante una transacción llevan su `trace_id` en `contexts.trace`.

Las transacciones se envían a `POST <host>/api/<projectId>/transactions` con las mismas garantías que los eventos (reintentos, `sendBeacon`, 429).

## Cómo envía

`POST <host>/api/<projectId>/events` con la clave en `X-Sentinel-Key`, `credentials: "omit"` y `keepalive`. Si el servidor responde 429, pausa el envío según `Retry-After`. Ante errores de red o 5xx reintenta con espera creciente, y si la página se cierra manda lo pendiente con `sendBeacon`.

Los eventos se ajustan a los límites del servidor (tamaño de campos, 100 breadcrumbs, 250 frames) para que nunca sean rechazados por exceso.

## Desarrollo

```bash
pnpm --filter @sentinel/browser build   # dist/index.js, dist/index.cjs, dist/sentinel.min.js
pnpm --filter @sentinel/browser test
```

Los tests validan los eventos del SDK contra el `ingestEventSchema` real del backend (`packages/shared`), de modo que ambos no pueden divergir sin que falle un test.

Para probarlo en un navegador real, ver [`examples/browser-demo`](../../examples/browser-demo).
