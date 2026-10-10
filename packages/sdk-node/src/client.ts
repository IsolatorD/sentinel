import { hostname, release as osRelease } from "node:os";
import {
	type AddBreadcrumb,
	type ClientDeps,
	CoreClient,
	installConsole,
	installFetch,
	originalConsole,
	type Platform,
	Tracer,
	type Transaction,
} from "@sentinel/core";
import { AsyncTraceContext } from "./async-context";
import { installHttpClient } from "./instrumentation/http-client";
import { installHttpServer } from "./instrumentation/http-server";
import { installProcessHandlers } from "./instrumentation/process-handlers";
import { requestScope } from "./request-scope";
import type {
	NodeBreadcrumbOptions,
	NodeOptions,
	NodeTracingOptions,
} from "./types";
import { SDK_NAME, SDK_VERSION } from "./version";

export type { ClientDeps };

const DEFAULT_SHUTDOWN_MS = 2_000;

function tracingOptions(options: NodeOptions): Required<NodeTracingOptions> {
	const on = (options.tracesSampleRate ?? 0) > 0;
	const t = options.tracing;
	const all = { server: on, http: on };
	if (!on || t === undefined || t === true) return all;
	if (t === false) return { server: false, http: false };
	return { ...all, ...t };
}

function nodePlatform(options: NodeOptions): Platform {
	return {
		name: "node",
		sdk: { name: SDK_NAME, version: SDK_VERSION },
		createTracer: ({ onFinish, ...parts }) =>
			new Tracer(
				{
					...parts,
					http: tracingOptions(options).http,
					// Las transacciones de un servidor las termina el código que las abre (una por petición).
					idleTimeoutMs: 0,
					finalTimeoutMs: 0,
				},
				{ onFinish, context: new AsyncTraceContext() },
			),
		eventExtras: () => ({
			// La petición HTTP que se está atendiendo, si hay una.
			request: requestScope.getStore()?.request,
			contexts: {
				runtime: {
					name: "node",
					version: process.version,
					server_name: options.serverName ?? hostname(),
				},
				os: {
					name: process.platform,
					version: osRelease(),
					arch: process.arch,
				},
			},
		}),
		log: (message) => originalConsole?.warn?.(message),
	};
}

export class NodeClient extends CoreClient<NodeOptions> {
	constructor(options: NodeOptions, deps: ClientDeps = {}) {
		super(options, deps, nodePlatform(options));
	}

	/** La transacción en curso (la de la petición que se está atendiendo, o la que abrió el código). */
	activeTransaction(): Transaction | undefined {
		return this.tracer?.active;
	}

	/** Cuántas peticiones se miden de forma automática y qué se mide (para el resto de la instrumentación). */
	get tracingEnabled(): Required<NodeTracingOptions> {
		return tracingOptions(this.options);
	}

	/** Engancha los handlers del proceso y la instrumentación de breadcrumbs. */
	install(): this {
		if (!this.enabled || this.installed) return this;
		this.installed = true;
		const add: AddBreadcrumb = (b) => this.addBreadcrumb(b);
		const crumbs = this.breadcrumbOptions();

		if (this.options.captureGlobalErrors !== false) {
			this.uninstallers.push(
				installProcessHandlers({
					captureThrown: (thrown, hint, exceptionOptions) =>
						this.captureThrown(thrown, hint, exceptionOptions),
					flush: (ms) => this.flush(ms),
					exitOnUncaughtException: this.options.exitOnUncaughtException ?? true,
					unhandledRejection: this.options.unhandledRejection ?? "warn",
					shutdownTimeoutMs:
						this.options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_MS,
				}),
			);
		}
		if (crumbs.console) this.uninstallers.push(installConsole(add));

		const tracer = this.tracer;
		const tracing = this.tracingEnabled;
		const startSpan = tracing.http
			? (info: { method: string; url: string }) => tracer?.startHttpSpan(info)
			: undefined;
		if (crumbs.http || startSpan) {
			this.uninstallers.push(
				installHttpClient(
					crumbs.http ? add : () => {},
					this.isOwnUrl,
					startSpan,
				),
				installFetch(crumbs.http ? add : () => {}, this.isOwnUrl, startSpan),
			);
		}
		if (tracer && tracing.server)
			this.uninstallers.push(
				installHttpServer({
					tracer,
					transactionName: this.options.transactionName,
				}),
			);
		return this;
	}

	protected breadcrumbOptions(): Required<NodeBreadcrumbOptions> {
		const all = { console: true, http: true };
		const b = this.options.breadcrumbs;
		if (b === false) return { console: false, http: false };
		if (b === true || b === undefined) return all;
		return { ...all, ...b };
	}
}
