import type { ReactNode } from "react";

export interface DocSectionProps {
	id: string;
	title: string;
	intro?: string;
	children: ReactNode;
}
