import { useTranslation } from "react-i18next";
import { Modal } from "@/components/molecules/Modal/Modal";
import type { CreateProjectDialogProps } from "@/components/organisms/CreateProjectDialog/CreateProjectDialogInterface";
import { CreateProjectForm } from "@/components/organisms/CreateProjectForm/CreateProjectForm";

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
