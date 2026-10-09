import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import type { Scope } from "@/hooks/useReleases/useReleasesInterface";
import { releasesService } from "@/services/releasesService/releasesService";

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

/** Archivos (source maps) subidos para una release; solo se piden cuando hay una versión elegida. */
export function useArtifacts(scope: Scope, version: string | undefined) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.artifacts(orgId ?? "", projectId ?? "", version ?? ""),
		queryFn: () =>
			releasesService.artifacts(
				orgId as string,
				projectId as string,
				version as string,
			),
		enabled: Boolean(orgId && projectId && version),
	});
}

export function useDeleteArtifact(
	scope: Required<{ orgId: string; projectId: string }>,
	version: string,
) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (artifactId: string) =>
			releasesService.removeArtifact(
				scope.orgId,
				scope.projectId,
				version,
				artifactId,
			),
		// También cambia el contador de archivos de la tabla de releases.
		onSuccess: () =>
			client.invalidateQueries({
				queryKey: queryKeys.releases(scope.orgId, scope.projectId),
			}),
	});
}
