import type { z } from "zod";
import {
	apiClient,
	cleanQuery,
	toApiError,
} from "@/services/http/http.constants";
import type { RequestOptions } from "@/services/http/httpInterface";

/** Cliente HTTP mínimo: cookies de sesión, JSON y errores tipados. */
export async function http<S extends z.ZodType | undefined = undefined>(
	path: string,
	options: RequestOptions<S> = {},
): Promise<S extends z.ZodType ? z.infer<S> : undefined> {
	const res = await apiClient.request({
		url: path,
		method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
		params: cleanQuery(options.query),
		data: options.body,
		signal: options.signal,
	});

	if (res.status >= 400) throw toApiError(res);
	if (res.status === 204 || !options.schema) return undefined as never;
	return options.schema.parse(res.data) as never;
}
