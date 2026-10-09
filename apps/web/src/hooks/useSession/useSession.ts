import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/hooks/useSession/useSession.constants";
import i18n from "@/i18n";
import { authService } from "@/services/authService/authService";
import { notify } from "@/utils/notice/notice";

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
		mutationFn: (vars: {
			name: string;
			email: string;
			password: string;
			callbackURL?: string;
		}) => {
			const { callbackURL, ...input } = vars;
			return authService.signUpEmail(input, callbackURL);
		},
		// Con la cuenta pendiente de verificar no hay sesión que leer.
		onSuccess: (result) =>
			result.needsVerification ? undefined : refreshSession(),
	});
}

export function useResendVerification() {
	return useMutation({
		mutationFn: (vars: { email: string; callbackURL: string }) =>
			authService.sendVerificationEmail(vars.email, vars.callbackURL),
		onSuccess: () => notify(i18n.t("notices.verificationSent")),
	});
}

export function useGoogleSignIn() {
	return useMutation({
		mutationFn: (returnTo?: string) => authService.signInGoogle(returnTo),
	});
}

export function useSignOut() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: () => authService.signOut(),
		// Al salir se descarta toda la caché: nada de la sesión anterior debe quedar a la vista.
		onSuccess: () => client.clear(),
	});
}
