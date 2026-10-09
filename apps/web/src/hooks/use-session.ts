import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { authService } from "@/services/authService/authService";
import { queryKeys } from "./query-keys";

/** Opciones de la consulta de sesión; el router las usa para decidir el acceso a cada ruta. */
export const sessionQueryOptions = queryOptions({
	queryKey: queryKeys.session,
	queryFn: () => authService.getSession(),
	staleTime: 60_000,
	retry: false,
});

/** Sesión actual: `null` si no hay usuario autenticado. */
export function useSession() {
	return useQuery(sessionQueryOptions);
}

/**
 * Tras iniciar sesión hay que leer la sesión de nuevo, no solo marcarla como vencida: si ninguna
 * pantalla la está observando, `invalidateQueries` no la vuelve a pedir y el guard del router
 * leería la caché vieja (`null`) y devolvería al usuario al login.
 */
function useRefreshSession() {
	const client = useQueryClient();
	return () => client.fetchQuery({ ...sessionQueryOptions, staleTime: 0 });
}

export function useSignIn() {
	const refreshSession = useRefreshSession();
	return useMutation({
		mutationFn: (input: { email: string; password: string }) =>
			authService.signInEmail(input),
		onSuccess: refreshSession,
	});
}

export function useSignUp() {
	const refreshSession = useRefreshSession();
	return useMutation({
		mutationFn: (input: { name: string; email: string; password: string }) =>
			authService.signUpEmail(input),
		onSuccess: refreshSession,
	});
}

export function useGoogleSignIn() {
	return useMutation({ mutationFn: () => authService.signInGoogle() });
}

export function useSignOut() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: () => authService.signOut(),
		// Al salir se descarta toda la caché: nada de la sesión anterior debe quedar a la vista.
		onSuccess: () => client.clear(),
	});
}
