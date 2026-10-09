import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import { organizationsService } from "@/services/organizationsService/organizationsService";

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
