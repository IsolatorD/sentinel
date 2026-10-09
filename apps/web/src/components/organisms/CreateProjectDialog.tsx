import type { ProjectDto } from "@sentinel/shared";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/molecules/Modal/Modal";
import { CreateProjectForm } from "./CreateProjectForm";

export interface CreateProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	orgId: string;
	onCreated: (project: ProjectDto) => void;
}

export function CreateProjectDialog({
	open,
	onOpenChange,
	orgId,
	onCreated,
}: CreateProjectDialogProps) {
	const { t } = useTranslation();
	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={t("projects.createDialog.title")}
		>
			<CreateProjectForm
				orgId={orgId}
				onCreated={onCreated}
				onCancel={() => onOpenChange(false)}
			/>
		</Modal>
	);
}
