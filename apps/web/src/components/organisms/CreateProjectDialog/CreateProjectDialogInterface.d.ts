import type { ProjectDto } from "@sentinel/shared";

export interface CreateProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	orgId: string;
	onCreated: (project: ProjectDto) => void;
}
