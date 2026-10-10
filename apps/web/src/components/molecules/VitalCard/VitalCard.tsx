import { VITAL_THRESHOLDS } from "@sentinel/shared";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Card } from "@/components/atoms/Card/Card";
import type { VitalCardProps } from "@/components/molecules/VitalCard/VitalCardInterface";
import { formatVital, vitalPosition } from "@/utils/performance/performance";
import {
	RATING_TEXT,
	RATING_TONE,
} from "@/utils/performance/performance.constants";
import { formatCompact } from "@/utils/time/time";

/** Un Web Vital: su valor (p75), la valoración y dónde cae entre los umbrales bueno / malo. */
export function VitalCard({ vital, p75, samples, rating }: VitalCardProps) {
	const { t, i18n } = useTranslation();
	const { good, poor } = VITAL_THRESHOLDS[vital];
	const goodWidth = (good / (poor * 2)) * 100;
	const midWidth = ((poor - good) / (poor * 2)) * 100;

	return (
		<Card className="p-4" data-testid="vital-card" data-vital={vital}>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<div className="text-xs font-semibold tracking-wide text-muted uppercase">
						{vital.toUpperCase()}
					</div>
					<div className="text-[11px] text-faint">
						{t(`performance.vitals.names.${vital}`)}
					</div>
				</div>
				<Badge tone={RATING_TONE[rating]}>
					{t(`performance.vitals.rating.${rating}`)}
				</Badge>
			</div>
			<div
				className={`mt-2 text-2xl font-semibold tabular-nums ${RATING_TEXT[rating]}`}
			>
				{formatVital(vital, p75, i18n.language)}
			</div>
			<div
				aria-hidden
				className="relative mt-3 flex h-1.5 overflow-hidden rounded-full"
			>
				<span className="bg-success/60" style={{ width: `${goodWidth}%` }} />
				<span className="bg-warning/60" style={{ width: `${midWidth}%` }} />
				<span className="flex-1 bg-danger/60" />
			</div>
			<div className="relative h-2" aria-hidden>
				<span
					className="absolute -top-0.5 size-2 -translate-x-1/2 rounded-full border-2 border-surface bg-foreground"
					style={{ left: `${vitalPosition(p75, poor)}%` }}
				/>
			</div>
			<div className="mt-1 text-[11px] text-faint">
				{t("performance.vitals.samples", {
					count: samples,
					formatted: formatCompact(samples, i18n.language),
				})}
			</div>
		</Card>
	);
}
