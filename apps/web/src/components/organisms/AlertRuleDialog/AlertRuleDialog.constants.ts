/** Minutos entre dos avisos de la misma regla por el mismo issue. */
export const COOLDOWN_OPTIONS = [0, 5, 15, 60, 360, 1440] as const;

/** Ventanas ofrecidas para las reglas de frecuencia, en minutos. */
export const WINDOW_OPTIONS = [1, 5, 10, 30, 60, 360, 1440] as const;

export const DEFAULT_THRESHOLD = "10";
export const DEFAULT_WINDOW = 10;
export const DEFAULT_COOLDOWN = 60;
