import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Input } from "@/components/atoms/Input/Input";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { useCreateOrganization } from "@/hooks/useOrganizations/useOrganizations";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";
import type { Organization } from "@/utils/organization/organizationInterface";
import { uniqueSlug } from "@/utils/slug/slug";

export function CreateOrganizationForm({
	onCreated,
}: {
	onCreated: (organization: Organization) => void;
}) {
	const { t } = useTranslation();
	const create = useCreateOrganization();
	const [error, setError] = useState<string>();

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const name = String(
			new FormData(event.currentTarget).get("name") ?? "",
		).trim();
		if (!name) return setError(t("auth.validation.required"));
		setError(undefined);
		create.mutate({ name, slug: uniqueSlug(name) }, { onSuccess: onCreated });
	}

	return (
		<form
			onSubmit={onSubmit}
			noValidate
			className="space-y-4"
			data-testid="create-org-form"
		>
			{create.isError && (
				<Alert variant="error">
					{apiErrorText(create.error, t("common.genericError"))}
				</Alert>
			)}
			<FormField
				label={t("onboarding.org.name")}
				htmlFor="org-name"
				error={error}
			>
				<Input
					id="org-name"
					name="name"
					placeholder={t("onboarding.org.placeholder")}
					autoFocus
					invalid={Boolean(error)}
				/>
			</FormField>
			<Button type="submit" variant="primary" loading={create.isPending}>
				{create.isPending ? t("common.creating") : t("common.create")}
			</Button>
		</form>
	);
}
