import type { ReactNode } from "react";

export interface CollapseProps {
	open: boolean;
	children: ReactNode;
	className?: string;
}
