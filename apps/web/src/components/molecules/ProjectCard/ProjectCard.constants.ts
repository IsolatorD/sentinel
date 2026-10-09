export const PLATFORM_KEYS = [
	"javascript",
	"react",
	"node",
	"react-native",
	"python",
	"other",
] as const;

export function isPlatform(
	value: string,
): value is (typeof PLATFORM_KEYS)[number] {
	return (PLATFORM_KEYS as readonly string[]).includes(value);
}
