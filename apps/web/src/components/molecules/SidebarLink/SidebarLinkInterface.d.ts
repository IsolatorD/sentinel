import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SidebarLinkProps = Omit<LinkProps, "children"> & {
	icon: LucideIcon;
	children: ReactNode;
	className?: string;
};
