import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button";

export interface PaginationProps {
	offset: number;
	limit: number;
	total: number;
	onChange: (offset: number) => void;
}

export function Pagination({
	offset,
	limit,
	total,
	onChange,
}: PaginationProps) {
	const { t } = useTranslation();
	if (total === 0) return null;
	const from = offset + 1;
	const to = Math.min(offset + limit, total);

	return (
		<nav
			aria-label={t("issues.pagination.label")}
			className="flex items-center justify-between gap-3 text-xs text-muted"
		>
			<span>{t("issues.pagination.showing", { from, to, total })}</span>
			<span className="flex gap-2">
				<Button
					size="sm"
					disabled={offset <= 0}
					onClick={() => onChange(Math.max(0, offset - limit))}
				>
					<ChevronLeft className="size-3.5" />
					{t("issues.pagination.previous")}
				</Button>
				<Button
					size="sm"
					disabled={offset + limit >= total}
					onClick={() => onChange(offset + limit)}
				>
					{t("issues.pagination.next")}
					<ChevronRight className="size-3.5" />
				</Button>
			</span>
		</nav>
	);
}
