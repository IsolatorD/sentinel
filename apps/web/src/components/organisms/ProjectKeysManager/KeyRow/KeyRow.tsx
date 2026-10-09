import type { ProjectKeyDto } from "@sentinel/shared";
import { KeyRound, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Button } from "@/components/atoms/Button/Button";
import { CopyButton } from "@/components/molecules/CopyButton/CopyButton";

export function KeyRow({
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
