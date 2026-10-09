/** Fallo al entregar un aviso. `permanent` indica que reintentar no puede arreglarlo. */
export class DeliveryError extends Error {
	constructor(
		message: string,
		readonly options: { permanent: boolean; statusCode?: number } = {
			permanent: false,
		},
	) {
		super(message);
		this.name = "DeliveryError";
	}

	get permanent(): boolean {
		return this.options.permanent;
	}

	get statusCode(): number | undefined {
		return this.options.statusCode;
	}
}

/** Qué hacer con una respuesta HTTP de un webhook: éxito, reintentar o rendirse. */
export function classifyHttpStatus(
	status: number,
): "ok" | "retry" | "permanent" {
	if (status >= 200 && status < 300) return "ok";
	// 3xx: no se siguen redirecciones (podrían llevar a una dirección interna)
	if (status === 408 || status === 429 || status >= 500) return "retry";
	return "permanent";
}
