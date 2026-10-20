import * as Sentinel from "@argus-isolator/browser";
import { useEffect } from "react";
import { usePublicConfig } from "@/hooks/usePublicConfig/usePublicConfig";

/**
 * La web reporta sus propios errores a un proyecto de esta misma instancia, con la misma SDK que usan los
 * demás (`@argus-isolator/browser`). La DSN la da el servidor (`monitoringDsn`): si no la hay, no hace nada.
 */
export function useSelfMonitoring(): void {
	const dsn = usePublicConfig().data?.monitoringDsn;
	useEffect(() => {
		if (!dsn) return;
		Sentinel.init({ dsn, environment: import.meta.env.MODE });
		return () => {
			void Sentinel.close();
		};
	}, [dsn]);
}
