import type { CoreOptions } from "@sentinel/core";

export type {
	Breadcrumb,
	CaptureHint,
	ExceptionValue,
	Level,
	SentinelEvent,
	SentinelSpan,
	SentinelTransaction,
	StackFrame,
	User,
} from "@sentinel/core";

export interface RNBreadcrumbOptions {
	/** Registra console.log/info/warn/error/debug. Por defecto true. */
	console?: boolean;
	/** Registra las peticiones de red (fetch, XMLHttpRequest, axios...). Por defecto true. */
	http?: boolean;
	/** Registra cuándo la app pasa a segundo plano y vuelve. Por defecto true. */
	appState?: boolean;
	/** Registra los cambios de pantalla de `instrumentNavigation`. Por defecto true. */
	navigation?: boolean;
}

export interface RNTracingOptions {
	/** Mide el arranque de la app, hasta la primera pantalla. Por defecto true. */
	appStart?: boolean;
	/** Una transacción por pantalla con `instrumentNavigation`. Por defecto true. */
	navigation?: boolean;
	/** Un span por cada petición de red. Por defecto true. */
	http?: boolean;
}

export interface RNOptions extends CoreOptions {
	/** Qué se mide solo cuando `tracesSampleRate` es mayor que 0. */
	tracing?: RNTracingOptions | boolean;
	/** Captura los errores de JavaScript sin controlar y las promesas rechazadas. Por defecto true. */
	captureGlobalErrors?: boolean;
	/**
	 * Un error fatal cierra la app en cuanto vuelve el manejador. Esto es lo que se espera, como máximo, a
	 * enviarlo antes de dejar que siga (ms). Por defecto 2000.
	 */
	fatalFlushTimeoutMs?: number;
	breadcrumbs?: RNBreadcrumbOptions | boolean;
}
