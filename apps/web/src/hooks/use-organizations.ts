import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationsService } from "@/services/organizations.service";
import { queryKeys } from "./query-keys";

export function useOrganizations() {
	return useQuery({
		queryKey: queryKeys.organizations,
		queryFn: () => organizationsService.list(),
		staleTime: 60_000,
	});
}

export function useCreateOrganization() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: { name: string; slug: string }) =>
			organizationsService.create(input),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.organizations }),
	});
}
