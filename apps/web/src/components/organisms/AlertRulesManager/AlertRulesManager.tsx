import type { RuleDto } from "@sentinel/shared";
import { Bell, Pencil, Plus, Trash2 } from "lucide-react";
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
import { AlertRuleDialog } from "@/components/organisms/AlertRuleDialog/AlertRuleDialog";
import {
	useAlertChannels,
	useAlertRules,
	useDeleteRule,
	useUpdateRule,
} from "@/hooks/useAlerts/useAlerts";
import type { ReadyScope } from "@/hooks/useAlerts/useAlertsInterface";
import { ApiError } from "@/utils/apiError/apiError";
import { describeMinutes } from "@/utils/duration/duration";

export function AlertRulesManager({ scope }: { scope: ReadyScope }) {
	const { t } = useTranslation();
	const rules = useAlertRules(scope);
	const channels = useAlertChannels(scope);
	const update = useUpdateRule(scope);
	const remove = useDeleteRule(scope);
	// `undefined`: cerrado; `null`: creando; una regla: editándola.
	const [editing, setEditing] = useState<RuleDto | null>();
	const [toDelete, setToDelete] = useState<RuleDto>();

	if (rules.isError) {
		return rules.error instanceof ApiError && rules.error.status === 403 ? (
			<Alert variant="error">{t("alerts.forbidden")}</Alert>
		) : (
			<ErrorState
				title={t("alerts.rules.loadError")}
				onRetry={() => rules.refetch()}
			/>
		);
	}

	const channelList = channels.data ?? [];
	const channelName = (id: string) =>
		channelList.find((c) => c.id === id)?.name ?? "—";
	const duration = (minutes: number) => {
		const { unit, count } = describeMinutes(minutes);
		return t(`alerts.duration.${unit}`, { count });
	};
	const summary = (rule: RuleDto) =>
		rule.trigger === "frequency" && rule.threshold && rule.windowMinutes
			? t("alerts.rules.summary.frequency", {
					count: rule.threshold,
					window: duration(rule.windowMinutes),
				})
			: t(`alerts.rules.summary.${rule.trigger}`);
	const failure = [update, remove].find((m) => m.isError);

	return (
		<div className="space-y-3">
			<div className="flex justify-end">
				<Button
					variant="primary"
					disabled={channelList.length === 0}
					onClick={() => setEditing(null)}
				>
					<Plus className="size-4" />
					{t("alerts.rules.create")}
				</Button>
			</div>
			{channelList.length === 0 && channels.isSuccess && (
				<Alert variant="info">{t("alerts.rules.needChannel")}</Alert>
			)}
			{failure && (
				<Alert variant="error">
					{failure.error instanceof ApiError && failure.error.status === 403
						? t("alerts.forbidden")
						: t("common.genericError")}
				</Alert>
			)}
			<Card>
				{!rules.data ? (
					<div className="space-y-3 p-5">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
					</div>
				) : rules.data.length === 0 ? (
					<EmptyState
						icon={Bell}
						title={t("alerts.rules.empty.title")}
						description={t("alerts.rules.empty.description")}
					/>
				) : (
					<ul className="divide-y divide-border" data-testid="rule-list">
						{rules.data.map((rule) => (
							<li
								key={rule.id}
								className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
								data-testid="rule-row"
							>
								<Checkbox
									aria-label={`${t("alerts.rules.toggle")} ${rule.name}`}
									checked={rule.enabled}
									disabled={update.isPending}
									onChange={(e) =>
										update.mutate({
											ruleId: rule.id,
											input: { enabled: e.target.checked },
										})
									}
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="truncate text-sm font-medium text-foreground">
											{rule.name}
										</span>
										{!rule.enabled && (
											<Badge>{t("alerts.rules.disabled")}</Badge>
										)}
									</div>
									<p className="text-xs text-muted">
										{summary(rule)}
										{rule.environment && ` · ${rule.environment}`}
										{rule.minLevel &&
											` · ${t("alerts.rules.levelFrom", { level: t(`issues.levels.${rule.minLevel}`) })}`}
									</p>
									<p className="text-xs text-faint">
										{t("alerts.rules.notifies")}{" "}
										{rule.channelIds.map(channelName).join(", ")}
									</p>
								</div>
								<span className="flex gap-1.5">
									<Button
										size="sm"
										aria-label={`${t("alerts.rules.edit")} ${rule.name}`}
										onClick={() => setEditing(rule)}
									>
										<Pencil className="size-3.5" />
									</Button>
									<Button
										size="sm"
										variant="danger-outline"
										aria-label={`${t("alerts.rules.delete")} ${rule.name}`}
										onClick={() => setToDelete(rule)}
									>
										<Trash2 className="size-3.5" />
									</Button>
								</span>
							</li>
						))}
					</ul>
				)}
			</Card>

			{editing !== undefined && (
				<AlertRuleDialog
					key={editing?.id ?? "new"}
					open
					onOpenChange={(open) => !open && setEditing(undefined)}
					scope={scope}
					channels={channelList}
					rule={editing ?? undefined}
				/>
			)}
			<Modal
				open={Boolean(toDelete)}
				onOpenChange={(open) => !open && setToDelete(undefined)}
				title={t("alerts.rules.deleteDialog.title", {
					name: toDelete?.name ?? "",
				})}
				description={t("alerts.rules.deleteDialog.description")}
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
							{t("alerts.rules.delete")}
						</Button>
					</>
				}
			/>
		</div>
	);
}
