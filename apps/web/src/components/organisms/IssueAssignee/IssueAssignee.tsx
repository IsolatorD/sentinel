import { useTranslation } from "react-i18next";
import { Select } from "@/components/atoms/Select/Select";
import type { IssueAssigneeProps } from "@/components/organisms/IssueAssignee/IssueAssigneeInterface";
import { useUpdateIssueStatus } from "@/hooks/useIssues/useIssues";
import { useMembers } from "@/hooks/useOrganizations/useOrganizations";

/** Responsable del issue: cualquier miembro puede cambiarlo. */
export function IssueAssignee({ issue, scope }: IssueAssigneeProps) {
	const { t } = useTranslation();
	const members = useMembers(scope.orgId);
	const update = useUpdateIssueStatus(scope, issue.id);
	const current = issue.assignee;
	const list = members.data ?? [];
	// Si quien está asignado ya no aparece en la lista (p. ej. aún carga), se conserva como opción.
	const includesCurrent = !current || list.some((m) => m.userId === current.id);

	return (
		<div data-tour="issue-assignee">
			<Select
				aria-label={t("issue.assignee.label")}
				className="w-48 text-sm font-normal"
				value={current?.id ?? ""}
				disabled={update.isPending}
				onChange={(e) => update.mutate({ assigneeId: e.target.value || null })}
			>
				<option value="">{t("issue.assignee.unassigned")}</option>
				{current && !includesCurrent && (
					<option value={current.id}>{current.name}</option>
				)}
				{list.map((m) => (
					<option key={m.userId} value={m.userId}>
						{m.user.name}
					</option>
				))}
			</Select>
		</div>
	);
}
