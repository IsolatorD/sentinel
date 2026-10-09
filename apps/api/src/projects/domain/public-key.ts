import { randomBytes } from "node:crypto";

/** Clave pública de la DSN: 128 bits aleatorios en hexadecimal (32 caracteres). */
export function generatePublicKey(): string {
	return randomBytes(16).toString("hex");
}
