import type {
	CreateProjectInput,
	CreateProjectKeyInput,
	UpdateProjectInput,
	UpdateProjectKeyInput,
} from "@sentinel/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsService } from "@/services/projects.service";
import { queryKeys } from "./query-keys";

export function useProjects(orgId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.projects(orgId ?? ""),
		queryFn: () => projectsService.list(orgId as string),
		enabled: Boolean(orgId),
		staleTime: 30_000,
	});
}

/** Detalle de un proyecto, con sus claves DSN. */
export function useProject(
	orgId: string | undefined,
	projectId: string | undefined,
) {
	return useQuery({
		queryKey: queryKeys.project(orgId ?? "", projectId ?? ""),
		queryFn: () => projectsService.get(orgId as string, projectId as string),
		enabled: Boolean(orgId && projectId),
	});
}

export function useCreateProject(orgId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateProjectInput) =>
			projectsService.create(orgId, input),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.projects(orgId) }),
	});
}

export function useUpdateProject(orgId: string, projectId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdateProjectInput) =>
			projectsService.update(orgId, projectId, input),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.projects(orgId) }),
	});
}

export function useDeleteProject(orgId: string, projectId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: () => projectsService.remove(orgId, projectId),
		onSuccess: () => {
			client.removeQueries({ queryKey: queryKeys.project(orgId, projectId) });
			return client.invalidateQueries({ queryKey: queryKeys.projects(orgId) });
		},
	});
}

export function useCreateKey(orgId: string, projectId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateProjectKeyInput) =>
			projectsService.createKey(orgId, projectId, input),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.projects(orgId) }),
	});
}

export function useUpdateKey(orgId: string, projectId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (args: { keyId: string; input: UpdateProjectKeyInput }) =>
			projectsService.updateKey(orgId, projectId, args.keyId, args.input),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.projects(orgId) }),
	});
}

export function useDeleteKey(orgId: string, projectId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (keyId: string) =>
			projectsService.removeKey(orgId, projectId, keyId),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.projects(orgId) }),
	});
}
