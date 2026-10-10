import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Card } from "@/components/atoms/Card/Card";
import type { TraceTimelineProps } from "@/components/organisms/TraceTimeline/TraceTimelineInterface";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { cn } from "@/utils/cn/cn";
import { formatMs } from "@/utils/performance/performance";
import { layoutTrace } from "@/utils/traceLayout/traceLayout";

/** Las transacciones de cada servicio sobre un mismo eje de tiempo, cada una bajo la que la originó. */
export function TraceTimeline({ trace }: TraceTimelineProps) {
	const { t, i18n } = useTranslation();
	const { organization, project } = useCurrentProject();
	const layout = layoutTrace(trace);
	if (!organization || !project) return null;

	return (
		<Card className="p-4" data-testid="trace-timeline">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="text-sm font-semibold text-foreground">
					{t("performance.trace.timeline")}
				</h2>
				<span className="text-xs text-muted tabular-nums">
					{t("performance.trace.total", {
						value: formatMs(layout.totalMs, i18n.language),
					})}
				</span>
			</div>
			<ol className="space-y-1.5">
				{layout.rows.map(({ transaction: tx, depth, offsetMs, eventIds }) => (
					<li
						key={tx.id}
						data-testid="trace-row"
						data-depth={depth}
						className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 text-xs"
					>
						<div className="min-w-0" style={{ paddingLeft: `${depth * 16}px` }}>
							<div className="flex flex-wrap items-center gap-1.5">
								<Link
									to="/$orgSlug/projects/$projectSlug/performance/samples/$sampleId"
									params={{
										orgSlug: organization.slug,
										projectSlug: project.slug,
										sampleId: tx.id,
									}}
									className="truncate font-medium text-foreground hover:text-primary hover:underline"
									title={tx.name}
								>
									{tx.name}
								</Link>
								{tx.platform && <Badge tone="neutral">{tx.platform}</Badge>}
								{tx.status !== "ok" && <Badge tone="danger">{tx.status}</Badge>}
								{eventIds.length > 0 && (
									<span
										className="inline-flex items-center gap-0.5 text-danger"
										title={t("performance.trace.errorsIn", {
											count: eventIds.length,
										})}
									>
										<AlertCircle aria-hidden className="size-3.5" />
										{eventIds.length}
									</span>
								)}
							</div>
							<span className="font-mono text-faint">{tx.op}</span>
						</div>
						<div className="relative h-5 rounded bg-subtle">
							<span
								className={cn(
									"absolute inset-y-0.5 rounded-sm",
									tx.status === "ok" ? "bg-primary/60" : "bg-danger",
								)}
								style={{
									left: `${(offsetMs / layout.totalMs) * 100}%`,
									width: `max(${(tx.durationMs / layout.totalMs) * 100}%, 2px)`,
								}}
							/>
							<span
								className="absolute inset-y-0 flex items-center pl-1.5 text-[11px] text-foreground tabular-nums"
								style={{
									left: `min(${((offsetMs + tx.durationMs) / layout.totalMs) * 100}%, 82%)`,
								}}
							>
								{formatMs(tx.durationMs, i18n.language)}
							</span>
						</div>
					</li>
				))}
			</ol>
		</Card>
	);
}
