import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { CopyButton } from "@/components/molecules/CopyButton/CopyButton";
import { Modal } from "@/components/molecules/Modal/Modal";
import type { SigningSecretDialogProps } from "@/components/organisms/SigningSecretDialog/SigningSecretDialogInterface";

/** Muestra una sola vez el secreto con el que se firman los envíos de un webhook. */
export function SigningSecretDialog({
	secret,
	onClose,
}: SigningSecretDialogProps) {
	const { t } = useTranslation();
	return (
		<Modal
			open={Boolean(secret)}
			onOpenChange={(open) => !open && onClose()}
			title={t("alerts.channels.secretDialog.title")}
			description={t("alerts.channels.secretDialog.description")}
			footer={
				<Button variant="primary" onClick={onClose}>
					{t("alerts.channels.secretDialog.done")}
				</Button>
			}
		>
			<div className="flex items-center gap-2">
				<code
					className="min-w-0 flex-1 truncate rounded border border-border bg-subtle px-2 py-1.5 font-mono text-xs text-foreground"
					data-testid="signing-secret"
				>
					{secret}
				</code>
				<CopyButton value={secret ?? ""} />
			</div>
			<p className="mt-3 text-xs text-muted">
				{t("alerts.channels.secretDialog.verify")}
			</p>
		</Modal>
	);
}
