export interface SessionUser {
	id: string;
	name: string;
	email: string;
	image?: string | null;
}

export type BetterAuthError = {
	message?: string;
	status: number;
	code?: string;
} | null;
