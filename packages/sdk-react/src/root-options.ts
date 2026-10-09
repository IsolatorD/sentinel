import { captureReactError } from "./capture";

/** Lo que React 19 pasa como segundo argumento a los handlers de la raíz. */
export interface RootErrorInfo {
	componentStack?: string | null;
}

type RootHandler = (error: unknown, info: RootErrorInfo) => void;

export interface RootOptions {
	onUncaughtError: RootHandler;
	onCaughtError: RootHandler;
	onRecoverableError: RootHandler;
}

/**
 * Opciones para `createRoot` / `hydrateRoot` (React 19). Envían a Sentinel lo que React reporta:
 *  - `onUncaughtError`: errores que ningún `ErrorBoundary` atrapó (la app se desmonta).
 *  - `onCaughtError`: errores atrapados por un `ErrorBoundary`, incluidos los de librerías de terceros.
 *  - `onRecoverableError`: errores de los que React se recuperó solo (p. ej. diferencias de hidratación).
 *
 * El `ErrorBoundary` de este paquete y `onCaughtError` pueden avisar del mismo error: solo se envía una vez.
 * `callback` se invoca después de cada envío, por si quieres además mostrar o registrar algo.
 */
export function reactRootOptions(
	callback?: (
		error: unknown,
		info: RootErrorInfo,
		eventId: string | undefined,
	) => void,
): RootOptions {
	const handler =
		(handled: boolean, mechanism: string, level?: "warning"): RootHandler =>
		(error, info) => {
			const eventId = captureReactError(error, {
				componentStack: info?.componentStack,
				handled,
				mechanism,
				hint: level ? { level } : undefined,
			});
			try {
				callback?.(error, info, eventId);
			} catch {}
		};
	return {
		onUncaughtError: handler(false, "react.uncaught"),
		onCaughtError: handler(true, "react.caught"),
		onRecoverableError: handler(true, "react.recoverable", "warning"),
	};
}
