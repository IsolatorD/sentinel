import { useNavigate } from "@tanstack/react-router";
import { FolderPlus, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Card } from "@/components/atoms/Card/Card";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ErrorState } from "@/components/molecules/ErrorState";
import { ProjectCard } from "@/components/molecules/ProjectCard";
import { useProjects } from "@/hooks/useProjects/useProjects";
import { useCurrentOrganization } from "@/hooks/useScope/useScope";
import { CreateProjectDialog } from "./CreateProjectDialog";

export function ProjectsList() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { organization } = useCurrentOrganization();
	const projects = useProjects(organization?.id);
	const [creating, setCreating] = useState(false);

	if (!organization) return null;
	const createButton = (
		<Button variant="primary" onClick={() => setCreating(true)}>
			<Plus className="size-4" />
			{t("projects.create")}
		</Button>
	);

	return (
		<>
			{projects.isError ? (
				<ErrorState
					title={t("projects.loadError")}
					onRetry={() => projects.refetch()}
				/>
			) : projects.isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{[0, 1, 2].map((i) => (
						<Card key={i} className="p-4">
							<Skeleton className="h-4 w-1/2" />
							<Skeleton className="mt-3 h-3 w-1/3" />
						</Card>
					))}
				</div>
			) : projects.data?.length === 0 ? (
				<Card>
					<EmptyState
						icon={FolderPlus}
						title={t("projects.emptyTitle")}
						description={t("projects.emptyDescription")}
						action={createButton}
					/>
				</Card>
			) : (
				<>
					<div className="mb-4 flex justify-end">{createButton}</div>
					<div
						className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
						data-testid="project-grid"
					>
						{projects.data?.map((p) => (
							<ProjectCard key={p.id} project={p} orgSlug={organization.slug} />
						))}
					</div>
				</>
			)}
			<CreateProjectDialog
				open={creating}
				onOpenChange={setCreating}
				orgId={organization.id}
				onCreated={(project) => {
					setCreating(false);
					navigate({
						to: "/$orgSlug/projects/$projectSlug/settings",
						params: { orgSlug: organization.slug, projectSlug: project.slug },
					});
				}}
			/>
		</>
	);
}
