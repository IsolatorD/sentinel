import type { ReactNode } from "react";

export interface ModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	children?: ReactNode;
	footer?: ReactNode;
}
