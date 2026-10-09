import * as Dropdown from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/utils/cn/cn";

export function MenuContent({
	className,
	sideOffset = 6,
	...props
}: ComponentPropsWithoutRef<typeof Dropdown.Content>) {
	return (
		<Dropdown.Portal>
			<Dropdown.Content
				sideOffset={sideOffset}
				className={cn(
					"z-50 min-w-56 rounded-lg border border-border bg-surface p-1 text-sm text-foreground shadow-lg",
					className,
				)}
				{...props}
			/>
		</Dropdown.Portal>
	);
}
