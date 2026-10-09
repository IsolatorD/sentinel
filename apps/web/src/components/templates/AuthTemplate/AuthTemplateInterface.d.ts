import type { ReactNode } from "react";

export interface AuthTemplateProps {
	title: string;
	subtitle?: string;
	children: ReactNode;
	footer?: ReactNode;
	/** Más ancho, para pasos con contenido (onboarding). */
	wide?: boolean;
}
