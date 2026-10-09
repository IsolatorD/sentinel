import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tokensService } from "@/services/tokensService/tokensService";
import { queryKeys } from "./query-keys";

export function useTokens(orgId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.tokens(orgId ?? ""),
		queryFn: () => tokensService.list(orgId as string),
		enabled: Boolean(orgId),
		// Una respuesta 403 (member) no se arregla reintentando.
		retry: false,
	});
}

export function useCreateToken(orgId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (name: string) => tokensService.create(orgId, name),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.tokens(orgId) }),
	});
}

export function useRevokeToken(orgId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (tokenId: string) => tokensService.revoke(orgId, tokenId),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.tokens(orgId) }),
	});
}
