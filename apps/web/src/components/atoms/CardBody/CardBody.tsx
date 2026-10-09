import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn/cn";

export function CardBody({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("p-5", className)} {...props} />;
}
