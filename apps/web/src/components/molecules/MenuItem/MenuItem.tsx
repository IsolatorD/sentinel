import * as Dropdown from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/utils/cn/cn";

export function MenuItem({
	className,
	...props
}: ComponentPropsWithoutRef<typeof Dropdown.Item>) {
	return (
		<Dropdown.Item
			className={cn(
				"flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary",
				className,
			)}
			{...props}
		/>
	);
}
