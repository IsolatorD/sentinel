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

	async signUpEmail(input: {
		name: string;
		email: string;
		password: string;
	}): Promise<void> {
		unwrap(await authClient.signUp.email(input));
	},

	async signInGoogle(): Promise<void> {
		// Redirige al proveedor; al volver, la sesión ya está activa.
		unwrap(
			await authClient.signIn.social({
				provider: "google",
				callbackURL: window.location.origin,
			}),
		);
	},

	async signOut(): Promise<void> {
		unwrap(await authClient.signOut());
	},
};
