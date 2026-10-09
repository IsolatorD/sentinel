import { Circle } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	ICONS,
	LEVEL_COLOR,
	summarize,
	time,
} from "@/components/organisms/BreadcrumbList/BreadcrumbList.constants";
import type { Breadcrumb } from "@/components/organisms/BreadcrumbList/BreadcrumbListInterface";
import { cn } from "@/utils/cn/cn";

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
