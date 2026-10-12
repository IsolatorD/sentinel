import { ExternalLink, Link2Off, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Alert } from "@/components/molecules/Alert/Alert";
import type { IssueTicketProps } from "@/components/organisms/IssueTicket/IssueTicketInterface";
import {
	useCreateTicket,
	useJiraConnection,
	useUnlinkTicket,
} from "@/hooks/useIntegrations/useIntegrations";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";

/**
 * El ticket de Jira del issue: un enlace si ya existe, o el botón para crearlo si el proyecto está
 * conectado con Jira. Si no hay ni ticket ni conexión no muestra nada.
 */
export function IssueTicket({ issue, scope }: IssueTicketProps) {
	const { t } = useTranslation();
	const connection = useJiraConnection(scope.orgId, scope.projectId);
	const create = useCreateTicket(scope, issue.id);
	const unlink = useUnlinkTicket(scope, issue.id);
	const failure = [create, unlink].find((m) => m.isError);

	if (issue.ticket) {
		return (
			<div
				className="flex flex-wrap items-center gap-2"
				data-testid="issue-ticket"
			>
				<a
					href={issue.ticket.url}
					target="_blank"
					rel="noreferrer noopener"
					className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm font-medium text-accent hover:bg-surface-hover"
				>
					<Ticket aria-hidden className="size-4" />
					{issue.ticket.key}
					<ExternalLink aria-hidden className="size-3" />
					<span className="sr-only">{t("issue.ticket.opensInJira")}</span>
				</a>
				<Button
					size="sm"
					loading={unlink.isPending}
					aria-label={t("issue.ticket.unlink")}
					onClick={() => unlink.mutate()}
				>
					<Link2Off className="size-3.5" />
					{t("issue.ticket.unlink")}
				</Button>
				{failure && (
					<Alert variant="error">
						{apiErrorText(failure.error, t("common.genericError"))}
					</Alert>
				)}
			</div>
		);
	}

	if (!connection.data?.connected) return null;
	return (
		<div
			className="flex flex-wrap items-center gap-2"
			data-testid="issue-ticket"
		>
			<Button loading={create.isPending} onClick={() => create.mutate()}>
				<Ticket className="size-4" />
				{t("issue.ticket.create")}
			</Button>
			{failure && (
				<Alert variant="error">
					{apiErrorText(failure.error, t("common.genericError"))}
				</Alert>
			)}
		</div>
	);
}
