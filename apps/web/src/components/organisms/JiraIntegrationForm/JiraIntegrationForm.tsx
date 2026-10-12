import type { ProjectDto } from "@sentinel/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Button } from "@/components/atoms/Button/Button";
import { Input } from "@/components/atoms/Input/Input";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { Section } from "@/components/molecules/Section/Section";
import {
	useConnectJira,
	useDisconnectJira,
	useJiraConnection,
} from "@/hooks/useIntegrations/useIntegrations";
import { ApiError } from "@/utils/apiError/apiError";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";

/**
 * Conexión del proyecto con Jira Cloud (correo + API token). El token se envía una vez y el servidor
 * lo guarda cifrado: aquí nunca se vuelve a mostrar, y dejarlo vacío al editar conserva el guardado.
 */
export function JiraIntegrationForm({
	project,
	orgId,
}: {
	project: ProjectDto;
	orgId: string;
}) {
	const { t } = useTranslation();
	const connection = useJiraConnection(orgId, project.id);
	const connect = useConnectJira(orgId, project.id);
	const disconnect = useDisconnectJira(orgId, project.id);
	const [errors, setErrors] = useState<Record<string, string | undefined>>({});
	const current = connection.data;

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const value = (name: string) => String(form.get(name) ?? "").trim();
		const next: Record<string, string> = {};
		if (!value("siteUrl")) next.siteUrl = t("auth.validation.required");
		if (!value("email")) next.email = t("auth.validation.required");
		if (!value("projectKey")) next.projectKey = t("auth.validation.required");
		// Al conectar por primera vez el token es obligatorio; al editar, vacío = conservar.
		if (!current?.connected && !value("apiToken"))
			next.apiToken = t("auth.validation.required");
		setErrors(next);
		if (Object.keys(next).length > 0) return;
		connect.mutate({
			siteUrl: value("siteUrl"),
			email: value("email"),
			projectKey: value("projectKey"),
			...(value("apiToken") && { apiToken: value("apiToken") }),
			...(value("issueType") && { issueType: value("issueType") }),
		});
	}

	const failure = [connect, disconnect].find((m) => m.isError);

	return (
		<Section
			title={t("settings.jira.title")}
			action={
				current?.connected ? (
					<Badge tone="success">{t("settings.jira.connected")}</Badge>
				) : undefined
			}
		>
			<p className="mb-4 text-sm text-muted">
				{t("settings.jira.description")}
			</p>
			{!current ? (
				<Skeleton className="h-40 w-full" />
			) : (
				<form
					onSubmit={onSubmit}
					noValidate
					className="max-w-md space-y-4"
					data-testid="jira-form"
					key={`${current.siteUrl}-${current.email}-${current.projectKey}-${current.issueType}`}
				>
					{connect.isSuccess && (
						<Alert variant="success">{t("settings.jira.saved")}</Alert>
					)}
					{failure && (
						<Alert variant="error">
							{failure.error instanceof ApiError && failure.error.status === 403
								? t("settings.forbidden")
								: apiErrorText(failure.error, t("common.genericError"))}
						</Alert>
					)}
					<FormField
						label={t("settings.jira.siteUrl")}
						htmlFor="jira-site"
						error={errors.siteUrl}
						hint={t("settings.jira.siteUrlHint")}
					>
						<Input
							id="jira-site"
							name="siteUrl"
							placeholder="https://your-team.atlassian.net"
							defaultValue={current.siteUrl ?? ""}
							invalid={Boolean(errors.siteUrl)}
						/>
					</FormField>
					<FormField
						label={t("settings.jira.email")}
						htmlFor="jira-email"
						error={errors.email}
					>
						<Input
							id="jira-email"
							name="email"
							type="email"
							defaultValue={current.email ?? ""}
							invalid={Boolean(errors.email)}
						/>
					</FormField>
					<FormField
						label={t("settings.jira.apiToken")}
						htmlFor="jira-token"
						error={errors.apiToken}
						hint={
							current.connected
								? t("settings.jira.apiTokenKeep")
								: t("settings.jira.apiTokenHint")
						}
					>
						<Input
							id="jira-token"
							name="apiToken"
							type="password"
							autoComplete="off"
							placeholder={current.connected ? "••••••••" : undefined}
							invalid={Boolean(errors.apiToken)}
						/>
					</FormField>
					<div className="grid grid-cols-2 gap-3">
						<FormField
							label={t("settings.jira.projectKey")}
							htmlFor="jira-key"
							error={errors.projectKey}
						>
							<Input
								id="jira-key"
								name="projectKey"
								placeholder="APP"
								defaultValue={current.projectKey ?? ""}
								invalid={Boolean(errors.projectKey)}
							/>
						</FormField>
						<FormField label={t("settings.jira.issueType")} htmlFor="jira-type">
							<Input
								id="jira-type"
								name="issueType"
								placeholder="Bug"
								defaultValue={current.issueType ?? ""}
							/>
						</FormField>
					</div>
					<div className="flex gap-2">
						<Button type="submit" variant="primary" loading={connect.isPending}>
							{current.connected
								? t("settings.jira.update")
								: t("settings.jira.connect")}
						</Button>
						{current.connected && (
							<Button
								variant="danger-outline"
								loading={disconnect.isPending}
								onClick={() => disconnect.mutate()}
							>
								{t("settings.jira.disconnect")}
							</Button>
						)}
					</div>
				</form>
			)}
		</Section>
	);
}
