import { TOUR_IDS } from "@sentinel/shared";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUpdatePreferences } from "@/hooks/usePreferences/usePreferences";
import { useSession } from "@/hooks/useSession/useSession";
import { TOUR_DELAY_MS, TOURS } from "@/hooks/useTour/useTour.constants";
import type { TourId, UseTourOptions } from "@/hooks/useTour/useTourInterface";
import {
	readStorage,
	removeStorage,
	writeStorage,
} from "@/utils/storage/storage";
import { tourSeenKey } from "@/utils/storage/storage.constants";
import { isTourActive, isTourEnabled, startTour } from "@/utils/tour/tour";

/** Recorridos que esta persona ya vio en este navegador. */
function seenTours(userId: string): TourId[] {
	return TOUR_IDS.filter((id) => readStorage(tourSeenKey(userId, id)));
}

/**
 * Recorrido guiado de una pantalla. Se lanza solo la primera vez que la persona llega (y no antes de
 * haber visto el de bienvenida), y `start` permite repetirlo. Quién lo vio se recuerda por usuario.
 */
export function useTour(id: TourId, { ready }: UseTourOptions) {
	const { t } = useTranslation();
	const userId = useSession().data?.user.id;
	const savePreferences = useUpdatePreferences();

	const start = useCallback(() => {
		if (!userId) return false;
		return startTour({
			steps: TOURS[id].map((step) => ({
				target: step.target,
				title: t(step.title),
				body: t(step.body),
				side: step.side,
			})),
			labels: {
				next: t("tour.next"),
				back: t("tour.back"),
				done: t("tour.done"),
				progress: t("tour.progress", {
					current: "{{current}}",
					total: "{{total}}",
				}),
			},
			// Cerrarlo a medias también cuenta: no se vuelve a molestar.
			onClose: () => {
				writeStorage(tourSeenKey(userId, id), "1");
				savePreferences.mutate({ toursSeen: seenTours(userId) });
			},
		});
	}, [id, t, userId, savePreferences]);

	useEffect(() => {
		if (!ready || !userId || !isTourEnabled()) return;
		if (readStorage(tourSeenKey(userId, id))) return;
		// Las pantallas se explican después de la bienvenida, nunca encima de ella.
		if (id !== "welcome" && !readStorage(tourSeenKey(userId, "welcome")))
			return;
		const timer = setTimeout(() => {
			if (!isTourActive()) start();
		}, TOUR_DELAY_MS);
		return () => clearTimeout(timer);
	}, [ready, userId, id, start]);

	/** Olvida todo lo visto y vuelve a lanzar la bienvenida. */
	const restart = useCallback(() => {
		if (userId) {
			for (const tour of Object.keys(TOURS))
				removeStorage(tourSeenKey(userId, tour));
			savePreferences.mutate({ toursSeen: [] });
		}
		return start();
	}, [userId, start, savePreferences]);

	return { start, restart };
}
