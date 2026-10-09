import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn/cn";

export function CardHeader({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("border-b border-border px-5 py-3.5", className)}
			{...props}
		/>
	);
}
