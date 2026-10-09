import { Link } from "@tanstack/react-router";
import type { SidebarLinkProps } from "@/components/molecules/SidebarLink/SidebarLinkInterface";
import { cn } from "@/utils/cn/cn";

export function SidebarLink({
	icon: Icon,
	children,
	className,
	...props
}: SidebarLinkProps) {
	return (
		<Link
			className={cn(
				"flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-white",
				className,
			)}
			activeProps={{ className: "bg-sidebar-active !text-white" }}
			{...props}
		>
			<Icon aria-hidden className="size-4 shrink-0" />
			{children}
		</Link>
	);
}
