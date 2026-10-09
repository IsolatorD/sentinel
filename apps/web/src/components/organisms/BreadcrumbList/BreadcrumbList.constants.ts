import {
	Circle,
	Globe,
	ImageOff,
	MousePointerClick,
	Navigation,
	Terminal,
} from "lucide-react";
import type { Breadcrumb } from "@/components/organisms/BreadcrumbList/BreadcrumbListInterface";

export const ICONS: Record<string, typeof Circle> = {
	"ui.click": MousePointerClick,
	console: Terminal,
	fetch: Globe,
	xhr: Globe,
	navigation: Navigation,
	resource: ImageOff,
};

export const LEVEL_COLOR: Record<string, string> = {
	fatal: "text-fatal",
	error: "text-error",
	warning: "text-warning",
	info: "text-muted",
	debug: "text-faint",
};

/** Resume el breadcrumb en una línea: el mensaje o, para peticiones y navegación, sus datos. */
export function summarize(crumb: Breadcrumb): string {
	if (crumb.message) return crumb.message;
	const data = crumb.data ?? {};
	if (data.method && data.url)
		return `${data.method} ${data.url}${data.status_code ? ` [${data.status_code}]` : ""}`;
	if (data.from && data.to) return `${data.from} → ${data.to}`;
	if (data.url) return String(data.url);
	return "";
}

export function time(
	value: string | number | undefined,
	locale: string,
): string {
	if (value === undefined) return "";
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? ""
		: date.toLocaleTimeString(locale, { hour12: false });
}
