import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn/cn";

export function Skeleton({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			aria-hidden
			className={cn("animate-pulse rounded bg-border/70", className)}
			{...props}
		/>
	);
}
