import { useSelfMonitoring } from "@/hooks/useSelfMonitoring/useSelfMonitoring";

/** No dibuja nada: activa que la web reporte sus propios errores si el servidor lo configuró. */
export function SelfMonitoring() {
	useSelfMonitoring();
	return null;
}
