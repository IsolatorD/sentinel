export type TourId = "welcome" | "issues" | "issueDetail" | "performance";

export interface UseTourOptions {
	/** `true` cuando la pantalla ya tiene en el DOM lo que el recorrido va a señalar. */
	ready: boolean;
}
