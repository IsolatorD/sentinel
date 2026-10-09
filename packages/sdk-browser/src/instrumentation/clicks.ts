import type { AddBreadcrumb, Uninstall } from "./types";

/**
 * Describe un elemento como `div#app > main > button.btn.primary`.
 * Nunca incluye el texto ni los valores: pueden contener datos personales.
 */
export function describeElement(el: Element, maxDepth = 3): string {
	const parts: string[] = [];
	let current: Element | null = el;
	while (current && parts.length < maxDepth && current.tagName) {
		let part = current.tagName.toLowerCase();
		if (current.id) part += `#${current.id}`;
		const classes = (
			typeof current.className === "string" ? current.className : ""
		)
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 3);
		if (classes.length > 0) part += `.${classes.join(".")}`;
		parts.unshift(part);
		if (current.id) break;
		current = current.parentElement;
	}
	return parts.join(" > ");
}

export function installClicks(add: AddBreadcrumb): Uninstall {
	if (typeof document === "undefined") return () => {};

	const handler = (event: Event) => {
		try {
			const target = event.target;
			if (!(target instanceof Element)) return;
			add({
				category: "ui.click",
				type: "user",
				message: describeElement(target),
			});
		} catch {
			// Nunca interferir con la app.
		}
	};
	document.addEventListener("click", handler, { capture: true, passive: true });
	return () =>
		document.removeEventListener("click", handler, { capture: true });
}
