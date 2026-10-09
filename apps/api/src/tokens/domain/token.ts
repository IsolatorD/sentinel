import { createHash, randomBytes } from "node:crypto";

export const TOKEN_PREFIX = "snt_";

export interface GeneratedToken {
	/** Valor completo: se muestra una sola vez. */
	token: string;
	hash: string;
	/** Inicio visible en la lista (reconocible, no utilizable). */
	prefix: string;
}

/** Los tokens llevan 192 bits aleatorios; en la base de datos solo se guarda su hash. */
export function generateToken(): GeneratedToken {
	const token = `${TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
	return {
		token,
		hash: hashToken(token),
		prefix: token.slice(0, TOKEN_PREFIX.length + 6),
	};
}

export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/** Descarta de entrada lo que no puede ser un token nuestro (evita una consulta inútil). */
export function looksLikeToken(value: string): boolean {
	return /^snt_[0-9a-f]{48}$/.test(value);
}
