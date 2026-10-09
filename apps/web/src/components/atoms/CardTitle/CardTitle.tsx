import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn/cn";

export function CardTitle({
	className,
	...props
}: HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h3
			className={cn("text-sm font-semibold text-foreground", className)}
			{...props}
		/>
	);
}
