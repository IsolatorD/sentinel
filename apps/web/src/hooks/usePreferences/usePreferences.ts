import type { UpdatePreferencesInput } from "@sentinel/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import { useSession } from "@/hooks/useSession/useSession";
import { preferencesService } from "@/services/preferencesService/preferencesService";

/** Preferencias guardadas de la persona (idioma, tema, recorridos vistos). */
export function usePreferences() {
	const userId = useSession().data?.user.id;
	return useQuery({
		queryKey: queryKeys.preferences,
		queryFn: () => preferencesService.get(),
		enabled: Boolean(userId),
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});
}

export function useUpdatePreferences() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdatePreferencesInput) =>
			preferencesService.update(input),
		onSuccess: (saved) => client.setQueryData(queryKeys.preferences, saved),
	});
}
