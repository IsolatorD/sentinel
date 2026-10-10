import {
	type AddBreadcrumb,
	type ClientDeps,
	CoreClient,
	installConsole,
	installXhr,
	originalConsole,
	type Platform,
	Tracer,
	type Transaction,
} from "@sentinel/core";
import { normalizeBundleFrames } from "./bundle";
import {
	installGlobalErrorHandler,
	installRejectionTracker,
} from "./instrumentation";
import { jsEngine, loadReactNative, type ReactNativeModule } from "./native";
import type { RNBreadcrumbOptions, RNOptions, RNTracingOptions } from "./types";
import { SDK_NAME, SDK_VERSION } from "./version";

export type { ClientDeps };

const DEFAULT_FATAL_FLUSH_MS = 2_000;
// Una transacción de pantalla termina tras 1 s sin actividad, y como mucho a los 15 s.
const IDLE_TIMEOUT_MS = 1_000;
const FINAL_TIMEOUT_MS = 15_000;

export interface RNClientDeps extends ClientDeps {
	/** Para pruebas: el módulo `react-native` (por defecto se carga el de la app). */
	reactNative?: ReactNativeModule;
}

function tracingOptions(options: RNOptions): Required<RNTracingOptions> {
	const on = (options.tracesSampleRate ?? 0) > 0;
	const t = options.tracing;
	const all = { appStart: on, navigation: on, http: on };
	if (!on || t === undefined || t === true) return all;
	if (t === false) return { appStart: false, navigation: false, http: false };
	return { ...all, ...t };
}

function rnPlatform(
	options: RNOptions,
	rn: ReactNativeModule | undefined,
): Platform {
	const os = rn?.Platform?.OS;
	return {
		name: "react-native",
		sdk: { name: SDK_NAME, version: SDK_VERSION },
		createTracer: ({ onFinish, ...parts }) =>
			new Tracer(
				{
					...parts,
					http: tracingOptions(options).http,
					idleTimeoutMs: IDLE_TIMEOUT_MS,
					finalTimeoutMs: FINAL_TIMEOUT_MS,
				},
				{ onFinish },
			),
		eventExtras: () => ({
			contexts: {
				...(os && {
					os: {
						name: os === "ios" ? "iOS" : os === "android" ? "Android" : os,
						version: String(rn?.Platform?.Version ?? ""),
					},
				}),
				runtime: {
					name: jsEngine() === "hermes" ? "Hermes" : "JavaScriptCore",
				},
				...(rn?.AppState?.currentState && {
					app: { state: rn.AppState.currentState },
				}),
			},
		}),
		processEvent: normalizeBundleFrames,
		log: (message) => originalConsole?.warn?.(message),
	};
}

export class RNClient extends CoreClient<RNOptions> {
	private readonly rn: ReactNativeModule | undefined;
	private releaseAppStart?: () => void;
	private navigationTx?: Transaction;

	constructor(options: RNOptions, deps: RNClientDeps = {}) {
		const rn = deps.reactNative ?? loadReactNative();
		super(options, deps, rnPlatform(options, rn));
		this.rn = rn;
	}

	get tracingEnabled(): Required<RNTracingOptions> {
		return tracingOptions(this.options);
	}

	/** Engancha los manejadores de errores y la instrumentación de breadcrumbs y de red. */
	install(): this {
		if (!this.enabled || this.installed) return this;
		this.installed = true;
		const add: AddBreadcrumb = (b) => this.addBreadcrumb(b);
		const crumbs = this.breadcrumbOptions();
		const tracing = this.tracingEnabled;

		if (this.options.captureGlobalErrors !== false) {
			this.uninstallers.push(
				installGlobalErrorHandler(
					this,
					this.options.fatalFlushTimeoutMs ?? DEFAULT_FATAL_FLUSH_MS,
				),
				installRejectionTracker(this),
			);
		}
		if (crumbs.console) this.uninstallers.push(installConsole(add));

		// `fetch` de React Native se apoya en XMLHttpRequest: instrumentar solo XHR cubre también a
		// axios y a cualquier biblioteca, sin contar dos veces cada petición.
		const tracer = this.tracer;
		const startSpan = tracing.http
			? (info: { method: string; url: string }) => tracer?.startHttpSpan(info)
			: undefined;
		if (crumbs.http || startSpan)
			this.uninstallers.push(
				installXhr(crumbs.http ? add : () => {}, this.isOwnUrl, startSpan),
			);

		const appState = this.rn?.AppState;
		if (appState) {
			const subscription = appState.addEventListener("change", (state) => {
				if (crumbs.appState)
					add({ category: "app.lifecycle", type: "default", message: state });
				// En segundo plano el sistema puede cerrar la app en cualquier momento: se envía ya.
				if (state === "background" || state === "inactive")
					void this.flush(1_000);
			});
			if (subscription) this.uninstallers.push(() => subscription.remove());
		}

		if (tracing.appStart && tracer) this.startAppStart();
		return this;
	}

	/**
	 * La app ya muestra su primera pantalla: termina la transacción `app.start`. Si usas
	 * `instrumentNavigation`, se llama sola con la primera ruta.
	 */
	appReady(): void {
		this.releaseAppStart?.();
		this.releaseAppStart = undefined;
	}

	/** Una transacción por pantalla; la anterior termina al llegar la nueva. */
	startNavigationTransaction(name: string): Transaction | undefined {
		if (!this.tracingEnabled.navigation || !this.tracer) return undefined;
		this.navigationTx?.finish();
		this.navigationTx = this.tracer.startTransaction({
			name,
			op: "navigation",
			idle: true,
		});
		return this.navigationTx;
	}

	private startAppStart(): void {
		const sinceStart =
			typeof performance !== "undefined" &&
			typeof performance.now === "function"
				? performance.now()
				: 0;
		const tx = this.tracer?.startTransaction({
			name: "app.start",
			op: "app.start",
			// El motor de JavaScript arrancó hace `performance.now()` ms.
			startTimestamp: Date.now() - sinceStart,
			idle: true,
		});
		if (!tx) return;
		// Se mantiene abierta hasta la primera pantalla (o hasta el límite de 15 s).
		this.releaseAppStart = tx.hold();
	}

	protected breadcrumbOptions(): Required<RNBreadcrumbOptions> {
		const all = { console: true, http: true, appState: true, navigation: true };
		const b = this.options.breadcrumbs;
		if (b === false)
			return {
				console: false,
				http: false,
				appState: false,
				navigation: false,
			};
		if (b === true || b === undefined) return all;
		return { ...all, ...b };
	}

	/** @internal Lo usa `instrumentNavigation`. */
	get crumbs(): Required<RNBreadcrumbOptions> {
		return this.breadcrumbOptions();
	}
}
