import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { TraceErrors } from "@/components/organisms/TraceErrors/TraceErrors";
import { TraceTimeline } from "@/components/organisms/TraceTimeline/TraceTimeline";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import { useTrace } from "@/hooks/usePerformance/usePerformance";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { NotFoundPage } from "@/pages/NotFoundPage/NotFoundPage";
import { ProjectGate } from "@/pages/ProjectGate/ProjectGate";
import { ApiError } from "@/utils/apiError/apiError";

/** Una traza: lo que pasó en cada servicio durante una misma petición, y los errores que hubo. */
export function TracePage() {
	const { t } = useTranslation();
	const { traceId } = useParams({ strict: false }) as { traceId: string };
	const { organization, project, scope } = useCurrentProject();
	const trace = useTrace(scope, traceId);

	if (trace.isError) {
		return trace.error instanceof ApiError && trace.error.status === 404 ? (
			<NotFoundPage />
		) : (
			<ErrorState
				title={t("performance.trace.loadError")}
				onRetry={() => trace.refetch()}
			/>
		);
	}

	return (
		<ProjectGate>
			<PageTemplate
				eyebrow={
					organization &&
					project && (
						<Link
							to="/$orgSlug/projects/$projectSlug/performance"
							params={{ orgSlug: organization.slug, projectSlug: project.slug }}
							className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
						>
							<ArrowLeft aria-hidden className="size-4" />
							{t("performance.trace.back")}
						</Link>
					)
				}
				title={t("performance.trace.title")}
				description={traceId}
			>
				{!trace.data ? (
					<Skeleton className="h-64 w-full" />
				) : (
					<div className="space-y-4">
						<p className="text-sm text-muted">
							{t("performance.trace.subtitle")}
						</p>
						{trace.data.transactions.length > 0 && (
							<TraceTimeline trace={trace.data} />
						)}
						<TraceErrors events={trace.data.events} />
					</div>
				)}
			</PageTemplate>
		</ProjectGate>
	);
}
