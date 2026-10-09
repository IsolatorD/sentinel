import { stripQuery } from "../url";
import type { AddBreadcrumb, Uninstall } from "./types";

export function installNavigation(add: AddBreadcrumb): Uninstall {
	if (typeof window === "undefined" || typeof history === "undefined")
		return () => {};

	let from = stripQuery(location.href);
	const record = () => {
		try {
			const to = stripQuery(location.href);
			if (to === from) return;
			add({ category: "navigation", type: "navigation", data: { from, to } });
			from = to;
		} catch {}
	};

	const originalPush = history.pushState;
	const originalReplace = history.replaceState;
	const wrap = (original: typeof history.pushState): typeof history.pushState =>
		function (this: History, ...args) {
			const result = original.apply(this, args);
			record();
			return result;
		};
	history.pushState = wrap(originalPush);
	history.replaceState = wrap(originalReplace);
	window.addEventListener("popstate", record);
	window.addEventListener("hashchange", record);

	return () => {
		history.pushState = originalPush;
		history.replaceState = originalReplace;
		window.removeEventListener("popstate", record);
		window.removeEventListener("hashchange", record);
	};
}
