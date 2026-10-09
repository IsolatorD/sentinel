import { useTranslation } from "react-i18next";
import { ApiTokensManager } from "@/components/organisms/ApiTokensManager";
import { PageTemplate } from "@/components/templates/PageTemplate";
import { useCurrentOrganization } from "@/hooks/useScope/useScope";

export function TokensPage() {
	const { t } = useTranslation();
	const { organization } = useCurrentOrganization();
	if (!organization) return null;
	return (
		<PageTemplate
			narrow
			title={t("tokens.title")}
			description={organization.name}
		>
			<p className="mb-4 text-sm text-muted">{t("tokens.subtitle")}</p>
			<ApiTokensManager orgId={organization.id} />
		</PageTemplate>
	);
}
