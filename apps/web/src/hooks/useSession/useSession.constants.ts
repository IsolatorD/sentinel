import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import { authService } from "@/services/authService/authService";

/** Opciones de la consulta de sesión; el router las usa para decidir el acceso a cada ruta. */
export const sessionQueryOptions = queryOptions({
	queryKey: queryKeys.session,
	queryFn: () => authService.getSession(),
	staleTime: 60_000,
	retry: false,
});
