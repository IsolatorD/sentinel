import * as Dropdown from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/utils/cn/cn";

export function MenuSeparator({
	className,
	...props
}: ComponentPropsWithoutRef<typeof Dropdown.Separator>) {
	return (
		<Dropdown.Separator
			className={cn("my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}
