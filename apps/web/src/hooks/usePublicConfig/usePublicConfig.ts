import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import { configService } from "@/services/configService/configService";

export function usePublicConfig() {
	return useQuery({
		queryKey: queryKeys.publicConfig,
		queryFn: () => configService.getPublicConfig(),
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});
}
