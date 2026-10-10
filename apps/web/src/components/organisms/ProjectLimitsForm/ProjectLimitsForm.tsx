import { type ProjectDto, RETENTION_OPTIONS } from "@sentinel/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Input } from "@/components/atoms/Input/Input";
import { Select } from "@/components/atoms/Select/Select";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { Section } from "@/components/molecules/Section/Section";
import { UsageMeter } from "@/components/molecules/UsageMeter/UsageMeter";
import { parseQuota } from "@/components/organisms/ProjectLimitsForm/ProjectLimitsForm.constants";
import { useUpdateProject, useUsage } from "@/hooks/useProjects/useProjects";
import { ApiError } from "@/utils/apiError/apiError";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";
import { formatDateUtc } from "@/utils/time/time";

/** Retención de los datos, límites mensuales de ingesta y lo consumido este mes. */
export function ProjectLimitsForm({
	project,
	orgId,
}: {
	project: ProjectDto;
	orgId: string;
}) {
	const { t, i18n } = useTranslation();
	const usage = useUsage(orgId, project.id);
	const update = useUpdateProject(orgId, project.id);
	const [errors, setErrors] = useState<{
		events?: string;
		transactions?: string;
	}>({});

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const events = parseQuota(String(form.get("monthlyEventQuota") ?? ""));
		const transactions = parseQuota(
			String(form.get("monthlyTransactionQuota") ?? ""),
		);
		const next = {
			events:
				events === "invalid" ? t("settings.limits.invalidQuota") : undefined,
			transactions:
				transactions === "invalid"
					? t("settings.limits.invalidQuota")
					: undefined,
		};
		setErrors(next);
		if (events === "invalid" || transactions === "invalid") return;
		update.mutate({
			retentionDays: Number(form.get("retentionDays")),
			monthlyEventQuota: events,
			monthlyTransactionQuota: transactions,
		});
	}

	return (
		<Section title={t("settings.limits.title")}>
			<div className="space-y-6">
				<div data-testid="usage-panel" className="space-y-4">
					<h3 className="text-xs font-semibold tracking-wide text-faint uppercase">
						{t("settings.limits.thisMonth")}
					</h3>
					{!usage.data ? (
						<Skeleton className="h-16 w-full" />
					) : (
						<>
							<UsageMeter
								label={t("settings.limits.events")}
								used={usage.data.events.used}
								quota={usage.data.events.quota}
							/>
							<UsageMeter
								label={t("settings.limits.transactions")}
								used={usage.data.transactions.used}
								quota={usage.data.transactions.quota}
							/>
							<p className="text-xs text-faint">
								{t("settings.limits.resets", {
									date: formatDateUtc(usage.data.resetsAt, i18n.language),
								})}
							</p>
						</>
					)}
				</div>

				<form
					onSubmit={onSubmit}
					noValidate
					className="max-w-md space-y-4 border-t border-border pt-5"
					key={`${project.retentionDays}-${project.monthlyEventQuota}-${project.monthlyTransactionQuota}`}
				>
					{update.isSuccess && (
						<Alert variant="success">{t("settings.limits.saved")}</Alert>
					)}
					{update.isError && (
						<Alert variant="error">
							{update.error instanceof ApiError && update.error.status === 403
								? t("settings.forbidden")
								: apiErrorText(update.error, t("common.genericError"))}
						</Alert>
					)}
					<FormField
						label={t("settings.limits.retention")}
						htmlFor="limits-retention"
						hint={t("settings.limits.retentionHint")}
					>
						<Select
							id="limits-retention"
							name="retentionDays"
							defaultValue={String(project.retentionDays)}
						>
							{RETENTION_OPTIONS.map((days) => (
								<option key={days} value={days}>
									{t("settings.limits.days", { count: days })}
								</option>
							))}
						</Select>
					</FormField>
					<FormField
						label={t("settings.limits.eventQuota")}
						htmlFor="limits-events"
						error={errors.events}
						hint={t("settings.limits.quotaHint")}
					>
						<Input
							id="limits-events"
							name="monthlyEventQuota"
							inputMode="numeric"
							placeholder={t("settings.limits.noLimit")}
							defaultValue={project.monthlyEventQuota ?? ""}
							invalid={Boolean(errors.events)}
						/>
					</FormField>
					<FormField
						label={t("settings.limits.transactionQuota")}
						htmlFor="limits-transactions"
						error={errors.transactions}
					>
						<Input
							id="limits-transactions"
							name="monthlyTransactionQuota"
							inputMode="numeric"
							placeholder={t("settings.limits.noLimit")}
							defaultValue={project.monthlyTransactionQuota ?? ""}
							invalid={Boolean(errors.transactions)}
						/>
					</FormField>
					<Button type="submit" variant="primary" loading={update.isPending}>
						{update.isPending ? t("common.saving") : t("common.save")}
					</Button>
				</form>
			</div>
		</Section>
	);
}
