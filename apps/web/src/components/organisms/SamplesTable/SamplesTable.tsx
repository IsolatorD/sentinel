import { Link } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Card } from "@/components/atoms/Card/Card";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { EmptyState } from "@/components/molecules/EmptyState/EmptyState";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import type { SamplesTableProps } from "@/components/organisms/SamplesTable/SamplesTableInterface";
import { useSamples } from "@/hooks/usePerformance/usePerformance";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { staggerStyle } from "@/utils/animation/animation";
import { formatMs } from "@/utils/performance/performance";

/** Ejemplos concretos de una transacción (las más lentas o las más recientes); cada uno abre su cascada. */
export function SamplesTable({
	name,
	period,
	environment,
	release,
	sort,
}: SamplesTableProps) {
	const { t, i18n } = useTranslation();
	const { organization, project, scope } = useCurrentProject();
	const samples = useSamples(scope, {
		name,
		period,
		environment,
		release,
		sort,
	});

	if (!organization || !project) return null;
	if (samples.isError)
		return (
			<ErrorState
				title={t("performance.samples.loadError")}
				onRetry={() => samples.refetch()}
			/>
		);

	return (
		<Card className="overflow-x-auto">
			{samples.data?.items.length === 0 ? (
				<EmptyState
					icon={Gauge}
					title={t("performance.samples.empty")}
					description={t("performance.samples.emptyHint")}
				/>
			) : (
				<table className="w-full text-left text-sm" data-testid="samples-table">
					<thead>
						<tr className="border-b border-border bg-subtle/70 text-[11px] tracking-wide text-faint uppercase">
							<th className="px-5 py-2 font-medium">
								{t("performance.samples.columns.when")}
							</th>
							<th className="px-3 py-2 text-right font-medium">
								{t("performance.samples.columns.duration")}
							</th>
							<th className="px-3 py-2 font-medium">
								{t("performance.samples.columns.status")}
							</th>
							<th className="px-3 py-2 font-medium">
								{t("performance.samples.columns.release")}
							</th>
							<th className="px-3 py-2 font-medium">
								{t("performance.samples.columns.environment")}
							</th>
						</tr>
					</thead>
					<tbody>
						{!samples.data
							? [0, 1, 2].map((i) => (
									<tr key={i} className="border-b border-border">
										<td colSpan={5} className="px-5 py-3">
											<Skeleton className="h-4 w-full" />
										</td>
									</tr>
								))
							: samples.data.items.map((s, index) => (
									<tr
										key={s.id}
										className="animate-fade-in border-b border-border last:border-b-0 hover:bg-primary-soft/40"
										style={staggerStyle(index)}
										data-testid="sample-row"
									>
										<td className="px-5 py-2.5 whitespace-nowrap">
											<Link
												to="/$orgSlug/projects/$projectSlug/performance/samples/$sampleId"
												params={{
													orgSlug: organization.slug,
													projectSlug: project.slug,
													sampleId: s.id,
												}}
												className="font-medium text-primary hover:underline"
											>
												<RelativeTime date={s.timestamp} />
											</Link>
										</td>
										<td className="px-3 py-2.5 text-right tabular-nums">
											{formatMs(s.durationMs, i18n.language)}
										</td>
										<td className="px-3 py-2.5">
											<Badge tone={s.status === "ok" ? "success" : "danger"}>
												{s.status}
											</Badge>
										</td>
										<td className="px-3 py-2.5 font-mono text-xs">
											{s.release ?? "—"}
										</td>
										<td className="px-3 py-2.5">{s.environment ?? "—"}</td>
									</tr>
								))}
					</tbody>
				</table>
			)}
		</Card>
	);
}
