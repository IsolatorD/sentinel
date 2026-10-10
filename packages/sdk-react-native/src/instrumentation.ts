import type { CoreClient, Uninstall } from "@sentinel/core";

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike {
	getGlobalHandler?: () => GlobalErrorHandler | undefined;
	setGlobalHandler?: (handler: GlobalErrorHandler) => void;
}

/** La parte del cliente que necesita la instrumentación. */
type Capturer = Pick<CoreClient, "captureThrown" | "flush">;

/**
 * Captura los errores de JavaScript sin controlar (`ErrorUtils`). Un error fatal cierra la app en cuanto
 * vuelve el manejador, así que se le da un plazo para enviarse antes de dejar que siga su curso.
 */
export function installGlobalErrorHandler(
	client: Capturer,
	fatalFlushTimeoutMs: number,
): Uninstall {
	const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
	if (!utils?.setGlobalHandler) return () => {};
	const previous = utils.getGlobalHandler?.();

	const handler: GlobalErrorHandler = (error, isFatal) => {
		try {
			client.captureThrown(error, {
				level: isFatal ? "fatal" : "error",
				tags: {
					handled: "false",
					mechanism: "onerror",
					fatal: String(Boolean(isFatal)),
				},
			});
		} catch {}
		if (!isFatal) {
			previous?.(error, isFatal);
			return;
		}
		const proceed = () => previous?.(error, isFatal);
		client.flush(fatalFlushTimeoutMs).then(proceed, proceed);
	};

	utils.setGlobalHandler(handler);
	return () => {
		// Solo se restaura si nadie más lo envolvió encima.
		if (utils.getGlobalHandler?.() === handler && previous)
			utils.setGlobalHandler?.(previous);
	};
}

interface HermesLike {
	enablePromiseRejectionTracker?: (options: {
		allRejections: boolean;
		onUnhandled: (id: number, reason: unknown) => void;
	}) => void;
}

/** Promesas rechazadas sin manejar: solo Hermes lo permite (y no se puede desactivar, por eso el interruptor). */
export function installRejectionTracker(client: Capturer): Uninstall {
	const hermes = (globalThis as { HermesInternal?: HermesLike }).HermesInternal;
	if (!hermes?.enablePromiseRejectionTracker) return () => {};
	let active = true;
	hermes.enablePromiseRejectionTracker({
		allRejections: true,
		onUnhandled: (_id, reason) => {
			if (!active) return;
			client.captureThrown(
				reason,
				{ tags: { handled: "false", mechanism: "onunhandledrejection" } },
				{
					nonErrorType: "UnhandledRejection",
					nonErrorPrefix: "Non-Error promise rejection captured with value: ",
				},
			);
		},
	});
	return () => {
		active = false;
	};
}
