import type { VitalRating } from "@sentinel/shared";

/** Tono de la insignia (y color del texto) de cada valoración de un Web Vital. */
export const RATING_TONE: Record<
	VitalRating,
	"success" | "warning" | "danger"
> = {
	good: "success",
	"needs-improvement": "warning",
	poor: "danger",
};

export const RATING_TEXT: Record<VitalRating, string> = {
	good: "text-success",
	"needs-improvement": "text-warning",
	poor: "text-danger",
};

export const RATING_BAR: Record<VitalRating, string> = {
	good: "bg-success",
	"needs-improvement": "bg-warning",
	poor: "bg-danger",
};

/** Color de la barra de un span en la cascada, según el tipo de trabajo. */
export const SPAN_COLORS: Array<[prefix: string, className: string]> = [
	["http", "bg-info"],
	["db", "bg-success"],
	["ui", "bg-primary"],
	["browser", "bg-warning"],
	["pageload", "bg-primary/50"],
	["navigation", "bg-primary/50"],
];
export const SPAN_COLOR_DEFAULT = "bg-muted";
