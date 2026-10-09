import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button";

export function CopyButton({
	value,
	label,
	className,
}: {
	value: string;
	label?: string;
	className?: string;
}) {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			clearTimeout(timer.current);
			timer.current = setTimeout(() => setCopied(false), 1_500);
		} catch {
			// Sin permiso de portapapeles: no hay nada más que hacer.
		}
	}

	return (
		<Button
			variant="secondary"
			size="sm"
			onClick={copy}
			className={className}
			aria-label={label ?? t("common.copy")}
		>
			{copied ? (
				<Check className="size-3.5 text-success" />
			) : (
				<Copy className="size-3.5" />
			)}
			{copied ? t("common.copied") : (label ?? t("common.copy"))}
		</Button>
	);
}
