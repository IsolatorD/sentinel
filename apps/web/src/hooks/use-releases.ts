import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { releasesService } from "@/services/releases.service";
import { queryKeys } from "./query-keys";

interface Scope {
	orgId: string | undefined;
	projectId: string | undefined;
}

export function useReleases(scope: Scope) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.releases(orgId ?? "", projectId ?? ""),
		queryFn: () => releasesService.list(orgId as string, projectId as string),
		enabled: Boolean(orgId && projectId),
		staleTime: 30_000,
	});
}

/** Entornos desde los que han llegado eventos: alimenta el filtro del listado. */
export function useEnvironments(scope: Scope) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.environments(orgId ?? "", projectId ?? ""),
		queryFn: () =>
			releasesService.environments(orgId as string, projectId as string),
		enabled: Boolean(orgId && projectId),
		staleTime: 60_000,
	});
}

export function useDeleteRelease(
	scope: Required<{ orgId: string; projectId: string }>,
) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (version: string) =>
			releasesService.remove(scope.orgId, scope.projectId, version),
		onSuccess: () =>
			client.invalidateQueries({
				queryKey: queryKeys.releases(scope.orgId, scope.projectId),
			}),
	});
}
