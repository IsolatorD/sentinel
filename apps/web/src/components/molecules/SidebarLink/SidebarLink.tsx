import { Link } from "@tanstack/react-router";
import type { SidebarLinkProps } from "@/components/molecules/SidebarLink/SidebarLinkInterface";
import { cn } from "@/utils/cn/cn";

export function SidebarLink({
	icon: Icon,
	children,
	className,
	collapsed = false,
	...props
}: SidebarLinkProps) {
	return (
		<Link
			className={cn(
				"flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-white",
				collapsed && "justify-center px-0",
				className,
			)}
			title={collapsed && typeof children === "string" ? children : undefined}
			activeProps={{ className: "bg-sidebar-active !text-white" }}
			{...props}
		>
			<Icon aria-hidden className="size-4 shrink-0" />
			<span className={cn("truncate", collapsed && "sr-only")}>{children}</span>
		</Link>
	);
}
