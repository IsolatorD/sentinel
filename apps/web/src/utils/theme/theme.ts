import { readStorage, writeStorage } from "@/utils/storage/storage";
import {
	DARK_QUERY,
	DEFAULT_THEME,
	THEME_KEY,
	THEMES,
} from "@/utils/theme/theme.constants";
import type {
	ResolvedTheme,
	ThemePreference,
} from "@/utils/theme/themeInterface";

export const isThemePreference = (value: unknown): value is ThemePreference =>
	typeof value === "string" && (THEMES as readonly string[]).includes(value);

/** Qué tema se pinta: el elegido o, con "sistema", el del sistema. */
export function resolveTheme(
	preference: ThemePreference,
	systemIsDark: boolean,
): ResolvedTheme {
	if (preference === "system") return systemIsDark ? "dark" : "light";
	return preference;
}

const systemIsDark = () =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia(DARK_QUERY).matches;

export function readThemePreference(): ThemePreference {
	const stored = readStorage(THEME_KEY);
	return isThemePreference(stored) ? stored : DEFAULT_THEME;
}

/** Pone el tema en el documento: el atributo para los estilos y `color-scheme` para los controles nativos. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
	const resolved = resolveTheme(preference, systemIsDark());
	const root = document.documentElement;
	root.dataset.theme = resolved;
	root.style.colorScheme = resolved;
	return resolved;
}

// ---------- Almacén (para useSyncExternalStore) ----------

const listeners = new Set<() => void>();

export function subscribeTheme(listener: () => void): () => void {
	listeners.add(listener);
	// El sistema puede cambiar mientras la app está abierta (p. ej. atardecer automático).
	const media =
		typeof window.matchMedia === "function"
			? window.matchMedia(DARK_QUERY)
			: undefined;
	const onSystemChange = () => {
		applyTheme(readThemePreference());
		listener();
	};
	media?.addEventListener?.("change", onSystemChange);
	return () => {
		listeners.delete(listener);
		media?.removeEventListener?.("change", onSystemChange);
	};
}

export function setThemePreference(preference: ThemePreference): void {
	writeStorage(THEME_KEY, preference);
	applyTheme(preference);
	for (const listener of listeners) listener();
}
