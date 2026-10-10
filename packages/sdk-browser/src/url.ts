import { stripQuery } from "@sentinel/core";

export { stripQuery };

export function pageUrl(sendFullUrl: boolean): string | undefined {
	if (typeof location === "undefined") return undefined;
	return sendFullUrl ? location.href : stripQuery(location.href);
}
