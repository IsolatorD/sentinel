import { useTranslation } from "react-i18next";
import {
	GAP,
	HEIGHT,
	WIDTH,
} from "@/components/molecules/BarChart/BarChart.constants";
import type { BarChartProps } from "@/components/molecules/BarChart/BarChartInterface";
import { barHeights, formatBucket } from "@/utils/trend/trend";

/** Eventos por intervalo; cada barra lleva un tooltip nativo con la fecha y el total. */
export function BarChart({ points, bucketMinutes, label }: BarChartProps) {
	const { t, i18n } = useTranslation();
	const heights = barHeights(points.map((p) => p.events));
	const barWidth = points.length ? WIDTH / points.length - GAP : 0;
	const first = points[0];
	const last = points.at(-1);
	return (
		<div>
			<svg
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				preserveAspectRatio="none"
				role="img"
				aria-label={label}
				className="h-32 w-full"
				data-testid="bar-chart"
			>
				<line
					x1={0}
					x2={WIDTH}
					y1={HEIGHT - 0.5}
					y2={HEIGHT - 0.5}
					className="stroke-border"
				/>
				{points.map((point, i) => {
					const h = heights[i] * (HEIGHT - 2);
					const height = point.events > 0 ? Math.max(h, 3) : 0;
					return (
						<rect
							key={point.start}
							x={i * (barWidth + GAP)}
							y={HEIGHT - 1 - height}
							width={barWidth}
							height={height}
							rx={1}
							className="fill-primary opacity-80 transition-opacity hover:opacity-100"
						>
							<title>
								{`${formatBucket(point.start, bucketMinutes, i18n.language)} · ${t("trend.events", { count: point.events })}`}
							</title>
						</rect>
					);
				})}
			</svg>
			{first && last && (
				<div className="mt-1 flex justify-between text-[11px] text-faint">
					<span>{formatBucket(first.start, bucketMinutes, i18n.language)}</span>
					<span>{formatBucket(last.start, bucketMinutes, i18n.language)}</span>
				</div>
			)}
		</div>
	);
}
