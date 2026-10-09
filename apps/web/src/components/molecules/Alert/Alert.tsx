import type { ReactNode } from "react";
import { STYLES } from "@/components/molecules/Alert/Alert.constants";
import { cn } from "@/utils/cn/cn";

export function Alert({
	variant = "info",
	children,
	className,
}: {
	variant?: keyof typeof STYLES;
	children: ReactNode;
	className?: string;
}) {
	const { box, Icon } = STYLES[variant];
	return (
		<div
			role={variant === "error" ? "alert" : "status"}
			className={cn(
				"flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
				box,
				className,
			)}
		>
			<Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
			<div>{children}</div>
		</div>
	);
}
