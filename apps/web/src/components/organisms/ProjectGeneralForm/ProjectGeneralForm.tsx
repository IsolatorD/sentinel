import { PLATFORMS, type ProjectDto } from "@sentinel/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Input } from "@/components/atoms/Input/Input";
import { Select } from "@/components/atoms/Select/Select";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { Section } from "@/components/molecules/Section/Section";
import { useUpdateProject } from "@/hooks/useProjects/useProjects";
import { ApiError } from "@/utils/apiError/apiError";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";

export function ProjectGeneralForm({
	project,
	orgId,
}: {
	project: ProjectDto;
	orgId: string;
}) {
	const { t } = useTranslation();
	const update = useUpdateProject(orgId, project.id);
	const [error, setError] = useState<string>();

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const name = String(form.get("name") ?? "").trim();
		if (!name) return setError(t("auth.validation.required"));
		setError(undefined);
		update.mutate({
			name,
			platform: String(form.get("platform")) as (typeof PLATFORMS)[number],
		});
	}

	return (
		<Section title={t("settings.general.title")}>
			<form
				onSubmit={onSubmit}
				noValidate
				className="max-w-md space-y-4"
				key={`${project.id}-${project.name}-${project.platform}`}
			>
				{update.isSuccess && (
					<Alert variant="success">{t("settings.general.saved")}</Alert>
				)}
				{update.isError && (
					<Alert variant="error">
						{update.error instanceof ApiError && update.error.status === 403
							? t("settings.forbidden")
							: apiErrorText(update.error, t("common.genericError"))}
					</Alert>
				)}
				<FormField
					label={t("settings.general.name")}
					htmlFor="settings-name"
					error={error}
				>
					<Input
						id="settings-name"
						name="name"
						defaultValue={project.name}
						invalid={Boolean(error)}
					/>
				</FormField>
				<FormField
					label={t("settings.general.platform")}
					htmlFor="settings-platform"
				>
					<Select
						id="settings-platform"
						name="platform"
						defaultValue={project.platform}
					>
						{PLATFORMS.map((p) => (
							<option key={p} value={p}>
								{t(`platforms.${p}`)}
							</option>
						))}
					</Select>
				</FormField>
				<Button type="submit" variant="primary" loading={update.isPending}>
					{update.isPending ? t("common.saving") : t("common.save")}
				</Button>
			</form>
		</Section>
	);
}
