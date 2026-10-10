// Tipos públicos del SDK. Los comunes viven en `@sentinel/core`; aquí están los del navegador.
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

export interface SentinelOptions extends CoreOptions {
	/**
	 * Con `tracesSampleRate` mayor que 0 se miden automáticamente las cargas de página y las
	 * navegaciones; esto permite elegir qué se mide.
	 */
	tracing?: TracingOptions | boolean;
	/**
	 * A qué URLs se añade la cabecera `traceparent` para continuar la traza en tu backend.
	 * Por defecto solo al mismo origen (en otros orígenes obliga a una petición previa CORS).
	 */
	tracePropagationTargets?: Array<string | RegExp>;
	/** Captura errores globales (window.onerror y unhandledrejection). Por defecto true. */
	captureGlobalErrors?: boolean;
	breadcrumbs?: BreadcrumbOptions | boolean;
	/** Envía la URL completa (con query y hash). Por defecto false, por privacidad. */
	sendFullUrl?: boolean;
}
