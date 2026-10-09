import type { EventDetailDto } from "@sentinel/shared";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/molecules/Alert/Alert";
import { CodeBlock } from "@/components/molecules/CodeBlock/CodeBlock";
import { Section } from "@/components/molecules/Section/Section";
import { BreadcrumbList } from "@/components/organisms/BreadcrumbList/BreadcrumbList";
import { EventContext } from "@/components/organisms/EventContext/EventContext";
import { StackTrace } from "@/components/organisms/StackTrace/StackTrace";
import { parseEventPayload } from "@/utils/eventView/eventView";

/** Contenido de un evento: stack trace y breadcrumbs a la izquierda; tags y contexto a la derecha. */
export function IssueEventDetails({ event }: { event: EventDetailDto }) {
	const { t } = useTranslation();
	const view = parseEventPayload(event.payload);

	if (!view) {
		return (
			<div className="space-y-3">
				<Alert variant="info">{t("issue.unreadable")}</Alert>
				<CodeBlock
					title={t("issue.rawPayload")}
					code={JSON.stringify(event.payload, null, 2)}
				/>
			</div>
		);
	}

	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<div className="min-w-0 space-y-4">
				<Section title={t("issue.stackTrace.title")}>
					{view.exception ? (
						<StackTrace exceptions={view.exception.values} />
					) : (
						<p className="font-mono text-sm text-foreground">
							{view.message ?? t("issue.stackTrace.noStack")}
						</p>
					)}
				</Section>
				<Section title={t("issue.breadcrumbs.title")}>
					<BreadcrumbList breadcrumbs={view.breadcrumbs ?? []} />
				</Section>
			</div>
			<aside>
				<EventContext view={view} />
			</aside>
		</div>
	);
}
