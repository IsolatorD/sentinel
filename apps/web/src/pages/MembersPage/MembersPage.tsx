import { useTranslation } from "react-i18next";
import { MembersManager } from "@/components/organisms/MembersManager/MembersManager";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import { useCurrentOrganization } from "@/hooks/useScope/useScope";
import { useSession } from "@/hooks/useSession/useSession";

export function MembersPage() {
	const { t } = useTranslation();
	const { organization } = useCurrentOrganization();
	const session = useSession();
	const userId = session.data?.user.id;
	if (!organization || !userId) return null;
	return (
		<PageTemplate
			narrow
			title={t("members.pageTitle")}
			description={organization.name}
		>
			<p className="mb-4 text-sm text-muted">{t("members.subtitle")}</p>
			<MembersManager orgId={organization.id} currentUserId={userId} />
		</PageTemplate>
	);
}
