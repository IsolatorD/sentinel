import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button";
import { EmptyState } from "./EmptyState";

export function ErrorState({
	title,
	onRetry,
}: {
	title?: string;
	onRetry?: () => void;
}) {
	const { t } = useTranslation();
	return (
		<EmptyState
			icon={AlertTriangle}
			title={title ?? t("common.genericError")}
			description={t("common.genericErrorHint")}
			action={onRetry && <Button onClick={onRetry}>{t("common.retry")}</Button>}
		/>
	);
}
