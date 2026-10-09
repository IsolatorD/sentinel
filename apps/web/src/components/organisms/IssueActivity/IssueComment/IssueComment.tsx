import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/atoms/Avatar/Avatar";
import { Button } from "@/components/atoms/Button/Button";
import { Textarea } from "@/components/atoms/Textarea/Textarea";
import { Alert } from "@/components/molecules/Alert/Alert";
import { Modal } from "@/components/molecules/Modal/Modal";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import type { IssueCommentProps } from "@/components/organisms/IssueActivity/IssueComment/IssueCommentInterface";
import { useDeleteComment, useEditComment } from "@/hooks/useIssues/useIssues";

export function IssueComment({
	comment,
	scope,
	issueId,
	currentUserId,
	canModerate,
}: IssueCommentProps) {
	const { t } = useTranslation();
	const edit = useEditComment(scope, issueId);
	const remove = useDeleteComment(scope, issueId);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(comment.body ?? "");
	const [confirming, setConfirming] = useState(false);
	const author = comment.actor;
	const isAuthor = author?.id === currentUserId;
	const name = author?.name ?? t("activity.someone");

	function save() {
		const body = draft.trim();
		if (!body) return;
		edit.mutate(
			{ commentId: comment.id, body },
			{ onSuccess: () => setEditing(false) },
		);
	}

	return (
		<li className="flex gap-3 py-3" data-testid="comment">
			<Avatar name={name} rounded="full" />
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-x-2 text-sm">
					<span className="font-medium text-foreground">{name}</span>
					<RelativeTime
						date={comment.createdAt}
						className="text-xs text-faint"
					/>
					{comment.editedAt && (
						<span className="text-xs text-faint">({t("activity.edited")})</span>
					)}
					{(isAuthor || canModerate) && !editing && (
						<span className="ml-auto flex gap-1">
							{isAuthor && (
								<Button
									size="sm"
									variant="ghost"
									aria-label={t("activity.edit")}
									onClick={() => {
										setDraft(comment.body ?? "");
										setEditing(true);
									}}
								>
									<Pencil className="size-3.5" />
								</Button>
							)}
							<Button
								size="sm"
								variant="ghost"
								aria-label={t("activity.delete")}
								onClick={() => setConfirming(true)}
							>
								<Trash2 className="size-3.5" />
							</Button>
						</span>
					)}
				</div>
				{editing ? (
					<div className="mt-2 space-y-2">
						{edit.isError && (
							<Alert variant="error">{t("common.genericError")}</Alert>
						)}
						<Textarea
							aria-label={t("activity.edit")}
							value={draft}
							maxLength={5000}
							onChange={(e) => setDraft(e.target.value)}
						/>
						<div className="flex justify-end gap-2">
							<Button size="sm" onClick={() => setEditing(false)}>
								{t("common.cancel")}
							</Button>
							<Button
								size="sm"
								variant="primary"
								disabled={draft.trim().length === 0}
								loading={edit.isPending}
								onClick={save}
							>
								{t("common.save")}
							</Button>
						</div>
					</div>
				) : (
					<p className="mt-1 text-sm break-words whitespace-pre-wrap text-foreground">
						{comment.body}
					</p>
				)}
			</div>
			<Modal
				open={confirming}
				onOpenChange={setConfirming}
				title={t("activity.deleteDialog.title")}
				description={t("activity.deleteDialog.description")}
				footer={
					<>
						<Button onClick={() => setConfirming(false)}>
							{t("common.cancel")}
						</Button>
						<Button
							variant="danger"
							loading={remove.isPending}
							onClick={() =>
								remove.mutate(comment.id, {
									onSettled: () => setConfirming(false),
								})
							}
						>
							{t("activity.delete")}
						</Button>
					</>
				}
			/>
		</li>
	);
}
