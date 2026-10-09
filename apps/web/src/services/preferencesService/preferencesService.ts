import {
	preferencesDtoSchema,
	type UpdatePreferencesInput,
} from "@sentinel/shared";
import { http } from "@/services/http/http";

export const preferencesService = {
	get: () => http("/api/me/preferences", { schema: preferencesDtoSchema }),

	update: (input: UpdatePreferencesInput) =>
		http("/api/me/preferences", {
			method: "PATCH",
			body: input,
			schema: preferencesDtoSchema,
		}),
};
