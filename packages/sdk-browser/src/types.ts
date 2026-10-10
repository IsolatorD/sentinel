// Tipos públicos del SDK. Reflejan el contrato de ingesta del servidor
// (packages/shared/src/ingest.ts); un test verifica que sigan alineados.

export type Level = "fatal" | "error" | "warning" | "info" | "debug";

export interface StackFrame {
	filename?: string;
	function?: string;
	module?: string;
	lineno?: number;
	colno?: number;
	in_app?: boolean;
}

export interface ExceptionValue {
	type: string;
	value?: string;
	/** Del frame más antiguo al más reciente (el último es donde se lanzó). */
	stacktrace?: { frames: StackFrame[] };
}

export interface Breadcrumb {
	timestamp?: string | number;
	category?: string;
	type?: string;
	level?: Level;
	message?: string;
	data?: Record<string, unknown>;
}

export interface User {
	id?: string;
	email?: string;
	username?: string;
	ip_address?: string;
}

export interface SentinelEvent {
	event_id?: string;
	timestamp?: string | number;
	level: Level;
	platform?: string;
	release?: string;
	environment?: string;
	message?: string;
	exception?: { values: ExceptionValue[] };
	fingerprint?: string[];
	user?: User;
	tags?: Record<string, string>;
	request?: { url?: string; method?: string; headers?: Record<string, string> };
	contexts?: Record<string, Record<string, unknown>>;
	breadcrumbs?: Breadcrumb[];
	extra?: Record<string, unknown>;
}

export interface SentinelSpan {
	span_id: string;
	parent_span_id?: string;
	op: string;
	description?: string;
	start_timestamp: string | number;
	duration_ms: number;
	status?: string;
	data?: Record<string, unknown>;
}

/** Transacción de rendimiento; refleja `ingestTransactionSchema` del servidor. */
export interface SentinelTransaction {
	transaction_id?: string;
	trace_id: string;
	span_id: string;
	parent_span_id?: string;
	name: string;
	op?: string;
	timestamp?: string | number;
	duration_ms: number;
	status?: string;
	platform?: string;
	release?: string;
	environment?: string;
	user?: User;
	tags?: Record<string, string>;
	measurements?: Record<string, { value: number; unit?: string }>;
	spans?: SentinelSpan[];
}

/** Opciones por captura. */
export interface CaptureHint {
	level?: Level;
	tags?: Record<string, string>;
	extra?: Record<string, unknown>;
	user?: User;
	contexts?: Record<string, Record<string, unknown>>;
	/** Reemplaza al fingerprint automático (agrupa por estas claves). */
	fingerprint?: string[];
}

export interface BreadcrumbOptions {
	/** Registra console.log/info/warn/error/debug. Por defecto true. */
	console?: boolean;
	/** Registra clicks (solo el selector del elemento, nunca su texto). Por defecto true. */
	clicks?: boolean;
	/** Registra peticiones fetch. Por defecto true. */
	fetch?: boolean;
	/** Registra peticiones XMLHttpRequest. Por defecto true. */
	xhr?: boolean;
	/** Registra cambios de URL (pushState, popstate, hashchange). Por defecto true. */
	navigation?: boolean;
}

export interface TracingOptions {
	/** Mide la carga de página (con sus Web Vitals). Por defecto true. */
	pageload?: boolean;
	/** Mide los cambios de URL sin recarga (apps de una sola página). Por defecto true. */
	navigation?: boolean;
	/** Crea un span por cada petición `fetch`/XHR. Por defecto true. */
	http?: boolean;
	/** Mide FCP, LCP, CLS, INP y TTFB en la carga de página. Por defecto true. */
	webVitals?: boolean;
}

export interface SentinelOptions {
	/** DSN del proyecto: `https://<clave>@<host>/<projectId>`. */
	dsn: string;
	release?: string;
	environment?: string;
	/** Fracción de eventos que se envían (0 a 1). Por defecto 1. */
	sampleRate?: number;
	/**
	 * Fracción de transacciones que se registran (0 a 1). Por defecto 0: el rendimiento es opt-in.
	 * Con un valor mayor que 0 se miden automáticamente las cargas de página y las navegaciones.
	 */
	tracesSampleRate?: number;
	/** Qué se mide automáticamente cuando `tracesSampleRate` es mayor que 0. */
	tracing?: TracingOptions | boolean;
	/**
	 * A qué URLs se añade la cabecera `traceparent` para continuar la traza en tu backend.
	 * Por defecto solo al mismo origen (en otros orígenes obliga a una petición previa CORS).
	 */
	tracePropagationTargets?: Array<string | RegExp>;
	/** Máximo de spans por transacción (hasta 200). Por defecto 100. */
	maxSpans?: number;
	/** Última oportunidad de modificar o descartar (null) una transacción. */
	beforeSendTransaction?: (
		transaction: SentinelTransaction,
	) => SentinelTransaction | null;
	/** Máximo de breadcrumbs por evento (hasta 100). Por defecto 50. */
	maxBreadcrumbs?: number;
	/** Máximo de eventos por minuto desde esta página. Por defecto 30. */
	maxEventsPerMinute?: number;
	/** Ignora errores cuyo tipo o mensaje coincida (se suman a los ignorados por defecto). */
	ignoreErrors?: Array<string | RegExp>;
	/** Ignora errores cuyo stack tenga algún frame con estas URLs (p. ej. extensiones). */
	denyUrls?: Array<string | RegExp>;
	/** Si se define, solo se envían errores con algún frame en estas URLs. */
	allowUrls?: Array<string | RegExp>;
	/** Última oportunidad de modificar o descartar (null) un evento. */
	beforeSend?: (
		event: SentinelEvent,
		hint: CaptureHint,
	) => SentinelEvent | null;
	/** Tags que se agregan a todos los eventos. */
	tags?: Record<string, string>;
	/** Usuario inicial. */
	user?: User;
	/** Captura errores globales (window.onerror y unhandledrejection). Por defecto true. */
	captureGlobalErrors?: boolean;
	breadcrumbs?: BreadcrumbOptions | boolean;
	/** Envía la URL completa (con query y hash). Por defecto false, por privacidad. */
	sendFullUrl?: boolean;
	/** Desactiva el SDK sin quitar el código. Por defecto true. */
	enabled?: boolean;
	/** Mensajes del SDK en la consola. */
	debug?: boolean;
}
