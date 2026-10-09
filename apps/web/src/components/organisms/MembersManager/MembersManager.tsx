import { MailPlus, RotateCw, UserMinus, Users, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/atoms/Avatar/Avatar";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Button } from "@/components/atoms/Button/Button";
import { Select } from "@/components/atoms/Select/Select";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { Alert } from "@/components/molecules/Alert/Alert";
import { EmptyState } from "@/components/molecules/EmptyState/EmptyState";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { Modal } from "@/components/molecules/Modal/Modal";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import { Section } from "@/components/molecules/Section/Section";
import { InviteMemberDialog } from "@/components/organisms/InviteMemberDialog/InviteMemberDialog";
import {
	isAdminRole,
	LOCKED_ROLE,
} from "@/components/organisms/MembersManager/MembersManager.constants";
import type { MembersManagerProps } from "@/components/organisms/MembersManager/MembersManagerInterface";
import {
	useCancelInvitation,
	useInvitations,
	useInviteMember,
	useMembers,
	useRemoveMember,
	useUpdateMemberRole,
} from "@/hooks/useOrganizations/useOrganizations";
import { ApiError } from "@/utils/apiError/apiError";
import { ASSIGNABLE_ROLES } from "@/utils/invitation/invitation.constants";
import type { AssignableRole } from "@/utils/invitation/invitationInterface";
import type { OrgMember } from "@/utils/member/memberInterface";

export function MembersManager({ orgId, currentUserId }: MembersManagerProps) {
	const { t } = useTranslation();
	const members = useMembers(orgId);
	const invitations = useInvitations(orgId);
	const updateRole = useUpdateMemberRole(orgId);
	const remove = useRemoveMember(orgId);
	const resend = useInviteMember(orgId);
	const cancel = useCancelInvitation(orgId);
	const [inviting, setInviting] = useState(false);
	const [toRemove, setToRemove] = useState<OrgMember>();

	if (members.isError) {
		return (
			<ErrorState
				title={t("members.loadError")}
				onRetry={() => members.refetch()}
			/>
		);
	}

	const me = members.data?.find((m) => m.userId === currentUserId);
	const canManage = me ? isAdminRole(me.role) : false;
	const failure = [updateRole, remove, resend, cancel].find((m) => m.isError);
	const roleLabel = (role: string) => {
		const key = role.split(",")[0].trim();
		return ["owner", "admin", "member"].includes(key)
			? t(`members.roles.${key as "owner" | "admin" | "member"}`)
			: role;
	};

	return (
		<div className="space-y-5">
			{failure && (
				<Alert variant="error">
					{failure.error instanceof ApiError && failure.error.status === 403
						? t("members.forbidden")
						: t("common.genericError")}
				</Alert>
			)}

			<Section
				title={t("members.title")}
				flush
				action={
					canManage && (
						<Button
							variant="primary"
							size="sm"
							onClick={() => setInviting(true)}
						>
							<MailPlus className="size-4" />
							{t("members.invite.button")}
						</Button>
					)
				}
			>
				{!members.data ? (
					<div className="space-y-3 p-5">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
					</div>
				) : (
					<ul className="divide-y divide-border" data-testid="member-list">
						{members.data.map((m) => {
							const isMe = m.userId === currentUserId;
							const locked = m.role.split(",").includes(LOCKED_ROLE);
							return (
								<li
									key={m.id}
									className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
									data-testid="member-row"
								>
									<Avatar name={m.user.name} rounded="full" />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="truncate text-sm font-medium text-foreground">
												{m.user.name}
											</span>
											{isMe && <Badge>{t("members.you")}</Badge>}
										</div>
										<p className="truncate text-xs text-muted">
											{m.user.email}
										</p>
									</div>
									<div className="text-xs text-muted">
										{t("members.joined")}{" "}
										<RelativeTime date={m.createdAt.toISOString()} />
									</div>
									{canManage && !locked && !isMe ? (
										<Select
											className="w-32"
											aria-label={`${t("members.changeRole")} ${m.user.name}`}
											value={m.role}
											disabled={updateRole.isPending}
											onChange={(e) =>
												updateRole.mutate({
													memberId: m.id,
													role: e.target.value as AssignableRole,
												})
											}
										>
											{ASSIGNABLE_ROLES.map((id) => (
												<option key={id} value={id}>
													{t(`members.roles.${id}`)}
												</option>
											))}
										</Select>
									) : (
										<Badge tone={locked ? "primary" : "neutral"}>
											{roleLabel(m.role)}
										</Badge>
									)}
									{canManage && !locked && !isMe && (
										<Button
											size="sm"
											variant="danger-outline"
											aria-label={`${t("members.remove")} ${m.user.name}`}
											onClick={() => setToRemove(m)}
										>
											<UserMinus className="size-3.5" />
										</Button>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</Section>

			{canManage && (
				<Section title={t("members.pending.title")} flush>
					{invitations.isError ? (
						<div className="p-5">
							<Alert variant="error">{t("members.pending.loadError")}</Alert>
						</div>
					) : !invitations.data ? (
						<div className="p-5">
							<Skeleton className="h-4 w-full" />
						</div>
					) : invitations.data.length === 0 ? (
						<EmptyState
							icon={Users}
							title={t("members.pending.empty.title")}
							description={t("members.pending.empty.description")}
						/>
					) : (
						<ul
							className="divide-y divide-border"
							data-testid="invitation-list"
						>
							{invitations.data.map((inv) => (
								<li
									key={inv.id}
									className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
									data-testid="invitation-row"
								>
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm font-medium text-foreground">
											{inv.email}
										</div>
										<p className="text-xs text-muted">
											{inv.role ? roleLabel(inv.role) : ""} ·{" "}
											{t("members.pending.expires")}{" "}
											<RelativeTime date={inv.expiresAt.toISOString()} />
										</p>
									</div>
									<span className="flex gap-1.5">
										<Button
											size="sm"
											loading={
												resend.isPending &&
												resend.variables?.email === inv.email
											}
											onClick={() =>
												resend.mutate({
													email: inv.email,
													role: (inv.role ?? "member") as AssignableRole,
													resend: true,
												})
											}
										>
											<RotateCw className="size-3.5" />
											{t("members.pending.resend")}
										</Button>
										<Button
											size="sm"
											variant="danger-outline"
											aria-label={`${t("members.pending.cancel")} ${inv.email}`}
											onClick={() => cancel.mutate(inv.id)}
										>
											<X className="size-3.5" />
										</Button>
									</span>
								</li>
							))}
						</ul>
					)}
					{resend.isSuccess && (
						<div className="border-t border-border p-3">
							<Alert variant="success">{t("members.pending.resent")}</Alert>
						</div>
					)}
				</Section>
			)}

			{inviting && (
				<InviteMemberDialog
					open
					onOpenChange={(open) => !open && setInviting(false)}
					orgId={orgId}
				/>
			)}
			<Modal
				open={Boolean(toRemove)}
				onOpenChange={(open) => !open && setToRemove(undefined)}
				title={t("members.removeDialog.title", {
					name: toRemove?.user.name ?? "",
				})}
				description={t("members.removeDialog.description")}
				footer={
					<>
						<Button onClick={() => setToRemove(undefined)}>
							{t("common.cancel")}
						</Button>
						<Button
							variant="danger"
							loading={remove.isPending}
							onClick={() =>
								toRemove &&
								remove.mutate(toRemove.id, {
									onSettled: () => setToRemove(undefined),
								})
							}
						>
							{t("members.remove")}
						</Button>
					</>
				}
			/>
		</div>
	);
}
