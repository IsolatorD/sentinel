import { type ErrorResponse, errorResponseSchema } from "@sentinel/shared";
import axios, { type AxiosResponse } from "axios";
import type { RequestOptions } from "@/services/http/httpInterface";
import { ApiError } from "@/utils/apiError/apiError";

/**
 * Instancia compartida: cookies de sesión en cada petición y sin que axios lance por el estado HTTP
 * (el formato de error del backend se interpreta en `http`, no en un interceptor).
 */
export const apiClient = axios.create({
	withCredentials: true,
	validateStatus: () => true,
});

/** Quita los parámetros vacíos o indefinidos para que no aparezcan en la URL. */
export function cleanQuery(query: RequestOptions<undefined>["query"]) {
	if (!query) return undefined;
	return Object.fromEntries(
		Object.entries(query).filter(([, v]) => v !== undefined && v !== ""),
	);
}

export function toApiError(res: AxiosResponse): ApiError {
	const parsed = errorResponseSchema.safeParse(res.data);
	const body: ErrorResponse | undefined = parsed.success
		? parsed.data
		: undefined;
	return new ApiError(
		res.status,
		body?.message ?? res.statusText ?? "Request failed",
		body?.code,
		body?.issues,
		body?.requestId,
	);
}
