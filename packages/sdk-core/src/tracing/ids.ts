/** Identificador aleatorio de `bytes` bytes en hexadecimal (8 para un span, 16 para una traza). */
export function randomHex(bytes: number): string {
	const arr = new Uint8Array(bytes);
	const c = (globalThis as { crypto?: Crypto }).crypto;
	if (c?.getRandomValues) c.getRandomValues(arr);
	else for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
	// Un id de solo ceros no es válido en W3C trace-context.
	if (arr.every((b) => b === 0)) arr[bytes - 1] = 1;
	return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
