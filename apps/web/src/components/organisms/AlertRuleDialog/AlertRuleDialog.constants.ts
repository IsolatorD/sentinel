/** Minutos entre dos avisos de la misma regla por el mismo issue. */
export const COOLDOWN_OPTIONS = [0, 5, 15, 60, 360, 1440] as const;

/** Ventanas ofrecidas para las reglas de frecuencia, en minutos. */
export const WINDOW_OPTIONS = [1, 5, 10, 30, 60, 360, 1440] as const;

export const DEFAULT_THRESHOLD = "10";
export const DEFAULT_WINDOW = 10;
export const DEFAULT_COOLDOWN = 60;

/** Ventanas ofrecidas para las reglas de rendimiento, en minutos (mínimo 5: con menos hay pocas transacciones). */
export const PERFORMANCE_WINDOW_OPTIONS = [
	5, 10, 15, 30, 60, 360, 1440,
] as const;

export const DEFAULT_PERFORMANCE_WINDOW = 15;
/** Umbral inicial: p95 en milisegundos, o tasa de errores en porcentaje. */
export const DEFAULT_P95_THRESHOLD = "1000";
export const DEFAULT_ERROR_RATE_THRESHOLD = "5";
