import type { UpdateIssueInput } from "@sentinel/shared";
import type { NoticeResolver, NoticeSpec } from "../../common/notice.js";

/**
 * Qué avisar tras cambiar un issue. Si la petición cambió estado y responsable a la vez, manda el
 * estado (un solo aviso por operación).
 */
export const issueUpdatedNotice: NoticeResolver = ({
	request,
	result,
}): NoticeSpec | undefined => {
	const body = (request.body ?? {}) as Partial<UpdateIssueInput>;

	if (body.status === "resolved") {
		if (body.resolution?.type === "release")
			return {
				code: "NOTICE_ISSUE_RESOLVED_IN",
				params: { release: body.resolution.release },
			};
		if (body.resolution?.type === "next_release")
			return { code: "NOTICE_ISSUE_RESOLVED_NEXT" };
		return { code: "NOTICE_ISSUE_RESOLVED" };
	}
	if (body.status === "ignored") return { code: "NOTICE_ISSUE_IGNORED" };
	if (body.status === "unresolved") return { code: "NOTICE_ISSUE_REOPENED" };

	if (body.assigneeId !== undefined) {
		const assignee = (result as { assignee?: { name: string } | null })
			?.assignee;
		return assignee
			? { code: "NOTICE_ISSUE_ASSIGNED", params: { name: assignee.name } }
			: { code: "NOTICE_ISSUE_UNASSIGNED" };
	}
	return undefined;
};
