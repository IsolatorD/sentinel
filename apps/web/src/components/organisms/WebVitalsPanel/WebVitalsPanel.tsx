import { type PerformanceOverviewDto, WEB_VITALS } from "@sentinel/shared";
import { useTranslation } from "react-i18next";
import { VitalCard } from "@/components/molecules/VitalCard/VitalCard";

/** Los Web Vitals que se llegaron a medir; si ninguno, no se muestra nada. */
export function WebVitalsPanel({
	vitals,
}: {
	vitals: PerformanceOverviewDto["vitals"];
}) {
	const { t } = useTranslation();
	const measured = WEB_VITALS.flatMap((vital) => {
		const summary = vitals[vital];
		return summary ? [{ vital, ...summary }] : [];
	});
	if (measured.length === 0) return null;
	return (
		<section
			aria-labelledby="web-vitals-title"
			data-testid="web-vitals"
			data-tour="web-vitals"
		>
			<h2
				id="web-vitals-title"
				className="text-sm font-semibold text-foreground"
			>
				{t("performance.vitals.title")}
			</h2>
			<p className="mt-0.5 mb-3 text-xs text-muted">
				{t("performance.vitals.subtitle")}
			</p>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
				{measured.map((m) => (
					<VitalCard key={m.vital} {...m} />
				))}
			</div>
		</section>
	);
}
