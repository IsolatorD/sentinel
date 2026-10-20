import * as Sentinel from "@argus-isolator/node";

let active = false;

/**
 * La instancia se vigila a sí misma: sus errores inesperados van a un proyecto suyo, con la misma SDK
 * que usan los demás (`@argus-isolator/node`). Solo errores: sin trazas de rendimiento (cada envío
 * sería a su vez una petición medida, y se enviaría a sí misma sin fin).
 * Sin DSN no hace nada. Nunca lanza.
 */
export function startSelfMonitor(opts: {
	dsn?: string;
	environment: string;
}): boolean {
	if (!opts.dsn) return false;
	Sentinel.init({ dsn: opts.dsn, environment: opts.environment });
	active = true;
	return true;
}

/** Un error 5xx que no es culpa de quien hizo la petición. */
export function reportUnexpected(error: unknown): void {
	if (active) Sentinel.captureException(error);
}

export function stopSelfMonitor(): Promise<void> {
	return active
		? Sentinel.close(2_000).then(() => undefined)
		: Promise.resolve();
}
