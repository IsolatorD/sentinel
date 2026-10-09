import type { ErrorResponse } from "@sentinel/shared";

/** Error de la API con el formato único del backend. Lo lanzan los services y lo leen los componentes. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly code?: string,
		readonly issues?: ErrorResponse["issues"],
		readonly requestId?: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}
