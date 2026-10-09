import type { ChannelDto } from "@sentinel/shared";
import { Plus, Radio, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Button } from "@/components/atoms/Button/Button";
import { Card } from "@/components/atoms/Card/Card";
import { Checkbox } from "@/components/atoms/Checkbox/Checkbox";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { Alert } from "@/components/molecules/Alert/Alert";
import { EmptyState } from "@/components/molecules/EmptyState/EmptyState";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { Modal } from "@/components/molecules/Modal/Modal";
import { AlertChannelDialog } from "@/components/organisms/AlertChannelDialog/AlertChannelDialog";
import { TYPE_ICONS } from "@/components/organisms/AlertChannelsManager/AlertChannelsManager.constants";
import { SigningSecretDialog } from "@/components/organisms/SigningSecretDialog/SigningSecretDialog";
import {
	useAlertChannels,
	useDeleteChannel,
	useTestChannel,
	useUpdateChannel,
} from "@/hooks/useAlerts/useAlerts";
import type { ReadyScope } from "@/hooks/useAlerts/useAlertsInterface";
import { usePublicConfig } from "@/hooks/usePublicConfig/usePublicConfig";
import { staggerStyle } from "@/utils/animation/animation";
import { ApiError } from "@/utils/apiError/apiError";

export function AlertChannelsManager({ scope }: { scope: ReadyScope }) {
	const { t } = useTranslation();
	const channels = useAlertChannels(scope);
	const update = useUpdateChannel(scope);
	const remove = useDeleteChannel(scope);
	const test = useTestChannel(scope);
	const config = usePublicConfig();
	const [creating, setCreating] = useState(false);
	const [secret, setSecret] = useState<string>();
	const [toDelete, setToDelete] = useState<ChannelDto>();

	if (channels.isError) {
		return channels.error instanceof ApiError &&
			channels.error.status === 403 ? (
			<Alert variant="error">{t("alerts.forbidden")}</Alert>
		) : (
			<ErrorState
				title={t("alerts.channels.loadError")}
				onRetry={() => channels.refetch()}
			/>
		);
	}

	const failure = [update, remove, test].find((m) => m.isError);
	const target = (channel: ChannelDto) => {
		if (channel.maskedUrl) return channel.maskedUrl;
		if (channel.recipients?.mode === "members")
			return t("alerts.channels.nMembers", {
				count: channel.recipients.userIds.length,
			});
		return t("alerts.channels.dialog.allMembers");
	};

	return (
		<div className="space-y-3">
			<div className="flex justify-end">
				<Button variant="primary" onClick={() => setCreating(true)}>
					<Plus className="size-4" />
					{t("alerts.channels.create")}
				</Button>
			</div>
			{config.data?.emailEnabled === false && (
				<Alert variant="info">{t("alerts.channels.emailDisabled")}</Alert>
			)}
			{test.isSuccess && (
				<Alert variant="success">{t("alerts.channels.testSent")}</Alert>
			)}
			{failure && (
				<Alert variant="error">
					{failure.error instanceof ApiError && failure.error.status === 403
						? t("alerts.forbidden")
						: t("common.genericError")}
				</Alert>
			)}
			<Card>
				{!channels.data ? (
					<div className="space-y-3 p-5">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
					</div>
				) : channels.data.length === 0 ? (
					<EmptyState
						icon={Radio}
						title={t("alerts.channels.empty.title")}
						description={t("alerts.channels.empty.description")}
					/>
				) : (
					<ul className="divide-y divide-border" data-testid="channel-list">
						{channels.data.map((channel, index) => {
							const Icon = TYPE_ICONS[channel.type];
							return (
								<li
									key={channel.id}
									className="flex animate-fade-in-up flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
									style={staggerStyle(index)}
									data-testid="channel-row"
								>
									<Checkbox
										aria-label={`${t("alerts.channels.toggle")} ${channel.name}`}
										checked={channel.enabled}
										disabled={update.isPending}
										onChange={(e) =>
											update.mutate({
												channelId: channel.id,
												input: { enabled: e.target.checked },
											})
										}
									/>
									<Icon aria-hidden className="size-4 shrink-0 text-faint" />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="truncate text-sm font-medium text-foreground">
												{channel.name}
											</span>
											<Badge>
												{t(`alerts.channels.types.${channel.type}`)}
											</Badge>
											{!channel.enabled && (
												<Badge>{t("alerts.rules.disabled")}</Badge>
											)}
										</div>
										<p className="truncate font-mono text-xs text-muted">
											{target(channel)}
										</p>
									</div>
									<span className="flex gap-1.5">
										<Button
											size="sm"
											loading={test.isPending && test.variables === channel.id}
											onClick={() => test.mutate(channel.id)}
										>
											<Send className="size-3.5" />
											{t("alerts.channels.test")}
										</Button>
										<Button
											size="sm"
											variant="danger-outline"
											aria-label={`${t("alerts.channels.delete")} ${channel.name}`}
											onClick={() => setToDelete(channel)}
										>
											<Trash2 className="size-3.5" />
										</Button>
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</Card>

			{creating && (
				<AlertChannelDialog
					open
					onOpenChange={(open) => !open && setCreating(false)}
					scope={scope}
					onCreated={(channel) => setSecret(channel.signingSecret ?? undefined)}
				/>
			)}
			<SigningSecretDialog
				secret={secret}
				onClose={() => setSecret(undefined)}
			/>
			<Modal
				open={Boolean(toDelete)}
				onOpenChange={(open) => !open && setToDelete(undefined)}
				title={t("alerts.channels.deleteDialog.title", {
					name: toDelete?.name ?? "",
				})}
				description={t("alerts.channels.deleteDialog.description")}
				footer={
					<>
						<Button onClick={() => setToDelete(undefined)}>
							{t("common.cancel")}
						</Button>
						<Button
							variant="danger"
							loading={remove.isPending}
							onClick={() =>
								toDelete &&
								remove.mutate(toDelete.id, {
									onSettled: () => setToDelete(undefined),
								})
							}
						>
							{t("alerts.channels.delete")}
						</Button>
					</>
				}
			/>
		</div>
	);
}
