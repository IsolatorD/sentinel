import { type FormEvent, type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Textarea } from "@/components/atoms/Textarea/Textarea";
import { Alert } from "@/components/molecules/Alert/Alert";
import type { CommentComposerProps } from "@/components/organisms/IssueActivity/CommentComposer/CommentComposerInterface";
import { useAddComment } from "@/hooks/useIssues/useIssues";

/** Caja para escribir un comentario nuevo. Ctrl/⌘ + Enter lo envía. */
export function CommentComposer({ scope, issueId }: CommentComposerProps) {
	const { t } = useTranslation();
	const add = useAddComment(scope, issueId);
	const [body, setBody] = useState("");
	const empty = body.trim().length === 0;

	function submit() {
		if (empty || add.isPending) return;
		add.mutate(body.trim(), { onSuccess: () => setBody("") });
	}

	function onSubmit(event: FormEvent) {
		event.preventDefault();
		submit();
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			submit();
		}
	}

	return (
		<form onSubmit={onSubmit} className="space-y-2" data-testid="comment-form">
			{add.isError && <Alert variant="error">{t("common.genericError")}</Alert>}
			<Textarea
				aria-label={t("activity.commentLabel")}
				placeholder={t("activity.placeholder")}
				value={body}
				maxLength={5000}
				onChange={(e) => setBody(e.target.value)}
				onKeyDown={onKeyDown}
			/>
			<div className="flex items-center justify-between gap-3">
				<span className="text-xs text-faint">{t("activity.shortcut")}</span>
				<Button
					type="submit"
					variant="primary"
					disabled={empty}
					loading={add.isPending}
				>
					{t("activity.comment")}
				</Button>
			</div>
		</form>
	);
}
