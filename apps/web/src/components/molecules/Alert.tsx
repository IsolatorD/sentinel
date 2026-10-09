import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn/cn";

const STYLES = {
	error: { box: "border-danger/30 bg-danger/5 text-danger", Icon: AlertCircle },
	success: {
		box: "border-success/30 bg-success/10 text-success",
		Icon: CheckCircle2,
	},
	info: { box: "border-info/30 bg-info/5 text-info", Icon: Info },
} as const;

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
