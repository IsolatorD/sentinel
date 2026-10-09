import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { EmailVerifiedCard } from "@/components/organisms/EmailVerifiedCard/EmailVerifiedCard";
import { AuthTemplate } from "@/components/templates/AuthTemplate/AuthTemplate";
import { parseVerifiedSearch } from "@/utils/verification/verification";

export function EmailVerifiedPage() {
	const { t } = useTranslation();
	// `strict: false` entrega los parámetros crudos de la URL: se limpian aquí también.
	const { error, redirect } = parseVerifiedSearch(
		useSearch({ strict: false }) as Record<string, unknown>,
	);
	return (
		<AuthTemplate
			title={error ? t("emailVerified.errorTitle") : t("emailVerified.title")}
			subtitle={error ? undefined : t("emailVerified.subtitle")}
		>
			<EmailVerifiedCard error={error} redirect={redirect} />
		</AuthTemplate>
	);
}
