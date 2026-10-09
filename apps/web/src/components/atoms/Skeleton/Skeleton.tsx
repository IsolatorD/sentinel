import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn/cn";

export function Skeleton({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div aria-hidden className={cn("skeleton rounded", className)} {...props} />
	);
}
