import { QueryCache, QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query-keys";
import { ApiError } from "@/lib/api-error";

export function createQueryClient(
	options: { retry?: boolean } = {},
): QueryClient {
	const client: QueryClient = new QueryClient({
		queryCache: new QueryCache({
			onError: (error) => {
				// Una sesión caducada en mitad del uso: marcamos "sin sesión" y la app redirige al login.
				if (error instanceof ApiError && error.status === 401) {
					client.setQueryData(queryKeys.session, null);
				}
			},
		}),
		defaultOptions: {
			queries: {
				staleTime: 15_000,
				refetchOnWindowFocus: false,
				// Los errores 4xx no mejoran reintentando.
				retry:
					options.retry === false
						? false
						: (failureCount, error) =>
								!(
									error instanceof ApiError &&
									error.status >= 400 &&
									error.status < 500
								) && failureCount < 2,
			},
		},
	});
	return client;
}
