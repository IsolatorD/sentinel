import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/molecules/Alert/Alert";
import { useUsage } from "@/hooks/useProjects/useProjects";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { formatDateTime } from "@/utils/time/time";

/** Avisa en lo alto de una pantalla de datos cuando el proyecto agotó su cuota y está rechazando lo que llega. */
export function QuotaBanner() {
	const { t, i18n } = useTranslation();
	const { organization, project } = useCurrentProject();
	const usage = useUsage(organization?.id, project?.id).data;
	if (!usage || !organization || !project) return null;

	const exceeded = (["events", "transactions"] as const).filter(
		(kind) =>
			usage[kind].quota !== null &&
			usage[kind].used >= (usage[kind].quota ?? 0),
	);
	if (exceeded.length === 0) return null;

	return (
		<div data-testid="quota-banner">
			<Alert variant="warning">
				<span className="font-medium">
					{t("settings.limits.exceeded", {
						what: exceeded
							.map((kind) => t(`settings.limits.${kind}`).toLowerCase())
							.join(", "),
					})}
				</span>{" "}
				{t("settings.limits.exceededHint", {
					date: formatDateTime(usage.resetsAt, i18n.language),
				})}{" "}
				<Link
					to="/$orgSlug/projects/$projectSlug/settings"
					params={{ orgSlug: organization.slug, projectSlug: project.slug }}
					className="font-medium underline"
				>
					{t("settings.limits.manage")}
				</Link>
			</Alert>
		</div>
	);
}
