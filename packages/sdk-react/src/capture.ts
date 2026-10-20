import { type CaptureHint, captureException } from "@argus-isolator/browser";

/**
 * Errores ya enviados. React puede avisar del mismo error por dos caminos (el `ErrorBoundary` y
 * `onCaughtError` de la raíz); con esto solo se envía una vez, llegue por donde llegue primero.
 */
const reported = new WeakSet<object>();

const isObject = (value: unknown): value is object =>
	(typeof value === "object" && value !== null) || typeof value === "function";

export interface ReactCaptureOptions {
	componentStack?: string | null;
	/** `true` si algún límite de errores lo atrapó; `false` si nadie lo manejó. */
	handled: boolean;
	/** De dónde viene: `react.error_boundary`, `react.uncaught`, `react.caught`, `react.recoverable`. */
	mechanism: string;
	hint?: CaptureHint;
}

/** Envía un error de React con su pila de componentes. Devuelve el id del evento, o `undefined` si ya se envió. */
export function captureReactError(
	error: unknown,
	options: ReactCaptureOptions,
): string | undefined {
	if (isObject(error)) {
		if (reported.has(error)) return undefined;
		reported.add(error);
	}
	const { hint = {}, componentStack } = options;
	return captureException(error, {
		...hint,
		tags: {
			...hint.tags,
			handled: String(options.handled),
			mechanism: options.mechanism,
		},
		contexts: {
			...hint.contexts,
			...(componentStack && {
				react: { componentStack: componentStack.trim() },
			}),
		},
	});
}
