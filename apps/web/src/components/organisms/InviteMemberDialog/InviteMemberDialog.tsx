import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Input } from "@/components/atoms/Input/Input";
import { Select } from "@/components/atoms/Select/Select";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { Modal } from "@/components/molecules/Modal/Modal";
import { EMAIL } from "@/components/organisms/InviteMemberDialog/InviteMemberDialog.constants";
import type { InviteMemberDialogProps } from "@/components/organisms/InviteMemberDialog/InviteMemberDialogInterface";
import { useInviteMember } from "@/hooks/useOrganizations/useOrganizations";
import { ApiError } from "@/utils/apiError/apiError";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";
import { ASSIGNABLE_ROLES } from "@/utils/invitation/invitation.constants";
import type { AssignableRole } from "@/utils/invitation/invitationInterface";

export function InviteMemberDialog({
	open,
	onOpenChange,
	orgId,
}: InviteMemberDialogProps) {
	const { t } = useTranslation();
	const invite = useInviteMember(orgId);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<AssignableRole>("member");
	const [error, setError] = useState<string>();

	function onSubmit(event: FormEvent) {
		event.preventDefault();
		const trimmed = email.trim();
		if (!EMAIL.test(trimmed)) return setError(t("auth.validation.email"));
		setError(undefined);
		invite.mutate(
			{ email: trimmed, role },
			{ onSuccess: () => onOpenChange(false) },
		);
	}

	const failure = invite.error;
	const message =
		failure instanceof ApiError
			? failure.status === 403
				? t("members.forbidden")
				: /already/i.test(failure.message)
					? t("members.invite.alreadyInvited")
					: apiErrorText(failure, t("common.genericError"))
			: failure
				? t("common.genericError")
				: null;

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={t("members.invite.title")}
			description={t("members.invite.description")}
		>
			<form
				onSubmit={onSubmit}
				noValidate
				className="space-y-4"
				data-testid="invite-member-form"
			>
				{message && <Alert variant="error">{message}</Alert>}
				<FormField
					label={t("members.invite.email")}
					htmlFor="invite-email"
					error={error}
				>
					<Input
						id="invite-email"
						type="email"
						autoComplete="off"
						value={email}
						onChange={(e) => {
							setEmail(e.target.value);
							setError(undefined);
						}}
						invalid={Boolean(error)}
						autoFocus
					/>
				</FormField>
				<FormField label={t("members.invite.role")} htmlFor="invite-role">
					<Select
						id="invite-role"
						value={role}
						onChange={(e) => setRole(e.target.value as AssignableRole)}
					>
						{ASSIGNABLE_ROLES.map((id) => (
							<option key={id} value={id}>
								{t(`members.roles.${id}`)}
							</option>
						))}
					</Select>
				</FormField>
				<div className="flex justify-end gap-2">
					<Button onClick={() => onOpenChange(false)}>
						{t("common.cancel")}
					</Button>
					<Button type="submit" variant="primary" loading={invite.isPending}>
						{t("members.invite.send")}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
