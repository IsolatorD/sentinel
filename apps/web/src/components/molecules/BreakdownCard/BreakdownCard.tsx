import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import type { BreakdownCardProps } from "@/components/molecules/BreakdownCard/BreakdownCardInterface";
import { formatCompact } from "@/utils/time/time";

/** Un reparto como barras horizontales: cada clave con su cantidad y su porcentaje del total. */
export function BreakdownCard({
	title,
	items,
	labelOf,
	colorOf,
	testId,
}: BreakdownCardProps) {
	const { t, i18n } = useTranslation();
	const total = items.reduce((sum, item) => sum + item.count, 0);
	return (
		<Card className="p-4" data-testid={testId}>
			<h3 className="text-sm font-semibold text-foreground">{title}</h3>
			{items.length === 0 ? (
				<p className="mt-3 text-sm text-muted">{t("overview.noData")}</p>
			) : (
				<ul className="mt-3 space-y-2.5">
					{items.map((item) => (
						<li key={item.key} data-testid="breakdown-item">
							<div className="flex items-baseline justify-between gap-3 text-sm">
								<span className="truncate text-foreground">
									{labelOf(item.key)}
								</span>
								<span className="shrink-0 tabular-nums text-muted">
									{formatCompact(item.count, i18n.language)}
								</span>
							</div>
							<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
								<div
									className={`h-full rounded-full ${colorOf?.(item.key) ?? "bg-primary"}`}
									style={{
										width: `${total ? (item.count / total) * 100 : 0}%`,
									}}
								/>
							</div>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
