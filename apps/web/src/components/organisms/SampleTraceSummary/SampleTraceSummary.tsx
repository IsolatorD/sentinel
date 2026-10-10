import { Link } from "@tanstack/react-router";
import { Route } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import type { SampleTraceSummaryProps } from "@/components/organisms/SampleTraceSummary/SampleTraceSummaryInterface";
import { useTrace } from "@/hooks/usePerformance/usePerformance";
import { useCurrentProject } from "@/hooks/useScope/useScope";

/** En una transacción: si su traza tiene más servicios o errores, lo dice y enlaza a la traza completa. */
export function SampleTraceSummary({ traceId }: SampleTraceSummaryProps) {
	const { t } = useTranslation();
	const { organization, project, scope } = useCurrentProject();
	const trace = useTrace(scope, traceId);
	const data = trace.data;
	if (!organization || !project || !data) return null;
	// Una traza con una sola transacción y sin errores no aporta nada más que esta pantalla.
	if (data.transactions.length <= 1 && data.events.length === 0) return null;

	return (
		<Card
			className="flex flex-wrap items-center justify-between gap-3 p-4"
			data-testid="sample-trace"
		>
			<div className="flex items-start gap-3">
				<Route aria-hidden className="mt-0.5 size-4 text-primary" />
				<div>
					<div className="text-sm font-semibold text-foreground">
						{t("performance.sample.trace.title")}
					</div>
					<p className="text-xs text-muted">
						{t("performance.sample.trace.summary", {
							transactions: data.transactions.length,
							errors: data.events.length,
						})}
					</p>
				</div>
			</div>
			<Link
				to="/$orgSlug/projects/$projectSlug/performance/traces/$traceId"
				params={{
					orgSlug: organization.slug,
					projectSlug: project.slug,
					traceId,
				}}
				className="rounded-md border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-subtle"
			>
				{t("performance.sample.trace.view")}
			</Link>
		</Card>
	);
}
