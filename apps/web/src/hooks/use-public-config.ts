import { useQuery } from "@tanstack/react-query";
import { configService } from "@/services/config.service";
import { queryKeys } from "./query-keys";

export function usePublicConfig() {
	return useQuery({
		queryKey: queryKeys.publicConfig,
		queryFn: () => configService.getPublicConfig(),
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});
}
