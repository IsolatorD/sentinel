import { Link } from "@tanstack/react-router";
import { Route } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Section } from "@/components/molecules/Section/Section";
import { useCurrentProject } from "@/hooks/useScope/useScope";

/** En el detalle de un error: la traza en la que ocurrió, para ver qué más pasó en esa petición. */
export function EventTraceLink({ traceId }: { traceId: string }) {
	const { t } = useTranslation();
	const { organization, project } = useCurrentProject();
	if (!organization || !project) return null;
	return (
		<Section title={t("issue.trace.title")}>
			<p className="mb-3 text-sm text-muted">{t("issue.trace.description")}</p>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<code className="font-mono text-xs text-muted" title={traceId}>
					{traceId.slice(0, 8)}…{traceId.slice(-4)}
				</code>
				<Link
					to="/$orgSlug/projects/$projectSlug/performance/traces/$traceId"
					params={{
						orgSlug: organization.slug,
						projectSlug: project.slug,
						traceId,
					}}
					className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-subtle"
					data-testid="view-trace"
				>
					<Route aria-hidden className="size-3.5" />
					{t("issue.trace.view")}
				</Link>
			</div>
		</Section>
	);
}
