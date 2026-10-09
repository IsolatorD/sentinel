import { PLATFORMS, type ProjectDto } from "@sentinel/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Alert } from "@/components/molecules/Alert";
import { FormField } from "@/components/molecules/FormField";
import { useCreateProject } from "@/hooks/use-projects";

export interface CreateProjectFormProps {
	orgId: string;
	onCreated: (project: ProjectDto) => void;
	onCancel?: () => void;
	placeholder?: string;
}

export function CreateProjectForm({
	orgId,
	onCreated,
	onCancel,
	placeholder,
}: CreateProjectFormProps) {
	const { t } = useTranslation();
	const create = useCreateProject(orgId);
	const [error, setError] = useState<string>();

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const name = String(form.get("name") ?? "").trim();
		if (!name) return setError(t("auth.validation.required"));
		setError(undefined);
		create.mutate(
			{
				name,
				platform: String(form.get("platform")) as (typeof PLATFORMS)[number],
			},
			{ onSuccess: onCreated },
		);
	}

	return (
		<form
			onSubmit={onSubmit}
			noValidate
			className="space-y-4"
			data-testid="create-project-form"
		>
			{create.isError && (
				<Alert variant="error">{t("common.genericError")}</Alert>
			)}
			<FormField
				label={t("projects.createDialog.name")}
				htmlFor="project-name"
				error={error}
			>
				<Input
					id="project-name"
					name="name"
					placeholder={placeholder}
					autoFocus
					invalid={Boolean(error)}
				/>
			</FormField>
			<FormField
				label={t("projects.createDialog.platform")}
				htmlFor="project-platform"
			>
				<Select id="project-platform" name="platform" defaultValue="javascript">
					{PLATFORMS.map((p) => (
						<option key={p} value={p}>
							{t(`platforms.${p}`)}
						</option>
					))}
				</Select>
			</FormField>
			<div className="flex justify-end gap-2">
				{onCancel && <Button onClick={onCancel}>{t("common.cancel")}</Button>}
				<Button type="submit" variant="primary" loading={create.isPending}>
					{create.isPending ? t("common.creating") : t("common.create")}
				</Button>
			</div>
		</form>
	);
}
