import { Outlet } from "@tanstack/react-router";
import { usePreferencesSync } from "@/hooks/usePreferencesSync/usePreferencesSync";

/** Todo lo que requiere sesión: aquí se sincronizan las preferencias de la persona. */
export function AuthedLayoutPage() {
	usePreferencesSync();
	return <Outlet />;
}
