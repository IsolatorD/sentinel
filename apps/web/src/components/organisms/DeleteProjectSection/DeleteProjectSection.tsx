import type { ProjectDto } from "@sentinel/shared";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Card } from "@/components/atoms/Card/Card";
import { CardBody } from "@/components/atoms/CardBody/CardBody";
import { Input } from "@/components/atoms/Input/Input";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { Modal } from "@/components/molecules/Modal/Modal";
import { useDeleteProject } from "@/hooks/useProjects/useProjects";
import { ApiError } from "@/utils/apiError/apiError";

export function DeleteProjectSection({
	project,
	orgId,
	orgSlug,
}: {
	project: ProjectDto;
	orgId: string;
	orgSlug: string;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const remove = useDeleteProject(orgId, project.id);
	const [open, setOpen] = useState(false);
	const [typed, setTyped] = useState("");

	return (
		<Card className="border-danger/30">
			<CardBody className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h3 className="text-sm font-semibold text-danger">
						{t("settings.danger.title")}
					</h3>
					<p className="mt-1 text-sm text-muted">
						{t("settings.danger.description")}
					</p>
				</div>
				<Button variant="danger-outline" onClick={() => setOpen(true)}>
					{t("settings.danger.delete")}
				</Button>
			</CardBody>
			<Modal
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) setTyped("");
				}}
				title={t("settings.danger.dialogTitle")}
				description={t("settings.danger.dialogDescription")}
				footer={
					<>
						<Button onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
						<Button
							variant="danger"
							disabled={typed !== project.name}
							loading={remove.isPending}
							onClick={() =>
								remove.mutate(undefined, {
									onSuccess: () =>
										navigate({ to: "/$orgSlug/projects", params: { orgSlug } }),
								})
							}
						>
							{t("settings.danger.delete")}
						</Button>
					</>
				}
			>
				{remove.isError && (
					<Alert variant="error" className="mb-3">
						{remove.error instanceof ApiError && remove.error.status === 403
							? t("settings.forbidden")
							: t("common.genericError")}
					</Alert>
				)}
				<FormField
					label={t("settings.danger.confirmLabel")}
					htmlFor="confirm-name"
					hint={project.name}
				>
					<Input
						id="confirm-name"
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
						autoComplete="off"
					/>
				</FormField>
			</Modal>
		</Card>
	);
}
