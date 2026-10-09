import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { Alert } from "@/components/molecules/Alert/Alert";
import type { InvitationCardProps } from "@/components/organisms/InvitationCard/InvitationCardInterface";
import {
	useAcceptInvitation,
	useInvitation,
	useRejectInvitation,
} from "@/hooks/useOrganizations/useOrganizations";
import { useSession, useSignOut } from "@/hooks/useSession/useSession";
import { ApiError } from "@/utils/apiError/apiError";
import { writeStorage } from "@/utils/storage/storage";
import { LAST_ORG_KEY } from "@/utils/storage/storage.constants";

/** Invitación a una organización: se ve quién invita, a qué y con qué rol, y se acepta o se rechaza. */
export function InvitationCard({ invitationId }: InvitationCardProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const invitation = useInvitation(invitationId);
	const accept = useAcceptInvitation();
	const reject = useRejectInvitation();
	const session = useSession();
	const signOut = useSignOut();

	if (invitation.isPending) return <Skeleton className="h-24 w-full" />;

	if (invitation.isError) {
		const wrongAccount =
			invitation.error instanceof ApiError && invitation.error.status === 403;
		return (
			<div className="space-y-4" data-testid="invitation-error">
				<Alert variant="error">
					{wrongAccount
						? t("invitation.wrongAccount", {
								email: session.data?.user.email ?? "",
							})
						: t("invitation.notFound")}
				</Alert>
				<div className="flex gap-2">
					{wrongAccount && (
						<Button
							onClick={() =>
								signOut.mutate(undefined, {
									onSuccess: () =>
										navigate({
											href: `/login?redirect=${encodeURIComponent(`/accept-invitation/${invitationId}`)}`,
										}),
								})
							}
						>
							{t("invitation.switchAccount")}
						</Button>
					)}
					<Button onClick={() => navigate({ to: "/" })}>
						{t("invitation.goHome")}
					</Button>
				</div>
			</div>
		);
	}

	const data = invitation.data;
	if (data.status !== "pending") {
		return <Alert variant="error">{t("invitation.notPending")}</Alert>;
	}

	const failure = accept.error ?? reject.error;
	return (
		<div className="space-y-5" data-testid="invitation-card">
			<p className="text-sm text-foreground">
				{t("invitation.description", {
					inviter: data.inviterEmail,
					organization: data.organizationName,
					role: data.role
						? t(
								`members.roles.${(["owner", "admin", "member"].includes(data.role) ? data.role : "member") as "owner" | "admin" | "member"}`,
							)
						: t("members.roles.member"),
				})}
			</p>
			{failure && <Alert variant="error">{t("common.genericError")}</Alert>}
			<div className="flex gap-2">
				<Button
					variant="primary"
					loading={accept.isPending}
					onClick={() =>
						accept.mutate(invitationId, {
							onSuccess: () => {
								writeStorage(LAST_ORG_KEY, data.organizationSlug);
								navigate({
									to: "/$orgSlug",
									params: { orgSlug: data.organizationSlug },
								});
							},
						})
					}
				>
					{t("invitation.accept")}
				</Button>
				<Button
					loading={reject.isPending}
					onClick={() =>
						reject.mutate(invitationId, {
							onSuccess: () => navigate({ to: "/" }),
						})
					}
				>
					{t("invitation.decline")}
				</Button>
			</div>
		</div>
	);
}
