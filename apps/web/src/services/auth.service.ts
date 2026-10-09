import { ApiError } from "@/lib/api-error";
import { authClient } from "./auth-client.js";

export interface SessionUser {
	id: string;
	name: string;
	email: string;
	image?: string | null;
}

type BetterAuthError = {
	message?: string;
	status: number;
	code?: string;
} | null;

function unwrap<T>(result: { data: T | null; error: BetterAuthError }): T {
	if (result.error) {
		throw new ApiError(
			result.error.status,
			result.error.message ?? "Request failed",
			result.error.code,
		);
	}
	return result.data as T;
}

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
