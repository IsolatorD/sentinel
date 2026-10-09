import { driver } from "driver.js";
import { TOUR_ATTRIBUTE } from "@/utils/tour/tour.constants";
import type { StartTourOptions } from "@/utils/tour/tourInterface";

let active: ReturnType<typeof driver> | undefined;

/** ¿Hay un recorrido en pantalla? Solo se muestra uno a la vez. */
export function isTourActive(): boolean {
	return active?.isActive() ?? false;
}

/** Los recorridos no se lanzan solos en las pruebas: taparían la pantalla que se está comprobando. */
export function isTourEnabled(): boolean {
	return import.meta.env.MODE !== "test";
}

const selectorFor = (target: string) => `[${TOUR_ATTRIBUTE}="${target}"]`;

/** Un elemento escondido (menú móvil cerrado, pestaña distinta) no se puede señalar. */
function isVisible(element: Element | null): element is Element {
	return element !== null && element.getClientRects().length > 0;
}

/**
 * Muestra un recorrido con los pasos cuyo elemento está en pantalla. Devuelve `false` si no hay
 * ningún paso que mostrar o si ya hay otro recorrido activo.
 */
export function startTour({
	steps,
	labels,
	onClose,
}: StartTourOptions): boolean {
	if (isTourActive()) return false;
	const visible = steps.filter((step) =>
		isVisible(document.querySelector(selectorFor(step.target))),
	);
	if (visible.length === 0) return false;

	const reduceMotion =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	active = driver({
		animate: !reduceMotion,
		smoothScroll: !reduceMotion,
		showProgress: visible.length > 1,
		progressText: labels.progress,
		nextBtnText: labels.next,
		prevBtnText: labels.back,
		doneBtnText: labels.done,
		overlayOpacity: 0.55,
		stagePadding: 6,
		stageRadius: 8,
		popoverClass: "sentinel-tour",
		steps: visible.map((step) => ({
			element: selectorFor(step.target),
			popover: {
				title: step.title,
				description: step.body,
				side: step.side ?? "bottom",
			},
		})),
		onDestroyed: () => {
			active = undefined;
			onClose();
		},
	});
	active.drive();
	return true;
}
