import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Mismo origen: en desarrollo Vite redirige /api al backend.
export const authClient = createAuthClient({
	plugins: [organizationClient()],
});
