import { useNavigate } from "@tanstack/react-router";
import { EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation as useI18n, useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Button } from "@/components/atoms/Button/Button";
import { Card } from "@/components/atoms/Card/Card";
import { LevelBadge } from "@/components/molecules/LevelBadge/LevelBadge";
import { Modal } from "@/components/molecules/Modal/Modal";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import { ResolveButton } from "@/components/molecules/ResolveButton/ResolveButton";
import { StatBlock } from "@/components/molecules/StatBlock/StatBlock";
import { StatusBadge } from "@/components/molecules/StatusBadge/StatusBadge";
import { IssueAssignee } from "@/components/organisms/IssueAssignee/IssueAssignee";
import type { IssueHeaderProps } from "@/components/organisms/IssueHeader/IssueHeaderInterface";
import { IssueTicket } from "@/components/organisms/IssueTicket/IssueTicket";
import {
	useDeleteIssue,
	useUpdateIssueStatus,
} from "@/hooks/useIssues/useIssues";
import { useReleases } from "@/hooks/useReleases/useReleases";
import { formatCompact } from "@/utils/time/time";

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
	const releases = useReleases(scope);
	const [confirming, setConfirming] = useState(false);
	const isRegression =
		issue.status === "unresolved" && issue.regressedAt !== null;
	// Si se resolvió en función de una release, se explica cuándo volvería a abrirse.
	const resolutionNote =
		issue.status === "resolved" && issue.resolvedRelease
			? t(
					issue.resolvedInclusive
						? "issue.resolution.inRelease"
						: "issue.resolution.next",
					{
						release: issue.resolvedRelease,
					},
				)
			: undefined;

	return (
		<Card className="p-5" data-testid="issue-header" data-tour="issue-header">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="mb-2 flex items-center gap-2">
						<LevelBadge level={issue.level} />
						<StatusBadge status={issue.status} />
						{isRegression && (
							<Badge tone="warning" data-testid="regression-badge">
								{t("issue.regression.title")}
							</Badge>
						)}
					</div>
					<h1 className="text-xl font-semibold break-words text-foreground">
						{issue.title}
					</h1>
					{issue.culprit && (
						<p className="mt-1 font-mono text-sm text-muted">{issue.culprit}</p>
					)}
					{isRegression && (
						<p className="mt-2 text-sm text-warning">
							{issue.regressedInRelease
								? t("issue.regression.descriptionIn", {
										release: issue.regressedInRelease,
									})
								: t("issue.regression.description")}
						</p>
					)}
					{resolutionNote && (
						<p className="mt-2 text-sm text-muted">{resolutionNote}</p>
					)}
					<div className="mt-3">
						<IssueTicket issue={issue} scope={scope} />
					</div>
				</div>
				<div className="flex shrink-0 flex-wrap gap-2">
					{issue.status === "unresolved" ? (
						<>
							<ResolveButton
								loading={update.isPending}
								currentRelease={releases.data?.[0]?.version}
								onResolve={(resolution) =>
									update.mutate({ status: "resolved", resolution })
								}
							/>
							<Button
								loading={update.isPending}
								onClick={() => update.mutate({ status: "ignored" })}
							>
								<EyeOff className="size-4" />
								{t("issue.actions.ignore")}
							</Button>
						</>
					) : (
						<Button
							loading={update.isPending}
							onClick={() => update.mutate({ status: "unresolved" })}
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
				<StatBlock label={t("issue.assignee.label")}>
					<IssueAssignee issue={issue} scope={scope} />
				</StatBlock>
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
				{issue.firstRelease && (
					<StatBlock label={t("issue.stats.firstRelease")}>
						<span className="font-mono text-sm font-medium">
							{issue.firstRelease}
						</span>
					</StatBlock>
				)}
				{issue.lastRelease && issue.lastRelease !== issue.firstRelease && (
					<StatBlock label={t("issue.stats.lastRelease")}>
						<span className="font-mono text-sm font-medium">
							{issue.lastRelease}
						</span>
					</StatBlock>
				)}
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
