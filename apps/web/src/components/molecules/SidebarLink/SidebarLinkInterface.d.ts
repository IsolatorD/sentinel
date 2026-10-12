import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SidebarLinkProps = Omit<LinkProps, "children"> & {
	icon: LucideIcon;
	children: ReactNode;
	className?: string;
	/** Modo mini: solo el icono (el texto queda para lectores de pantalla y como título). */
	collapsed?: boolean;
};
