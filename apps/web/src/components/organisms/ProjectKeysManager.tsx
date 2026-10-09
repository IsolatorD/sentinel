import type { ProjectDto, ProjectKeyDto } from "@sentinel/shared";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Button } from "@/components/atoms/Button/Button";
import { Input } from "@/components/atoms/Input/Input";
import { Alert } from "@/components/molecules/Alert/Alert";
import { CopyButton } from "@/components/molecules/CopyButton/CopyButton";
import { Modal } from "@/components/molecules/Modal/Modal";
import { Section } from "@/components/molecules/Section/Section";
import {
	useCreateKey,
	useDeleteKey,
	useUpdateKey,
} from "@/hooks/useProjects/useProjects";
import { ApiError } from "@/utils/apiError/apiError";

function KeyRow({
	keyData,
	onToggle,
	onDelete,
	busy,
}: {
	keyData: ProjectKeyDto;
	onToggle: () => void;
	onDelete: () => void;
	busy: boolean;
}) {
	const { t } = useTranslation();
	return (
		<li className="py-3 first:pt-0 last:pb-0" data-testid="key-row">
			<div className="flex flex-wrap items-center gap-2">
				<KeyRound aria-hidden className="size-4 text-faint" />
				<span className="text-sm font-medium text-foreground">
					{keyData.label}
				</span>
				<Badge tone={keyData.isActive ? "success" : "neutral"}>
					{keyData.isActive
						? t("settings.keys.active")
						: t("settings.keys.revoked")}
				</Badge>
				<span className="ml-auto flex gap-1.5">
					<Button size="sm" disabled={busy} onClick={onToggle}>
						{keyData.isActive
							? t("settings.keys.revoke")
							: t("settings.keys.enable")}
					</Button>
					<Button
						size="sm"
						variant="danger-outline"
						disabled={busy}
						aria-label={t("settings.keys.delete")}
						onClick={onDelete}
					>
						<Trash2 className="size-3.5" />
					</Button>
				</span>
			</div>
			<div className="mt-2 flex items-center gap-2">
				<code className="min-w-0 flex-1 truncate rounded border border-border bg-subtle px-2 py-1.5 font-mono text-xs text-foreground">
					{keyData.dsn}
				</code>
				<CopyButton value={keyData.dsn} />
			</div>
		</li>
	);
}

export function ProjectKeysManager({
	project,
	orgId,
}: {
	project: ProjectDto;
	orgId: string;
}) {
	const { t } = useTranslation();
	const create = useCreateKey(orgId, project.id);
	const update = useUpdateKey(orgId, project.id);
	const remove = useDeleteKey(orgId, project.id);
	const [label, setLabel] = useState("");
	const [toDelete, setToDelete] = useState<ProjectKeyDto>();
	const keys = project.keys ?? [];
	const failure = [create, update, remove].find((m) => m.isError)?.error;
	const busy = update.isPending || remove.isPending;

	function onCreate(event: FormEvent) {
		event.preventDefault();
		create.mutate(
			{ label: label.trim() || t("settings.keys.defaultLabel") },
			{ onSuccess: () => setLabel("") },
		);
	}

	return (
		<Section title={t("settings.keys.title")}>
			<p className="mb-4 text-sm text-muted">
				{t("settings.keys.description")}
			</p>
			{failure && (
				<Alert variant="error" className="mb-4">
					{failure instanceof ApiError && failure.status === 403
						? t("settings.forbidden")
						: t("common.genericError")}
				</Alert>
			)}
			<ul className="divide-y divide-border">
				{keys.map((k) => (
					<KeyRow
						key={k.id}
						keyData={k}
						busy={busy}
						onToggle={() =>
							update.mutate({ keyId: k.id, input: { isActive: !k.isActive } })
						}
						onDelete={() => setToDelete(k)}
					/>
				))}
			</ul>
			<form
				onSubmit={onCreate}
				className="mt-4 flex gap-2 border-t border-border pt-4"
			>
				<Input
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder={t("settings.keys.label")}
					aria-label={t("settings.keys.label")}
					className="max-w-xs"
				/>
				<Button type="submit" loading={create.isPending}>
					<Plus className="size-4" />
					{t("settings.keys.create")}
				</Button>
			</form>
			<Modal
				open={Boolean(toDelete)}
				onOpenChange={(open) => !open && setToDelete(undefined)}
				title={t("settings.keys.delete")}
				description={t("settings.keys.deleteConfirm")}
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
								remove.mutate(toDelete.id, {
									onSuccess: () => setToDelete(undefined),
								})
							}
						>
							{t("settings.keys.delete")}
						</Button>
					</>
				}
			/>
		</Section>
	);
}
