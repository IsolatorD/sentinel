import type { ProjectDto } from "@sentinel/shared";

export interface CreateProjectFormProps {
	orgId: string;
	onCreated: (project: ProjectDto) => void;
	onCancel?: () => void;
	placeholder?: string;
}
