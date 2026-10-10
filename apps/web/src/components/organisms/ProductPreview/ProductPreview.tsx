import { useTranslation } from "react-i18next";
import { Sparkline } from "@/components/atoms/Sparkline/Sparkline";
import { LEVEL_BAR } from "@/components/molecules/IssueListItem/IssueListItem.constants";
import { LatencyChart } from "@/components/molecules/LatencyChart/LatencyChart";
import { LevelBadge } from "@/components/molecules/LevelBadge/LevelBadge";
import { VitalCard } from "@/components/molecules/VitalCard/VitalCard";
import {
	PREVIEW_ISSUES,
	PREVIEW_POINTS,
	PREVIEW_VITALS,
} from "@/components/organisms/ProductPreview/ProductPreview.constants";
import { cn } from "@/utils/cn/cn";
import { formatCompact } from "@/utils/time/time";

/**
 * Un recorte del producto (lista de issues y rendimiento) armado con los mismos componentes de la app y
 * datos de muestra: sigue el tema claro/oscuro y el idioma sin depender de capturas de pantalla.
 */
export function ProductPreview() {
	const { t, i18n } = useTranslation();
	return (
		<div
			aria-hidden
			data-testid="product-preview"
			className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-2xl shadow-primary/10"
		>
			<div className="flex items-center gap-1.5 border-b border-border bg-subtle px-4 py-2.5">
				<span className="size-2.5 rounded-full bg-error/70" />
				<span className="size-2.5 rounded-full bg-warning/70" />
				<span className="size-2.5 rounded-full bg-success/70" />
				<span className="ml-3 truncate rounded bg-surface px-3 py-0.5 text-[11px] text-faint">
					sentinel.example.com/acme/projects/storefront
				</span>
			</div>
			<div className="grid gap-px bg-border lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
				<section className="min-w-0 bg-surface p-4">
					<h3 className="mb-3 text-xs font-semibold tracking-wide text-faint uppercase">
						{t("landing.preview.issues")}
					</h3>
					<ul className="overflow-hidden rounded-lg border border-border">
						{PREVIEW_ISSUES.map((issue) => (
							<li
								key={issue.title}
								className="relative flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
							>
								<span
									className={cn(
										"absolute inset-y-0 left-0 w-1",
										LEVEL_BAR[issue.level],
									)}
								/>
								<div className="min-w-0 flex-1">
									<div className="truncate text-sm font-semibold text-foreground">
										{issue.title}
									</div>
									<div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
										<LevelBadge level={issue.level} />
										<span className="truncate font-mono">{issue.culprit}</span>
									</div>
								</div>
								<Sparkline values={[...issue.trend]} label="" />
								<div className="w-12 text-right text-sm tabular-nums">
									{formatCompact(issue.events, i18n.language)}
								</div>
							</li>
						))}
					</ul>
				</section>
				<section className="min-w-0 space-y-3 bg-surface p-4">
					<h3 className="text-xs font-semibold tracking-wide text-faint uppercase">
						{t("landing.preview.performance")}
					</h3>
					<LatencyChart
						points={PREVIEW_POINTS}
						bucketMinutes={60}
						label={t("performance.chart.label")}
					/>
					<div className="grid grid-cols-3 gap-2">
						{PREVIEW_VITALS.map((vital) => (
							<VitalCard key={vital.vital} {...vital} />
						))}
					</div>
				</section>
			</div>
		</div>
	);
}
