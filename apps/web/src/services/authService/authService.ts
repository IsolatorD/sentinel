import { authClient } from "@/services/authClient/authClient";
import { unwrap } from "@/services/authService/authService.constants";
import type { SessionUser } from "@/services/authService/authServiceInterface";

export const authService = {
	async getSession(): Promise<{ user: SessionUser } | null> {
		const data = unwrap(await authClient.getSession());
		return data ? { user: data.user as SessionUser } : null;
	},

	async signInEmail(input: { email: string; password: string }): Promise<void> {
		unwrap(await authClient.signIn.email(input));
	},

	/** Devuelve si la cuenta quedó pendiente de verificar el correo (en ese caso no hay sesión). */
	async signUpEmail(
		input: { name: string; email: string; password: string },
		callbackURL?: string,
	): Promise<{ needsVerification: boolean }> {
		const data = unwrap(
			await authClient.signUp.email({ ...input, callbackURL }),
		);
		return { needsVerification: data?.token === null };
	},

	/** `returnTo`: ruta interna a la que volver tras autenticarse con Google. */
	async signInGoogle(returnTo?: string): Promise<void> {
		// Redirige al proveedor; al volver, la sesión ya está activa.
		unwrap(
			await authClient.signIn.social({
				provider: "google",
				callbackURL: `${window.location.origin}${returnTo ?? ""}`,
			}),
		);
	},

	async signOut(): Promise<void> {
		unwrap(await authClient.signOut());
	},

	/** Pide de nuevo el correo con el enlace de verificación. */
	async sendVerificationEmail(
		email: string,
		callbackURL: string,
	): Promise<void> {
		unwrap(await authClient.sendVerificationEmail({ email, callbackURL }));
	},
};
