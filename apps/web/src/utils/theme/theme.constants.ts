export const THEMES = ["system", "light", "dark"] as const;

export const THEME_KEY = "sentinel:theme";
export const DEFAULT_THEME = "system";

/** Consulta con la que el navegador dice si el sistema está en oscuro. */
export const DARK_QUERY = "(prefers-color-scheme: dark)";
