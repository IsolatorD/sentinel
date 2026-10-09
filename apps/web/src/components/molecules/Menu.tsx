import * as Dropdown from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/utils/cn/cn";

export const Menu = Dropdown.Root;
export const MenuTrigger = Dropdown.Trigger;

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
