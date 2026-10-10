import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import type { SlowestCardProps } from "@/components/organisms/SlowestCard/SlowestCardInterface";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { formatMs } from "@/utils/performance/performance";

/** Las transacciones con peor p95 del periodo; cada una abre su detalle en Rendimiento. */
export function SlowestCard({ items, period }: SlowestCardProps) {
	const { t, i18n } = useTranslation();
	const { organization, project } = useCurrentProject();
	return (
		<Card className="p-4" data-testid="slowest">
			<h3 className="text-sm font-semibold text-foreground">
				{t("overview.slowest")}
			</h3>
			{items.length === 0 || !organization || !project ? (
				<p className="mt-3 text-sm text-muted">{t("overview.noData")}</p>
			) : (
				<ul className="mt-3 divide-y divide-border">
					{items.map((item) => (
						<li
							key={`${item.name}|${item.op}`}
							className="flex items-center gap-3 py-2"
							data-testid="slow-item"
						>
							<Link
								to="/$orgSlug/projects/$projectSlug/performance/transaction"
								params={{
									orgSlug: organization.slug,
									projectSlug: project.slug,
								}}
								search={{
									name: item.name,
									period:
										period === "24h" ? undefined : (period as "7d" | "30d"),
								}}
								className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
								title={item.name}
							>
								{item.name}
							</Link>
							<span className="shrink-0 font-mono text-xs text-faint">
								{item.op}
							</span>
							<span className="w-16 shrink-0 text-right text-sm tabular-nums">
								{formatMs(item.p95, i18n.language)}
							</span>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
