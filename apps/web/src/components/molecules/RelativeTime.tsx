import { useTranslation } from "react-i18next";
import { formatDateTime, formatRelative } from "@/lib/time";

/** "hace 3 horas", con la fecha completa como tooltip. */
export function RelativeTime({
	date,
	className,
}: {
	date: string;
	className?: string;
}) {
	const { i18n } = useTranslation();
	return (
		<time
			dateTime={date}
			title={formatDateTime(date, i18n.language)}
			className={className}
		>
			{formatRelative(date, i18n.language)}
		</time>
	);
}
