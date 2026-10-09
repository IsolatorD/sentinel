import { type ErrorResponse, errorResponseSchema } from "@sentinel/shared";
import axios, { type AxiosResponse } from "axios";
import i18n from "@/i18n";
import type { RequestOptions } from "@/services/http/httpInterface";
import { ApiError } from "@/utils/apiError/apiError";
import { showNotice } from "@/utils/notice/notice";

/**
 * Instancia compartida: cookies de sesión en cada petición y sin que axios lance por el estado HTTP
 * (el formato de error del backend se interpreta en `http`, no en un interceptor).
 */
export const apiClient = axios.create({
	withCredentials: true,
	validateStatus: () => true,
});

// El idioma de la interfaz viaja en cada petición: la API responde (y avisa) en ese idioma.
apiClient.interceptors.request.use((config) => {
	config.headers.set("Accept-Language", i18n.language);
	return config;
});

// Un aviso de éxito que mande la API se muestra tal cual llega.
apiClient.interceptors.response.use((response) => {
	showNotice(response.status, response.headers);
	return response;
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
		body?.reason,
	);
}
