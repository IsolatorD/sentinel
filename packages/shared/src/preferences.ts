import { z } from "zod";
import { SUPPORTED_LOCALES } from "./locale.js";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export const TOUR_IDS = [
	"welcome",
	"issues",
	"issueDetail",
	"performance",
] as const;

export const preferencesDtoSchema = z.object({
	/** `null` mientras la persona no haya elegido: se usa el idioma del navegador. */
	locale: z.enum(SUPPORTED_LOCALES).nullable(),
	theme: z.enum(THEME_PREFERENCES).nullable(),
	/** Recorridos guiados que ya vio. */
	toursSeen: z.array(z.enum(TOUR_IDS)),
});
export type PreferencesDto = z.infer<typeof preferencesDtoSchema>;

export const updatePreferencesSchema = z
	.object({
		locale: z.enum(SUPPORTED_LOCALES).optional(),
		theme: z.enum(THEME_PREFERENCES).optional(),
		/** Reemplaza la lista completa (vacía = volver a ver todos los recorridos). */
		toursSeen: z.array(z.enum(TOUR_IDS)).max(TOUR_IDS.length).optional(),
	})
	.refine((v) => Object.keys(v).length > 0, { message: "NOTHING_TO_UPDATE" });
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
