import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import type { SpanWaterfallProps } from "@/components/organisms/SpanWaterfall/SpanWaterfallInterface";
import { formatMs, spanColor } from "@/utils/performance/performance";

/** Cascada: cada span como una barra, desplazada según cuándo empezó respecto a la transacción. */
export function SpanWaterfall({ sample }: SpanWaterfallProps) {
	const { t, i18n } = useTranslation();
	const locale = i18n.language;
	// El eje cubre la transacción entera, y más si algún span acabó después de ella.
	const total = Math.max(
		sample.durationMs,
		...sample.spans.map((s) => s.offsetMs + s.durationMs),
		1,
	);
	const rows = [
		{
			key: "root",
			label: sample.name,
			op: sample.op,
			depth: 0,
			offsetMs: 0,
			durationMs: sample.durationMs,
			failed: sample.status !== "ok",
		},
		...sample.spans.map((s) => ({
			key: s.spanId,
			label: s.description ?? s.op,
			op: s.op,
			depth: s.depth,
			offsetMs: s.offsetMs,
			durationMs: s.durationMs,
			failed:
				Boolean(s.status) && !["ok", "cancelled"].includes(s.status ?? ""),
		})),
	];

	return (
		<Card className="p-4" data-testid="span-waterfall">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="text-sm font-semibold text-foreground">
					{t("performance.sample.waterfall")}
				</h2>
				<span className="text-xs text-muted">
					{t("performance.sample.spans", { count: sample.spans.length })}
				</span>
			</div>
			{sample.spans.length === 0 && (
				<p className="mb-3 text-xs text-muted">
					{t("performance.sample.noSpans")}
				</p>
			)}
			<ol className="space-y-1">
				{rows.map((row) => (
					<li
						key={row.key}
						data-testid="span-row"
						data-depth={row.depth}
						className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 text-xs"
					>
						<div
							className="min-w-0 truncate"
							style={{ paddingLeft: `${row.depth * 14}px` }}
							title={row.label}
						>
							<span className="font-mono text-faint">{row.op}</span>{" "}
							<span className="text-foreground">{row.label}</span>
						</div>
						<div className="relative h-5 rounded bg-subtle">
							<span
								className={`absolute inset-y-0.5 rounded-sm ${
									row.failed ? "bg-danger" : spanColor(row.op)
								}`}
								style={{
									left: `${(row.offsetMs / total) * 100}%`,
									width: `max(${(row.durationMs / total) * 100}%, 2px)`,
								}}
							/>
							<span
								className="absolute inset-y-0 flex items-center pl-1.5 text-[11px] text-foreground tabular-nums"
								style={{
									left: `min(${((row.offsetMs + row.durationMs) / total) * 100}%, 82%)`,
								}}
							>
								{formatMs(row.durationMs, locale)}
							</span>
						</div>
					</li>
				))}
			</ol>
		</Card>
	);
}
