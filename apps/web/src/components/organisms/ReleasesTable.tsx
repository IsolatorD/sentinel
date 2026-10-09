import type { ReleaseDto } from "@sentinel/shared";
import { Link } from "@tanstack/react-router";
import { Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Skeleton } from "@/components/atoms/Skeleton";
import { Alert } from "@/components/molecules/Alert";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ErrorState } from "@/components/molecules/ErrorState";
import { Modal } from "@/components/molecules/Modal";
import { RelativeTime } from "@/components/molecules/RelativeTime";
import { ReleaseFilesDialog } from "@/components/organisms/ReleaseFilesDialog";
import { useDeleteRelease, useReleases } from "@/hooks/use-releases";
import { useCurrentProject } from "@/hooks/use-scope";
import { ApiError } from "@/lib/api-error";
import { formatCompact } from "@/lib/time";

export function ReleasesTable() {
	const { t, i18n } = useTranslation();
	const { organization, project, scope } = useCurrentProject();
	const releases = useReleases(scope);
	const remove = useDeleteRelease({
		orgId: scope.orgId ?? "",
		projectId: scope.projectId ?? "",
	});
	const [toDelete, setToDelete] = useState<ReleaseDto>();
	const [filesOf, setFilesOf] = useState<string>();

	if (!organization || !project) return null;
	if (releases.isError)
		return (
			<ErrorState
				title={t("releases.loadError")}
				onRetry={() => releases.refetch()}
			/>
		);

	return (
		<div className="space-y-3">
			{remove.isError && (
				<Alert variant="error">
					{remove.error instanceof ApiError && remove.error.status === 403
						? t("releases.forbidden")
						: t("common.genericError")}
				</Alert>
			)}
			<Card className="overflow-x-auto">
				{releases.data?.length === 0 ? (
					<EmptyState
						icon={Rocket}
						title={t("releases.empty.title")}
						description={t("releases.empty.description")}
					/>
				) : (
					<table
						className="w-full text-left text-sm"
						data-testid="releases-table"
					>
						<thead>
							<tr className="border-b border-border bg-subtle/70 text-[11px] tracking-wide text-faint uppercase">
								<th className="px-5 py-2 font-medium">
									{t("releases.columns.version")}
								</th>
								<th className="px-3 py-2 font-medium">
									{t("releases.columns.created")}
								</th>
								<th className="px-3 py-2 text-right font-medium">
									{t("releases.columns.events")}
								</th>
								<th className="px-3 py-2 text-right font-medium">
									{t("releases.columns.newIssues")}
								</th>
								<th className="px-3 py-2 text-right font-medium">
									{t("releases.columns.files")}
								</th>
								<th className="px-5 py-2" />
							</tr>
						</thead>
						<tbody>
							{!releases.data
								? [0, 1, 2].map((i) => (
										<tr key={i} className="border-b border-border">
											<td colSpan={6} className="px-5 py-3">
												<Skeleton className="h-4 w-full" />
											</td>
										</tr>
									))
								: releases.data.map((r) => (
										<tr
											key={r.version}
											className="border-b border-border last:border-b-0 hover:bg-primary-soft/40"
											data-testid="release-row"
										>
											<td className="px-5 py-2.5 font-mono text-sm font-semibold">
												{r.version}
											</td>
											<td className="px-3 py-2.5 whitespace-nowrap">
												<RelativeTime date={r.createdAt} />
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums">
												{formatCompact(r.eventCount, i18n.language)}
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums">
												{r.newIssueCount > 0 ? (
													<Link
														to="/$orgSlug/projects/$projectSlug/issues"
														params={{
															orgSlug: organization.slug,
															projectSlug: project.slug,
														}}
														search={{ release: r.version, status: "all" }}
														className="font-medium text-primary hover:underline"
													>
														{r.newIssueCount}
													</Link>
												) : (
													0
												)}
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums">
												<button
													type="button"
													aria-label={`${t("releases.files.open")} ${r.version}`}
													onClick={() => setFilesOf(r.version)}
													className="rounded px-1.5 py-0.5 font-medium text-primary hover:bg-primary-soft hover:underline"
												>
													{r.artifactCount}
												</button>
											</td>
											<td className="px-5 py-2.5 text-right">
												<Button
													size="sm"
													variant="ghost"
													aria-label={`${t("releases.delete")} ${r.version}`}
													onClick={() => setToDelete(r)}
												>
													<Trash2 className="size-3.5" />
												</Button>
											</td>
										</tr>
									))}
						</tbody>
					</table>
				)}
			</Card>
			<ReleaseFilesDialog
				version={filesOf}
				onClose={() => setFilesOf(undefined)}
			/>
			<Modal
				open={Boolean(toDelete)}
				onOpenChange={(open) => !open && setToDelete(undefined)}
				title={t("releases.deleteDialog.title", {
					version: toDelete?.version ?? "",
				})}
				description={t("releases.deleteDialog.description")}
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
								remove.mutate(toDelete.version, {
									onSettled: () => setToDelete(undefined),
								})
							}
						>
							{t("releases.delete")}
						</Button>
					</>
				}
			/>
		</div>
	);
}
