import { useSyncExternalStore } from "react";
import {
	readThemePreference,
	setThemePreference,
	subscribeTheme,
} from "@/utils/theme/theme";

/** Tema elegido (claro, oscuro o sistema) y cómo cambiarlo; se aplica al documento al instante. */
export function useTheme() {
	const theme = useSyncExternalStore(
		subscribeTheme,
		readThemePreference,
		() => "system" as const,
	);
	return { theme, setTheme: setThemePreference };
}
