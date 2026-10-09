import type { BetterAuthError } from "@/services/authService/authServiceInterface";
import { ApiError } from "@/utils/apiError/apiError";

export function unwrap<T>(result: {
	data: T | null;
	error: BetterAuthError;
}): T {
	if (result.error) {
		throw new ApiError(
			result.error.status,
			result.error.message ?? "Request failed",
			result.error.code,
		);
	}
	return result.data as T;
}
