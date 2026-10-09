import { TOUR_IDS } from "@sentinel/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
	usePreferences,
	useUpdatePreferences,
} from "@/hooks/usePreferences/usePreferences";
import { useSession } from "@/hooks/useSession/useSession";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { readStorage, writeStorage } from "@/utils/storage/storage";
import { tourSeenKey } from "@/utils/storage/storage.constants";
import { readThemePreference, setThemePreference } from "@/utils/theme/theme";

/**
 * Hace que las preferencias guardadas en el servidor y las de este navegador coincidan, una vez por
 * sesión: lo guardado manda (así el idioma, el tema y los recorridos vistos siguen a la persona
 * entre dispositivos); lo que el servidor aún no tiene se sube desde este navegador.
 */
export function usePreferencesSync(): void {
	const { i18n } = useTranslation();
	const userId = useSession().data?.user.id;
	const preferences = usePreferences();
	const update = useUpdatePreferences();
	const syncedFor = useRef<string>(undefined);

	useEffect(() => {
		const saved = preferences.data;
		if (!userId || !saved || syncedFor.current === userId) return;
		syncedFor.current = userId;

		const push: Parameters<typeof update.mutate>[0] = {};

		// Idioma
		const current = SUPPORTED_LANGUAGES.find((l) =>
			i18n.language?.startsWith(l),
		);
		if (saved.locale) {
			if (saved.locale !== current) void i18n.changeLanguage(saved.locale);
		} else if (current) {
			push.locale = current;
		}

		// Tema
		if (saved.theme) {
			if (saved.theme !== readThemePreference())
				setThemePreference(saved.theme);
		} else {
			push.theme = readThemePreference();
		}

		// Recorridos vistos: la unión de lo del servidor y lo de este navegador
		const local = TOUR_IDS.filter((id) => readStorage(tourSeenKey(userId, id)));
		for (const id of saved.toursSeen)
			writeStorage(tourSeenKey(userId, id), "1");
		const merged = TOUR_IDS.filter(
			(id) => saved.toursSeen.includes(id) || local.includes(id),
		);
		if (merged.length > saved.toursSeen.length) push.toursSeen = merged;

		if (Object.keys(push).length > 0) update.mutate(push);
	}, [userId, preferences.data, i18n, update]);
}
