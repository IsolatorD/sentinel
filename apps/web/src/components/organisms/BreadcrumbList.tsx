import type { IngestEvent } from "@sentinel/shared";
import {
	Circle,
	Globe,
	ImageOff,
	MousePointerClick,
	Navigation,
	Terminal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type Breadcrumb = NonNullable<IngestEvent["breadcrumbs"]>[number];

const ICONS: Record<string, typeof Circle> = {
	"ui.click": MousePointerClick,
	console: Terminal,
	fetch: Globe,
	xhr: Globe,
	navigation: Navigation,
	resource: ImageOff,
};

const LEVEL_COLOR: Record<string, string> = {
	fatal: "text-fatal",
	error: "text-error",
	warning: "text-warning",
	info: "text-muted",
	debug: "text-faint",
};

/** Resume el breadcrumb en una línea: el mensaje o, para peticiones y navegación, sus datos. */
function summarize(crumb: Breadcrumb): string {
	if (crumb.message) return crumb.message;
	const data = crumb.data ?? {};
	if (data.method && data.url)
		return `${data.method} ${data.url}${data.status_code ? ` [${data.status_code}]` : ""}`;
	if (data.from && data.to) return `${data.from} → ${data.to}`;
	if (data.url) return String(data.url);
	return "";
}

function time(value: string | number | undefined, locale: string): string {
	if (value === undefined) return "";
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? ""
		: date.toLocaleTimeString(locale, { hour12: false });
}

export function BreadcrumbList({ breadcrumbs }: { breadcrumbs: Breadcrumb[] }) {
	const { t, i18n } = useTranslation();
	if (breadcrumbs.length === 0)
		return <p className="text-sm text-muted">{t("issue.breadcrumbs.empty")}</p>;

	return (
		<ol className="-mx-1 divide-y divide-border" data-testid="breadcrumbs">
			{/* El más reciente arriba: es el más cercano al error. */}
			{[...breadcrumbs].reverse().map((crumb, i) => {
				const Icon = ICONS[crumb.category ?? ""] ?? Circle;
				return (
					<li
						// biome-ignore lint/suspicious/noArrayIndexKey: lista inmutable derivada del evento; los breadcrumbs no tienen id propio
						key={`${crumb.timestamp}-${i}`}
						className="flex items-baseline gap-3 px-1 py-2"
					>
						<Icon
							aria-hidden
							className={cn(
								"relative top-0.5 size-3.5 shrink-0",
								LEVEL_COLOR[crumb.level ?? "info"] ?? "text-muted",
							)}
						/>
						<span className="w-20 shrink-0 truncate font-mono text-xs text-muted">
							{crumb.category ?? crumb.type ?? "default"}
						</span>
						<span className="min-w-0 flex-1 break-words font-mono text-xs text-foreground">
							{summarize(crumb)}
						</span>
						<time className="shrink-0 font-mono text-[11px] text-faint">
							{time(crumb.timestamp, i18n.language)}
						</time>
					</li>
				);
			})}
		</ol>
	);
}
