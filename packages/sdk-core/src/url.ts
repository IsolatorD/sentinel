/** Quita query y hash: pueden contener tokens u otros datos personales. */
export function stripQuery(url: string): string {
	return url.split(/[?#]/, 1)[0];
}
