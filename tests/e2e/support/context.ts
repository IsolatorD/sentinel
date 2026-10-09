/** Lo que el arranque global comparte con los tests (vía `inject("e2e")`). */
export interface E2EContext {
	baseUrl: string;
	/** Segunda API, idéntica pero que exige verificar el correo para entrar. */
	verifyBaseUrl: string;
	databaseUrl: string;
	redis: { host: string; port: number; db: number };
	ingestRateLimitPerMinute: number;
	/** Archivo (JSON por línea) donde el servidor SMTP de pruebas guarda cada correo recibido. */
	mailFile: string;
}

declare module "vitest" {
	export interface ProvidedContext {
		e2e: E2EContext;
	}
}
