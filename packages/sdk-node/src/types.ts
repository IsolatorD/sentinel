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

export interface NodeBreadcrumbOptions {
	/** Registra console.log/info/warn/error/debug. Por defecto true. */
	console?: boolean;
	/** Registra las peticiones HTTP salientes (`http`, `https` y `fetch`). Por defecto true. */
	http?: boolean;
}

export interface NodeTracingOptions {
	/** Mide cada petición que atiende un servidor `http`/`https` (y por tanto Express, Fastify, Nest...). Por defecto true. */
	server?: boolean;
	/** Crea un span por cada petición HTTP saliente (`http`, `https` y `fetch`). Por defecto true. */
	http?: boolean;
}

export interface NodeOptions extends CoreOptions {
	/** Qué se mide solo cuando `tracesSampleRate` es mayor que 0. */
	tracing?: NodeTracingOptions | boolean;
	/** Captura `uncaughtException` y `unhandledRejection`. Por defecto true. */
	captureGlobalErrors?: boolean;
	/**
	 * Tras capturar una excepción no controlada, envía lo pendiente y termina el proceso (código 1),
	 * como haría Node sin handler. Si tu app ya tiene su propio `uncaughtException`, no se hace.
	 * Por defecto true.
	 */
	exitOnUncaughtException?: boolean;
	/**
	 * Qué hacer con una promesa rechazada sin manejar tras capturarla:
	 * `warn` (por defecto) la muestra en la consola y sigue; `strict` la relanza como excepción
	 * no controlada (con `exitOnUncaughtException`, termina el proceso); `none` solo la captura.
	 */
	unhandledRejection?: "warn" | "strict" | "none";
	breadcrumbs?: NodeBreadcrumbOptions | boolean;
	/** Nombre de este servidor o instancia; va en `contexts.runtime`. Por defecto, el hostname. */
	serverName?: string;
	/** Cuánto esperar (ms) a que se envíe lo pendiente antes de terminar el proceso. Por defecto 2000. */
	shutdownTimeoutMs?: number;
}
