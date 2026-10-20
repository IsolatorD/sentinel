# @argus-isolator/react

> Instalación (las SDK aún no están en npm): ver [Instalar las SDK](../../README.md#instalar-las-sdk).

SDK de Sentinel para React: un `ErrorBoundary` que envía los errores de render con su **pila de componentes**, y las opciones de React 19 para no perder ninguno. Reexporta todo `@argus-isolator/browser`, así que con un solo import tienes `init`, `captureException`, etc.

Requiere React 18 o superior (los handlers de la raíz, React 19).

## Uso

```tsx
import * as Sentinel from "@argus-isolator/react";
import { createRoot } from "react-dom/client";

Sentinel.init({ dsn: "https://<clave>@sentinel.example.com/<projectId>", release: "1.4.2" });

createRoot(document.getElementById("root")!, Sentinel.reactRootOptions()).render(
	<Sentinel.ErrorBoundary fallback={<p>Algo salió mal.</p>}>
		<App />
	</Sentinel.ErrorBoundary>,
);
```

## `ErrorBoundary`

Atrapa los errores de render de sus hijos, los envía y muestra `fallback` en lugar de dejar la pantalla en blanco.

```tsx
<Sentinel.ErrorBoundary
	fallback={({ error, eventId, resetError }) => (
		<div>
			<p>No pudimos mostrar esta página. Referencia: {eventId}</p>
			<button onClick={resetError}>Reintentar</button>
		</div>
	)}
	resetKeys={[location.pathname]}
>
	<Routes />
</Sentinel.ErrorBoundary>
```

| Prop | |
|---|---|
| `fallback` | Un nodo, o una función que recibe `{ error, componentStack, eventId, resetError }`. Sin ella no se muestra nada en su lugar. |
| `resetKeys` | Si cambia alguno de estos valores (p. ej. la ruta), el límite se reinicia solo. |
| `onError(error, componentStack, eventId)` | Después de enviar. |
| `onReset(error, componentStack, eventId)` | Al volver a mostrar los hijos. |
| `beforeCapture(hint, error, componentStack)` | Devuelve un `hint` con `tags`, `extra` o `level` para ese envío. |

Para envolver un componente que no controlas: `withErrorBoundary(Component, { fallback })`.

Cada evento lleva `contexts.react.componentStack` (visible en el detalle del issue) y los tags `handled` y `mechanism`.

## `reactRootOptions()` (React 19)

Opciones para `createRoot` / `hydrateRoot` que envían lo que React reporta por su cuenta:

| Handler | Cuándo | Tags |
|---|---|---|
| `onUncaughtError` | Ningún límite lo atrapó (la app se desmonta). | `handled: false`, `react.uncaught` |
| `onCaughtError` | Lo atrapó un `ErrorBoundary`, incluidos los de librerías de terceros. | `handled: true`, `react.caught` |
| `onRecoverableError` | React se recuperó solo (p. ej. diferencias de hidratación). Nivel `warning`. | `handled: true`, `react.recoverable` |

Usar `ErrorBoundary` y `reactRootOptions()` a la vez es seguro: cada error se envía **una sola vez**, llegue por el camino que llegue primero.

`reactRootOptions(callback)` acepta un callback que se invoca tras cada envío con `(error, info, eventId)`.

## `Profiler` (rendimiento)

Con `tracesSampleRate` activo, mide cuánto tarda en montarse una parte del árbol (del primer render al commit) y lo registra como un span `ui.react.mount` de la transacción en curso, normalmente la carga de página o la navegación:

```tsx
<Sentinel.Profiler name="Checkout">
	<Checkout />
</Sentinel.Profiler>

const Cart = Sentinel.withProfiler(CartView); // el nombre sale del componente
```

Sin transacción en curso no hace nada. Solo mide el montaje, no cada actualización.

## Notas

- Un `beforeCapture`, `onError` o callback que lance una excepción nunca impide el envío ni rompe el fallback.
- Si el SDK no está inicializado, el `ErrorBoundary` sigue mostrando el fallback; simplemente no envía nada.
- En React 18 en modo desarrollo, React además relanza el error como un error global del navegador. El SDK descarta el duplicado (mismo error en menos de un segundo), pero el que llega primero puede ser el global; en producción no ocurre.

## Desarrollo

```bash
pnpm --filter @argus-isolator/react build
pnpm --filter @argus-isolator/react test
```

Los tests usan el SDK real y validan cada evento contra el `ingestEventSchema` del backend.
