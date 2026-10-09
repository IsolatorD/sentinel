import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import i18n from "@/i18n";

// Mismo origen: en desarrollo Vite redirige /api al backend.
export const authClient = createAuthClient({
	plugins: [organizationClient()],
	fetchOptions: {
		// El idioma de la interfaz viaja en cada petición: los correos (verificación, invitaciones) salen en él.
		onRequest: (context) => {
			const headers = new Headers(context.headers);
			headers.set("Accept-Language", i18n.language);
			return { ...context, headers };
		},
	},
});
