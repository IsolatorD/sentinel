import {
	CHANNEL_TYPES,
	type ChannelType,
	type CreateChannelInput,
	checkWebhookUrl,
} from "@sentinel/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Checkbox } from "@/components/atoms/Checkbox/Checkbox";
import { Input } from "@/components/atoms/Input/Input";
import { Select } from "@/components/atoms/Select/Select";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { Modal } from "@/components/molecules/Modal/Modal";
import type {
	AlertChannelDialogProps,
	ChannelFormErrors,
} from "@/components/organisms/AlertChannelDialog/AlertChannelDialogInterface";
import { useCreateChannel } from "@/hooks/useAlerts/useAlerts";
import { useMembers } from "@/hooks/useOrganizations/useOrganizations";
import { ApiError } from "@/utils/apiError/apiError";

export function AlertChannelDialog({
	open,
	onOpenChange,
	scope,
	onCreated,
}: AlertChannelDialogProps) {
	const { t } = useTranslation();
	const create = useCreateChannel(scope);
	const members = useMembers(scope.orgId);
	const [type, setType] = useState<ChannelType>("email");
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const [mode, setMode] = useState<"all" | "members">("all");
	const [userIds, setUserIds] = useState<string[]>([]);
	const [errors, setErrors] = useState<ChannelFormErrors>({});

	/** Un error deja de mostrarse en cuanto el usuario toca el campo. */
	const clearError = (field: keyof ChannelFormErrors) =>
		setErrors((current) => ({ ...current, [field]: undefined }));

	function toggleMember(id: string) {
		clearError("recipients");
		setUserIds((current) =>
			current.includes(id) ? current.filter((u) => u !== id) : [...current, id],
		);
	}

	function onSubmit(event: FormEvent) {
		event.preventDefault();
		const next: ChannelFormErrors = {};
		const trimmed = name.trim();
		if (!trimmed) next.name = t("auth.validation.required");
		if (
			type !== "email" &&
			!checkWebhookUrl(url.trim(), { allowPrivate: true }).ok
		)
			next.url = t("alerts.channels.dialog.urlInvalid");
		if (type === "email" && mode === "members" && userIds.length === 0)
			next.recipients = t("alerts.channels.dialog.recipientsRequired");
		setErrors(next);
		if (Object.keys(next).length > 0) return;

		const input: CreateChannelInput =
			type === "email"
				? {
						type,
						name: trimmed,
						recipients: mode === "all" ? { mode } : { mode, userIds },
					}
				: { type, name: trimmed, url: url.trim() };
		create.mutate(input, {
			onSuccess: (channel) => {
				onOpenChange(false);
				onCreated(channel);
			},
		});
	}

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={t("alerts.channels.dialog.title")}
		>
			<form
				onSubmit={onSubmit}
				noValidate
				className="space-y-4"
				data-testid="alert-channel-form"
			>
				{create.isError && (
					<Alert variant="error">
						{create.error instanceof ApiError && create.error.status === 403
							? t("alerts.forbidden")
							: create.error instanceof ApiError && create.error.status === 400
								? create.error.message
								: t("common.genericError")}
					</Alert>
				)}
				<FormField
					label={t("alerts.channels.dialog.type")}
					htmlFor="channel-type"
				>
					<Select
						id="channel-type"
						value={type}
						onChange={(e) => setType(e.target.value as ChannelType)}
					>
						{CHANNEL_TYPES.map((id) => (
							<option key={id} value={id}>
								{t(`alerts.channels.types.${id}`)}
							</option>
						))}
					</Select>
				</FormField>
				<FormField
					label={t("alerts.channels.dialog.name")}
					htmlFor="channel-name"
					error={errors.name}
				>
					<Input
						id="channel-name"
						value={name}
						onChange={(e) => {
							setName(e.target.value);
							clearError("name");
						}}
						invalid={Boolean(errors.name)}
						maxLength={60}
						autoFocus
					/>
				</FormField>
				{type === "email" ? (
					<fieldset>
						<legend className="mb-1 text-xs font-medium text-muted">
							{t("alerts.channels.dialog.recipients")}
						</legend>
						<div className="space-y-2 rounded-md border border-border p-3">
							<label className="flex cursor-pointer items-center gap-2 text-sm">
								<input
									type="radio"
									name="recipients-mode"
									className="accent-primary"
									checked={mode === "all"}
									onChange={() => setMode("all")}
								/>
								{t("alerts.channels.dialog.allMembers")}
							</label>
							<label className="flex cursor-pointer items-center gap-2 text-sm">
								<input
									type="radio"
									name="recipients-mode"
									className="accent-primary"
									checked={mode === "members"}
									onChange={() => setMode("members")}
								/>
								{t("alerts.channels.dialog.selectedMembers")}
							</label>
							{mode === "members" && (
								<div className="ml-6 space-y-1.5">
									{(members.data ?? []).map((m) => (
										<label
											key={m.userId}
											className="flex cursor-pointer items-center gap-2 text-sm"
										>
											<Checkbox
												checked={userIds.includes(m.userId)}
												onChange={() => toggleMember(m.userId)}
											/>
											<span className="truncate">{m.user.name}</span>
											<span className="truncate text-xs text-faint">
												{m.user.email}
											</span>
										</label>
									))}
								</div>
							)}
						</div>
						{errors.recipients && (
							<p role="alert" className="mt-1 text-xs text-danger">
								{errors.recipients}
							</p>
						)}
					</fieldset>
				) : (
					<FormField
						label={t("alerts.channels.dialog.url")}
						htmlFor="channel-url"
						hint={t(`alerts.channels.dialog.urlHint.${type}`)}
						error={errors.url}
					>
						<Input
							id="channel-url"
							type="url"
							value={url}
							onChange={(e) => {
								setUrl(e.target.value);
								clearError("url");
							}}
							invalid={Boolean(errors.url)}
							placeholder="https://"
						/>
					</FormField>
				)}
				<div className="flex justify-end gap-2">
					<Button onClick={() => onOpenChange(false)}>
						{t("common.cancel")}
					</Button>
					<Button type="submit" variant="primary" loading={create.isPending}>
						{t("common.create")}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
