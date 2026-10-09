/** Lo que el arranque global comparte con los tests (vía `inject("e2e")`). */
export interface E2EContext {
	baseUrl: string;
	databaseUrl: string;
	redis: { host: string; port: number; db: number };
	ingestRateLimitPerMinute: number;
}

declare module "vitest" {
	export interface ProvidedContext {
		e2e: E2EContext;
	}
}
