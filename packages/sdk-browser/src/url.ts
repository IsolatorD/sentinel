/** Quita query y hash: pueden contener tokens u otros datos personales. */
export function stripQuery(url: string): string {
	return url.split(/[?#]/, 1)[0];
}

export function pageUrl(sendFullUrl: boolean): string | undefined {
	if (typeof location === "undefined") return undefined;
	return sendFullUrl ? location.href : stripQuery(location.href);
}
