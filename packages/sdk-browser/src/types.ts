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

export interface SentinelOptions {
	/** DSN del proyecto: `https://<clave>@<host>/<projectId>`. */
	dsn: string;
	release?: string;
	environment?: string;
	/** Fracción de eventos que se envían (0 a 1). Por defecto 1. */
	sampleRate?: number;
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
