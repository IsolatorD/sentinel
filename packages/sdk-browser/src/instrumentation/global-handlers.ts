import type { AddBreadcrumb, Uninstall } from "./types";

export interface GlobalHandlers {
	onError: (error: unknown, info: { message: string; source?: string }) => void;
	onRejection: (reason: unknown) => void;
	addBreadcrumb: AddBreadcrumb;
}

/** Errores de carga de recursos (img, script, link...) llegan al window sin `error`. */
function isResourceError(event: Event): boolean {
	const target = event.target as { tagName?: string } | null;
	return Boolean(target && target !== (window as unknown) && target.tagName);
}

export function installGlobalHandlers(handlers: GlobalHandlers): Uninstall {
	if (typeof window === "undefined") return () => {};

	const onError = (event: Event) => {
		try {
			if (isResourceError(event)) {
				const el = event.target as HTMLElement & {
					src?: string;
					href?: string;
				};
				handlers.addBreadcrumb({
					category: "resource",
					level: "error",
					message: `Failed to load <${el.tagName.toLowerCase()}>`,
					data: { url: el.src ?? el.href },
				});
				return;
			}
			const e = event as ErrorEvent;
			if (e.error) {
				handlers.onError(e.error, { message: e.message, source: e.filename });
			} else if (e.message) {
				// Errores de otro origen ("Script error."): solo llega el mensaje.
				const synthetic = new Error(e.message);
				synthetic.stack = e.filename
					? `${e.message}\n    at ${e.filename}:${e.lineno ?? 0}:${e.colno ?? 0}`
					: undefined;
				handlers.onError(synthetic, { message: e.message, source: e.filename });
			}
		} catch {}
	};

	const onRejection = (event: Event) => {
		try {
			handlers.onRejection((event as PromiseRejectionEvent).reason);
		} catch {}
	};

	// capture: true para recibir también los errores de carga de recursos, que no burbujean.
	window.addEventListener("error", onError, true);
	window.addEventListener("unhandledrejection", onRejection);
	return () => {
		window.removeEventListener("error", onError, true);
		window.removeEventListener("unhandledrejection", onRejection);
	};
}
