import { WEB_VITALS, type WebVital } from "@sentinel/shared";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Card } from "@/components/atoms/Card/Card";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { KeyValueList } from "@/components/molecules/KeyValueList/KeyValueList";
import { StatBlock } from "@/components/molecules/StatBlock/StatBlock";
import { SampleTraceSummary } from "@/components/organisms/SampleTraceSummary/SampleTraceSummary";
import { SpanWaterfall } from "@/components/organisms/SpanWaterfall/SpanWaterfall";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import { useSample } from "@/hooks/usePerformance/usePerformance";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { NotFoundPage } from "@/pages/NotFoundPage/NotFoundPage";
import { ProjectGate } from "@/pages/ProjectGate/ProjectGate";
import { ApiError } from "@/utils/apiError/apiError";
import { formatMs, formatVital } from "@/utils/performance/performance";
import { formatDateTime } from "@/utils/time/time";

/** Una ejecución concreta de una transacción, con su cascada de spans. */
export function SamplePage() {
	const { t, i18n } = useTranslation();
	const { sampleId } = useParams({ strict: false }) as { sampleId: string };
	const { organization, project, scope } = useCurrentProject();
	const sample = useSample(scope, sampleId);
	const locale = i18n.language;

	const data = sample.data;
	if (sample.isError) {
		return sample.error instanceof ApiError && sample.error.status === 404 ? (
			<NotFoundPage />
		) : (
			<ErrorState
				title={t("performance.sample.loadError")}
				onRetry={() => sample.refetch()}
			/>
		);
	}

	const measurements = data
		? Object.entries(data.measurements).map(([name, m]) => ({
				label: name.toUpperCase(),
				value: (WEB_VITALS as readonly string[]).includes(name)
					? formatVital(name as WebVital, m.value, locale)
					: `${m.value}${m.unit ? ` ${m.unit}` : ""}`,
			}))
		: [];

	return (
		<ProjectGate>
			<PageTemplate
				eyebrow={
					organization &&
					project &&
					data && (
						<Link
							to="/$orgSlug/projects/$projectSlug/performance/transaction"
							params={{ orgSlug: organization.slug, projectSlug: project.slug }}
							search={{ name: data.name }}
							className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
						>
							<ArrowLeft aria-hidden className="size-4" />
							{t("performance.sample.back")}
						</Link>
					)
				}
				title={
					data ? <span className="break-all">{data.name}</span> : undefined
				}
				description={data ? formatDateTime(data.timestamp, locale) : undefined}
			>
				{!data ? (
					<Skeleton className="h-64 w-full" />
				) : (
					<div className="space-y-4">
						<Card className="p-4" data-testid="sample-summary">
							<div className="flex flex-wrap gap-x-8 gap-y-3">
								<StatBlock label={t("performance.sample.duration")}>
									{formatMs(data.durationMs, locale)}
								</StatBlock>
								<StatBlock label={t("performance.sample.status")}>
									<Badge tone={data.status === "ok" ? "success" : "danger"}>
										{data.status}
									</Badge>
								</StatBlock>
								<StatBlock label={t("performance.sample.op")}>
									<span className="font-mono text-base">{data.op}</span>
								</StatBlock>
							</div>
							<div className="mt-4 grid gap-6 sm:grid-cols-2">
								<KeyValueList
									items={[
										{
											label: t("performance.samples.columns.release"),
											value: data.release ?? undefined,
										},
										{
											label: t("performance.samples.columns.environment"),
											value: data.environment ?? undefined,
										},
										{
											label: t("performance.sample.user"),
											value: data.user ?? undefined,
										},
										{
											label: t("performance.sample.platform"),
											value: data.platform ?? undefined,
										},
										{
											label: t("performance.sample.traceId"),
											value: data.traceId,
										},
									]}
								/>
								{measurements.length > 0 && (
									<div>
										<h3 className="mb-1.5 text-xs font-semibold tracking-wide text-faint uppercase">
											{t("performance.sample.measurements")}
										</h3>
										<KeyValueList items={measurements} />
									</div>
								)}
							</div>
						</Card>
						<SampleTraceSummary traceId={data.traceId} />
						<SpanWaterfall sample={data} />
					</div>
				)}
			</PageTemplate>
		</ProjectGate>
	);
}
