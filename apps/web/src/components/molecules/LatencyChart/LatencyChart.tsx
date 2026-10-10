import { useTranslation } from "react-i18next";
import {
	BAR_AREA,
	HEIGHT,
	WIDTH,
} from "@/components/molecules/LatencyChart/LatencyChart.constants";
import type {
	LatencyChartProps,
	Series,
} from "@/components/molecules/LatencyChart/LatencyChartInterface";
import { formatMs, niceMax } from "@/utils/performance/performance";
import { formatBucket } from "@/utils/trend/trend";

/** Trozos continuos de una serie: un intervalo sin datos (null) corta la línea. */
function segments(
	values: Series,
	x: (i: number) => number,
	y: (v: number) => number,
) {
	const out: string[][] = [];
	let current: string[] = [];
	values.forEach((v, i) => {
		if (v === null) {
			if (current.length) out.push(current);
			current = [];
		} else current.push(`${x(i)},${y(v)}`);
	});
	if (current.length) out.push(current);
	return out;
}

/** Latencia p50 y p95 en el tiempo, con el volumen de transacciones como barras de fondo. */
export function LatencyChart({
	points,
	bucketMinutes,
	label,
}: LatencyChartProps) {
	const { t, i18n } = useTranslation();
	const n = Math.max(points.length, 1);
	const step = WIDTH / n;
	const maxY = niceMax(
		Math.max(0, ...points.flatMap((p) => [p.p50 ?? 0, p.p95 ?? 0])),
	);
	const maxCount = Math.max(1, ...points.map((p) => p.count));
	const x = (i: number) => (i + 0.5) * step;
	const y = (v: number) => HEIGHT - 2 - (v / maxY) * (HEIGHT - 6);
	const p50 = segments(
		points.map((p) => p.p50),
		x,
		y,
	);
	const p95 = segments(
		points.map((p) => p.p95),
		x,
		y,
	);
	const first = points[0];
	const last = points.at(-1);

	return (
		<div>
			<div className="mb-1 flex items-center justify-between text-[11px] text-faint">
				<span>{formatMs(maxY, i18n.language)}</span>
				<span className="flex items-center gap-3">
					<span className="inline-flex items-center gap-1">
						<span aria-hidden className="h-0.5 w-3 bg-primary" />
						{t("performance.chart.p50")}
					</span>
					<span className="inline-flex items-center gap-1">
						<span aria-hidden className="h-0.5 w-3 bg-warning" />
						{t("performance.chart.p95")}
					</span>
				</span>
			</div>
			<svg
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				preserveAspectRatio="none"
				role="img"
				aria-label={label}
				className="h-36 w-full"
				data-testid="latency-chart"
			>
				{[0, 0.5, 1].map((fraction) => (
					<line
						key={fraction}
						x1={0}
						x2={WIDTH}
						y1={y(maxY * fraction)}
						y2={y(maxY * fraction)}
						className="stroke-border"
						vectorEffect="non-scaling-stroke"
					/>
				))}
				{points.map((point, i) => (
					<rect
						key={point.start}
						x={i * step + 1}
						y={HEIGHT - (point.count / maxCount) * BAR_AREA}
						width={Math.max(step - 2, 1)}
						height={(point.count / maxCount) * BAR_AREA}
						className="fill-primary opacity-15"
					/>
				))}
				{p95.map((seg) => (
					<polyline
						key={seg.join(" ")}
						points={seg.join(" ")}
						fill="none"
						className="stroke-warning"
						strokeWidth={2}
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
					/>
				))}
				{p50.map((seg) => (
					<polyline
						key={seg.join(" ")}
						points={seg.join(" ")}
						fill="none"
						className="stroke-primary"
						strokeWidth={2}
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
					/>
				))}
				{points.map((point, i) => (
					<rect
						key={`hover-${point.start}`}
						x={i * step}
						y={0}
						width={step}
						height={HEIGHT}
						fill="transparent"
					>
						<title>
							{`${formatBucket(point.start, bucketMinutes, i18n.language)} · ${t(
								"performance.chart.tooltip",
								{
									count: point.count,
									p50: formatMs(point.p50, i18n.language),
									p95: formatMs(point.p95, i18n.language),
								},
							)}`}
						</title>
					</rect>
				))}
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
