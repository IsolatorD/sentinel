import * as Dropdown from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/utils/cn/cn";

export function MenuLabel({
	className,
	...props
}: ComponentPropsWithoutRef<typeof Dropdown.Label>) {
	return (
		<Dropdown.Label
			className={cn(
				"px-2.5 py-1.5 text-[11px] font-medium tracking-wide text-faint uppercase",
				className,
			)}
			{...props}
		/>
	);
}
