import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { VerifyEmailCard } from "@/components/organisms/VerifyEmailCard/VerifyEmailCard";
import { AuthTemplate } from "@/components/templates/AuthTemplate/AuthTemplate";
import { parseVerifySearch } from "@/utils/verification/verification";

export function VerifyEmailPage() {
	const { t } = useTranslation();
	// `strict: false` entrega los parámetros crudos de la URL: se limpian aquí también.
	const { email, redirect } = parseVerifySearch(
		useSearch({ strict: false }) as Record<string, unknown>,
	);
	return (
		<AuthTemplate
			title={t("verifyEmail.title")}
			subtitle={t("verifyEmail.subtitle")}
		>
			<VerifyEmailCard email={email} redirect={redirect} />
		</AuthTemplate>
	);
}
