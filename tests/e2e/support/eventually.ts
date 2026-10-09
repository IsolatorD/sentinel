/** Reintenta una aserción hasta que pase (el worker procesa de forma asíncrona). */
export async function eventually<T>(
	fn: () => Promise<T> | T,
	{
		timeoutMs = 15_000,
		intervalMs = 150,
	}: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			await new Promise((r) => setTimeout(r, intervalMs));
		}
	}
	throw lastError;
}
