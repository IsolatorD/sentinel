# @sentinel/react-native

> Instalación (las SDK aún no están en npm): ver [Instalar las SDK](../../README.md#instalar-las-sdk).

SDK de Sentinel para React Native (0.72 o superior, Hermes o JavaScriptCore). Captura los errores de JavaScript, mide el arranque de la app, las pantallas y las peticiones de red, y simboliza los stacks con los source maps de tu build.

- Sin dependencias en tiempo de ejecución (`react` y `react-native` los pone tu app).
- Nunca lanza ni rompe tu aplicación.
- Funciona con cualquier navegación (React Navigation, Expo Router...).

## Uso

```ts
// index.js: lo primero, antes de registrar la app
import * as Sentinel from "@sentinel/react-native";

Sentinel.init({
	dsn: "https://<clave>@sentinel.example.com/<projectId>",
	release: "1.4.2", // debe coincidir con la release de tus source maps
	environment: "production",
	tracesSampleRate: 1, // opcional: activa el rendimiento
});
```

```tsx
// Errores de render: en lugar de cerrar la app, se muestra un fallback
export default Sentinel.withErrorBoundary(App, { fallback: ({ resetError }) => <Oops onRetry={resetError} /> });

// Pantallas con React Navigation
<NavigationContainer ref={navigationRef} onReady={() => Sentinel.instrumentNavigation(navigationRef)}>
```

## Qué hace solo

- **Errores de JavaScript sin controlar** (`ErrorUtils`): se capturan y se deja actuar al manejador original. Un error **fatal** cierra la app en cuanto vuelve el manejador, así que el SDK retiene ese cierre hasta que el error se haya enviado (`fatalFlushTimeoutMs`, 2 s por defecto) y recién entonces lo deja seguir.
- **Promesas rechazadas sin manejar**, con el rastreador de Hermes (con JavaScriptCore no hay forma de saberlo).
- **Red**: un breadcrumb y, dentro de una transacción, un span `http.client` por cada petición. Se instrumenta `XMLHttpRequest`, que es lo que usan por debajo `fetch` de React Native y axios, así que se cubre todo sin contar dos veces. La cabecera `traceparent` solo se añade a las URLs de `tracePropagationTargets` (por defecto, a ninguna): tu backend continúa la traza.
- **Ciclo de vida**: pasar a segundo plano deja un breadcrumb y **envía lo pendiente** (el sistema puede cerrar la app en cualquier momento).
- **Arranque** (`app.start`, con `tracesSampleRate`): desde que arrancó el motor de JavaScript hasta la primera pantalla (`instrumentNavigation` la da por vista; si no la usas, llama a `Sentinel.appReady()`), con un máximo de 15 s.
- **Pantallas** (`instrumentNavigation`): una transacción `navigation` por pantalla y un breadcrumb por cambio. Las peticiones y el montaje (`Profiler`) de esa pantalla cuelgan de su transacción.
- **Contexto**: plataforma `react-native`, SO (iOS/Android y versión), motor (Hermes/JavaScriptCore) y estado de la app.

## Source maps (ver el código original)

El bundle de producción está minificado (y con Hermes, compilado a bytecode). El SDK envía los archivos como `app:///index.android.bundle`, sea cual sea la ruta donde esté instalada la app, y el servidor los busca entre los source maps de esa release:

```bash
# tras compilar, sube los mapas con la misma release que pones en init()
sentinel-cli sourcemaps upload ./build --release 1.4.2
```

`index.android.bundle.map` queda guardado como `~/index.android.bundle` (lo mismo con `main.jsbundle` en iOS). Con Hermes, usa el mapa **compuesto** (React Native lo genera al compilar con `--sourcemap-output`; verifica que sea el que subes).

## API

| Función | Descripción |
|---|---|
| `init(options)` | Inicializa el SDK. Con una DSN inválida queda desactivado, sin lanzar. |
| `captureException(error, hint?)`, `captureMessage(texto, nivel?)` | Envían un error o un mensaje. |
| `addBreadcrumb()`, `setUser()`, `setTag()`, `setTags()`, `setContext()`, `setExtra()` | Datos que acompañan a los eventos siguientes. |
| `instrumentNavigation(contenedor)` | Registra los cambios de pantalla; devuelve la función para dejar de escuchar. |
| `appReady()` | Da por terminado el arranque de la app. |
| `trace(op, descripción, fn)`, `startSpan()`, `startTransaction()` | Medición manual (síncrona o async). |
| `ErrorBoundary`, `withErrorBoundary(App, opciones)` | Atrapa los errores de render y los envía con su pila de componentes. |
| `Profiler`, `withProfiler(Componente)` | Mide cuánto tarda en montarse un componente. |
| `flush(ms?)`, `close(ms?)` | Esperan los envíos pendientes. |

## Opciones de `init`

| Opción | Por defecto | |
|---|---|---|
| `dsn` | — | Obligatoria. |
| `release`, `environment` | — | Para filtrar, detectar regresiones y simbolizar. |
| `sampleRate` | `1` | Fracción de eventos que se envían. |
| `tracesSampleRate` | `0` | Fracción de transacciones que se registran. Con 0 el rendimiento está apagado. |
| `tracing` | todo | `false`, o `{ appStart, navigation, http }`. |
| `tracePropagationTargets` | ninguna | URLs (string o RegExp) a las que se añade `traceparent`. |
| `captureGlobalErrors` | `true` | Captura los errores sin controlar y las promesas rechazadas. |
| `fatalFlushTimeoutMs` | `2000` | Cuánto retener el cierre de la app tras un error fatal para enviarlo. |
| `breadcrumbs` | todos | `false`, o `{ console, http, appState, navigation }`. |
| `ignoreErrors`, `beforeSend`, `beforeSendTransaction`, `maxBreadcrumbs`, `tags`, `user`, `enabled`, `debug` | — | Igual que en el SDK del navegador. |

## Limitaciones

- **Sin cola en disco**: si no hay red cuando ocurre un error, se reintenta unos segundos y se descarta (no se guarda para el siguiente arranque). Los errores nativos (un cierre del sistema, Java/Objective-C) tampoco se capturan: este SDK es solo de JavaScript.
- Con JavaScriptCore no hay rastreo de promesas rechazadas.

## Desarrollo

```bash
pnpm --filter @sentinel/react-native build
pnpm --filter @sentinel/react-native test
```

Los tests simulan lo que React Native pone en el entorno (`ErrorUtils`, `HermesInternal`, `AppState`) y validan cada evento y transacción contra los esquemas reales del backend. Hay además una prueba de extremo a extremo (`tests/e2e/tests/react-native-sdk.e2e.test.ts`) que envía un stack de Hermes a la API real y comprueba que el worker lo simboliza con el source map del bundle.
