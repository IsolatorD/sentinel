import type { CaptureHint, Uninstall } from "@sentinel/core";

export interface ProcessHandlerOptions {
	captureThrown(
		thrown: unknown,
		hint: CaptureHint,
		exceptionOptions?: { nonErrorType?: string; nonErrorPrefix?: string },
	): string | undefined;
	flush(timeoutMs: number): Promise<boolean>;
	exitOnUncaughtException: boolean;
	unhandledRejection: "warn" | "strict" | "none";
	shutdownTimeoutMs: number;
}

/** Captura `uncaughtException` y `unhandledRejection`, y los deja actuar como lo haría Node. */
export function installProcessHandlers(
	options: ProcessHandlerOptions,
): Uninstall {
	const onUncaught = (error: unknown) => {
		options.captureThrown(error, {
			level: "fatal",
			tags: { handled: "false", mechanism: "uncaughtException" },
		});
		if (!options.exitOnUncaughtException) return;
		// Si la app tiene su propio handler, es ella quien decide qué hacer.
		if (process.listeners("uncaughtException").some((l) => l !== onUncaught))
			return;
		console.error(error);
		void options
			.flush(options.shutdownTimeoutMs)
			.finally(() => process.exit(1));
	};

	const onRejection = (reason: unknown) => {
		options.captureThrown(
			reason,
			{ tags: { handled: "false", mechanism: "unhandledRejection" } },
			{
				nonErrorType: "UnhandledRejection",
				nonErrorPrefix: "Non-Error promise rejection captured with value: ",
			},
		);
		if (options.unhandledRejection === "warn")
			console.warn("[Sentinel] unhandled promise rejection:", reason);
		// Relanzarla desde aquí la convierte en una excepción no controlada, como en el modo `strict` de Node.
		else if (options.unhandledRejection === "strict") throw reason;
	};

	process.on("uncaughtException", onUncaught);
	process.on("unhandledRejection", onRejection);
	return () => {
		process.off("uncaughtException", onUncaught);
		process.off("unhandledRejection", onRejection);
	};
}
