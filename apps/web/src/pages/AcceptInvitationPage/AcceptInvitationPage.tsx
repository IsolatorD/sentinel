import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { InvitationCard } from "@/components/organisms/InvitationCard/InvitationCard";
import { AuthTemplate } from "@/components/templates/AuthTemplate/AuthTemplate";

export function AcceptInvitationPage() {
	const { t } = useTranslation();
	const { invitationId } = useParams({ strict: false }) as {
		invitationId: string;
	};
	return (
		<AuthTemplate
			title={t("invitation.title")}
			subtitle={t("invitation.subtitle")}
		>
			<InvitationCard invitationId={invitationId} />
		</AuthTemplate>
	);
}
