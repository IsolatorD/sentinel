import { FileCode2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { Alert } from "@/components/molecules/Alert/Alert";
import { CodeBlock } from "@/components/molecules/CodeBlock/CodeBlock";
import { Modal } from "@/components/molecules/Modal/Modal";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import {
	useArtifacts,
	useDeleteArtifact,
} from "@/hooks/useReleases/useReleases";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { ApiError } from "@/utils/apiError/apiError";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";
import { sourceMapsUploadSnippet } from "@/utils/cliSnippets/cliSnippets";
import { formatBytes } from "@/utils/format/format";

/** Source maps de una release y cómo subir más con la CLI. */
export function ReleaseFilesDialog({
	version,
	onClose,
}: {
	/** Release abierta; `undefined` mantiene el diálogo cerrado. */
	version: string | undefined;
	onClose: () => void;
}) {
	const { t, i18n } = useTranslation();
	const { scope } = useCurrentProject();
	const artifacts = useArtifacts(scope, version);
	const remove = useDeleteArtifact(
		{ orgId: scope.orgId ?? "", projectId: scope.projectId ?? "" },
		version ?? "",
	);

	return (
		<Modal
			open={Boolean(version)}
			onOpenChange={(open) => !open && onClose()}
			title={t("releases.files.title", { version: version ?? "" })}
			description={t("releases.files.description")}
			footer={<Button onClick={onClose}>{t("common.close")}</Button>}
		>
			<div className="space-y-4">
				{remove.isError && (
					<Alert variant="error">
						{remove.error instanceof ApiError && remove.error.status === 403
							? t("releases.files.forbidden")
							: apiErrorText(remove.error, t("common.genericError"))}
					</Alert>
				)}
				{artifacts.isError ? (
					<Alert variant="error">{t("releases.files.loadError")}</Alert>
				) : !artifacts.data ? (
					<Skeleton className="h-10 w-full" />
				) : artifacts.data.length === 0 ? (
					<p className="text-sm text-muted" data-testid="no-files">
						{t("releases.files.empty")}
					</p>
				) : (
					<ul
						className="divide-y divide-border rounded-md border border-border"
						data-testid="file-list"
					>
						{artifacts.data.map((file) => (
							<li
								key={file.id}
								className="flex items-center gap-3 px-3 py-2"
								data-testid="file-row"
							>
								<FileCode2 aria-hidden className="size-4 shrink-0 text-faint" />
								<div className="min-w-0 flex-1">
									<div className="truncate font-mono text-xs text-foreground">
										{file.name}
									</div>
									<div className="text-xs text-muted">
										{formatBytes(file.size, i18n.language)} ·{" "}
										<RelativeTime date={file.createdAt} />
									</div>
								</div>
								<Button
									size="sm"
									variant="ghost"
									aria-label={`${t("releases.files.delete")} ${file.name}`}
									disabled={remove.isPending}
									onClick={() => remove.mutate(file.id)}
								>
									<Trash2 className="size-3.5" />
								</Button>
							</li>
						))}
					</ul>
				)}
				{version && scope.orgId && scope.projectId && (
					<div>
						<p className="mb-2 text-sm text-muted">
							{t("releases.files.upload")}
						</p>
						<CodeBlock
							title={t("releases.files.cli")}
							code={sourceMapsUploadSnippet({
								apiUrl: window.location.origin,
								orgId: scope.orgId,
								projectId: scope.projectId,
								release: version,
							})}
						/>
					</div>
				)}
			</div>
		</Modal>
	);
}
