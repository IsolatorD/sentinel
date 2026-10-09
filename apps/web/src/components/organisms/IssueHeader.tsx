import type { IssueDetailDto } from "@sentinel/shared";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation as useI18n, useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { LevelBadge } from "@/components/molecules/LevelBadge";
import { Modal } from "@/components/molecules/Modal";
import { RelativeTime } from "@/components/molecules/RelativeTime";
import { StatBlock } from "@/components/molecules/StatBlock";
import { StatusBadge } from "@/components/molecules/StatusBadge";
import {
	type ReadyScope,
	useDeleteIssue,
	useUpdateIssueStatus,
} from "@/hooks/use-issues";
import { formatCompact } from "@/lib/time";

export interface IssueHeaderProps {
	issue: IssueDetailDto;
	scope: ReadyScope;
	orgSlug: string;
	projectSlug: string;
}

export function IssueHeader({
	issue,
	scope,
	orgSlug,
	projectSlug,
}: IssueHeaderProps) {
	const { t } = useTranslation();
	const { i18n } = useI18n();
	const navigate = useNavigate();
	const update = useUpdateIssueStatus(scope, issue.id);
	const remove = useDeleteIssue(scope, issue.id);
	const [confirming, setConfirming] = useState(false);

	return (
		<Card className="p-5" data-testid="issue-header">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2">
						<LevelBadge level={issue.level} />
						<StatusBadge status={issue.status} />
					</div>
					<h1 className="text-xl font-semibold break-words text-foreground">
						{issue.title}
					</h1>
					{issue.culprit && (
						<p className="mt-1 font-mono text-sm text-muted">{issue.culprit}</p>
					)}
				</div>
				<div className="flex shrink-0 flex-wrap gap-2">
					{issue.status === "unresolved" ? (
						<>
							<Button
								variant="primary"
								loading={update.isPending}
								onClick={() => update.mutate("resolved")}
							>
								<CheckCircle2 className="size-4" />
								{t("issue.actions.resolve")}
							</Button>
							<Button
								loading={update.isPending}
								onClick={() => update.mutate("ignored")}
							>
								<EyeOff className="size-4" />
								{t("issue.actions.ignore")}
							</Button>
						</>
					) : (
						<Button
							loading={update.isPending}
							onClick={() => update.mutate("unresolved")}
						>
							<RotateCcw className="size-4" />
							{t("issue.actions.reopen")}
						</Button>
					)}
					<Button
						variant="danger-outline"
						aria-label={t("issue.actions.delete")}
						onClick={() => setConfirming(true)}
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			</div>

			<div className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-border pt-4">
				<StatBlock label={t("issue.stats.events")}>
					{formatCompact(issue.eventCount, i18n.language)}
				</StatBlock>
				<StatBlock label={t("issue.stats.users")}>
					{formatCompact(issue.userCount, i18n.language)}
				</StatBlock>
				<StatBlock label={t("issue.stats.firstSeen")}>
					<RelativeTime
						date={issue.firstSeen}
						className="text-sm font-medium"
					/>
				</StatBlock>
				<StatBlock label={t("issue.stats.lastSeen")}>
					<RelativeTime date={issue.lastSeen} className="text-sm font-medium" />
				</StatBlock>
			</div>

			<Modal
				open={confirming}
				onOpenChange={setConfirming}
				title={t("issue.deleteDialog.title")}
				description={t("issue.deleteDialog.description")}
				footer={
					<>
						<Button onClick={() => setConfirming(false)}>
							{t("common.cancel")}
						</Button>
						<Button
							variant="danger"
							loading={remove.isPending}
							onClick={() =>
								remove.mutate(undefined, {
									onSuccess: () =>
										navigate({
											to: "/$orgSlug/projects/$projectSlug/issues",
											params: { orgSlug, projectSlug },
										}),
								})
							}
						>
							{t("issue.actions.delete")}
						</Button>
					</>
				}
			/>
		</Card>
	);
}
